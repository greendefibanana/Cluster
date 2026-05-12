// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {SovereignAdapterBase} from "./SovereignAdapterBase.sol";

contract PredictionMarketAdapter is SovereignAdapterBase {
    constructor() SovereignAdapterBase("PREDICTION_MARKET") {}
}
