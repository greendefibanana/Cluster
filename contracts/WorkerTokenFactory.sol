// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {WorkerToken} from "./WorkerToken.sol";

contract WorkerTokenFactory is Ownable {
    mapping(address => bool) public trustedCallers;

    event WorkerTokenDeployed(address indexed token, address indexed owner, string name, string symbol, uint256 supply);
    event TrustedCallerSet(address indexed caller, bool allowed);

    constructor() {}

    function setTrustedCaller(address caller, bool allowed) external onlyOwner {
        trustedCallers[caller] = allowed;
        emit TrustedCallerSet(caller, allowed);
    }

    function deployToken(
        string calldata name,
        string calldata symbol,
        uint256 supply,
        address tokenOwner
    ) external returns (address token) {
        token = address(new WorkerToken(name, symbol, supply, tokenOwner));
        emit WorkerTokenDeployed(token, tokenOwner, name, symbol, supply);
    }
}
