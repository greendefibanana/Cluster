// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {SovereignAccountRegistry} from "./SovereignAccountRegistry.sol";

contract CrossChainIntentEngine is Ownable {
    enum IntentStatus {
        Pending,
        Executed,
        Failed,
        Cancelled
    }

    struct CrossChainIntent {
        uint256 sourceChain;
        uint256 targetChain;
        address asset;
        uint256 amount;
        bytes32 strategyType;
        address adapter;
        address userSovereignAccount;
        bytes32 riskConstraints;
        string proofURI;
        IntentStatus intentStatus;
        bytes32 validationHash;
        uint256 createdAt;
        uint256 updatedAt;
    }

    SovereignAccountRegistry public immutable registry;
    mapping(bytes32 => CrossChainIntent) public intents;
    mapping(address => bool) public executors;

    event IntentCreated(bytes32 indexed intentId, address indexed account, uint256 indexed targetChain, address adapter, string proofURI);
    event IntentStatusUpdated(bytes32 indexed intentId, IntentStatus status, string proofURI, bytes32 validationHash);
    event ExecutorSet(address indexed executor, bool trusted);

    constructor(address initialOwner, address accountRegistry) {
        require(accountRegistry != address(0), "invalid registry");
        transferOwnership(initialOwner);
        registry = SovereignAccountRegistry(accountRegistry);
    }

    modifier onlyAccountOrExecutor(bytes32 intentId) {
        require(msg.sender == intents[intentId].userSovereignAccount || executors[msg.sender], "not authorized");
        _;
    }

    function setExecutor(address executor, bool trusted) external onlyOwner {
        require(executor != address(0), "invalid executor");
        executors[executor] = trusted;
        emit ExecutorSet(executor, trusted);
    }

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
    ) external returns (bytes32 intentId) {
        require(registry.isSovereignAccount(msg.sender), "caller not sovereign");
        require(userSovereignAccount == msg.sender, "account mismatch");
        require(sourceChainId != 0 && targetChainId != 0, "invalid chain");
        require(asset != address(0), "invalid asset");
        require(amount > 0, "amount zero");
        require(adapter != address(0), "invalid adapter");
        intentId = keccak256(abi.encode(msg.sender, sourceChainId, targetChainId, asset, amount, strategyType, adapter, block.timestamp));
        intents[intentId] = CrossChainIntent({
            sourceChain: sourceChainId,
            targetChain: targetChainId,
            asset: asset,
            amount: amount,
            strategyType: strategyType,
            adapter: adapter,
            userSovereignAccount: userSovereignAccount,
            riskConstraints: riskConstraints,
            proofURI: proofURI,
            intentStatus: IntentStatus.Pending,
            validationHash: bytes32(0),
            createdAt: block.timestamp,
            updatedAt: block.timestamp
        });
        emit IntentCreated(intentId, msg.sender, targetChainId, adapter, proofURI);
    }

    function markExecuted(bytes32 intentId, string calldata proofURI, bytes32 validationHash)
        external
        onlyAccountOrExecutor(intentId)
    {
        require(intents[intentId].intentStatus == IntentStatus.Pending, "not pending");
        _setStatus(intentId, IntentStatus.Executed, proofURI, validationHash);
    }

    function markFailed(bytes32 intentId, string calldata proofURI, bytes32 validationHash)
        external
        onlyAccountOrExecutor(intentId)
    {
        require(intents[intentId].intentStatus == IntentStatus.Pending, "not pending");
        _setStatus(intentId, IntentStatus.Failed, proofURI, validationHash);
    }

    function cancelIntent(bytes32 intentId, string calldata proofURI) external {
        require(msg.sender == intents[intentId].userSovereignAccount, "not account");
        require(intents[intentId].intentStatus == IntentStatus.Pending, "not pending");
        _setStatus(intentId, IntentStatus.Cancelled, proofURI, bytes32(0));
    }

    function _setStatus(bytes32 intentId, IntentStatus status, string calldata proofURI, bytes32 validationHash) internal {
        CrossChainIntent storage intent = intents[intentId];
        intent.intentStatus = status;
        intent.proofURI = proofURI;
        intent.validationHash = validationHash;
        intent.updatedAt = block.timestamp;
        emit IntentStatusUpdated(intentId, status, proofURI, validationHash);
    }
}
