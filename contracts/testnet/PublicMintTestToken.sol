// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {ERC20} from "@openzeppelin/contracts/token/ERC20/ERC20.sol";

contract PublicMintTestToken is ERC20 {
    uint8 private immutable _customDecimals;
    uint256 public immutable maxMintPerTx;
    uint256 public immutable faucetAmount;

    event PublicMint(address indexed receiver, uint256 amount);

    constructor(
        string memory tokenName,
        string memory tokenSymbol,
        uint8 tokenDecimals,
        address initialHolder,
        uint256 initialSupply,
        uint256 maxMintPerTx_,
        uint256 faucetAmount_
    ) ERC20(tokenName, tokenSymbol) {
        require(initialHolder != address(0), "invalid holder");
        require(maxMintPerTx_ > 0, "zero max mint");
        require(faucetAmount_ > 0 && faucetAmount_ <= maxMintPerTx_, "bad faucet amount");
        _customDecimals = tokenDecimals;
        maxMintPerTx = maxMintPerTx_;
        faucetAmount = faucetAmount_;
        _mint(initialHolder, initialSupply);
    }

    function decimals() public view override returns (uint8) {
        return _customDecimals;
    }

    function mint(uint256 amount) external {
        require(amount > 0, "zero amount");
        require(amount <= maxMintPerTx, "amount too large");
        _mint(msg.sender, amount);
        emit PublicMint(msg.sender, amount);
    }

    function faucet() external {
        _mint(msg.sender, faucetAmount);
        emit PublicMint(msg.sender, faucetAmount);
    }
}
