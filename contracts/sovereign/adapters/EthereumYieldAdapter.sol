// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {SovereignAdapterBase} from "./SovereignAdapterBase.sol";

contract EthereumYieldAdapter is SovereignAdapterBase {
    constructor() SovereignAdapterBase("ETHEREUM_YIELD") {}
}
