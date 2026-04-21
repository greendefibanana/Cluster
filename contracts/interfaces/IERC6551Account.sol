// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

interface IERC6551Account {
    function execute(address to, uint256 value, bytes calldata data, uint8 operation) external payable returns (bytes memory result);
    function token() external view returns (uint256 chainId, address tokenContract, uint256 tokenId);
    function owner() external view returns (address);
}
