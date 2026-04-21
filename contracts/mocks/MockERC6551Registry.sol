// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/**
 * @dev Mock ERC-6551 registry aligned with the standard ERC-6551 reference implementation
 *      bytecode layout. The ERC6551AgentAccount.token() reads the footer at extcode offset
 *      0x4d (77 bytes). This mock pads the proxy runtime code so that the ABI-encoded
 *      (chainId, tokenContract, tokenId) footer begins at exactly that offset.
 */
contract MockERC6551Registry {
    event AccountCreated(
        address account,
        address implementation,
        bytes32 salt,
        uint256 chainId,
        address tokenContract,
        uint256 tokenId
    );

    function createAccount(
        address implementation,
        bytes32 salt,
        uint256 chainId,
        address tokenContract,
        uint256 tokenId
    ) external returns (address accountAddress) {
        bytes memory code = _creationCode(implementation, salt, chainId, tokenContract, tokenId);
        accountAddress = account(implementation, salt, chainId, tokenContract, tokenId);
        if (accountAddress.code.length != 0) {
            return accountAddress;
        }
        assembly {
            accountAddress := create2(0, add(code, 0x20), mload(code), salt)
            if iszero(accountAddress) {
                revert(0, 0)
            }
        }
        emit AccountCreated(accountAddress, implementation, salt, chainId, tokenContract, tokenId);
    }

    function account(
        address implementation,
        bytes32 salt,
        uint256 chainId,
        address tokenContract,
        uint256 tokenId
    ) public view returns (address) {
        bytes memory code = _creationCode(implementation, salt, chainId, tokenContract, tokenId);
        bytes32 hash = keccak256(code);
        return address(uint160(uint256(keccak256(abi.encodePacked(
            bytes1(0xff),
            address(this),
            salt,
            hash
        )))));
    }

    /**
     * @dev Builds the creation code for a minimal proxy that delegates to `implementation`,
     *      with a footer containing (salt, chainId, tokenContract, tokenId) at the offset
     *      expected by the ERC-6551 reference account implementation (0x4d = 77).
     *
     *      The standard ERC-6551 proxy bytecode:
     *        - 10 bytes deploy prefix (constructor that copies runtime code)
     *        - Runtime code: delegatecall proxy (45 bytes) + salt (32 bytes) = 77 bytes
     *        - Footer: abi.encode(chainId, tokenContract, tokenId) at offset 0x4d
     */
    function _creationCode(
        address implementation,
        bytes32 _salt,
        uint256 chainId,
        address tokenContract,
        uint256 tokenId
    ) internal pure returns (bytes memory) {
        return abi.encodePacked(
            // Deploy prefix: copies remainder as runtime code (10 bytes)
            hex"3d60ad80600a3d3981f3",
            // Minimal proxy runtime (45 bytes): delegatecall to implementation
            hex"363d3d373d3d3d363d73",
            implementation,
            hex"5af43d82803e903d91602b57fd5bf3",
            // Salt padding (32 bytes) — aligns footer to offset 0x4d
            _salt,
            // Footer: abi-encoded (chainId, tokenContract, tokenId) starting at 0x4d
            abi.encode(chainId, tokenContract, tokenId)
        );
    }
}
