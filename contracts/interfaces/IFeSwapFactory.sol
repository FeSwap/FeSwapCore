// SPDX-License-Identifier: GPL-3.0
pragma solidity =0.6.12;

interface IFeSwapFactory {
    event PairCreated(address indexed tokenA, address indexed tokenB, address pairAAB, address pairABB, uint);

    function feeTo() external view returns (address);
    function feeToSetter() external view returns (address);
    function routerFeSwap() external view returns (address);  
    function feeToCreatePair() external view returns (uint);

    function getPair(address tokenA, address tokenB) external view returns (address pair);
    function allPairs(uint) external view returns (address pair);
    function allPairsLength() external view returns (uint);

    function createPair(address tokenA, address tokenB, address _pairCreator) external returns (address pairAAB,address pairABB);

    function setFeeTo(address) external;
    function setFeeToSetter(address) external;
    function setRouterFeSwap(address) external;
    function setFeeToCreatePair(uint) external;
}
