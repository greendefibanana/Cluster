// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {IBridgeAdapter} from "../interfaces/IBridgeAdapter.sol";

contract AcrossQuoteService {
    function quote(address bridgeAdapter, IBridgeAdapter.BridgeRequest calldata request)
        external
        view
        returns (bool supported, uint256 fee, bytes32 quoteHash)
    {
        supported = IBridgeAdapter(bridgeAdapter).validateBridge(request);
        fee = supported ? IBridgeAdapter(bridgeAdapter).estimateBridgeFee(request) : 0;
        quoteHash = keccak256(abi.encode(bridgeAdapter, request.sourceChainId, request.targetChainId, request.asset, request.amount, fee));
    }
}
