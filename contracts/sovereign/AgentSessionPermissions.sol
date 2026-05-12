// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

abstract contract AgentSessionPermissions {
    struct SessionPermission {
        address executor;
        address adapter;
        uint256 chainId;
        uint256 expiresAt;
        uint256 quota;
        uint256 used;
        bool active;
    }

    mapping(bytes32 => SessionPermission) public sessionPermissions;

    event SessionKeyGranted(
        bytes32 indexed sessionKey,
        address indexed executor,
        address indexed adapter,
        uint256 chainId,
        uint256 expiresAt,
        uint256 quota
    );
    event SessionKeyRevoked(bytes32 indexed sessionKey);
    event SessionKeyUsed(bytes32 indexed sessionKey, uint256 used, uint256 quota);

    function _grantSessionKey(
        bytes32 sessionKey,
        address executor,
        address adapter,
        uint256 chainId,
        uint256 expiresAt,
        uint256 quota
    ) internal {
        require(sessionKey != bytes32(0), "invalid session");
        require(executor != address(0), "invalid executor");
        require(adapter != address(0), "invalid adapter");
        require(expiresAt > block.timestamp, "expired");
        require(quota > 0, "zero quota");
        sessionPermissions[sessionKey] = SessionPermission({
            executor: executor,
            adapter: adapter,
            chainId: chainId,
            expiresAt: expiresAt,
            quota: quota,
            used: 0,
            active: true
        });
        emit SessionKeyGranted(sessionKey, executor, adapter, chainId, expiresAt, quota);
    }

    function _revokeSessionKey(bytes32 sessionKey) internal {
        sessionPermissions[sessionKey].active = false;
        emit SessionKeyRevoked(sessionKey);
    }

    function _consumeSessionKey(bytes32 sessionKey, address executor, address adapter, uint256 chainId) internal returns (bool) {
        SessionPermission storage permission = sessionPermissions[sessionKey];
        if (!permission.active) return false;
        if (permission.executor != executor) return false;
        if (permission.adapter != adapter) return false;
        if (permission.chainId != 0 && permission.chainId != chainId) return false;
        if (permission.expiresAt < block.timestamp) return false;
        if (permission.used >= permission.quota) return false;
        permission.used += 1;
        emit SessionKeyUsed(sessionKey, permission.used, permission.quota);
        return true;
    }
}
