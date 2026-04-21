// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {ERC20} from "@openzeppelin/contracts/token/ERC20/ERC20.sol";

/// @title FourMemeToken — simple ERC20 created by MockFourMemeFactory
contract FourMemeToken is ERC20 {
    constructor(
        string memory name_,
        string memory symbol_,
        uint256 supply_,
        address recipient_
    ) ERC20(name_, symbol_) {
        _mint(recipient_, supply_);
    }
}

/// @title MockFourMemeFactory
/// @notice Drop-in replacement for Four.meme's factory on a hardhat fork.
///         Uses `hardhat_setCode` to overwrite the real factory at
///         0x5c952063c7fc8610FFDB798152D69F0B9550762b.
///
///         Accepts the same `createToken(bytes,bytes)` signature as Four.meme
///         but skips cryptographic verification — it decodes the args blob,
///         deploys a real ERC20, and emits an event matching Four.meme's pattern.
contract MockFourMemeFactory {
    event TokenCreated(
        address indexed token,
        address indexed creator,
        string name,
        string symbol,
        uint256 supply
    );

    uint256 public constant DEFAULT_SUPPLY = 1_000_000_000 ether; // 1B tokens

    /// @notice Mirror of Four.meme's createToken(bytes args, bytes signature).
    ///         `signature` is accepted but NOT validated (fork-only mock).
    ///         `args` is abi.encode(string name, string symbol, string uri).
    function createToken(
        bytes memory args,
        bytes memory /* signature — ignored */
    ) public payable returns (address token) {
        (string memory name, string memory symbol, ) = abi.decode(args, (string, string, string));

        token = address(new FourMemeToken(name, symbol, DEFAULT_SUPPLY, msg.sender));

        emit TokenCreated(token, msg.sender, name, symbol, DEFAULT_SUPPLY);
    }

    receive() external payable {}
}
