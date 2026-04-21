// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Base64} from "@openzeppelin/contracts/utils/Base64.sol";
import {ERC1155} from "@openzeppelin/contracts/token/ERC1155/ERC1155.sol";
import {ERC1155Supply} from "@openzeppelin/contracts/token/ERC1155/extensions/ERC1155Supply.sol";
import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {Strings} from "@openzeppelin/contracts/utils/Strings.sol";
import {MetadataEscaper} from "./libraries/MetadataEscaper.sol";

contract SkillNFT is ERC1155Supply, Ownable {
    using Strings for uint256;

    struct SkillData {
        string name;
        string skillType;
        string capabilityTag;
        string description;
        string skillMarkdown;
    }

    uint256 public nextSkillId = 1;
    mapping(uint256 => SkillData) internal _skillData;
    mapping(uint256 => bool) internal _definedSkills;
    mapping(uint256 => bool) public publicMintable;
    mapping(address => bool) public authorizedManagers;

    event SkillDefined(uint256 indexed skillId, string skillType, string capabilityTag);
    event SkillMinted(uint256 indexed skillId, address indexed to, uint256 amount);
    event ManagerSet(address indexed manager, bool allowed);

    constructor(address initialOwner) ERC1155("") {
        transferOwnership(initialOwner);
    }

    function defineSkill(
        string calldata name,
        string calldata skillType,
        string calldata capabilityTag,
        string calldata description,
        string calldata skillMarkdown
    ) external onlyOwner returns (uint256 skillId) {
        skillId = nextSkillId++;
        _definedSkills[skillId] = true;
        _skillData[skillId] = SkillData({
            name: name,
            skillType: skillType,
            capabilityTag: capabilityTag,
            description: description,
            skillMarkdown: skillMarkdown
        });
        emit SkillDefined(skillId, skillType, capabilityTag);
    }

    function mintSkill(address to, uint256 skillId, uint256 amount) external onlyOwner {
        require(isDefined(skillId), "undefined skill");
        _mint(to, skillId, amount, "");
        emit SkillMinted(skillId, to, amount);
    }

    function setPublicMintable(uint256 skillId, bool allowed) external onlyOwner {
        require(isDefined(skillId), "undefined skill");
        publicMintable[skillId] = allowed;
    }

    function publicMintSkill(uint256 skillId, uint256 amount) external {
        require(isDefined(skillId), "undefined skill");
        require(publicMintable[skillId], "skill not public");
        _mint(msg.sender, skillId, amount, "");
        emit SkillMinted(skillId, msg.sender, amount);
    }

    function setManager(address manager, bool allowed) external onlyOwner {
        authorizedManagers[manager] = allowed;
        emit ManagerSet(manager, allowed);
    }

    function managerTransfer(address from, address to, uint256 skillId, uint256 amount) external {
        require(authorizedManagers[msg.sender], "not manager");
        _safeTransferFrom(from, to, skillId, amount, "");
    }

    function getSkill(uint256 skillId)
        external
        view
        returns (
            string memory name,
            string memory skillType,
            string memory capabilityTag,
            string memory description,
            string memory skillMarkdown
        )
    {
        require(isDefined(skillId), "undefined skill");
        SkillData memory skill = _skillData[skillId];
        return (skill.name, skill.skillType, skill.capabilityTag, skill.description, skill.skillMarkdown);
    }

    function uri(uint256 skillId) public view override returns (string memory) {
        require(isDefined(skillId), "undefined skill");
        SkillData memory skill = _skillData[skillId];
        string memory svgName = MetadataEscaper.escapeSvgText(skill.name);
        string memory svgType = MetadataEscaper.escapeSvgText(skill.skillType);
        string memory svgCap = MetadataEscaper.escapeSvgText(skill.capabilityTag);
        string memory jsonName = MetadataEscaper.escapeJson(skill.name);
        string memory jsonType = MetadataEscaper.escapeJson(skill.skillType);
        string memory jsonCap = MetadataEscaper.escapeJson(skill.capabilityTag);
        string memory jsonDesc = MetadataEscaper.escapeJson(skill.description);

        string memory image = _svgImage(svgName, svgType, svgCap);
        string memory json = string.concat(
            '{"name":"',
            jsonName,
            ' #',
            skillId.toString(),
            '","description":"',
            jsonDesc,
            '","attributes":[{"trait_type":"Skill Type","value":"',
            jsonType,
            '"},{"trait_type":"Capability","value":"',
            jsonCap,
            '"}],"image":"data:image/svg+xml;base64,',
            Base64.encode(bytes(image)),
            '","skill_md_b64":"',
            Base64.encode(bytes(skill.skillMarkdown)),
            '"}'
        );
        return string.concat("data:application/json;base64,", Base64.encode(bytes(json)));
    }

    function totalSkillTypes() external view returns (uint256) {
        return nextSkillId - 1;
    }

    function skillTypeOf(uint256 skillId) external view returns (string memory) {
        require(isDefined(skillId), "undefined skill");
        return _skillData[skillId].skillType;
    }

    function capabilityOf(uint256 skillId) external view returns (string memory) {
        require(isDefined(skillId), "undefined skill");
        return _skillData[skillId].capabilityTag;
    }

    function isDefined(uint256 skillId) public view returns (bool) {
        return _definedSkills[skillId];
    }

    function _svgImage(
        string memory name,
        string memory skillType,
        string memory capabilityTag
    ) internal pure returns (string memory) {
        return string.concat(
            '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 420 420">',
            '<rect width="420" height="420" fill="#131722"/>',
            '<rect x="20" y="20" width="380" height="380" rx="24" fill="#1f2937" stroke="#f3ba2f" />',
            '<text x="36" y="72" fill="#f3ba2f" font-size="22" font-family="monospace">Skill SFT</text>',
            '<text x="36" y="170" fill="#ffffff" font-size="26" font-family="monospace">',
            name,
            "</text>",
            '<text x="36" y="220" fill="#9ca3af" font-size="18" font-family="monospace">',
            skillType,
            "</text>",
            '<text x="36" y="258" fill="#93c5fd" font-size="16" font-family="monospace">',
            capabilityTag,
            "</text></svg>"
        );
    }
}
