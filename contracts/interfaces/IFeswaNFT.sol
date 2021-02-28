// SPDX-License-Identifier: GPL-3.0
pragma solidity =0.6.12;

interface IFeswaNFT {
    // Views
    function getPoolTokens(uint256) external view returns (address tokenA, address tokenB);
}