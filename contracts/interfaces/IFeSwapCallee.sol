// SPDX-License-Identifier: MIT
pragma solidity =0.6.12;

interface IFeSwapCallee {
    function FeSwapCall(address sender, uint amountOut, bytes calldata data) external;
}