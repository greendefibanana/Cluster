// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";

contract AgentIdentityRegistry is Ownable {
    enum Status {
        Unknown,
        Active,
        Paused,
        Retired
    }

    struct AgentIdentity {
        uint256 agentId;
        address agentNft;
        address tba;
        address owner;
        string role;
        string metadataURI;
        string zeroGStorageURI;
        Status status;
    }

    mapping(bytes32 => AgentIdentity) private _identities;
    mapping(address => bool) public trustedRegistrars;

    event RegistrarSet(address indexed registrar, bool allowed);
    event AgentRegistered(
        uint256 indexed agentId,
        address indexed agentNft,
        address indexed tba,
        address owner,
        string role,
        string metadataURI,
        string zeroGStorageURI
    );
    event AgentStatusUpdated(uint256 indexed agentId, address indexed agentNft, Status status);
    event AgentStorageURIUpdated(uint256 indexed agentId, address indexed agentNft, string zeroGStorageURI);
    event AgentOwnerUpdated(uint256 indexed agentId, address indexed agentNft, address indexed owner);

    constructor(address initialOwner) {
        transferOwnership(initialOwner);
    }

    modifier onlyTrustedRegistrar() {
        require(trustedRegistrars[msg.sender] || msg.sender == owner(), "not registrar");
        _;
    }

    function setTrustedRegistrar(address registrar, bool allowed) external onlyOwner {
        trustedRegistrars[registrar] = allowed;
        emit RegistrarSet(registrar, allowed);
    }

    function registerAgent(
        uint256 agentId,
        address agentNft,
        address tba,
        address agentOwner,
        string calldata role,
        string calldata metadataURI,
        string calldata zeroGStorageURI
    ) external onlyTrustedRegistrar {
        require(agentNft != address(0), "invalid nft");
        require(tba != address(0), "invalid tba");
        require(agentOwner != address(0), "invalid owner");

        bytes32 key = identityKey(agentNft, agentId);
        _identities[key] = AgentIdentity({
            agentId: agentId,
            agentNft: agentNft,
            tba: tba,
            owner: agentOwner,
            role: role,
            metadataURI: metadataURI,
            zeroGStorageURI: zeroGStorageURI,
            status: Status.Active
        });

        emit AgentRegistered(agentId, agentNft, tba, agentOwner, role, metadataURI, zeroGStorageURI);
    }

    function updateStatus(address agentNft, uint256 agentId, Status status) external onlyOwner {
        bytes32 key = identityKey(agentNft, agentId);
        require(_identities[key].tba != address(0), "unknown agent");
        _identities[key].status = status;
        emit AgentStatusUpdated(agentId, agentNft, status);
    }

    function updateOwner(address agentNft, uint256 agentId, address agentOwner) external onlyTrustedRegistrar {
        require(agentOwner != address(0), "invalid owner");
        bytes32 key = identityKey(agentNft, agentId);
        require(_identities[key].tba != address(0), "unknown agent");
        _identities[key].owner = agentOwner;
        emit AgentOwnerUpdated(agentId, agentNft, agentOwner);
    }

    function updateZeroGStorageURI(address agentNft, uint256 agentId, string calldata zeroGStorageURI) external onlyOwner {
        bytes32 key = identityKey(agentNft, agentId);
        require(_identities[key].tba != address(0), "unknown agent");
        _identities[key].zeroGStorageURI = zeroGStorageURI;
        emit AgentStorageURIUpdated(agentId, agentNft, zeroGStorageURI);
    }

    function getAgent(address agentNft, uint256 agentId) external view returns (AgentIdentity memory) {
        return _identities[identityKey(agentNft, agentId)];
    }

    function identityKey(address agentNft, uint256 agentId) public pure returns (bytes32) {
        return keccak256(abi.encode(agentNft, agentId));
    }
}
