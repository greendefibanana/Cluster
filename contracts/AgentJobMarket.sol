// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/security/ReentrancyGuard.sol";
import {Pausable} from "@openzeppelin/contracts/security/Pausable.sol";
import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {IERC721} from "@openzeppelin/contracts/token/ERC721/IERC721.sol";
import {AgentNFT} from "./AgentNFT.sol";
import {SwarmNFT} from "./SwarmNFT.sol";
import {PerformanceRank} from "./PerformanceRank.sol";

contract AgentJobMarket is ReentrancyGuard, Pausable, Ownable {
    using SafeERC20 for IERC20;

    enum JobStatus {
        Open,
        Funded,
        Submitted,
        Completed,
        Rejected,
        Expired
    }

    enum ProviderKind {
        Agent,
        Swarm
    }

    struct Job {
        address client;
        address evaluator;
        uint256 budget;
        uint256 expiredAt;
        ProviderKind providerKind;
        uint256 providerId;
        JobStatus status;
        string description;
        string deliverable;
    }

    IERC20 public immutable paymentToken;
    AgentNFT public immutable agentCollection;
    SwarmNFT public immutable swarmCollection;
    PerformanceRank public immutable performanceRank;

    uint256 public nextJobId = 1;
    mapping(uint256 => Job) public jobs;
    mapping(uint256 => uint256[]) internal _creditedAgentIds;

    event JobCreated(
        uint256 indexed jobId,
        address indexed client,
        address indexed evaluator,
        ProviderKind providerKind,
        uint256 providerId,
        uint256 budget
    );
    event JobFunded(uint256 indexed jobId, uint256 budget);
    event JobSubmitted(uint256 indexed jobId, string deliverable);
    event JobCompleted(uint256 indexed jobId, address payoutRecipient, string reason);
    event JobRejected(uint256 indexed jobId, string reason);
    event JobRefunded(uint256 indexed jobId);

    constructor(
        address paymentTokenAddress,
        address agentCollectionAddress,
        address swarmCollectionAddress,
        address performanceRankAddress
    ) {
        paymentToken = IERC20(paymentTokenAddress);
        agentCollection = AgentNFT(agentCollectionAddress);
        swarmCollection = SwarmNFT(swarmCollectionAddress);
        performanceRank = PerformanceRank(performanceRankAddress);
        _transferOwnership(msg.sender);
    }

    function pause() external onlyOwner {
        _pause();
    }

    function unpause() external onlyOwner {
        _unpause();
    }

    function createAgentJob(
        uint256 agentId,
        address evaluator,
        uint256 budget,
        uint256 expiredAt,
        string calldata description
    ) external whenNotPaused returns (uint256 jobId) {
        require(evaluator != address(0), "invalid evaluator");
        require(evaluator != msg.sender, "evaluator cannot be client");
        require(expiredAt > block.timestamp, "invalid expiry");
        require(budget > 0, "budget zero");
        require(agentCollection.ownerOf(agentId) != address(0), "agent does not exist");
        require(agentCollection.tbas(agentId) != address(0), "agent has no tba");

        jobId = nextJobId++;
        Job storage job = jobs[jobId];
        job.client = msg.sender;
        job.evaluator = evaluator;
        job.budget = budget;
        job.expiredAt = expiredAt;
        job.providerKind = ProviderKind.Agent;
        job.providerId = agentId;
        job.status = JobStatus.Open;
        job.description = description;
        _creditedAgentIds[jobId].push(agentId);

        emit JobCreated(jobId, msg.sender, evaluator, ProviderKind.Agent, agentId, budget);
    }

    function createSwarmJob(
        uint256 swarmId,
        address evaluator,
        uint256 budget,
        uint256 expiredAt,
        string calldata description,
        uint256[] calldata creditedAgentIds
    ) external whenNotPaused returns (uint256 jobId) {
        require(evaluator != address(0), "invalid evaluator");
        require(evaluator != msg.sender, "evaluator cannot be client");
        require(expiredAt > block.timestamp, "invalid expiry");
        require(budget > 0, "budget zero");
        require(creditedAgentIds.length > 0, "no credited agents");
        require(swarmCollection.ownerOf(swarmId) != address(0), "swarm does not exist");

        address swarmTba = swarmCollection.tbas(swarmId);
        require(swarmTba != address(0), "swarm has no tba");

        jobId = nextJobId++;
        Job storage job = jobs[jobId];
        job.client = msg.sender;
        job.evaluator = evaluator;
        job.budget = budget;
        job.expiredAt = expiredAt;
        job.providerKind = ProviderKind.Swarm;
        job.providerId = swarmId;
        job.status = JobStatus.Open;
        job.description = description;

        for (uint256 i = 0; i < creditedAgentIds.length; i++) {
            uint256 creditedAgentId = creditedAgentIds[i];
            for (uint256 j = 0; j < i; j++) {
                require(creditedAgentIds[j] != creditedAgentId, "duplicate credited agent");
            }
            require(agentCollection.ownerOf(creditedAgentId) == swarmTba, "credited agent not in swarm");
            _creditedAgentIds[jobId].push(creditedAgentId);
        }

        emit JobCreated(jobId, msg.sender, evaluator, ProviderKind.Swarm, swarmId, budget);
    }

    function fund(uint256 jobId, uint256 expectedBudget) external nonReentrant whenNotPaused {
        Job storage job = jobs[jobId];
        require(job.client == msg.sender, "not client");
        require(job.status == JobStatus.Open, "job not open");
        require(job.budget == expectedBudget, "budget mismatch");

        job.status = JobStatus.Funded;
        paymentToken.safeTransferFrom(msg.sender, address(this), job.budget);
        emit JobFunded(jobId, job.budget);
    }

    function submit(uint256 jobId, string calldata deliverable) external whenNotPaused {
        Job storage job = jobs[jobId];
        require(job.status == JobStatus.Funded, "job not funded");
        require(block.timestamp < job.expiredAt, "job expired");
        require(_isProviderAuthorized(job), "not provider");
        require(bytes(deliverable).length > 0, "empty deliverable");

        job.status = JobStatus.Submitted;
        job.deliverable = deliverable;
        emit JobSubmitted(jobId, deliverable);
    }

    function complete(uint256 jobId, string calldata reason) external nonReentrant {
        Job storage job = jobs[jobId];
        require(job.evaluator == msg.sender, "not evaluator");
        require(job.status == JobStatus.Submitted, "job not submitted");

        job.status = JobStatus.Completed;
        address payoutRecipient = _providerRecipient(job);
        paymentToken.safeTransfer(payoutRecipient, job.budget);
        _creditScores(jobId, job);

        emit JobCompleted(jobId, payoutRecipient, reason);
    }

    function reject(uint256 jobId, string calldata reason) external nonReentrant {
        Job storage job = jobs[jobId];

        if (job.status == JobStatus.Open) {
            require(job.client == msg.sender, "not client");
            job.status = JobStatus.Rejected;
            emit JobRejected(jobId, reason);
            return;
        }

        require(job.evaluator == msg.sender, "not evaluator");
        require(job.status == JobStatus.Funded || job.status == JobStatus.Submitted, "job not rejectable");
        job.status = JobStatus.Rejected;
        paymentToken.safeTransfer(job.client, job.budget);
        emit JobRejected(jobId, reason);
    }

    function claimRefund(uint256 jobId) external nonReentrant {
        Job storage job = jobs[jobId];
        require(
            job.status == JobStatus.Funded || job.status == JobStatus.Submitted,
            "job not refundable"
        );
        require(block.timestamp >= job.expiredAt, "job not expired");
        require(msg.sender == job.client, "not client");

        job.status = JobStatus.Expired;
        paymentToken.safeTransfer(job.client, job.budget);
        emit JobRefunded(jobId);
    }

    function getCreditedAgentIds(uint256 jobId) external view returns (uint256[] memory) {
        return _creditedAgentIds[jobId];
    }

    function providerRecipient(uint256 jobId) external view returns (address) {
        Job storage job = jobs[jobId];
        return _providerRecipient(job);
    }

    function _isProviderAuthorized(Job storage job) internal view returns (bool) {
        if (job.providerKind == ProviderKind.Agent) {
            return agentCollection.ownerOf(job.providerId) == msg.sender;
        }
        return swarmCollection.ownerOf(job.providerId) == msg.sender;
    }

    function _providerRecipient(Job storage job) internal view returns (address) {
        if (job.providerKind == ProviderKind.Agent) {
            return agentCollection.tbas(job.providerId);
        }
        return swarmCollection.tbas(job.providerId);
    }

    function _creditScores(uint256 jobId, Job storage job) internal {
        if (job.providerKind == ProviderKind.Agent) {
            performanceRank.increaseScore(job.providerId, 10, "erc8183 completion");
            return;
        }

        uint256[] storage creditedAgentIds = _creditedAgentIds[jobId];
        for (uint256 i = 0; i < creditedAgentIds.length; i++) {
            performanceRank.increaseScore(creditedAgentIds[i], 4, "swarm erc8183 completion");
        }
    }
}
