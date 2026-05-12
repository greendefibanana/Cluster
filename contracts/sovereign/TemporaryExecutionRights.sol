// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {AgentSessionPermissions} from "./AgentSessionPermissions.sol";

abstract contract TemporaryExecutionRights is AgentSessionPermissions {
    event TemporaryRightGranted(bytes32 indexed sessionKey, address indexed executor, uint256 expiresAt);
    event TemporaryRightRevoked(bytes32 indexed sessionKey);

    function _grantTemporaryRight(
        bytes32 sessionKey,
        address executor,
        address adapter,
        uint256 chainId,
        uint256 ttlSeconds,
        uint256 quota
    ) internal {
        require(ttlSeconds > 0, "zero ttl");
        uint256 expiresAt = block.timestamp + ttlSeconds;
        _grantSessionKey(sessionKey, executor, adapter, chainId, expiresAt, quota);
        emit TemporaryRightGranted(sessionKey, executor, expiresAt);
    }

    function _revokeTemporaryRight(bytes32 sessionKey) internal {
        _revokeSessionKey(sessionKey);
        emit TemporaryRightRevoked(sessionKey);
    }
}
