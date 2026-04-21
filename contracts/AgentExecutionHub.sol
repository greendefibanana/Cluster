// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {IERC721} from "@openzeppelin/contracts/token/ERC721/IERC721.sol";
import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {IERC6551Account} from "./interfaces/IERC6551Account.sol";
import {AgentNFT} from "./AgentNFT.sol";
import {SwarmNFT} from "./SwarmNFT.sol";
import {AgentSkillManager} from "./AgentSkillManager.sol";

contract AgentExecutionHub is Ownable {
    struct ActionPolicy {
        bool enabled;
        string capabilityTag;
    }

    AgentNFT public immutable agentCollection;
    SwarmNFT public immutable swarmCollection;
    AgentSkillManager public immutable skillManager;

    mapping(address => mapping(bytes4 => ActionPolicy)) private _targetPolicies;
    mapping(bytes4 => ActionPolicy) private _globalPolicies;

    event WorkerExecution(uint256 indexed masterAgentId, uint256 indexed workerAgentId, address indexed target, bytes data);
    event SwarmWorkerExecution(uint256 indexed swarmId, uint256 indexed workerAgentId, address indexed target, bytes data);
    event TargetPolicySet(address indexed target, bytes4 indexed selector, string capabilityTag, bool enabled);
    event GlobalPolicySet(bytes4 indexed selector, string capabilityTag, bool enabled);

    constructor(address agentCollectionAddress, address swarmCollectionAddress, address skillManagerAddress) {
        agentCollection = AgentNFT(agentCollectionAddress);
        swarmCollection = SwarmNFT(swarmCollectionAddress);
        skillManager = AgentSkillManager(skillManagerAddress);
        _transferOwnership(msg.sender);
    }

    function setTargetPolicy(address target, bytes4 selector, string calldata capabilityTag, bool enabled) external onlyOwner {
        require(target != address(0), "invalid target");
        if (enabled) {
            _targetPolicies[target][selector] = ActionPolicy({enabled: true, capabilityTag: capabilityTag});
        } else {
            delete _targetPolicies[target][selector];
        }
        emit TargetPolicySet(target, selector, capabilityTag, enabled);
    }

    function setGlobalPolicy(bytes4 selector, string calldata capabilityTag, bool enabled) external onlyOwner {
        if (enabled) {
            _globalPolicies[selector] = ActionPolicy({enabled: true, capabilityTag: capabilityTag});
        } else {
            delete _globalPolicies[selector];
        }
        emit GlobalPolicySet(selector, capabilityTag, enabled);
    }

    function getTargetPolicy(address target, bytes4 selector) external view returns (bool enabled, string memory capabilityTag) {
        ActionPolicy storage policy = _targetPolicies[target][selector];
        return (policy.enabled, policy.capabilityTag);
    }

    function getGlobalPolicy(bytes4 selector) external view returns (bool enabled, string memory capabilityTag) {
        ActionPolicy storage policy = _globalPolicies[selector];
        return (policy.enabled, policy.capabilityTag);
    }

    function executeWorkerAction(
        uint256 masterAgentId,
        address masterTba,
        uint256 workerAgentId,
        address workerTba,
        address target,
        uint256 value,
        bytes calldata data
    ) external returns (bytes memory result) {
        require(agentCollection.ownerOf(masterAgentId) == msg.sender, "caller is not master owner");
        require(masterTba == agentCollection.tbas(masterAgentId), "invalid master TBA");
        require(workerTba == agentCollection.tbas(workerAgentId), "invalid worker TBA");
        require(agentCollection.ownerOf(workerAgentId) == masterTba, "worker not owned by master");
        _validateTarget(target);
        _enforcePolicy(target, data, workerAgentId);

        bytes memory nestedCall = abi.encodeWithSelector(
            IERC6551Account.execute.selector,
            target,
            value,
            data,
            uint8(0)
        );

        result = IERC6551Account(masterTba).execute(workerTba, 0, nestedCall, 0);
        emit WorkerExecution(masterAgentId, workerAgentId, target, data);
    }

    function executeSwarmWorkerAction(
        uint256 swarmId,
        address swarmTba,
        uint256 workerAgentId,
        address workerTba,
        address target,
        uint256 value,
        bytes calldata data
    ) external returns (bytes memory result) {
        require(swarmCollection.ownerOf(swarmId) == msg.sender, "caller is not swarm owner");
        require(swarmTba == swarmCollection.tbas(swarmId), "invalid swarm TBA");
        require(workerTba == agentCollection.tbas(workerAgentId), "invalid worker TBA");
        require(agentCollection.ownerOf(workerAgentId) == swarmTba, "worker not owned by swarm");
        _validateTarget(target);
        _enforcePolicy(target, data, workerAgentId);

        bytes memory nestedCall = abi.encodeWithSelector(
            IERC6551Account.execute.selector,
            target,
            value,
            data,
            uint8(0)
        );

        result = IERC6551Account(swarmTba).execute(workerTba, 0, nestedCall, 0);
        emit SwarmWorkerExecution(swarmId, workerAgentId, target, data);
    }

    function _enforcePolicy(address target, bytes calldata data, uint256 workerAgentId) private view {
        bytes4 selector = _selectorFromCalldata(data);
        (bool enabled, string memory capabilityTag) = _resolvePolicy(target, selector);
        require(enabled, "action not allowed");

        if (bytes(capabilityTag).length > 0) {
            require(skillManager.hasCapability(workerAgentId, capabilityTag), "missing required capability");
        }
    }

    function _resolvePolicy(address target, bytes4 selector) private view returns (bool enabled, string memory capabilityTag) {
        ActionPolicy storage targetPolicy = _targetPolicies[target][selector];
        if (targetPolicy.enabled) {
            return (true, targetPolicy.capabilityTag);
        }

        ActionPolicy storage globalPolicy = _globalPolicies[selector];
        return (globalPolicy.enabled, globalPolicy.capabilityTag);
    }

    function _selectorFromCalldata(bytes calldata data) private pure returns (bytes4 selector) {
        require(data.length >= 4, "invalid calldata");
        assembly {
            selector := calldataload(data.offset)
        }
    }

    function _validateTarget(address target) private view {
        require(target != address(0), "invalid target");
        require(target.code.length > 0, "target must be contract");
    }
}
