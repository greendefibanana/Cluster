// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {SovereignAdapterBase} from "./SovereignAdapterBase.sol";

contract MantleYieldAdapter is SovereignAdapterBase {
    constructor() SovereignAdapterBase("MANTLE_YIELD") {}
}
