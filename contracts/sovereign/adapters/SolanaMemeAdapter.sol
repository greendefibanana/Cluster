// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {SovereignAdapterBase} from "./SovereignAdapterBase.sol";

contract SolanaMemeAdapter is SovereignAdapterBase {
    constructor() SovereignAdapterBase("SOLANA_MEME") {}
}
