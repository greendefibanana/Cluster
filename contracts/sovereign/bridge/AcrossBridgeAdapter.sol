// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {IBridgeAdapter} from "../interfaces/IBridgeAdapter.sol";

contract AcrossBridgeAdapter is IBridgeAdapter, Ownable {
    address public spokePool;
    bool public simulationMode = true;
    mapping(uint256 => bool) public supportedChains;

    event AcrossSimulationModeSet(bool simulationMode);
    event AcrossSpokePoolSet(address indexed spokePool);
    event AcrossChainSupportSet(uint256 indexed chainId, bool supported);
    event AcrossIntentSimulated(bytes32 indexed intentId, uint256 indexed targetChainId, address asset, uint256 amount, bytes32 receiptHash);

    constructor(address initialOwner, address initialSpokePool, uint256[] memory chains) {
        transferOwnership(initialOwner);
        spokePool = initialSpokePool;
        for (uint256 i = 0; i < chains.length; i++) {
            supportedChains[chains[i]] = true;
        }
    }

    function setSimulationMode(bool enabled) external onlyOwner {
        simulationMode = enabled;
        emit AcrossSimulationModeSet(enabled);
    }

    function setSpokePool(address newSpokePool) external onlyOwner {
        spokePool = newSpokePool;
        emit AcrossSpokePoolSet(newSpokePool);
    }

    function setSupportedChain(uint256 chainId, bool supported) external onlyOwner {
        supportedChains[chainId] = supported;
        emit AcrossChainSupportSet(chainId, supported);
    }

    function validateBridge(BridgeRequest calldata request) external view returns (bool) {
        return supportedChains[request.targetChainId]
            && request.asset != address(0)
            && request.amount > 0
            && request.receiver != address(0)
            && (simulationMode || spokePool != address(0));
    }

    function estimateBridgeFee(BridgeRequest calldata request) external pure returns (uint256 fee) {
        return request.amount / 750;
    }

    function executeBridge(BridgeRequest calldata request) external returns (bytes32 receiptHash) {
        require(supportedChains[request.targetChainId], "chain unsupported");
        require(request.amount > 0, "amount zero");
        if (!simulationMode) {
            require(spokePool != address(0), "spoke pool unset");
            revert("real Across execution not wired");
        }
        receiptHash = keccak256(abi.encode("ACROSS_SIM", request.intentId, request.targetChainId, request.amount, block.timestamp));
        emit AcrossIntentSimulated(request.intentId, request.targetChainId, request.asset, request.amount, receiptHash);
    }
}
