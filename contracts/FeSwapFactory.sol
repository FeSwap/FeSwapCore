// SPDX-License-Identifier: GPL-3.0
pragma solidity =0.6.12;

import './interfaces/IFeSwapFactory.sol';
import './FeSwapPair.sol';

contract FeSwapFactory is IFeSwapFactory {
    address public override feeTo;
    address public override factoryAdmin;
    address public override routerFeSwap;

    mapping(address => mapping(address => address)) public override getPair;
    address[] public override allPairs;

    event PairCreated(address indexed tokenA, address indexed tokenB, address pairAAB, address pairABB, uint allPairsLength);
    event PairOwnerChanged(address indexed pairAAB, address indexed pairABB, address oldOwner, address newOwner);

    constructor(address _factoryAdmin) public {
        factoryAdmin    = _factoryAdmin;
     }

    function allPairsLength() external view override returns (uint) {
        return allPairs.length;
    }

    function createUpdatePair(address tokenA, address tokenB, address pairOwner) external override returns (address pairAAB, address pairABB ) {
        require(tokenA != tokenB, 'FeSwap: IDENTICAL_ADDRESSES');
        require(tokenA != address(0) && tokenB != address(0) && routerFeSwap != address(0) , 'FeSwap: ZERO_ADDRESS');
        require((msg.sender == factoryAdmin) || (msg.sender == routerFeSwap) , 'FeSwap: FORBIDDEN');

        pairAAB = getPair[tokenA][tokenB];
        if(pairAAB != address(0)) {
            pairABB = getPair[tokenB][tokenA];
            address oldOwner = IFeSwapPair(pairAAB).pairOwner();
            IFeSwapPair(pairAAB).setOwner(pairOwner);           // Owner Security must be checked by Router
            IFeSwapPair(pairABB).setOwner(pairOwner);
            emit PairOwnerChanged(pairAAB, pairABB, oldOwner, pairOwner);
        } else {
            bytes memory bytecode = type(FeSwapPair).creationCode;
            bytes32 saltAAB = keccak256(abi.encodePacked(tokenA, tokenB));
            bytes32 saltABB = keccak256(abi.encodePacked(tokenB, tokenA));
            assembly {
                pairAAB := create2(0, add(bytecode, 32), mload(bytecode), saltAAB)
                pairABB := create2(0, add(bytecode, 32), mload(bytecode), saltABB)
            }

            IFeSwapPair(pairAAB).initialize(tokenA, tokenB, pairOwner, routerFeSwap);
            getPair[tokenA][tokenB] = pairAAB;
            allPairs.push(pairAAB);

            IFeSwapPair(pairABB).initialize(tokenB, tokenA, pairOwner, routerFeSwap);
            getPair[tokenB][tokenA] = pairABB;
            allPairs.push(pairABB);

            emit PairCreated(tokenA, tokenB, pairAAB, pairABB, allPairs.length);
        }
    }

    function setFeeTo(address _feeTo) external override {
        require(msg.sender == factoryAdmin, 'FeSwap: FORBIDDEN');
        feeTo = _feeTo;
    }

    function setFactoryAdmin(address _factoryAdmin) external override {
        require(msg.sender == factoryAdmin, 'FeSwap: FORBIDDEN');
        factoryAdmin = _factoryAdmin;
    }

    function setRouterFeSwap(address _routerFeSwap) external override {
        require(msg.sender == factoryAdmin, 'FeSwap: FORBIDDEN');
        routerFeSwap = _routerFeSwap;                                         // for Router Update
    }    
}
