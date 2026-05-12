// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {IStrategyAdapter} from "../interfaces/IStrategyAdapter.sol";

abstract contract MockStrategyAdapterBase is IStrategyAdapter {
    using SafeERC20 for IERC20;

    struct StrategyIntent {
        address asset;
        uint256 amount;
        address receiver;
        uint256 maxSlippageBps;
        bytes32 action;
        string proofURI;
    }

    event MockStrategyAction(
        address indexed account,
        address indexed asset,
        uint256 amount,
        address indexed receiver,
        bytes32 action,
        string proofURI
    );

    function execute(bytes calldata intentData) external virtual returns (bool) {
        StrategyIntent memory intent = abi.decode(intentData, (StrategyIntent));
        require(intent.amount > 0, "amount zero");
        IERC20(intent.asset).safeTransferFrom(msg.sender, intent.receiver, intent.amount);
        emit MockStrategyAction(msg.sender, intent.asset, intent.amount, intent.receiver, intent.action, intent.proofURI);
        return true;
    }

    function previewExecution(bytes calldata data)
        external
        view
        returns (address asset, uint256 amount, address receiver, uint256 maxSlippageBps, bytes32 action)
    {
        require(bytes4(data[:4]) == this.execute.selector, "unsupported action");
        bytes calldata encodedIntent = data[4:];
        bytes memory intentData = abi.decode(encodedIntent, (bytes));
        StrategyIntent memory intent = abi.decode(intentData, (StrategyIntent));
        _validateAction(intent.action);
        return (intent.asset, intent.amount, intent.receiver, intent.maxSlippageBps, intent.action);
    }

    function _validateAction(bytes32 action) internal view virtual;
}
