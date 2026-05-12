// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {ISovereignAdapter} from "../interfaces/ISovereignAdapter.sol";

abstract contract SovereignAdapterBase is ISovereignAdapter {
    using SafeERC20 for IERC20;

    bytes32 public immutable adapterType;

    event AdapterExecution(address indexed account, uint256 indexed targetChainId, address indexed asset, uint256 amount, bytes32 action);
    event ProofGenerated(bytes32 indexed action, string proofURI, bytes32 validationHash);

    constructor(bytes32 newAdapterType) {
        adapterType = newAdapterType;
    }

    function previewExecution(bytes calldata data)
        external
        view
        returns (
            uint256 targetChainId,
            address asset,
            uint256 amount,
            address receiver,
            uint256 slippageBps,
            bytes32 action
        )
    {
        return _decode(data);
    }

    function validateIntent(bytes calldata data) external view returns (bool) {
        (uint256 targetChainId, address asset, uint256 amount, address receiver,,) = _decode(data);
        return targetChainId != 0 && asset != address(0) && amount > 0 && receiver != address(0);
    }

    function estimateRisk(bytes calldata data) external view returns (uint256 riskScore) {
        (uint256 targetChainId,, uint256 amount,,,) = _decodeRisk(data);
        riskScore = uint256(keccak256(abi.encode(adapterType, targetChainId, amount))) % 100;
    }

    function estimateFees(bytes calldata data) external view returns (uint256 fee) {
        (,, uint256 amount,,,) = _decode(data);
        fee = amount / 1000;
    }

    function simulate(bytes calldata data) external view returns (bytes32 simulationHash) {
        simulationHash = keccak256(abi.encode(adapterType, data, block.chainid));
    }

    function execute(bytes calldata data) external returns (bytes32 executionHash) {
        (uint256 targetChainId, address asset, uint256 amount, address receiver,, bytes32 action) = _decode(data);
        IERC20(asset).safeTransferFrom(msg.sender, receiver, amount);
        executionHash = keccak256(abi.encode(adapterType, msg.sender, targetChainId, asset, amount, receiver, action, block.timestamp));
        emit AdapterExecution(msg.sender, targetChainId, asset, amount, action);
    }

    function generateProof(bytes32 action, string calldata proofURI) external returns (bytes32 proofHash) {
        proofHash = keccak256(abi.encode(adapterType, action, proofURI));
        emit ProofGenerated(action, proofURI, proofHash);
    }

    function generateValidationObject(bytes32 action, string calldata proofURI) external pure returns (bytes32) {
        return keccak256(abi.encode(action, proofURI));
    }

    function _decode(bytes calldata data)
        internal
        pure
        returns (
            uint256 targetChainId,
            address asset,
            uint256 amount,
            address receiver,
            uint256 slippageBps,
            bytes32 action
        )
    {
        bytes memory payload = data;
        if (data.length >= 4) {
            bytes4 selector;
            assembly {
                selector := calldataload(data.offset)
            }
            if (selector == this.execute.selector) {
                payload = abi.decode(data[4:], (bytes));
            }
        }
        (targetChainId, asset, amount, receiver, slippageBps, action) =
            abi.decode(payload, (uint256, address, uint256, address, uint256, bytes32));
    }

    function _decodeRisk(bytes calldata data)
        internal
        pure
        returns (
            uint256 targetChainId,
            address asset,
            uint256 amount,
            address receiver,
            uint256 slippageBps,
            bytes32 action
        )
    {
        return _decode(data);
    }
}
