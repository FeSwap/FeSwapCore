// SPDX-License-Identifier: GPL-3.0
pragma solidity =0.6.12;

interface IFeswaNFT {
    // Views
    function ownerOf(uint256 tokenId) external view returns (address owner);
    function getPoolTokens(uint256 tokenId) external view returns (address tokenA, address tokenB);
}