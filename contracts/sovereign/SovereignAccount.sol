// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/security/ReentrancyGuard.sol";
import {ECDSA} from "@openzeppelin/contracts/utils/cryptography/ECDSA.sol";
import {SovereignPermissionModule} from "./SovereignPermissionModule.sol";
import {SovereignExecutionModule} from "./SovereignExecutionModule.sol";
import {TemporaryExecutionRights} from "./TemporaryExecutionRights.sol";
import {SovereignAccountRegistry} from "./SovereignAccountRegistry.sol";
import {ISovereignAdapter} from "./interfaces/ISovereignAdapter.sol";

interface ICrossChainIntentEngine {
    function createIntent(
        uint256 sourceChainId,
        uint256 targetChainId,
        address asset,
        uint256 amount,
        bytes32 strategyType,
        address adapter,
        address userSovereignAccount,
        bytes32 riskConstraints,
        string calldata proofURI
    ) external returns (bytes32 intentId);
}

contract SovereignAccount is
    ReentrancyGuard,
    SovereignPermissionModule,
    SovereignExecutionModule,
    TemporaryExecutionRights
{
    using SafeERC20 for IERC20;
    using ECDSA for bytes32;

    struct PolicyProof {
        bytes32 strategyId;
        bytes32 policyDecisionHash;
        string proofURI;
        uint256 expiresAt;
        bytes signature;
    }

    address public immutable factory;
    SovereignAccountRegistry public registry;
    bytes32 public accountId;
    string public label;
    address public policyValidator;

    mapping(address => uint256) public balances;
    mapping(bytes32 => bool) public consumedPolicyApprovals;

    event SovereignDeposited(address indexed asset, uint256 amount);
    event SovereignWithdrawn(address indexed asset, uint256 amount, address indexed receiver);
    event CrossChainIntentOpened(bytes32 indexed intentId, uint256 indexed targetChainId, address indexed adapter, string proofURI);
    event EmergencyExit(address indexed asset, uint256 amount, address indexed receiver);
    event OwnershipTransferred(address indexed previousOwner, address indexed newOwner);
    event PolicyValidatorSet(address indexed previousValidator, address indexed newValidator);
    event PolicyProofConsumed(
        bytes32 indexed approvalDigest,
        bytes32 indexed strategyId,
        bytes32 indexed policyDecisionHash,
        address executor,
        string proofURI
    );

    constructor() {
        factory = msg.sender;
    }

    function initialize(
        address accountOwner,
        address accountRegistry,
        bytes32 newAccountId,
        string calldata accountLabel,
        uint256 allocationLimit,
        uint256 slippageLimitBps,
        string calldata profile,
        address[] calldata adapters,
        uint256[] calldata chains
    ) external {
        require(msg.sender == factory, "not factory");
        require(owner == address(0), "initialized");
        require(accountOwner != address(0), "invalid owner");
        require(accountRegistry != address(0), "invalid registry");
        owner = accountOwner;
        policyValidator = accountOwner;
        registry = SovereignAccountRegistry(accountRegistry);
        accountId = newAccountId;
        label = accountLabel;
        _setRiskLimits(allocationLimit, slippageLimitBps, profile);
        _setPaused(false);
        for (uint256 i = 0; i < adapters.length; i++) {
            _setAdapterPermission(adapters[i], true);
        }
        for (uint256 i = 0; i < chains.length; i++) {
            _setChainPermission(chains[i], true);
        }
        emit OwnershipTransferred(address(0), accountOwner);
        emit PolicyValidatorSet(address(0), accountOwner);
    }

    function transferOwnership(address newOwner) external onlyOwner {
        require(newOwner != address(0), "invalid owner");
        address oldOwner = owner;
        owner = newOwner;
        if (policyValidator == oldOwner) {
            policyValidator = newOwner;
            emit PolicyValidatorSet(oldOwner, newOwner);
        }
        emit OwnershipTransferred(oldOwner, newOwner);
    }

    function deposit(address asset, uint256 amount) external onlyOwner nonReentrant {
        require(asset != address(0), "invalid asset");
        require(amount > 0, "amount zero");
        IERC20(asset).safeTransferFrom(msg.sender, address(this), amount);
        balances[asset] += amount;
        emit SovereignDeposited(asset, amount);
        _logAction(msg.sender, "deposit", "");
    }

    function depositNative() external payable onlyOwner nonReentrant {
        require(msg.value > 0, "amount zero");
        balances[address(0)] += msg.value;
        emit SovereignDeposited(address(0), msg.value);
        _logAction(msg.sender, "deposit_native", "");
    }

    function withdraw(address asset, uint256 amount) external onlyOwner nonReentrant {
        require(amount > 0, "amount zero");
        require(balances[asset] >= amount, "insufficient accounting");
        balances[asset] -= amount;
        if (asset == address(0)) {
            (bool success,) = payable(owner).call{value: amount}("");
            require(success, "native transfer failed");
        } else {
            IERC20(asset).safeTransfer(owner, amount);
        }
        emit SovereignWithdrawn(asset, amount, owner);
        _logAction(msg.sender, "withdraw", "");
    }

    function pause() external onlyOwner {
        _setPaused(true);
    }

    function resume() external onlyOwner {
        _setPaused(false);
    }

    function approveAgent(address agent) external onlyOwner {
        _setAgentPermission(agent, true);
    }

    function revokeAgent(address agent) external onlyOwner {
        _setAgentPermission(agent, false);
    }

    function approveCluster(address cluster) external onlyOwner {
        _setClusterPermission(cluster, true);
    }

    function revokeCluster(address cluster) external onlyOwner {
        _setClusterPermission(cluster, false);
    }

    function approveAdapter(address adapter) external onlyOwner {
        _setAdapterPermission(adapter, true);
    }

    function removeAdapter(address adapter) external onlyOwner {
        _setAdapterPermission(adapter, false);
    }

    function setChainPermission(uint256 chainId, bool approved) external onlyOwner {
        _setChainPermission(chainId, approved);
    }

    function setRiskLimits(uint256 allocationLimit, uint256 slippageLimitBps, string calldata profile) external onlyOwner {
        _setRiskLimits(allocationLimit, slippageLimitBps, profile);
    }

    function setPolicyValidator(address newValidator) external onlyOwner {
        require(newValidator != address(0), "invalid validator");
        address previousValidator = policyValidator;
        policyValidator = newValidator;
        emit PolicyValidatorSet(previousValidator, newValidator);
    }

    function subscribeStrategy(bytes32 strategyId) external onlyOwner {
        _setStrategySubscription(strategyId, true);
    }

    function closeStrategy(bytes32 strategyId) external onlyOwner {
        _setStrategySubscription(strategyId, false);
    }

    function grantSessionKey(
        bytes32 sessionKey,
        address executor,
        address adapter,
        uint256 chainId,
        uint256 ttlSeconds,
        uint256 quota
    ) external onlyOwner {
        require(approvedAdapters[adapter], "adapter not allowed");
        _grantTemporaryRight(sessionKey, executor, adapter, chainId, ttlSeconds, quota);
    }

    function revokeSessionKey(bytes32 sessionKey) external onlyOwner {
        _revokeTemporaryRight(sessionKey);
    }

    function execute(address adapter, bytes calldata data) external nonReentrant returns (bytes memory result) {
        return _executeWithPermission(adapter, data, bytes32(0), false, "");
    }

    function executeWithProof(address adapter, bytes calldata data, PolicyProof calldata proof)
        external
        nonReentrant
        returns (bytes memory result)
    {
        _consumePolicyProof(msg.sender, adapter, data, proof);
        return _executeWithPermission(adapter, data, bytes32(0), true, proof.proofURI);
    }

    function executeWithSession(address adapter, bytes calldata data, bytes32 sessionKey)
        external
        nonReentrant
        returns (bytes memory result)
    {
        return _executeWithPermission(adapter, data, sessionKey, false, "");
    }

    function executeWithSessionProof(address adapter, bytes calldata data, bytes32 sessionKey, PolicyProof calldata proof)
        external
        nonReentrant
        returns (bytes memory result)
    {
        _consumePolicyProof(msg.sender, adapter, data, proof);
        return _executeWithPermission(adapter, data, sessionKey, true, proof.proofURI);
    }

    function openCrossChainIntent(
        address intentEngine,
        uint256 targetChainId,
        address asset,
        uint256 amount,
        bytes32 strategyType,
        address adapter,
        bytes32 riskConstraints,
        string calldata proofURI
    ) external returns (bytes32 intentId) {
        require(msg.sender == owner, "policy proof required");
        intentId = _openCrossChainIntent(
            intentEngine,
            targetChainId,
            asset,
            amount,
            strategyType,
            adapter,
            riskConstraints,
            proofURI
        );
    }

    function openCrossChainIntentWithProof(
        address intentEngine,
        uint256 targetChainId,
        address asset,
        uint256 amount,
        bytes32 strategyType,
        address adapter,
        bytes32 riskConstraints,
        string calldata proofURI,
        PolicyProof calldata proof
    ) external returns (bytes32 intentId) {
        bytes memory intentData = abi.encode(
            intentEngine,
            targetChainId,
            asset,
            amount,
            strategyType,
            adapter,
            riskConstraints,
            proofURI
        );
        _consumePolicyProof(msg.sender, adapter, intentData, proof);
        require(approvedAgents[msg.sender] || approvedClusters[msg.sender], "not approved");
        intentId = _openCrossChainIntent(
            intentEngine,
            targetChainId,
            asset,
            amount,
            strategyType,
            adapter,
            riskConstraints,
            proofURI
        );
    }

    function policyApprovalDigest(
        address executor,
        address adapter,
        bytes calldata data,
        bytes32 strategyId,
        bytes32 policyDecisionHash,
        string calldata proofURI,
        uint256 expiresAt
    ) public view returns (bytes32) {
        return _policyApprovalDigest(executor, adapter, keccak256(data), strategyId, policyDecisionHash, proofURI, expiresAt);
    }

    function policyApprovalDigestForHash(
        address executor,
        address adapter,
        bytes32 dataHash,
        bytes32 strategyId,
        bytes32 policyDecisionHash,
        string calldata proofURI,
        uint256 expiresAt
    ) public view returns (bytes32) {
        return _policyApprovalDigest(executor, adapter, dataHash, strategyId, policyDecisionHash, proofURI, expiresAt);
    }

    function _openCrossChainIntent(
        address intentEngine,
        uint256 targetChainId,
        address asset,
        uint256 amount,
        bytes32 strategyType,
        address adapter,
        bytes32 riskConstraints,
        string calldata proofURI
    ) internal returns (bytes32 intentId) {
        require(!paused, "paused");
        require(intentEngine != address(0), "invalid engine");
        require(chainPermissions[targetChainId], "chain not allowed");
        require(approvedAdapters[adapter], "adapter not allowed");
        require(amount <= maxAllocation, "allocation exceeded");
        require(balances[asset] >= amount, "insufficient balance");
        intentId = ICrossChainIntentEngine(intentEngine).createIntent(
            block.chainid,
            targetChainId,
            asset,
            amount,
            strategyType,
            adapter,
            address(this),
            riskConstraints,
            proofURI
        );
        emit CrossChainIntentOpened(intentId, targetChainId, adapter, proofURI);
        _logAction(msg.sender, "cross_chain_intent", proofURI);
    }

    function emergencyExit(address asset) external onlyOwner nonReentrant {
        _setPaused(true);
        uint256 balance = asset == address(0) ? address(this).balance : IERC20(asset).balanceOf(address(this));
        balances[asset] = 0;
        if (balance > 0) {
            if (asset == address(0)) {
                (bool success,) = payable(owner).call{value: balance}("");
                require(success, "native transfer failed");
            } else {
                IERC20(asset).safeTransfer(owner, balance);
            }
        }
        emit EmergencyExit(asset, balance, owner);
        _logAction(msg.sender, "emergency_exit", "");
    }

    function _executeWithPermission(
        address adapter,
        bytes calldata data,
        bytes32 sessionKey,
        bool hasPolicyProof,
        string memory proofURI
    )
        internal
        returns (bytes memory result)
    {
        require(!paused, "paused");
        require(approvedAdapters[adapter], "adapter not allowed");
        (
            uint256 targetChainId,
            address asset,
            uint256 amount,
            address receiver,
            uint256 slippageBps,
            bytes32 action
        ) = ISovereignAdapter(adapter).previewExecution(data);
        require(chainPermissions[targetChainId], "chain not allowed");
        require(amount <= maxAllocation, "allocation exceeded");
        require(balances[asset] >= amount, "insufficient balance");
        require(slippageBps <= maxSlippageBps, "slippage exceeded");
        require(receiver == address(this) || receiver == owner, "unauthorized receiver");

        bool ownerPermission = msg.sender == owner;
        bool delegatedPermission = hasPolicyProof && (approvedAgents[msg.sender] || approvedClusters[msg.sender]);
        bool sessionPermission = hasPolicyProof && sessionKey != bytes32(0) && _consumeSessionKey(sessionKey, msg.sender, adapter, targetChainId);
        require(ownerPermission || delegatedPermission || sessionPermission, "not approved");

        result = _executeAdapter(msg.sender, adapter, targetChainId, asset, amount, action, data);
        _logAction(msg.sender, action, proofURI);
    }

    function _consumePolicyProof(
        address executor,
        address adapter,
        bytes memory data,
        PolicyProof calldata proof
    ) internal {
        require(policyValidator != address(0), "policy validator missing");
        require(proof.strategyId != bytes32(0), "strategy required");
        require(proof.policyDecisionHash != bytes32(0), "policy required");
        require(bytes(proof.proofURI).length > 0, "proof required");
        require(proof.expiresAt >= block.timestamp, "policy expired");
        bytes32 digest = _policyApprovalDigest(
            executor,
            adapter,
            keccak256(data),
            proof.strategyId,
            proof.policyDecisionHash,
            proof.proofURI,
            proof.expiresAt
        );
        require(!consumedPolicyApprovals[digest], "policy already used");
        address recovered = digest.toEthSignedMessageHash().recover(proof.signature);
        require(recovered == policyValidator, "invalid policy signature");
        consumedPolicyApprovals[digest] = true;
        emit PolicyProofConsumed(digest, proof.strategyId, proof.policyDecisionHash, executor, proof.proofURI);
    }

    function _policyApprovalDigest(
        address executor,
        address adapter,
        bytes32 dataHash,
        bytes32 strategyId,
        bytes32 policyDecisionHash,
        string memory proofURI,
        uint256 expiresAt
    ) internal view returns (bytes32) {
        return keccak256(abi.encode(
            "ClusterFi:SovereignPolicyApproval:v1",
            address(this),
            block.chainid,
            executor,
            adapter,
            dataHash,
            strategyId,
            policyDecisionHash,
            keccak256(bytes(proofURI)),
            expiresAt
        ));
    }

    function _logAction(address actor, bytes32 actionType, string memory proofURI) internal {
        if (address(registry) != address(0)) {
            registry.logAction(actor, actionType, proofURI);
        }
    }
}
