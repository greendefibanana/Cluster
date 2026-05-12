// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

interface IStrategyAdapter {
    function previewExecution(bytes calldata data)
        external
        view
        returns (address asset, uint256 amount, address receiver, uint256 maxSlippageBps, bytes32 action);
}
