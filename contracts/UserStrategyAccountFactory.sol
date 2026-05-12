// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Clones} from "@openzeppelin/contracts/proxy/Clones.sol";
import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {UserStrategyAccount} from "./UserStrategyAccount.sol";

contract UserStrategyAccountFactory is Ownable {
    using Clones for address;

    struct StrategyAccountConfig {
        address asset;
        uint256 maxAllocation;
        uint256 maxSlippageBps;
        address[] allowedAdapters;
    }

    address public immutable implementation;
    bool public paused;
    mapping(address => bool) public trustedRelayers;
    mapping(address => address[]) private _userAccounts;
    mapping(bytes32 => address) public accountForSalt;

    event StrategyAccountCreated(
        address indexed account,
        address indexed user,
        address indexed approvedExecutor,
        bytes32 strategyId,
        address asset
    );
    event Paused(bool paused);
    event TrustedRelayerSet(address indexed relayer, bool allowed);

    constructor(address initialOwner) {
        transferOwnership(initialOwner);
        implementation = address(new UserStrategyAccount());
    }

    function createStrategyAccount(
        address user,
        address approvedAgentOrCluster,
        bytes32 strategyId,
        StrategyAccountConfig calldata config
    ) external returns (address account) {
        require(!paused, "factory paused");
        require(msg.sender == user || trustedRelayers[msg.sender], "user authorization required");
        require(user != address(0), "invalid user");
        require(approvedAgentOrCluster != address(0), "invalid executor");
        require(strategyId != bytes32(0), "invalid strategy");
        require(config.asset != address(0), "invalid asset");
        require(config.allowedAdapters.length > 0, "no adapters");
        require(config.maxAllocation > 0, "zero allocation");
        bytes32 salt = accountSalt(user, approvedAgentOrCluster, strategyId, config.asset);
        require(accountForSalt[salt] == address(0), "account exists");

        account = implementation.cloneDeterministic(salt);
        UserStrategyAccount(account).initialize(
            user,
            approvedAgentOrCluster,
            strategyId,
            config.asset,
            config.maxAllocation,
            config.maxSlippageBps,
            config.allowedAdapters
        );
        accountForSalt[salt] = account;
        _userAccounts[user].push(account);
        emit StrategyAccountCreated(account, user, approvedAgentOrCluster, strategyId, config.asset);
    }

    function predictAccountAddress(
        address user,
        address approvedAgentOrCluster,
        bytes32 strategyId,
        address asset
    ) external view returns (address) {
        return implementation.predictDeterministicAddress(accountSalt(user, approvedAgentOrCluster, strategyId, asset), address(this));
    }

    function getUserAccounts(address user) external view returns (address[] memory) {
        return _userAccounts[user];
    }

    function setPaused(bool isPaused) external onlyOwner {
        paused = isPaused;
        emit Paused(isPaused);
    }

    function setTrustedRelayer(address relayer, bool allowed) external onlyOwner {
        require(relayer != address(0), "invalid relayer");
        trustedRelayers[relayer] = allowed;
        emit TrustedRelayerSet(relayer, allowed);
    }

    function accountSalt(address user, address approvedAgentOrCluster, bytes32 strategyId, address asset)
        public
        pure
        returns (bytes32)
    {
        return keccak256(abi.encode(user, approvedAgentOrCluster, strategyId, asset));
    }
}
