// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";

abstract contract SovereignExecutionModule {
    using SafeERC20 for IERC20;

    event SovereignExecution(
        address indexed executor,
        address indexed adapter,
        uint256 indexed targetChainId,
        address asset,
        uint256 amount,
        bytes32 action
    );

    function _executeAdapter(
        address executor,
        address adapter,
        uint256 targetChainId,
        address asset,
        uint256 amount,
        bytes32 action,
        bytes calldata data
    ) internal returns (bytes memory result) {
        IERC20(asset).safeApprove(adapter, 0);
        IERC20(asset).safeApprove(adapter, amount);
        (bool success, bytes memory response) = adapter.call(data);
        IERC20(asset).safeApprove(adapter, 0);
        if (!success) {
            assembly {
                revert(add(response, 0x20), mload(response))
            }
        }
        emit SovereignExecution(executor, adapter, targetChainId, asset, amount, action);
        return response;
    }
}
