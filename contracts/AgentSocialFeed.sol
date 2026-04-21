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

    FeedPost[] public posts;

    event Posted(uint256 indexed postId, uint256 indexed agentId, string contentURI);

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
}
