// SPDX-License-Identifier: GPL-3.0
pragma solidity =0.6.12;

import './interfaces/IFeSwapFactory.sol';
import './FeSwapPair.sol';

contract FeSwapFactory is IFeSwapFactory {
    address public override feeTo;
    address public override feeToSetter;
    address public override routerFeSwap;

    mapping(address => mapping(address => address)) public override getPair;
    address[] public override allPairs;

    event PairCreated(address indexed tokenA, address indexed tokenB, address pairAAB, address pairABB, uint allPairsLength);

    constructor(address _feeToSetter) public {
        feeToSetter     = _feeToSetter;
        feeTo           = _feeToSetter;
    }

    function allPairsLength() external view override returns (uint) {
        return allPairs.length;
    }

    function createPair(address tokenA, address tokenB, address _pairCreator) external override returns (address pairAAB, address pairABB ) {
        require((msg.sender == feeToSetter) || (msg.sender == routerFeSwap) , 'FeSwap: FORBIDDEN');
        require(tokenA != tokenB, 'FeSwap: IDENTICAL_ADDRESSES');
        require(tokenA != address(0) && tokenB != address(0) && routerFeSwap != address(0) , 'FeSwap: ZERO_ADDRESS');
        require(getPair[tokenA][tokenB] == address(0), 'FeSwap: PAIR_EXISTS');   // single check is sufficient
        
        bytes memory bytecode = type(FeSwapPair).creationCode;
        bytes32 saltAAB = keccak256(abi.encodePacked(tokenA, tokenB));
        bytes32 saltABB = keccak256(abi.encodePacked(tokenB, tokenA));
        assembly {
            pairAAB := create2(0, add(bytecode, 32), mload(bytecode), saltAAB)
            pairABB := create2(0, add(bytecode, 32), mload(bytecode), saltABB)
        }

        IFeSwapPair(pairAAB).initialize(tokenA, tokenB, _pairCreator, routerFeSwap);
        getPair[tokenA][tokenB] = pairAAB;
        allPairs.push(pairAAB);

        IFeSwapPair(pairABB).initialize(tokenB, tokenA, _pairCreator, routerFeSwap);
        getPair[tokenB][tokenA] = pairABB;
        allPairs.push(pairABB);

        emit PairCreated(tokenA, tokenB, pairAAB, pairABB, allPairs.length);
    }

    function setFeeTo(address _feeTo) external override {
        require(msg.sender == feeToSetter, 'FeSwap: FORBIDDEN');
        feeTo = _feeTo;
    }

    function setFeeToSetter(address _feeToSetter) external override {
        require(msg.sender == feeToSetter, 'FeSwap: FORBIDDEN');
        feeToSetter = _feeToSetter;
    }

    function setRouterFeSwap(address _routerFeSwap) external override {
        require(msg.sender == feeToSetter, 'FeSwap: FORBIDDEN');
        routerFeSwap = _routerFeSwap;
    }    
}
