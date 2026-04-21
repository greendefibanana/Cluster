// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";

interface IPancakeRouter02 {
    function addLiquidityETH(
        address token,
        uint256 amountTokenDesired,
        uint256 amountTokenMin,
        uint256 amountETHMin,
        address to,
        uint256 deadline
    ) external payable returns (uint256 amountToken, uint256 amountETH, uint256 liquidity);
}

contract PancakeLiquidityManager {
    IPancakeRouter02 public immutable router;

    event LiquiditySeeded(address indexed token, address indexed recipient, uint256 tokenAmount, uint256 nativeAmount, uint256 liquidity);

    constructor(address routerAddress) {
        router = IPancakeRouter02(routerAddress);
    }

    function seedLiquidityWithNative(
        address token,
        uint256 amountTokenDesired,
        uint256 amountTokenMin,
        uint256 amountNativeMin,
        address lpRecipient,
        uint256 deadline
    ) external payable returns (uint256 amountToken, uint256 amountNative, uint256 liquidity) {
        IERC20(token).transferFrom(msg.sender, address(this), amountTokenDesired);
        IERC20(token).approve(address(router), amountTokenDesired);
        (amountToken, amountNative, liquidity) = router.addLiquidityETH{value: msg.value}(
            token,
            amountTokenDesired,
            amountTokenMin,
            amountNativeMin,
            lpRecipient,
            deadline
        );

        uint256 leftoverTokens = amountTokenDesired - amountToken;
        if (leftoverTokens > 0) {
            IERC20(token).transfer(msg.sender, leftoverTokens);
        }
        uint256 leftoverNative = msg.value - amountNative;
        if (leftoverNative > 0) {
            (bool ok, ) = payable(msg.sender).call{value: leftoverNative}("");
            require(ok, "native refund failed");
        }

        emit LiquiditySeeded(token, lpRecipient, amountToken, amountNative, liquidity);
    }
}
