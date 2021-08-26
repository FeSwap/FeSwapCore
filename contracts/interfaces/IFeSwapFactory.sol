// SPDX-License-Identifier: MIT
pragma solidity =0.6.12;

interface IFeSwapFactory {
    event PairCreated(address indexed tokenA, address indexed tokenB, address pairAAB, address pairABB, uint);

    function feeTo() external view returns (address);
    function getFeeInfo() external view returns (address, uint256);
    function factoryAdmin() external view returns (address);
    function routerFeSwap() external view returns (address);  
    function rateTriggerFactory() external view returns (uint64);  
    function rateCapArbitrage() external view returns (uint64);     
    function rateProfitShare() external view returns (uint64); 

    function getPair(address tokenA, address tokenB) external view returns (address pair);
    function allPairs(uint) external view returns (address pair);
    function allPairsLength() external view returns (uint);

    function createUpdatePair(address tokenA, address tokenB, address pairOwner, uint256 rateTrigger) external returns (address pairAAB,address pairABB);

    function setFeeTo(address) external;
    function setFactoryAdmin(address) external;
    function setRouterFeSwap(address) external;
    function configFactory(uint64, uint64, uint64) external;
    function managePair(address, address, address, address) external;
}