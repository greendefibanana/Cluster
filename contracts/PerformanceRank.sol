// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";

contract PerformanceRank is Ownable {
    uint256 public constant MAX_SCORE = 10000;

    mapping(uint256 => uint256) public intelligenceScore;
    mapping(address => bool) public trustedExecutors;

    event ExecutorSet(address indexed executor, bool allowed);
    event ScoreIncreased(uint256 indexed agentId, uint256 amount, uint256 newScore, string reason);
    event ScoreDecreased(uint256 indexed agentId, uint256 amount, uint256 newScore, string reason);

    constructor(address initialOwner) {
        transferOwnership(initialOwner);
    }

    modifier onlyTrusted() {
        require(trustedExecutors[msg.sender] || msg.sender == owner(), "not authorized");
        _;
    }

    function setTrustedExecutor(address executor, bool allowed) external onlyOwner {
        trustedExecutors[executor] = allowed;
        emit ExecutorSet(executor, allowed);
    }

    function increaseScore(uint256 agentId, uint256 amount, string calldata reason) external onlyTrusted {
        uint256 current = intelligenceScore[agentId];
        uint256 newScore = current + amount;
        if (newScore > MAX_SCORE) {
            newScore = MAX_SCORE;
        }
        intelligenceScore[agentId] = newScore;
        emit ScoreIncreased(agentId, amount, newScore, reason);
    }

    function decreaseScore(uint256 agentId, uint256 amount, string calldata reason) external onlyTrusted {
        uint256 current = intelligenceScore[agentId];
        uint256 newScore = current > amount ? current - amount : 0;
        intelligenceScore[agentId] = newScore;
        emit ScoreDecreased(agentId, amount, newScore, reason);
    }
}
