// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Pausable} from "@openzeppelin/contracts/security/Pausable.sol";
import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {SkillNFT} from "./SkillNFT.sol";
import {AgentNFT} from "./AgentNFT.sol";
import {PerformanceRank} from "./PerformanceRank.sol";

contract AgentSkillManager is Pausable, Ownable {
    AgentNFT public immutable agentCollection;
    SkillNFT public immutable skillCollection;
    PerformanceRank public immutable performanceRank;

    mapping(uint256 => mapping(uint256 => uint256)) public equippedBalance;
    mapping(uint256 => uint256[]) internal _equippedSkillIds;
    mapping(uint256 => mapping(uint256 => bool)) internal _hasSkillId;

    event SkillEquipped(uint256 indexed agentId, uint256 indexed skillId, uint256 amount, address indexed tba);
    event SkillUnequipped(uint256 indexed agentId, uint256 indexed skillId, uint256 amount, address indexed recipient);

    constructor(address agentCollectionAddress, address skillCollectionAddress, address performanceRankAddress) {
        agentCollection = AgentNFT(agentCollectionAddress);
        skillCollection = SkillNFT(skillCollectionAddress);
        performanceRank = PerformanceRank(performanceRankAddress);
        _transferOwnership(msg.sender);
    }

    function pause() external onlyOwner {
        _pause();
    }

    function unpause() external onlyOwner {
        _unpause();
    }

    function agentLevel(uint256 agentId) public view returns (uint256) {
        return 1 + (performanceRank.intelligenceScore(agentId) / 10);
    }

    function skillSlots(uint256 agentId) public view returns (uint256) {
        uint256 level = agentLevel(agentId);
        return 1 + ((level - 1) / 10);
    }

    function equippedSkillCount(uint256 agentId) public view returns (uint256) {
        return _equippedSkillIds[agentId].length;
    }

    function equippedSkillIds(uint256 agentId) external view returns (uint256[] memory) {
        return _equippedSkillIds[agentId];
    }

    function canEquipSkill(uint256 agentId, uint256 skillId) public view returns (bool) {
        if (_hasSkillId[agentId][skillId]) {
            return true;
        }
        return _equippedSkillIds[agentId].length < skillSlots(agentId);
    }

    function equipSkill(uint256 agentId, uint256 skillId, uint256 amount) external whenNotPaused {
        require(amount > 0, "amount zero");
        require(agentCollection.ownerOf(agentId) == msg.sender, "not agent owner");
        require(skillCollection.balanceOf(msg.sender, skillId) >= amount, "insufficient skill balance");
        require(canEquipSkill(agentId, skillId), "no free skill slots");

        address tba = agentCollection.tbas(agentId);
        require(tba != address(0), "agent has no tba");

        if (!_hasSkillId[agentId][skillId]) {
            _hasSkillId[agentId][skillId] = true;
            _equippedSkillIds[agentId].push(skillId);
        }

        equippedBalance[agentId][skillId] += amount;
        skillCollection.safeTransferFrom(msg.sender, tba, skillId, amount, "");
        emit SkillEquipped(agentId, skillId, amount, tba);
    }

    function unequipSkill(uint256 agentId, uint256 skillId, uint256 amount, address recipient) external whenNotPaused {
        require(amount > 0, "amount zero");
        require(recipient != address(0), "invalid recipient");
        require(agentCollection.ownerOf(agentId) == msg.sender, "not agent owner");
        require(equippedBalance[agentId][skillId] >= amount, "insufficient equipped balance");

        address tba = agentCollection.tbas(agentId);
        require(tba != address(0), "agent has no tba");

        equippedBalance[agentId][skillId] -= amount;
        if (equippedBalance[agentId][skillId] == 0) {
            _hasSkillId[agentId][skillId] = false;
            _removeEquippedSkillId(agentId, skillId);
        }

        skillCollection.managerTransfer(tba, recipient, skillId, amount);
        emit SkillUnequipped(agentId, skillId, amount, recipient);
    }

    function hasCapability(uint256 agentId, string memory capabilityTag) public view returns (bool) {
        address tba = agentCollection.tbas(agentId);
        uint256[] memory skillIds = _equippedSkillIds[agentId];
        for (uint256 i = 0; i < skillIds.length; i++) {
            uint256 skillId = skillIds[i];
            if (skillCollection.balanceOf(tba, skillId) == 0) {
                continue;
            }
            if (_same(skillCollection.capabilityOf(skillId), capabilityTag)) {
                return true;
            }
        }
        return false;
    }

    function canPost(uint256 agentId) external view returns (bool) {
        return hasCapability(agentId, "creative_content");
    }

    function _same(string memory a, string memory b) private pure returns (bool) {
        return keccak256(bytes(a)) == keccak256(bytes(b));
    }

    function _removeEquippedSkillId(uint256 agentId, uint256 skillId) private {
        uint256[] storage skillIds = _equippedSkillIds[agentId];
        uint256 length = skillIds.length;
        for (uint256 i = 0; i < length; i++) {
            if (skillIds[i] == skillId) {
                if (i != length - 1) {
                    skillIds[i] = skillIds[length - 1];
                }
                skillIds.pop();
                break;
            }
        }
    }
}
