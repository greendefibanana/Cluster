// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";

contract SovereignAccountRegistry is Ownable {
    mapping(address => bool) public trustedFactories;
    mapping(address => bool) public isSovereignAccount;
    mapping(address => address[]) private _accountsByOwner;

    event TrustedFactorySet(address indexed factory, bool trusted);
    event SovereignAccountRegistered(address indexed account, address indexed owner, bytes32 indexed accountSalt, string label);
    event SovereignActionLogged(address indexed account, address indexed actor, bytes32 indexed actionType, string proofURI);

    constructor(address initialOwner) {
        transferOwnership(initialOwner);
    }

    modifier onlyTrustedFactory() {
        require(trustedFactories[msg.sender], "not factory");
        _;
    }

    function setTrustedFactory(address factory, bool trusted) external onlyOwner {
        require(factory != address(0), "invalid factory");
        trustedFactories[factory] = trusted;
        emit TrustedFactorySet(factory, trusted);
    }

    function registerSovereignAccount(address account, address owner, bytes32 accountSalt, string calldata label)
        external
        onlyTrustedFactory
    {
        require(account != address(0), "invalid account");
        require(owner != address(0), "invalid owner");
        require(!isSovereignAccount[account], "registered");
        isSovereignAccount[account] = true;
        _accountsByOwner[owner].push(account);
        emit SovereignAccountRegistered(account, owner, accountSalt, label);
    }

    function logAction(address actor, bytes32 actionType, string calldata proofURI) external {
        require(isSovereignAccount[msg.sender], "not sovereign account");
        emit SovereignActionLogged(msg.sender, actor, actionType, proofURI);
    }

    function accountsByOwner(address owner) external view returns (address[] memory) {
        return _accountsByOwner[owner];
    }
}
