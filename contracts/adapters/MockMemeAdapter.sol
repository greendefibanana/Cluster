// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {MockStrategyAdapterBase} from "./MockStrategyAdapterBase.sol";

contract MockMemeAdapter is MockStrategyAdapterBase {
    bytes32 public constant ACTION = keccak256("CREATE_MEME");

    function _validateAction(bytes32 action) internal pure override {
        require(action == ACTION, "not meme action");
    }
}
