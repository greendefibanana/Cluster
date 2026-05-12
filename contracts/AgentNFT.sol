// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Base64} from "@openzeppelin/contracts/utils/Base64.sol";
import {ERC721} from "@openzeppelin/contracts/token/ERC721/ERC721.sol";
import {ERC721Enumerable} from "@openzeppelin/contracts/token/ERC721/extensions/ERC721Enumerable.sol";
import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {Strings} from "@openzeppelin/contracts/utils/Strings.sol";
import {IERC6551Registry} from "./interfaces/IERC6551Registry.sol";
import {IAgentIdentityRegistry} from "./interfaces/IAgentIdentityRegistry.sol";
import {PerformanceRank} from "./PerformanceRank.sol";
import {MetadataEscaper} from "./libraries/MetadataEscaper.sol";

contract AgentNFT is ERC721Enumerable, Ownable {
    using Strings for uint256;

    struct AgentProfile {
        string name;
        string role;
        string description;
    }

    uint256 public nextTokenId = 1;
    address public immutable accountImplementation;
    IERC6551Registry public immutable registry;
    PerformanceRank public immutable performanceRank;
    IAgentIdentityRegistry public identityRegistry;

    mapping(uint256 => AgentProfile) public agentProfiles;
    mapping(uint256 => bytes32) public accountSalts;
    mapping(uint256 => address) public tbas;

    event AgentMinted(uint256 indexed agentId, address indexed owner, address indexed tba, string role);
    event IdentityRegistrySet(address indexed identityRegistry);

    constructor(
        address initialOwner,
        address registryAddress,
        address accountImplementationAddress,
        address performanceRankAddress
    ) ERC721("Tradeable Agent Workforce", "AGENT") {
        transferOwnership(initialOwner);
        registry = IERC6551Registry(registryAddress);
        accountImplementation = accountImplementationAddress;
        performanceRank = PerformanceRank(performanceRankAddress);
    }

    function mintAgent(
        address to,
        string calldata name,
        string calldata role,
        string calldata description,
        bytes32 salt
    ) external returns (uint256 agentId, address tba) {
        agentId = nextTokenId++;
        _safeMint(to, agentId);
        agentProfiles[agentId] = AgentProfile({name: name, role: role, description: description});
        accountSalts[agentId] = salt;
        tba = registry.createAccount(accountImplementation, salt, block.chainid, address(this), agentId);
        tbas[agentId] = tba;
        if (address(identityRegistry) != address(0)) {
            identityRegistry.registerAgent(agentId, address(this), tba, to, role, tokenURI(agentId), "");
        }
        emit AgentMinted(agentId, to, tba, role);
    }

    function setIdentityRegistry(address identityRegistryAddress) external onlyOwner {
        identityRegistry = IAgentIdentityRegistry(identityRegistryAddress);
        emit IdentityRegistrySet(identityRegistryAddress);
    }

    function intelligenceScore(uint256 agentId) external view returns (uint256) {
        return performanceRank.intelligenceScore(agentId);
    }

    function tokenURI(uint256 tokenId) public view override returns (string memory) {
        require(_exists(tokenId), "nonexistent token");
        AgentProfile memory profile = agentProfiles[tokenId];
        address tba = tbas[tokenId];
        uint256 score = performanceRank.intelligenceScore(tokenId);
        uint256 level = 1 + (score / 10);
        uint256 slots = 1 + ((level - 1) / 10);

        string memory svgName = MetadataEscaper.escapeSvgText(profile.name);
        string memory svgRole = MetadataEscaper.escapeSvgText(profile.role);
        string memory jsonName = MetadataEscaper.escapeJson(profile.name);
        string memory jsonRole = MetadataEscaper.escapeJson(profile.role);
        string memory jsonDesc = MetadataEscaper.escapeJson(profile.description);

        string memory svg = string.concat(
            '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 420 420">',
            '<rect width="420" height="420" fill="#0b1220"/>',
            '<rect x="20" y="20" width="380" height="380" rx="28" fill="#111827" stroke="#f3ba2f"/>',
            '<text x="36" y="70" fill="#f3ba2f" font-size="22" font-family="monospace">Agent NFT</text>',
            '<text x="36" y="160" fill="#ffffff" font-size="28" font-family="monospace">',
            svgName,
            "</text>",
            '<text x="36" y="210" fill="#93c5fd" font-size="20" font-family="monospace">',
            svgRole,
            "</text></svg>"
        );
        string memory json = string.concat(
            '{"name":"',
            jsonName,
            ' #',
            tokenId.toString(),
            '","description":"',
            jsonDesc,
            '","attributes":[{"trait_type":"Role","value":"',
            jsonRole,
            '"},{"trait_type":"TBA","value":"',
            Strings.toHexString(uint160(tba), 20),
            '"},{"trait_type":"Intelligence Score","value":"',
            score.toString(),
            '"},{"trait_type":"Level","value":"',
            level.toString(),
            '"},{"trait_type":"Skill Slots","value":"',
            slots.toString(),
            '"}],"image":"data:image/svg+xml;base64,',
            Base64.encode(bytes(svg)),
            '"}'
        );
        return string.concat("data:application/json;base64,", Base64.encode(bytes(json)));
    }

    function _beforeTokenTransfer(address from, address to, uint256 tokenId, uint256 batchSize)
        internal
        override(ERC721Enumerable)
    {
        super._beforeTokenTransfer(from, to, tokenId, batchSize);
        if (from != address(0) && to != address(0) && address(identityRegistry) != address(0)) {
            identityRegistry.updateOwner(address(this), tokenId, to);
        }
    }

    function supportsInterface(bytes4 interfaceId)
        public
        view
        override(ERC721Enumerable)
        returns (bool)
    {
        return super.supportsInterface(interfaceId);
    }
}
