// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {MockStrategyAdapterBase} from "./MockStrategyAdapterBase.sol";

contract MockYieldAdapter is MockStrategyAdapterBase {
    bytes32 public constant ACTION = keccak256("RUN_YIELD_STRATEGY");

    function _validateAction(bytes32 action) internal pure override {
        require(action == ACTION, "not yield action");
    }
}
