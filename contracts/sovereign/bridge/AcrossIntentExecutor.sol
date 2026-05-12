// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {IBridgeAdapter} from "../interfaces/IBridgeAdapter.sol";

contract AcrossIntentExecutor {
    event BridgeIntentExecuted(bytes32 indexed intentId, address indexed bridgeAdapter, bytes32 receiptHash);

    function executeBridgeIntent(address bridgeAdapter, IBridgeAdapter.BridgeRequest calldata request)
        external
        returns (bytes32 receiptHash)
    {
        require(bridgeAdapter != address(0), "invalid bridge");
        require(IBridgeAdapter(bridgeAdapter).validateBridge(request), "invalid bridge request");
        receiptHash = IBridgeAdapter(bridgeAdapter).executeBridge(request);
        emit BridgeIntentExecuted(request.intentId, bridgeAdapter, receiptHash);
    }
}
