// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";

contract AgentReputationRegistry is Ownable {
    enum SubjectType {
        Agent,
        Cluster
    }

    struct ReputationEvent {
        SubjectType subjectType;
        uint256 subjectId;
        bytes32 strategyId;
        string eventType;
        int256 scoreDelta;
        int256 pnlDelta;
        int256 tvlDelta;
        string proofURI;
        uint256 timestamp;
    }

    ReputationEvent[] private _events;
    mapping(bytes32 => uint256[]) private _subjectEvents;
    mapping(address => bool) public trustedWriters;

    event WriterSet(address indexed writer, bool allowed);
    event ReputationRecorded(
        uint256 indexed eventId,
        SubjectType indexed subjectType,
        uint256 indexed subjectId,
        bytes32 strategyId,
        string eventType,
        int256 scoreDelta,
        int256 pnlDelta,
        int256 tvlDelta,
        string proofURI
    );

    constructor(address initialOwner) {
        transferOwnership(initialOwner);
    }

    modifier onlyWriter() {
        require(trustedWriters[msg.sender] || msg.sender == owner(), "not writer");
        _;
    }

    function setTrustedWriter(address writer, bool allowed) external onlyOwner {
        trustedWriters[writer] = allowed;
        emit WriterSet(writer, allowed);
    }

    function recordEvent(
        SubjectType subjectType,
        uint256 subjectId,
        bytes32 strategyId,
        string calldata eventType,
        int256 scoreDelta,
        int256 pnlDelta,
        int256 tvlDelta,
        string calldata proofURI
    ) external onlyWriter returns (uint256 eventId) {
        eventId = _events.length;
        _events.push(
            ReputationEvent({
                subjectType: subjectType,
                subjectId: subjectId,
                strategyId: strategyId,
                eventType: eventType,
                scoreDelta: scoreDelta,
                pnlDelta: pnlDelta,
                tvlDelta: tvlDelta,
                proofURI: proofURI,
                timestamp: block.timestamp
            })
        );
        _subjectEvents[subjectKey(subjectType, subjectId)].push(eventId);
        emit ReputationRecorded(eventId, subjectType, subjectId, strategyId, eventType, scoreDelta, pnlDelta, tvlDelta, proofURI);
    }

    function getEvent(uint256 eventId) external view returns (ReputationEvent memory) {
        return _events[eventId];
    }

    function getSubjectEventIds(SubjectType subjectType, uint256 subjectId) external view returns (uint256[] memory) {
        return _subjectEvents[subjectKey(subjectType, subjectId)];
    }

    function totalEvents() external view returns (uint256) {
        return _events.length;
    }

    function subjectKey(SubjectType subjectType, uint256 subjectId) public pure returns (bytes32) {
        return keccak256(abi.encode(subjectType, subjectId));
    }
}
