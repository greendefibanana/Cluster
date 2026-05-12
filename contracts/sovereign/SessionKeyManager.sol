// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

contract SessionKeyManager {
    struct SessionKey {
        address account;
        address executor;
        address adapter;
        uint256 chainId;
        uint256 expiresAt;
        uint256 quota;
        uint256 used;
        bool active;
    }

    mapping(bytes32 => SessionKey) public sessions;

    event SessionRegistered(bytes32 indexed sessionKey, address indexed account, address indexed executor);
    event SessionRevoked(bytes32 indexed sessionKey);
    event SessionConsumed(bytes32 indexed sessionKey, uint256 used, uint256 quota);

    function registerSession(
        bytes32 sessionKey,
        address executor,
        address adapter,
        uint256 chainId,
        uint256 expiresAt,
        uint256 quota
    ) external {
        require(sessionKey != bytes32(0), "invalid session");
        require(executor != address(0), "invalid executor");
        require(adapter != address(0), "invalid adapter");
        require(expiresAt > block.timestamp, "expired");
        require(quota > 0, "zero quota");
        sessions[sessionKey] = SessionKey({
            account: msg.sender,
            executor: executor,
            adapter: adapter,
            chainId: chainId,
            expiresAt: expiresAt,
            quota: quota,
            used: 0,
            active: true
        });
        emit SessionRegistered(sessionKey, msg.sender, executor);
    }

    function revokeSession(bytes32 sessionKey) external {
        require(sessions[sessionKey].account == msg.sender, "not account");
        sessions[sessionKey].active = false;
        emit SessionRevoked(sessionKey);
    }

    function consumeSession(bytes32 sessionKey, address executor, address adapter, uint256 chainId) external returns (bool) {
        SessionKey storage session = sessions[sessionKey];
        require(session.account == msg.sender, "not account");
        if (!session.active || session.executor != executor || session.adapter != adapter) return false;
        if (session.chainId != 0 && session.chainId != chainId) return false;
        if (session.expiresAt < block.timestamp || session.used >= session.quota) return false;
        session.used += 1;
        emit SessionConsumed(sessionKey, session.used, session.quota);
        return true;
    }
}
