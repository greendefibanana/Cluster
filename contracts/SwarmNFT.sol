// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Base64} from "@openzeppelin/contracts/utils/Base64.sol";
import {ERC721} from "@openzeppelin/contracts/token/ERC721/ERC721.sol";
import {ERC721Enumerable} from "@openzeppelin/contracts/token/ERC721/extensions/ERC721Enumerable.sol";
import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {Strings} from "@openzeppelin/contracts/utils/Strings.sol";
import {IERC6551Registry} from "./interfaces/IERC6551Registry.sol";
import {MetadataEscaper} from "./libraries/MetadataEscaper.sol";

contract SwarmNFT is ERC721Enumerable, Ownable {
    using Strings for uint256;

    struct SwarmProfile {
        string name;
        string strategy;
        string description;
    }

    uint256 public nextTokenId = 1;
    address public immutable accountImplementation;
    IERC6551Registry public immutable registry;

    mapping(uint256 => SwarmProfile) public swarmProfiles;
    mapping(uint256 => bytes32) public accountSalts;
    mapping(uint256 => address) public tbas;

    event SwarmMinted(uint256 indexed swarmId, address indexed owner, address indexed tba, string strategy);

    constructor(
        address initialOwner,
        address registryAddress,
        address accountImplementationAddress
    ) ERC721("Tradeable Agent Swarm", "SWARM") {
        transferOwnership(initialOwner);
        registry = IERC6551Registry(registryAddress);
        accountImplementation = accountImplementationAddress;
    }

    function mintSwarm(
        address to,
        string calldata name,
        string calldata strategy,
        string calldata description,
        bytes32 salt
    ) external returns (uint256 swarmId, address tba) {
        swarmId = nextTokenId++;
        _safeMint(to, swarmId);
        swarmProfiles[swarmId] = SwarmProfile({name: name, strategy: strategy, description: description});
        accountSalts[swarmId] = salt;
        tba = registry.createAccount(accountImplementation, salt, block.chainid, address(this), swarmId);
        tbas[swarmId] = tba;
        emit SwarmMinted(swarmId, to, tba, strategy);
    }

    function tokenURI(uint256 tokenId) public view override returns (string memory) {
        require(_exists(tokenId), "nonexistent token");
        SwarmProfile memory profile = swarmProfiles[tokenId];
        address tba = tbas[tokenId];

        string memory svgName = MetadataEscaper.escapeSvgText(profile.name);
        string memory svgStrategy = MetadataEscaper.escapeSvgText(profile.strategy);
        string memory jsonName = MetadataEscaper.escapeJson(profile.name);
        string memory jsonStrategy = MetadataEscaper.escapeJson(profile.strategy);
        string memory jsonDesc = MetadataEscaper.escapeJson(profile.description);

        string memory svg = string.concat(
            '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 420 420">',
            '<rect width="420" height="420" fill="#0d1321"/>',
            '<rect x="20" y="20" width="380" height="380" rx="28" fill="#111827" stroke="#22c55e"/>',
            '<text x="36" y="70" fill="#22c55e" font-size="22" font-family="monospace">Swarm NFT</text>',
            '<text x="36" y="160" fill="#ffffff" font-size="28" font-family="monospace">',
            svgName,
            "</text>",
            '<text x="36" y="210" fill="#86efac" font-size="20" font-family="monospace">',
            svgStrategy,
            "</text></svg>"
        );
        string memory json = string.concat(
            '{"name":"',
            jsonName,
            ' #',
            tokenId.toString(),
            '","description":"',
            jsonDesc,
            '","attributes":[{"trait_type":"Strategy","value":"',
            jsonStrategy,
            '"},{"trait_type":"TBA","value":"',
            Strings.toHexString(uint160(tba), 20),
            '"}],"image":"data:image/svg+xml;base64,',
            Base64.encode(bytes(svg)),
            '"}'
        );
        return string.concat("data:application/json;base64,", Base64.encode(bytes(json)));
    }
}
