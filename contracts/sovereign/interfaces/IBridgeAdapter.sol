// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

interface IBridgeAdapter {
    struct BridgeRequest {
        uint256 sourceChainId;
        uint256 targetChainId;
        address asset;
        uint256 amount;
        address receiver;
        bytes32 intentId;
        bytes data;
    }

    function validateBridge(BridgeRequest calldata request) external view returns (bool);
    function estimateBridgeFee(BridgeRequest calldata request) external view returns (uint256 fee);
    function executeBridge(BridgeRequest calldata request) external returns (bytes32 receiptHash);
}
