// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {SovereignAdapterBase} from "./SovereignAdapterBase.sol";

contract BNBLaunchAdapter is SovereignAdapterBase {
    constructor() SovereignAdapterBase("BNB_LAUNCH") {}
}
