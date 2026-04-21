// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {ERC20} from "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";

contract WorkerToken is ERC20, Ownable {
    constructor(
        string memory name_,
        string memory symbol_,
        uint256 supply_,
        address owner_
    ) ERC20(name_, symbol_) {
        transferOwnership(owner_);
        _mint(owner_, supply_);
    }
}
