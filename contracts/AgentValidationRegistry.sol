// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";

contract AgentValidationRegistry is Ownable {
    enum SubjectType {
        Agent,
        Cluster
    }

    enum ClaimStatus {
        Pending,
        Valid,
        Invalid
    }

    struct Claim {
        bytes32 claimHash;
        SubjectType subjectType;
        uint256 subjectId;
        bytes32 strategyId;
        string claimType;
        string proofURI;
        address validator;
        ClaimStatus status;
        uint256 updatedAt;
    }

    mapping(bytes32 => Claim) private _claims;
    mapping(bytes32 => bytes32[]) private _subjectClaims;
    mapping(address => bool) public trustedSubmitters;

    event SubmitterSet(address indexed submitter, bool allowed);
    event ClaimSubmitted(
        bytes32 indexed claimHash,
        SubjectType indexed subjectType,
        uint256 indexed subjectId,
        bytes32 strategyId,
        string claimType,
        string proofURI,
        address validator
    );
    event ClaimStatusUpdated(bytes32 indexed claimHash, ClaimStatus status, address indexed validator);

    constructor(address initialOwner) {
        transferOwnership(initialOwner);
    }

    modifier onlySubmitter() {
        require(trustedSubmitters[msg.sender] || msg.sender == owner(), "not submitter");
        _;
    }

    function setTrustedSubmitter(address submitter, bool allowed) external onlyOwner {
        trustedSubmitters[submitter] = allowed;
        emit SubmitterSet(submitter, allowed);
    }

    function submitClaim(
        bytes32 claimHash,
        SubjectType subjectType,
        uint256 subjectId,
        bytes32 strategyId,
        string calldata claimType,
        string calldata proofURI,
        address validator
    ) external onlySubmitter {
        require(claimHash != bytes32(0), "invalid claim");
        require(validator != address(0), "invalid validator");
        require(_claims[claimHash].claimHash == bytes32(0), "claim exists");

        _claims[claimHash] = Claim({
            claimHash: claimHash,
            subjectType: subjectType,
            subjectId: subjectId,
            strategyId: strategyId,
            claimType: claimType,
            proofURI: proofURI,
            validator: validator,
            status: ClaimStatus.Pending,
            updatedAt: block.timestamp
        });
        _subjectClaims[subjectKey(subjectType, subjectId)].push(claimHash);
        emit ClaimSubmitted(claimHash, subjectType, subjectId, strategyId, claimType, proofURI, validator);
    }

    function updateClaimStatus(bytes32 claimHash, ClaimStatus status) external {
        Claim storage claim = _claims[claimHash];
        require(claim.claimHash != bytes32(0), "unknown claim");
        require(msg.sender == claim.validator || msg.sender == owner(), "not validator");
        claim.status = status;
        claim.updatedAt = block.timestamp;
        emit ClaimStatusUpdated(claimHash, status, msg.sender);
    }

    function getClaim(bytes32 claimHash) external view returns (Claim memory) {
        return _claims[claimHash];
    }

    function getSubjectClaims(SubjectType subjectType, uint256 subjectId) external view returns (bytes32[] memory) {
        return _subjectClaims[subjectKey(subjectType, subjectId)];
    }

    function subjectKey(SubjectType subjectType, uint256 subjectId) public pure returns (bytes32) {
        return keccak256(abi.encode(subjectType, subjectId));
    }
}
