// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Clones} from "@openzeppelin/contracts/proxy/Clones.sol";
import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {SovereignAccount} from "./SovereignAccount.sol";
import {SovereignAccountRegistry} from "./SovereignAccountRegistry.sol";

contract SovereignAccountFactory is Ownable {
    using Clones for address;

    struct SovereignConfig {
        uint256 maxAllocation;
        uint256 maxSlippageBps;
        string riskProfile;
        address[] approvedAdapters;
        uint256[] chainIds;
    }

    address public immutable implementation;
    SovereignAccountRegistry public immutable registry;
    bool public paused;
    mapping(address => bool) public trustedRelayers;
    mapping(bytes32 => address) public accountForSalt;

    event SovereignAccountCreated(address indexed account, address indexed owner, bytes32 indexed accountSalt, string label);
    event Paused(bool paused);
    event TrustedRelayerSet(address indexed relayer, bool trusted);

    constructor(address initialOwner, address accountRegistry) {
        require(accountRegistry != address(0), "invalid registry");
        transferOwnership(initialOwner);
        registry = SovereignAccountRegistry(accountRegistry);
        implementation = address(new SovereignAccount());
    }

    function createSovereignAccount(address accountOwner, string calldata label, SovereignConfig calldata config)
        external
        returns (address account)
    {
        require(!paused, "factory paused");
        require(msg.sender == accountOwner || trustedRelayers[msg.sender], "user authorization required");
        require(accountOwner != address(0), "invalid owner");
        require(config.approvedAdapters.length > 0, "no adapters");
        require(config.chainIds.length > 0, "no chains");
        require(config.maxAllocation > 0, "zero allocation");
        require(config.maxSlippageBps <= 10_000, "bad slippage");

        bytes32 salt = accountSalt(accountOwner, label, config.riskProfile);
        require(accountForSalt[salt] == address(0), "account exists");

        account = implementation.cloneDeterministic(salt);
        SovereignAccount(account).initialize(
            accountOwner,
            address(registry),
            salt,
            label,
            config.maxAllocation,
            config.maxSlippageBps,
            config.riskProfile,
            config.approvedAdapters,
            config.chainIds
        );
        accountForSalt[salt] = account;
        registry.registerSovereignAccount(account, accountOwner, salt, label);
        emit SovereignAccountCreated(account, accountOwner, salt, label);
    }

    function predictSovereignAccount(address accountOwner, string calldata label, string calldata riskProfile)
        external
        view
        returns (address)
    {
        return implementation.predictDeterministicAddress(accountSalt(accountOwner, label, riskProfile), address(this));
    }

    function setPaused(bool isPaused) external onlyOwner {
        paused = isPaused;
        emit Paused(isPaused);
    }

    function setTrustedRelayer(address relayer, bool trusted) external onlyOwner {
        require(relayer != address(0), "invalid relayer");
        trustedRelayers[relayer] = trusted;
        emit TrustedRelayerSet(relayer, trusted);
    }

    function accountSalt(address accountOwner, string memory label, string memory riskProfile) public pure returns (bytes32) {
        return keccak256(abi.encode(accountOwner, label, riskProfile));
    }
}
