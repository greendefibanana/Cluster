// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/// @title IFourMemeFactory
/// @notice Four.meme's real createToken interface on BSC mainnet.
interface IFourMemeFactory {
    function createToken(bytes memory args, bytes memory signature) external payable returns (address token);
}

/// @title FourMemeAdapter
/// @notice Adapter that Clustr worker TBAs call (via AgentExecutionHub)
///         to launch meme tokens on Four.meme's bonding curve.
///
///         On a mainnet fork with MockFourMemeFactory patched in,
///         `signature` can be empty bytes.
contract FourMemeAdapter {
    address public constant FOUR_MEME_FACTORY = 0x5c952063c7fc8610FFDB798152D69F0B9550762b;

    event MemeLaunched(
        address indexed creator,
        address indexed token,
        string name,
        string symbol
    );

    /// @notice Launch a meme token on Four.meme.
    /// @param name      Token name
    /// @param symbol    Token symbol
    /// @param uri       Metadata URI (image, description, socials)
    /// @param signature Backend signature from Four.meme API (empty on fork)
    /// @return token    Address of the newly created token
    function launchMeme(
        string calldata name,
        string calldata symbol,
        string calldata uri,
        bytes calldata signature
    ) external payable returns (address token) {
        bytes memory args = abi.encode(name, symbol, uri);
        token = IFourMemeFactory(FOUR_MEME_FACTORY).createToken{value: msg.value}(args, signature);
        emit MemeLaunched(msg.sender, token, name, symbol);
    }

    receive() external payable {}
}
