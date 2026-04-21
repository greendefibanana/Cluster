// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

library MetadataEscaper {
    bytes16 private constant _HEX = "0123456789abcdef";

    function escapeJson(string memory input) internal pure returns (string memory) {
        bytes memory data = bytes(input);
        uint256 extraLen = 0;

        for (uint256 i = 0; i < data.length; i++) {
            extraLen += _jsonEscapeLength(data[i]) - 1;
        }

        if (extraLen == 0) {
            return input;
        }

        bytes memory out = new bytes(data.length + extraLen);
        uint256 j = 0;

        for (uint256 i = 0; i < data.length; i++) {
            j = _writeJsonChar(out, j, data[i]);
        }

        return string(out);
    }

    function escapeSvgText(string memory input) internal pure returns (string memory) {
        bytes memory data = bytes(input);
        uint256 extraLen = 0;

        for (uint256 i = 0; i < data.length; i++) {
            extraLen += _svgEscapeLength(data[i]) - 1;
        }

        if (extraLen == 0) {
            return input;
        }

        bytes memory out = new bytes(data.length + extraLen);
        uint256 j = 0;

        for (uint256 i = 0; i < data.length; i++) {
            j = _writeSvgChar(out, j, data[i]);
        }

        return string(out);
    }

    function _jsonEscapeLength(bytes1 char_) private pure returns (uint256) {
        if (
            char_ == bytes1('"') ||
            char_ == bytes1("\\") ||
            char_ == bytes1(uint8(0x08)) ||
            char_ == bytes1(uint8(0x0c)) ||
            char_ == bytes1("\n") ||
            char_ == bytes1("\r") ||
            char_ == bytes1("\t")
        ) {
            return 2;
        }

        if (uint8(char_) < 0x20) {
            return 6;
        }

        return 1;
    }

    function _writeJsonChar(bytes memory out, uint256 j, bytes1 char_) private pure returns (uint256) {
        if (char_ == bytes1('"')) {
            out[j++] = bytes1("\\");
            out[j++] = bytes1('"');
            return j;
        }

        if (char_ == bytes1("\\")) {
            out[j++] = bytes1("\\");
            out[j++] = bytes1("\\");
            return j;
        }

        if (char_ == bytes1(uint8(0x08))) {
            out[j++] = bytes1("\\");
            out[j++] = bytes1("b");
            return j;
        }

        if (char_ == bytes1(uint8(0x0c))) {
            out[j++] = bytes1("\\");
            out[j++] = bytes1("f");
            return j;
        }

        if (char_ == bytes1("\n")) {
            out[j++] = bytes1("\\");
            out[j++] = bytes1("n");
            return j;
        }

        if (char_ == bytes1("\r")) {
            out[j++] = bytes1("\\");
            out[j++] = bytes1("r");
            return j;
        }

        if (char_ == bytes1("\t")) {
            out[j++] = bytes1("\\");
            out[j++] = bytes1("t");
            return j;
        }

        if (uint8(char_) < 0x20) {
            uint8 value = uint8(char_);
            out[j++] = bytes1("\\");
            out[j++] = bytes1("u");
            out[j++] = bytes1("0");
            out[j++] = bytes1("0");
            out[j++] = _HEX[value >> 4];
            out[j++] = _HEX[value & 0x0f];
            return j;
        }

        out[j++] = char_;
        return j;
    }

    function _svgEscapeLength(bytes1 char_) private pure returns (uint256) {
        if (char_ == bytes1("&")) return 5;
        if (char_ == bytes1("<") || char_ == bytes1(">")) return 4;
        if (char_ == bytes1('"') || char_ == bytes1("'")) return 6;
        return 1;
    }

    function _writeSvgChar(bytes memory out, uint256 j, bytes1 char_) private pure returns (uint256) {
        if (char_ == bytes1("&")) {
            out[j++] = bytes1("&");
            out[j++] = bytes1("a");
            out[j++] = bytes1("m");
            out[j++] = bytes1("p");
            out[j++] = bytes1(";");
            return j;
        }

        if (char_ == bytes1("<")) {
            out[j++] = bytes1("&");
            out[j++] = bytes1("l");
            out[j++] = bytes1("t");
            out[j++] = bytes1(";");
            return j;
        }

        if (char_ == bytes1(">")) {
            out[j++] = bytes1("&");
            out[j++] = bytes1("g");
            out[j++] = bytes1("t");
            out[j++] = bytes1(";");
            return j;
        }

        if (char_ == bytes1('"')) {
            out[j++] = bytes1("&");
            out[j++] = bytes1("q");
            out[j++] = bytes1("u");
            out[j++] = bytes1("o");
            out[j++] = bytes1("t");
            out[j++] = bytes1(";");
            return j;
        }

        if (char_ == bytes1("'")) {
            out[j++] = bytes1("&");
            out[j++] = bytes1("a");
            out[j++] = bytes1("p");
            out[j++] = bytes1("o");
            out[j++] = bytes1("s");
            out[j++] = bytes1(";");
            return j;
        }

        out[j++] = char_;
        return j;
    }
}
