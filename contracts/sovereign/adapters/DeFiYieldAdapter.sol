// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {SovereignAdapterBase} from "./SovereignAdapterBase.sol";

contract DeFiYieldAdapter is SovereignAdapterBase {
    constructor() SovereignAdapterBase("DEFI_YIELD") {}
}
