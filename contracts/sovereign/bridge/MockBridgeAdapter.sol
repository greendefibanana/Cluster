// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {IBridgeAdapter} from "../interfaces/IBridgeAdapter.sol";

contract MockBridgeAdapter is IBridgeAdapter {
    mapping(uint256 => bool) public supportedChains;

    event MockBridgeExecuted(bytes32 indexed intentId, uint256 indexed targetChainId, address asset, uint256 amount, bytes32 receiptHash);

    constructor(uint256[] memory chains) {
        for (uint256 i = 0; i < chains.length; i++) {
            supportedChains[chains[i]] = true;
        }
    }

    function setSupportedChain(uint256 chainId, bool supported) external {
        supportedChains[chainId] = supported;
    }

    function validateBridge(BridgeRequest calldata request) external view returns (bool) {
        return request.sourceChainId != 0
            && supportedChains[request.targetChainId]
            && request.asset != address(0)
            && request.amount > 0
            && request.receiver != address(0);
    }

    function estimateBridgeFee(BridgeRequest calldata request) external pure returns (uint256 fee) {
        return request.amount / 1000;
    }

    function executeBridge(BridgeRequest calldata request) external returns (bytes32 receiptHash) {
        require(supportedChains[request.targetChainId], "chain unsupported");
        require(request.amount > 0, "amount zero");
        receiptHash = keccak256(abi.encode(request.intentId, request.targetChainId, request.asset, request.amount, block.timestamp));
        emit MockBridgeExecuted(request.intentId, request.targetChainId, request.asset, request.amount, receiptHash);
    }
}
