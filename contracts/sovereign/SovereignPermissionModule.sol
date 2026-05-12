// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

abstract contract SovereignPermissionModule {
    address public owner;
    uint256 public maxAllocation;
    uint256 public maxSlippageBps;
    string public riskProfile;
    bool public paused;

    mapping(address => bool) public approvedAgents;
    mapping(address => bool) public approvedClusters;
    mapping(address => bool) public approvedAdapters;
    mapping(uint256 => bool) public chainPermissions;
    mapping(bytes32 => bool) public strategySubscriptions;

    event AgentPermissionSet(address indexed agent, bool approved);
    event ClusterPermissionSet(address indexed cluster, bool approved);
    event AdapterPermissionSet(address indexed adapter, bool approved);
    event ChainPermissionSet(uint256 indexed chainId, bool approved);
    event RiskLimitsSet(uint256 maxAllocation, uint256 maxSlippageBps, string riskProfile);
    event StrategySubscriptionSet(bytes32 indexed strategyId, bool active);
    event AccountPaused(bool paused);

    modifier onlyOwner() {
        require(msg.sender == owner, "not owner");
        _;
    }

    function _setAgentPermission(address agent, bool approved) internal {
        require(agent != address(0), "invalid agent");
        approvedAgents[agent] = approved;
        emit AgentPermissionSet(agent, approved);
    }

    function _setClusterPermission(address cluster, bool approved) internal {
        require(cluster != address(0), "invalid cluster");
        approvedClusters[cluster] = approved;
        emit ClusterPermissionSet(cluster, approved);
    }

    function _setAdapterPermission(address adapter, bool approved) internal {
        require(adapter != address(0), "invalid adapter");
        approvedAdapters[adapter] = approved;
        emit AdapterPermissionSet(adapter, approved);
    }

    function _setChainPermission(uint256 chainId, bool approved) internal {
        require(chainId != 0, "invalid chain");
        chainPermissions[chainId] = approved;
        emit ChainPermissionSet(chainId, approved);
    }

    function _setRiskLimits(uint256 allocationLimit, uint256 slippageLimitBps, string memory profile) internal {
        require(slippageLimitBps <= 10_000, "bad slippage");
        maxAllocation = allocationLimit;
        maxSlippageBps = slippageLimitBps;
        riskProfile = profile;
        emit RiskLimitsSet(allocationLimit, slippageLimitBps, profile);
    }

    function _setStrategySubscription(bytes32 strategyId, bool active) internal {
        require(strategyId != bytes32(0), "invalid strategy");
        strategySubscriptions[strategyId] = active;
        emit StrategySubscriptionSet(strategyId, active);
    }

    function _setPaused(bool isPaused) internal {
        paused = isPaused;
        emit AccountPaused(isPaused);
    }
}
