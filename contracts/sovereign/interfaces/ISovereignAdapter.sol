// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

interface ISovereignAdapter {
    function previewExecution(bytes calldata data)
        external
        view
        returns (
            uint256 targetChainId,
            address asset,
            uint256 amount,
            address receiver,
            uint256 slippageBps,
            bytes32 action
        );
}
