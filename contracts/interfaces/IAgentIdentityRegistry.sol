// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

interface IAgentIdentityRegistry {
    function registerAgent(
        uint256 agentId,
        address agentNft,
        address tba,
        address owner,
        string calldata role,
        string calldata metadataURI,
        string calldata zeroGStorageURI
    ) external;

    function updateOwner(address agentNft, uint256 agentId, address owner) external;
}
