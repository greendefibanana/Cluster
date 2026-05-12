// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/security/ReentrancyGuard.sol";
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

    address public immutable factory;
    SovereignAccountRegistry public registry;
    bytes32 public accountId;
    string public label;

    mapping(address => uint256) public balances;

    event SovereignDeposited(address indexed asset, uint256 amount);
    event SovereignWithdrawn(address indexed asset, uint256 amount, address indexed receiver);
    event CrossChainIntentOpened(bytes32 indexed intentId, uint256 indexed targetChainId, address indexed adapter, string proofURI);
    event EmergencyExit(address indexed asset, uint256 amount, address indexed receiver);
    event OwnershipTransferred(address indexed previousOwner, address indexed newOwner);

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
    }

    function transferOwnership(address newOwner) external onlyOwner {
        require(newOwner != address(0), "invalid owner");
        address oldOwner = owner;
        owner = newOwner;
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

    function withdraw(address asset, uint256 amount) external onlyOwner nonReentrant {
        require(amount > 0, "amount zero");
        require(balances[asset] >= amount, "insufficient accounting");
        balances[asset] -= amount;
        IERC20(asset).safeTransfer(owner, amount);
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
        return _executeWithPermission(adapter, data, bytes32(0));
    }

    function executeWithSession(address adapter, bytes calldata data, bytes32 sessionKey)
        external
        nonReentrant
        returns (bytes memory result)
    {
        return _executeWithPermission(adapter, data, sessionKey);
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
        require(msg.sender == owner || approvedAgents[msg.sender] || approvedClusters[msg.sender], "not approved");
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
        uint256 balance = IERC20(asset).balanceOf(address(this));
        balances[asset] = 0;
        if (balance > 0) {
            IERC20(asset).safeTransfer(owner, balance);
        }
        emit EmergencyExit(asset, balance, owner);
        _logAction(msg.sender, "emergency_exit", "");
    }

    function _executeWithPermission(address adapter, bytes calldata data, bytes32 sessionKey)
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

        bool directPermission = msg.sender == owner || approvedAgents[msg.sender] || approvedClusters[msg.sender];
        bool sessionPermission = sessionKey != bytes32(0) && _consumeSessionKey(sessionKey, msg.sender, adapter, targetChainId);
        require(directPermission || sessionPermission, "not approved");

        result = _executeAdapter(msg.sender, adapter, targetChainId, asset, amount, action, data);
        _logAction(msg.sender, action, "");
    }

    function _logAction(address actor, bytes32 actionType, string memory proofURI) internal {
        if (address(registry) != address(0)) {
            registry.logAction(actor, actionType, proofURI);
        }
    }
}
