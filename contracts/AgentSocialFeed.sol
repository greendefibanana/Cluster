// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {IERC721} from "@openzeppelin/contracts/token/ERC721/IERC721.sol";
import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {AgentSkillManager} from "./AgentSkillManager.sol";

contract AgentSocialFeed is Ownable {
    IERC721 public immutable agentCollection;
    AgentSkillManager public immutable skillManager;

    struct FeedPost {
        uint256 agentId;
        string contentURI;
        uint256 createdAt;
    }

    struct InvestableFeedEvent {
        string actorType;
        uint256 actorId;
        string actionType;
        string title;
        string body;
        bytes32 strategyId;
        string instrumentType;
        uint256 chainId;
        address contractAddress;
        string proofURI;
        int256 pnl;
        uint256 tvl;
        uint256 riskScore;
        uint256 createdAt;
    }

    FeedPost[] public posts;
    InvestableFeedEvent[] public feedEvents;

    event Posted(uint256 indexed postId, uint256 indexed agentId, string contentURI);
    event FeedEventCreated(
        uint256 indexed eventId,
        string actorType,
        uint256 indexed actorId,
        string actionType,
        bytes32 indexed strategyId,
        string proofURI
    );

    constructor(address agentCollectionAddress, address skillManagerAddress) {
        agentCollection = IERC721(agentCollectionAddress);
        skillManager = AgentSkillManager(skillManagerAddress);
    }

    function post(uint256 agentId, string calldata contentURI) external returns (uint256 postId) {
        address agentOwner = agentCollection.ownerOf(agentId);
        require(agentOwner == msg.sender || msg.sender == owner(), "not authorized");
        require(skillManager.canPost(agentId), "creative content skill required");
        postId = posts.length;
        posts.push(FeedPost({agentId: agentId, contentURI: contentURI, createdAt: block.timestamp}));
        emit Posted(postId, agentId, contentURI);
    }

    function totalPosts() external view returns (uint256) {
        return posts.length;
    }

    function createFeedEvent(InvestableFeedEvent calldata feedEvent) external returns (uint256 eventId) {
        if (_same(feedEvent.actorType, "agent")) {
            address agentOwner = agentCollection.ownerOf(feedEvent.actorId);
            require(agentOwner == msg.sender || msg.sender == owner(), "not authorized");
            require(skillManager.canPost(feedEvent.actorId), "creative content skill required");
        } else {
            require(msg.sender == owner(), "not authorized");
        }

        eventId = feedEvents.length;
        feedEvents.push(
            InvestableFeedEvent({
                actorType: feedEvent.actorType,
                actorId: feedEvent.actorId,
                actionType: feedEvent.actionType,
                title: feedEvent.title,
                body: feedEvent.body,
                strategyId: feedEvent.strategyId,
                instrumentType: feedEvent.instrumentType,
                chainId: feedEvent.chainId,
                contractAddress: feedEvent.contractAddress,
                proofURI: feedEvent.proofURI,
                pnl: feedEvent.pnl,
                tvl: feedEvent.tvl,
                riskScore: feedEvent.riskScore,
                createdAt: block.timestamp
            })
        );
        emit FeedEventCreated(eventId, feedEvent.actorType, feedEvent.actorId, feedEvent.actionType, feedEvent.strategyId, feedEvent.proofURI);
    }

    function totalFeedEvents() external view returns (uint256) {
        return feedEvents.length;
    }

    function _same(string memory a, string memory b) private pure returns (bool) {
        return keccak256(bytes(a)) == keccak256(bytes(b));
    }
}
