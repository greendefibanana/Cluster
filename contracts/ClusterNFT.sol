// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Base64} from "@openzeppelin/contracts/utils/Base64.sol";
import {ERC721} from "@openzeppelin/contracts/token/ERC721/ERC721.sol";
import {ERC721Enumerable} from "@openzeppelin/contracts/token/ERC721/extensions/ERC721Enumerable.sol";
import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {Strings} from "@openzeppelin/contracts/utils/Strings.sol";
import {IERC6551Registry} from "./interfaces/IERC6551Registry.sol";
import {MetadataEscaper} from "./libraries/MetadataEscaper.sol";

contract ClusterNFT is ERC721Enumerable, Ownable {
    using Strings for uint256;

    struct ClusterProfile {
        string name;
        string strategy;
        string description;
        string zeroGStorageURI;
    }

    uint256 public nextTokenId = 1;
    address public immutable accountImplementation;
    IERC6551Registry public immutable registry;

    mapping(uint256 => ClusterProfile) public clusterProfiles;
    mapping(uint256 => bytes32) public accountSalts;
    mapping(uint256 => address) public tbas;

    event ClusterMinted(uint256 indexed clusterId, address indexed owner, address indexed tba, string strategy, string zeroGStorageURI);
    event ClusterStorageUpdated(uint256 indexed clusterId, string zeroGStorageURI);

    constructor(
        address initialOwner,
        address registryAddress,
        address accountImplementationAddress
    ) ERC721("ClusterFi Agent Cluster", "CLUSTER") {
        transferOwnership(initialOwner);
        registry = IERC6551Registry(registryAddress);
        accountImplementation = accountImplementationAddress;
    }

    function mintCluster(
        address to,
        string calldata name,
        string calldata strategy,
        string calldata description,
        string calldata zeroGStorageURI,
        bytes32 salt
    ) external returns (uint256 clusterId, address tba) {
        clusterId = nextTokenId++;
        _safeMint(to, clusterId);
        clusterProfiles[clusterId] = ClusterProfile({
            name: name,
            strategy: strategy,
            description: description,
            zeroGStorageURI: zeroGStorageURI
        });
        accountSalts[clusterId] = salt;
        tba = registry.createAccount(accountImplementation, salt, block.chainid, address(this), clusterId);
        tbas[clusterId] = tba;
        emit ClusterMinted(clusterId, to, tba, strategy, zeroGStorageURI);
    }

    function updateZeroGStorageURI(uint256 clusterId, string calldata zeroGStorageURI) external {
        require(ownerOf(clusterId) == msg.sender || msg.sender == owner(), "not authorized");
        clusterProfiles[clusterId].zeroGStorageURI = zeroGStorageURI;
        emit ClusterStorageUpdated(clusterId, zeroGStorageURI);
    }

    function tokenURI(uint256 tokenId) public view override returns (string memory) {
        require(_exists(tokenId), "nonexistent token");
        ClusterProfile memory profile = clusterProfiles[tokenId];
        string memory jsonName = MetadataEscaper.escapeJson(profile.name);
        string memory jsonStrategy = MetadataEscaper.escapeJson(profile.strategy);
        string memory jsonDesc = MetadataEscaper.escapeJson(profile.description);
        string memory jsonZeroG = MetadataEscaper.escapeJson(profile.zeroGStorageURI);
        string memory svgName = MetadataEscaper.escapeSvgText(profile.name);
        string memory svgStrategy = MetadataEscaper.escapeSvgText(profile.strategy);

        string memory svg = string.concat(
            '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 420 420">',
            '<rect width="420" height="420" fill="#101418"/>',
            '<rect x="20" y="20" width="380" height="380" rx="24" fill="#171c20" stroke="#00f9be"/>',
            '<text x="36" y="70" fill="#00f9be" font-size="22" font-family="monospace">Cluster NFT</text>',
            '<text x="36" y="160" fill="#ffffff" font-size="27" font-family="monospace">',
            svgName,
            "</text>",
            '<text x="36" y="210" fill="#a4e6ff" font-size="18" font-family="monospace">',
            svgStrategy,
            "</text></svg>"
        );

        string memory json = string.concat(
            '{"name":"',
            jsonName,
            " #",
            tokenId.toString(),
            '","description":"',
            jsonDesc,
            '","attributes":[{"trait_type":"Strategy","value":"',
            jsonStrategy,
            '"},{"trait_type":"TBA","value":"',
            Strings.toHexString(uint160(tbas[tokenId]), 20),
            '"},{"trait_type":"0G Storage","value":"',
            jsonZeroG,
            '"}],"image":"data:image/svg+xml;base64,',
            Base64.encode(bytes(svg)),
            '"}'
        );
        return string.concat("data:application/json;base64,", Base64.encode(bytes(json)));
    }
}
