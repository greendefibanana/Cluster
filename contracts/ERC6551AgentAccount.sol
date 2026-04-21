// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {ERC721Holder} from "@openzeppelin/contracts/token/ERC721/utils/ERC721Holder.sol";
import {IERC721} from "@openzeppelin/contracts/token/ERC721/IERC721.sol";
import {IERC1155Receiver} from "@openzeppelin/contracts/token/ERC1155/IERC1155Receiver.sol";
import {IERC165} from "@openzeppelin/contracts/utils/introspection/IERC165.sol";
import {IERC1271} from "@openzeppelin/contracts/interfaces/IERC1271.sol";
import {SignatureChecker} from "@openzeppelin/contracts/utils/cryptography/SignatureChecker.sol";

contract ERC6551AgentAccount is ERC721Holder, IERC1271, IERC1155Receiver {
    uint256 private _state;
    bool private _executing;
    mapping(address => mapping(address => bool)) private _executors;

    event ExecutorSet(address indexed executor, bool allowed);

    receive() external payable {}

    function owner() public view returns (address) {
        (uint256 chainId, address tokenContract, uint256 tokenId) = token();
        if (chainId != block.chainid) {
            return address(0);
        }
        return IERC721(tokenContract).ownerOf(tokenId);
    }

    function token() public view returns (uint256 chainId, address tokenContract, uint256 tokenId) {
        bytes memory footer = new bytes(0x60);
        assembly {
            extcodecopy(address(), add(footer, 0x20), 0x4d, 0x60)
        }
        return abi.decode(footer, (uint256, address, uint256));
    }

    function execute(address to, uint256 value, bytes calldata data, uint8 operation) external payable returns (bytes memory result) {
        address accountOwner = owner();
        require(msg.sender == accountOwner || _executors[accountOwner][msg.sender], "not authorized");
        require(operation == 0, "unsupported operation");
        require(!_executing, "reentrant call");
        _executing = true;
        _state++;
        (bool success, bytes memory response) = to.call{value: value}(data);
        _executing = false;
        if (!success) {
            assembly {
                revert(add(response, 0x20), mload(response))
            }
        }
        return response;
    }

    function state() external view returns (uint256) {
        return _state;
    }

    function setExecutor(address executor, bool allowed) external {
        require(msg.sender == owner(), "not token owner");
        require(executor != address(0), "invalid executor");
        _executors[msg.sender][executor] = allowed;
        emit ExecutorSet(executor, allowed);
    }

    function executors(address executor) external view returns (bool) {
        return _executors[owner()][executor];
    }

    function isValidSignature(bytes32 hash, bytes memory signature) external view returns (bytes4) {
        return SignatureChecker.isValidSignatureNow(owner(), hash, signature) ? IERC1271.isValidSignature.selector : bytes4(0);
    }

    function supportsInterface(bytes4 interfaceId) external pure override returns (bool) {
        return interfaceId == type(IERC1155Receiver).interfaceId || interfaceId == type(IERC165).interfaceId;
    }

    function onERC1155Received(address, address, uint256, uint256, bytes calldata) external pure override returns (bytes4) {
        return this.onERC1155Received.selector;
    }

    function onERC1155BatchReceived(address, address, uint256[] calldata, uint256[] calldata, bytes calldata) external pure override returns (bytes4) {
        return this.onERC1155BatchReceived.selector;
    }
}
