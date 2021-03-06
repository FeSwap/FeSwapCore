// SPDX-License-Identifier: GPL-3.0
pragma solidity =0.6.12;

import './interfaces/IFeSwapPair.sol';
import './FeSwapERC20.sol';
import './libraries/Math.sol';
import './libraries/UQ112x112.sol';
import './interfaces/IERC20.sol';
import './interfaces/IFeSwapFactory.sol';
import './interfaces/IFeSwapCallee.sol';

contract FeSwapPair is IFeSwapPair, FeSwapERC20 {
    using SafeMath  for uint;
    using UQ112x112 for uint224;

    uint public constant override MINIMUM_LIQUIDITY = 10**3;
    bytes4 private constant SELECTOR = bytes4(keccak256(bytes('transfer(address,uint256)')));
    bytes4 private constant SELECTORFROM = bytes4(keccak256(bytes('transferFrom(address,address,uint256)')));

    address public override factory;
    address public override pairOwner;    
    address public override tokenIn;
    address public override tokenOut;

    uint112 private reserveIn;              // uses single storage slot, accessible via getReserves
    uint112 private reserveOut;             // uses single storage slot, accessible via getReserves
    uint32  private blockTimestampLast;     // uses single storage slot, accessible via getReserves

    uint public override price0CumulativeLast;
    uint public override price1CumulativeLast;
    uint public override kLast;             // reserveIn * reserveOut, as of immediately after the most recent liquidity event

    uint public override rateTriggerArbitrage;

    uint private unlocked = 0x5A;
    modifier lock() {
        require(unlocked == 0x5A, 'FeSwap: LOCKED');
        unlocked = 0x69;
        _;
        unlocked = 0x5A;
    }

    function getReserves() public view override returns ( uint112 _reserveIn, uint112 _reserveOut, 
                                                          uint32 _blockTimestampLast, uint _rateTriggerArbitrage) {
        _reserveIn = reserveIn;
        _reserveOut = reserveOut;
        _blockTimestampLast = blockTimestampLast;
        _rateTriggerArbitrage = rateTriggerArbitrage;

    }

    function _safeTransfer(address token, address to, uint value) private {
        (bool success, bytes memory data) = token.call(abi.encodeWithSelector(SELECTOR, to, value));
        require(success && (data.length == 0 || abi.decode(data, (bool))), 'FeSwap: TRANSFER_FAILED');
    }

    event Mint(address indexed sender, uint amountIn, uint amountOut);
    event Burn(address indexed sender, uint amountIn, uint amountOut, address indexed to);
    event Swap(
        address indexed sender,
        uint amount0In,
        uint amount1In,
        uint amount1Out,
        address indexed to
    );
    event Sync(uint112 reserveIn, uint112 reserveOut);

    constructor() public {
        factory = msg.sender;
    }

    // called once by the factory at time of deployment
    function initialize(address _tokenIn, address _tokenOut, address _pairOwner, address router, uint rateTrigger) external override {
        require(msg.sender == factory, 'FeSwap: FORBIDDEN');
        tokenIn     = _tokenIn;
        tokenOut    = _tokenOut;
        pairOwner   = _pairOwner;
        if(rateTrigger != 0)  rateTriggerArbitrage = rateTrigger;
        IERC20(tokenIn).approve(router, uint(-1));      // Approve Rourter to transfer out tokenIn for auto-arbitrage 
    }

    function setOwner(address _pairOwner) external override {
        require(msg.sender == factory, 'FeSwap: FORBIDDEN');
        pairOwner = _pairOwner;
    }

    function adjusArbitragetRate(uint newRate) external override {
        require(msg.sender == factory, 'FeSwap: FORBIDDEN');
        rateTriggerArbitrage = newRate;
    }  

    // update reserves and, on the first call per block, price accumulators
    function _update(uint balanceIn, uint balanceOut, uint112 _reserveIn, uint112 _reserveOut) private {
        require(balanceIn <= uint112(-1) && balanceOut <= uint112(-1), 'FeSwap: OVERFLOW');
        uint32 blockTimestamp = uint32(block.timestamp % 2**32);
        uint32 timeElapsed = blockTimestamp - blockTimestampLast; // overflow is desired
        if (timeElapsed > 0 && _reserveIn != 0 && _reserveOut != 0) {
            // * never overflows, and + overflow is desired
            price0CumulativeLast += uint(UQ112x112.encode(_reserveOut).uqdiv(_reserveIn)) * timeElapsed;
            price1CumulativeLast += uint(UQ112x112.encode(_reserveIn).uqdiv(_reserveOut)) * timeElapsed;
        }
        reserveIn = uint112(balanceIn);
        reserveOut = uint112(balanceOut);
        blockTimestampLast = blockTimestamp;
        emit Sync(reserveIn, reserveOut);
    }

    // if fee is on, mint liquidity equivalent to 1/6th of the growth in sqrt(k)
    function _mintFee(uint112 _reserveIn, uint112 _reserveOut) private returns (bool feeOn) {
        (address feeTo, uint rateProfitShare) = IFeSwapFactory(factory).getFeeInfo();
        feeOn = (feeTo != address(0)) || (pairOwner != address(0));
        uint _kLast = kLast;            // gas savings
        if (feeOn) {
            if (_kLast != 0) {
                uint rootK = Math.sqrt(uint(_reserveIn).mul(_reserveOut));
                uint rootKLast = Math.sqrt(_kLast);
                if (rootK > rootKLast.add(20)) {     // ignore swap dust increase, select 20 randomly 
                    uint numerator = totalSupply.mul(rootK.sub(rootKLast)).mul(6);
                    uint denominator = rootK.mul(rateProfitShare).add(rootKLast);
                    uint liquidityCreator = numerator / (denominator.mul(10));
                    if((liquidityCreator > 0) && (pairOwner != address(0))) {
                        _mint(pairOwner, liquidityCreator);
                    } 
                    uint liquidityFeSwap = numerator / (denominator.mul(15));
                    if((liquidityFeSwap > 0)  && (feeTo != address(0))) {
                        _mint(feeTo, liquidityFeSwap);
                    } 
                }
            }
        } else if (_kLast != 0) {
            kLast = 0;
        }            
    }

    // this low-level function should be called from a contract which performs important safety checks
    function mint(address to) external override lock returns (uint liquidity) {
        (uint112 _reserveIn, uint112 _reserveOut, ,) = getReserves(); // gas savings
        uint balanceIn = IERC20(tokenIn).balanceOf(address(this));
        uint balanceOut = IERC20(tokenOut).balanceOf(address(this));
        uint amountTokenIn = balanceIn.sub(_reserveIn);
        uint amountTokenOut = balanceOut.sub(_reserveOut);

        bool feeOn = _mintFee(_reserveIn, _reserveOut);
        uint _totalSupply = totalSupply; // gas savings, must be defined here since totalSupply can update in _mintFee
        if (_totalSupply == 0) {
            liquidity = Math.sqrt(amountTokenIn.mul(amountTokenOut)).sub(MINIMUM_LIQUIDITY);
            _mint(address(0), MINIMUM_LIQUIDITY); // permanently lock the first MINIMUM_LIQUIDITY tokens
        } else {
            liquidity = Math.min(amountTokenIn.mul(_totalSupply) / _reserveIn, amountTokenOut.mul(_totalSupply) / _reserveOut);
        }
        require(liquidity > 0, 'FeSwap: INSUFFICIENT_LIQUIDITY_MINTED');
        _mint(to, liquidity);

        _update(balanceIn, balanceOut, _reserveIn, _reserveOut);
        if (feeOn) kLast = uint(reserveIn).mul(reserveOut);                    // reserve0 and reserve1 are up-to-date
        emit Mint(msg.sender, amountTokenIn, amountTokenOut);
    }

    // this low-level function should be called from a contract which performs important safety checks
    function burn(address to) external lock override returns (uint amountIn, uint amountOut) {
        (uint112 _reserveIn, uint112 _reserveOut, ,) = getReserves();     // gas savings
        (address _tokenIn, address _tokenOut) = (tokenIn, tokenOut);    // gas savings
        uint balanceIn = IERC20(_tokenIn).balanceOf(address(this));
        uint balanceOut = IERC20(_tokenOut).balanceOf(address(this));
        uint liquidity = balanceOf[address(this)];                      // liquidity to remove

        bool feeOn = _mintFee(_reserveIn, _reserveOut);
        uint _totalSupply = totalSupply;                        // gas savings, must be defined here since totalSupply can update in _mintFee
        amountIn = liquidity.mul(balanceIn) / _totalSupply;     // using balances ensures pro-rata distribution
        amountOut = liquidity.mul(balanceOut) / _totalSupply;   // using balances ensures pro-rata distribution
        require(amountIn > 0 && amountOut > 0, 'FeSwap: INSUFFICIENT_LIQUIDITY_BURNED');

        _burn(address(this), liquidity);
        _safeTransfer(_tokenIn, to, amountIn);
        _safeTransfer(_tokenOut, to, amountOut);
        balanceIn = IERC20(_tokenIn).balanceOf(address(this));
        balanceOut = IERC20(_tokenOut).balanceOf(address(this));

        _update(balanceIn, balanceOut, _reserveIn, _reserveOut);
        if (feeOn) kLast = uint(reserveIn).mul(reserveOut);     // reserve0 and reserve1 are up-to-date
        emit Burn(msg.sender, amountIn, amountOut, to);
    }

    // this low-level function should be called from a contract which performs important safety checks
    function swap(uint amountOut, address to, bytes calldata data) external lock override {
        require(amountOut > 0, 'FeSwap: INSUFFICIENT_OUTPUT_AMOUNT');
        (uint112 _reserveIn, uint112 _reserveOut) = (reserveIn, reserveOut);        // gas savings
        require(amountOut < _reserveOut, 'FeSwap: INSUFFICIENT_LIQUIDITY');

        uint balanceIn;
        uint balanceOut;
        {   // scope for {_tokenIn, _tokenOut}, avoids stack too deep errors
            (address _tokenIn, address _tokenOut) = (tokenIn, tokenOut);            // gas savings
            require(to != _tokenIn && to != _tokenOut, 'FeSwap: INVALID_TO');
            _safeTransfer(_tokenOut, to, amountOut); 
            if (data.length > 0) IFeSwapCallee(to).FeSwapCall(msg.sender, amountOut, data);
            balanceIn = IERC20(_tokenIn).balanceOf(address(this));
            balanceOut = IERC20(_tokenOut).balanceOf(address(this));
        }

        uint amountInTokenIn = balanceIn > _reserveIn ? balanceIn - _reserveIn : 0;
        uint amountInTokenOut = balanceOut > (_reserveOut - amountOut) 
                                           ? balanceOut - (_reserveOut - amountOut) : 0;  // to support Flash Swap
        require(amountInTokenIn > 0 || amountInTokenOut > 0, 'FeSwap: INSUFFICIENT_INPUT_AMOUNT');

        uint balanceOutAdjusted = balanceOut.mul(1000).sub(amountInTokenOut.mul(3));      // Fee for Flash Swap: 0.3% from tokenOut
        require(balanceIn.mul(balanceOutAdjusted) >= uint(_reserveIn).mul(_reserveOut).mul(1000), 'FeSwap: K');

        _update(balanceIn, balanceOut, _reserveIn, _reserveOut);
        emit Swap(msg.sender, amountInTokenIn, amountInTokenOut, amountOut, to);
    }

    // force balances to match reserves
    function skim(address to) external lock override {
        address _tokenIn = tokenIn;     // gas savings
        address _tokenOut = tokenOut;   // gas savings
        _safeTransfer(_tokenIn, to, IERC20(_tokenIn).balanceOf(address(this)).sub(reserveIn));
        _safeTransfer(_tokenOut, to, IERC20(_tokenOut).balanceOf(address(this)).sub(reserveOut));
    }

    // force reserves to match balances
    function sync() external lock override {
        _update(IERC20(tokenIn).balanceOf(address(this)), IERC20(tokenOut).balanceOf(address(this)), reserveIn, reserveOut);
    }
}