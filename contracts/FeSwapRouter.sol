// SPDX-License-Identifier: GPL-3.0
pragma solidity =0.6.12;

import './interfaces/IFeSwapFactory.sol';
import './libraries/TransferHelper.sol';

import './interfaces/IFeSwapRouter.sol';
import './libraries/FeSwapLibrary.sol';
import './libraries/SafeMath.sol';
import './interfaces/IERC20.sol';
import './interfaces/IWETH.sol';
import './interfaces/IFeswaNFT.sol';

contract FeSwapRouter is IFeSwapRouter{
    using SafeMath for uint;

    address public immutable override factory;
    address public immutable override feswaNFT;
    address public immutable override WETH;

    modifier ensure(uint deadline) {
        require(deadline >= block.timestamp, 'FeSwapRouter: EXPIRED');
        _;
    }

    constructor(address _factory, address _feswaNFT, address _WETH) public {
        factory = _factory;
        feswaNFT = _feswaNFT;
        WETH = _WETH;
    }

    receive() external payable {
        assert(msg.sender == WETH); // only accept ETH via fallback from the WETH contract
    }

    // **** CREATE SWAP PAIR ****
    function ManageFeswaPair( uint256 tokenID, address pairOwner, uint256 rateTrigger ) 
                external virtual override 
                returns (address pairAAB, address pairABB) 
    {
        require(msg.sender == IFeswaNFT(feswaNFT).ownerOf(tokenID), 'FeSwap: NOT TOKEN OWNER');
        (address tokenA, address tokenB) = IFeswaNFT(feswaNFT).getPoolTokens(tokenID);
        (pairAAB, pairABB) = IFeSwapFactory(factory).createUpdatePair(tokenA, tokenB, pairOwner, rateTrigger); 
    }

    // **** ADD LIQUIDITY ****
    function _addLiquidity( address tokenIn, address tokenOut, uint amountInDesired, uint amountOutDesired ) 
                    internal virtual view 
                    returns (uint amountIn, uint amountOut, address pair) 
    {
        pair = IFeSwapFactory(factory).getPair(tokenIn, tokenOut);
        require(pair != address(0), 'FeSwap: NOT CREATED');
        (uint reserveIn, uint reserveOut, ,) = IFeSwapPair(pair).getReserves();
        if (reserveIn == 0 && reserveOut == 0) {
            (amountIn, amountOut) = (amountInDesired, amountOutDesired);
        } else {
            uint amountOutOptimal = FeSwapLibrary.quote(amountInDesired, reserveIn, reserveOut);
            if (amountOutOptimal <= amountOutDesired) {
                (amountIn, amountOut) = (amountInDesired, amountOutOptimal);
            } else {
                uint amountInOptimal = FeSwapLibrary.quote(amountOutDesired, reserveOut, reserveIn);
                assert(amountInOptimal <= amountInDesired);
                (amountIn, amountOut) = (amountInOptimal, amountOutDesired);
            }
        }
    }

    function addLiquidity(  address tokenA, address tokenB, 
                            uint amountADesired, uint amountBDesired,
                            uint ratio, address to, uint deadline ) 
                external virtual override ensure(deadline) 
                returns (uint amountA, uint amountB, uint liquidityAAB, uint liquidityABB)
    {
        require(ratio <= 100,  'FeSwap: RATIO EER');
        if(ratio != uint(0)) {
            // (liquidityAAB, liquidityABB) reused to solve "Stack too deep" issue
            address pairA2B;
            liquidityAAB = amountADesired.mul(ratio)/100; 
            liquidityABB = amountBDesired.mul(ratio)/100;
            (amountA, amountB, pairA2B) = _addLiquidity(tokenA, tokenB, liquidityAAB, liquidityABB);
            TransferHelper.safeTransferFrom(tokenA, msg.sender, pairA2B, amountA);
            TransferHelper.safeTransferFrom(tokenB, msg.sender, pairA2B, amountB);
            liquidityAAB = IFeSwapPair(pairA2B).mint(to);
        }
        if(ratio != uint(100)) {
            // (amountBDesired, amountADesired) reused to solve "Stack too deep" issue
            address pairB2A; 
            (amountBDesired, amountADesired, pairB2A) = 
                    _addLiquidity(tokenB, tokenA, amountBDesired-amountB, amountADesired-amountA);
            TransferHelper.safeTransferFrom(tokenA, msg.sender, pairB2A, amountADesired);
            TransferHelper.safeTransferFrom(tokenB, msg.sender, pairB2A, amountBDesired);
            liquidityABB = IFeSwapPair(pairB2A).mint(to);
            amountA += amountADesired;
            amountB += amountBDesired;
        }
    }

    function addLiquidityETH(   address token, uint amountTokenDesired, uint ratio, address to, uint deadline ) 
                external virtual override payable ensure(deadline) 
                returns (uint amountToken, uint amountETH, uint liquidityTTE, uint liquidityTEE) 
    {
        require(ratio <= 100,  'FeSwap: RATIO EER');
        if(ratio != uint(0)) {        
            address pairTTE;
            (amountToken, amountETH, pairTTE) =
                    _addLiquidity(token, WETH, amountTokenDesired.mul(ratio)/100, msg.value.mul(ratio)/100);
            TransferHelper.safeTransferFrom(token, msg.sender, pairTTE, amountToken);
            IWETH(WETH).deposit{value: amountETH}();
            assert(IWETH(WETH).transfer(pairTTE, amountETH));
            liquidityTTE = IFeSwapPair(pairTTE).mint(to);
        }
        if(ratio != uint(100)){
            address pairTEE;
            uint amountETHDesired;            // (amountTokenDesired) reused to solve "Stack too deep" issue
            (amountETHDesired, amountTokenDesired, pairTEE) = 
                    _addLiquidity(WETH, token, msg.value-amountETH,  amountTokenDesired-amountToken);
            TransferHelper.safeTransferFrom(token, msg.sender, pairTEE, amountTokenDesired);
            IWETH(WETH).deposit{value: amountETHDesired}();
            assert(IWETH(WETH).transfer(pairTEE, amountETHDesired));
            liquidityTEE = IFeSwapPair(pairTEE).mint(to);     
            amountToken += amountTokenDesired;
            amountETH += amountETHDesired;       
        }

        // refund dust eth, if any
        if (msg.value > amountETH) TransferHelper.safeTransferETH(msg.sender, msg.value - amountETH);
    }

    // **** REMOVE LIQUIDITY ****
    function removeLiquidity(
        address tokenA,
        address tokenB,
        uint liquidityAAB,
        uint liquidityABB,        
        uint amountAMin,
        uint amountBMin,
        address to,
        uint deadline
    ) public virtual override ensure(deadline) returns (uint amountA, uint amountB) {
        if(liquidityAAB != uint(0)) {
            address pairAAB = FeSwapLibrary.pairFor(factory, tokenA, tokenB);
            IFeSwapPair(pairAAB).transferFrom(msg.sender, pairAAB, liquidityAAB); // send liquidity to pair
            (amountA, amountB) = IFeSwapPair(pairAAB).burn(to);
        }
        if(liquidityABB != uint(0)) {
            address pairABB = FeSwapLibrary.pairFor(factory, tokenB, tokenA);
            IFeSwapPair(pairABB).transferFrom(msg.sender, pairABB, liquidityABB); // send liquidity to pair
            (uint amountB0, uint amountA0) = IFeSwapPair(pairABB).burn(to);
            amountA += amountA0;
            amountB += amountB0;
        }
        require(amountA >= amountAMin, 'FeSwapRouter: INSUFFICIENT_A_AMOUNT');
        require(amountB >= amountBMin, 'FeSwapRouter: INSUFFICIENT_B_AMOUNT');
    }
    function removeLiquidityETH(
        address token,
        uint liquidityTTE,
        uint liquidityTEE,       
        uint amountTokenMin,
        uint amountETHMin,
        address to,
        uint deadline
    ) public virtual override ensure(deadline) returns (uint amountToken, uint amountETH) {
        (amountToken, amountETH) = removeLiquidity(
            token,
            WETH,
            liquidityTTE,
            liquidityTEE,
            amountTokenMin,
            amountETHMin,
            address(this),
            deadline
        );
        TransferHelper.safeTransfer(token, to, amountToken);
        IWETH(WETH).withdraw(amountETH);
        TransferHelper.safeTransferETH(to, amountETH);
    }
    function removeLiquidityWithPermit(
        address tokenA,
        address tokenB,
        uint liquidityAAB,
        uint amountAMin,
        uint amountBMin,
        address to,
        uint deadline,
        bool approveMax, uint8 v, bytes32 r, bytes32 s
    ) external virtual override returns (uint amountA, uint amountB) {
        {   // To save stack
            address pairAAB = FeSwapLibrary.pairFor(factory, tokenA, tokenB);
            uint value = approveMax ? uint(-1) : liquidityAAB; 
            IFeSwapPair(pairAAB).permit(msg.sender, address(this), value, deadline, v, r, s);
        }
        (amountA, amountB) = removeLiquidity(tokenA, tokenB, liquidityAAB, 0, amountAMin, amountBMin, to, deadline);
    }
    function removeLiquidityETHWithPermit(
        address token,
        uint liquidityTTE,
        uint amountTokenMin,
        uint amountETHMin,              
        address to,
        uint deadline,
        bool approveMax, uint8 v, bytes32 r, bytes32 s
    ) external virtual override returns (uint amountToken, uint amountETH) {
        address pairTTE = FeSwapLibrary.pairFor(factory, token, WETH);
        uint value = approveMax ? uint(-1) : liquidityTTE;
        IFeSwapPair(pairTTE).permit(msg.sender, address(this), value, deadline, v, r, s);
        (amountToken, amountETH) = removeLiquidityETH(token, liquidityTTE, 0, amountTokenMin, amountETHMin, to, deadline);
    }

    // **** REMOVE LIQUIDITY (supporting deflation tokens) ****
    function removeLiquidityETHFeeOnTransfer(
        address token,
        uint liquidityTTE,
        uint liquidityTEE,        
        uint amountTokenMin,
        uint amountETHMin,
        address to,
        uint deadline
    ) public virtual override ensure(deadline) returns (uint amountETH) {
        (, amountETH) = removeLiquidity(
            token,
            WETH,
            liquidityTTE,
            liquidityTEE,            
            amountTokenMin,
            amountETHMin,
            address(this),
            deadline
        );
        TransferHelper.safeTransfer(token, to, IERC20(token).balanceOf(address(this)));
        IWETH(WETH).withdraw(amountETH);
        TransferHelper.safeTransferETH(to, amountETH);
    }
    function removeLiquidityETHWithPermitFeeOnTransfer(
        address token,
        uint liquidityTTE,
        uint liquidityTEE,        
        address to,
        uint deadline,
        bool approveMax, uint8 v, bytes32 r, bytes32 s
    ) external virtual override returns (uint amountETH) {
        address pair = FeSwapLibrary.pairFor(factory, token, WETH);
        uint value = approveMax ? uint(-1) : liquidityTTE;
        IFeSwapPair(pair).permit(msg.sender, address(this), value, deadline, v, r, s);
        amountETH = removeLiquidityETHFeeOnTransfer(
            token, liquidityTTE, liquidityTEE, 0, 0, to, deadline
        );
    }


    // **** SWAP ****
    // requires the initial amount to have already been sent to the first pair
    function _swap(uint[] memory amounts, address[] memory path, address _to) internal virtual {
        for (uint i = 0; i < path.length - 1; i++) {
            (address tokenInput, address tokenOutput) = (path[i], path[i + 1]);
            uint amountOut = amounts[i + 1];
            address to = i < path.length - 2 ? FeSwapLibrary.pairFor(factory, tokenOutput, path[i + 2]) : _to;
            IFeSwapPair(FeSwapLibrary.pairFor(factory, tokenInput, tokenOutput))
                .swap(amountOut, to, new bytes(0));
        }
    }

    function swapExactTokensForTokens(
        uint amountIn,
        uint amountOutMin,
        address[] calldata path,
        address to,
        uint deadline
    ) external virtual override ensure(deadline) returns (uint[] memory amounts) {
        address firstPair;
        (firstPair, amounts) = FeSwapLibrary.getAmountsOut(factory, amountIn, path);
        require(amounts[amounts.length - 1] >= amountOutMin, 'FeSwapRouter: INSUFFICIENT_OUTPUT_AMOUNT');
        TransferHelper.safeTransferFrom(path[0], msg.sender, firstPair , amounts[0]);
        _swap(amounts, path, to);
    }

    function swapTokensForExactTokens(
        uint amountOut,
        uint amountInMax,
        address[] calldata path,
        address to,
        uint deadline
    ) external virtual override ensure(deadline) returns (uint[] memory amounts) {
        address firstPair;
        (firstPair, amounts) = FeSwapLibrary.getAmountsIn(factory, amountOut, path);
        require(amounts[0] <= amountInMax, 'FeSwapRouter: EXCESSIVE_INPUT_AMOUNT');
        TransferHelper.safeTransferFrom(path[0], msg.sender, firstPair, amounts[0]);
        _swap(amounts, path, to);
    }

    function swapExactETHForTokens(uint amountOutMin, address[] calldata path, address to, uint deadline)
        external virtual override payable ensure(deadline)
        returns (uint[] memory amounts)
    {
        require(path[0] == WETH, 'FeSwapRouter: INVALID_PATH');
        address _firstPair;
        (_firstPair, amounts) = FeSwapLibrary.getAmountsOut(factory, msg.value, path);            // to save 536 gas
        require(amounts[amounts.length - 1] >= amountOutMin, 'FeSwapRouter: INSUFFICIENT_OUTPUT_AMOUNT');
        IWETH(WETH).deposit{value: amounts[0]}();
        assert(IWETH(WETH).transfer(_firstPair, amounts[0]));
        _swap(amounts, path, to);
    }

    function swapTokensForExactETH(uint amountOut, uint amountInMax, address[] calldata path, address to, uint deadline)
        external virtual override ensure(deadline)
        returns (uint[] memory amounts)
    {
        require(path[path.length - 1] == WETH, 'FeSwapRouter: INVALID_PATH');
        address _firstPair;
        (_firstPair, amounts) = FeSwapLibrary.getAmountsIn(factory, amountOut, path);
        require(amounts[0] <= amountInMax, 'FeSwapRouter: EXCESSIVE_INPUT_AMOUNT');
        TransferHelper.safeTransferFrom(path[0], msg.sender, _firstPair, amounts[0]);
        _swap(amounts, path, address(this));
        IWETH(WETH).withdraw(amounts[amounts.length - 1]);
        TransferHelper.safeTransferETH(to, amounts[amounts.length - 1]);
    }

    function swapExactTokensForETH(uint amountIn, uint amountOutMin, address[] calldata path, address to, uint deadline)
        external virtual override ensure(deadline)
        returns (uint[] memory amounts)
    {
        require(path[path.length - 1] == WETH, 'FeSwapRouter: INVALID_PATH');
        address _firstPair;
        (_firstPair, amounts) = FeSwapLibrary.getAmountsOut(factory, amountIn, path);
        require(amounts[amounts.length - 1] >= amountOutMin, 'FeSwapRouter: INSUFFICIENT_OUTPUT_AMOUNT');
        TransferHelper.safeTransferFrom(path[0], msg.sender, _firstPair, amounts[0]);
        _swap(amounts, path, address(this));
        IWETH(WETH).withdraw(amounts[amounts.length - 1]);
        TransferHelper.safeTransferETH(to, amounts[amounts.length - 1]);
    }

    function swapETHForExactTokens(uint amountOut, address[] calldata path, address to, uint deadline)
        external virtual override payable ensure(deadline)
        returns (uint[] memory amounts)
    {
        require(path[0] == WETH, 'FeSwapRouter: INVALID_PATH');
        address _firstPair;
        (_firstPair, amounts) = FeSwapLibrary.getAmountsIn(factory, amountOut, path);
        require(amounts[0] <= msg.value, 'FeSwapRouter: EXCESSIVE_INPUT_AMOUNT');
        IWETH(WETH).deposit{value: amounts[0]}();
        assert(IWETH(WETH).transfer(_firstPair, amounts[0]));
        _swap(amounts, path, to);
        // refund dust eth, if any
        if (msg.value > amounts[0]) TransferHelper.safeTransferETH(msg.sender, msg.value - amounts[0]);
    }

    // **** SWAP (supporting fee-on-transfer tokens) ****
    // requires the initial amount to have already been sent to the first pair
    function _swapTokensFeeOnTransfer(address[] memory path, address _to) internal virtual {
        for (uint i = 0; i < path.length - 1; i++) {
            (address input, address output) = (path[i], path[i + 1]);
            IFeSwapPair pair = IFeSwapPair(FeSwapLibrary.pairFor(factory, input, output));
            uint amountInput;
            uint amountOutput;
            {   // scope to avoid stack too deep errors
                (uint reserveInput, uint reserveOutput, ,) = pair.getReserves();
                amountInput = IERC20(input).balanceOf(address(pair)).sub(reserveInput);
                amountOutput = FeSwapLibrary.getAmountOut(amountInput, reserveInput, reserveOutput);
            }
            address to = i < path.length - 2 ? FeSwapLibrary.pairFor(factory, output, path[i + 2]) : _to;
            pair.swap(amountOutput, to, new bytes(0));
        }
    }

    function swapExactTokensForTokensFeeOnTransfer(
        uint amountIn,
        uint amountOutMin,
        address[] calldata path,
        address to,
        uint deadline
    ) external virtual override ensure(deadline) {
        TransferHelper.safeTransferFrom(
            path[0], msg.sender, FeSwapLibrary.pairFor(factory, path[0], path[1]), amountIn
        );
        uint balanceBefore = IERC20(path[path.length - 1]).balanceOf(to);
        _swapTokensFeeOnTransfer(path, to);
        require(
            IERC20(path[path.length - 1]).balanceOf(to).sub(balanceBefore) >= amountOutMin,
            'FeSwapRouter: INSUFFICIENT_OUTPUT_AMOUNT'
        );
    }
    function swapExactETHForTokensFeeOnTransfer(
        uint amountOutMin,
        address[] calldata path,
        address to,
        uint deadline
    )
        external
        virtual
        override
        payable
        ensure(deadline)
    {
        require(path[0] == WETH, 'FeSwapRouter: INVALID_PATH');
        uint amountIn = msg.value;
        IWETH(WETH).deposit{value: amountIn}();
        assert(IWETH(WETH).transfer(FeSwapLibrary.pairFor(factory, path[0], path[1]), amountIn));
        uint balanceBefore = IERC20(path[path.length - 1]).balanceOf(to);
        _swapTokensFeeOnTransfer(path, to);
        require(
            IERC20(path[path.length - 1]).balanceOf(to).sub(balanceBefore) >= amountOutMin,
            'FeSwapRouter: INSUFFICIENT_OUTPUT_AMOUNT'
        );
    }
    function swapExactTokensForETHFeeOnTransfer(
        uint amountIn,
        uint amountOutMin,
        address[] calldata path,
        address to,
        uint deadline
    )
        external
        virtual
        override
        ensure(deadline)
    {
        require(path[path.length - 1] == WETH, 'FeSwapRouter: INVALID_PATH');
        TransferHelper.safeTransferFrom(
            path[0], msg.sender, FeSwapLibrary.pairFor(factory, path[0], path[1]), amountIn
        );
        _swapTokensFeeOnTransfer(path, address(this));
        uint amountOut = IERC20(WETH).balanceOf(address(this));
        require(amountOut >= amountOutMin, 'FeSwapRouter: INSUFFICIENT_OUTPUT_AMOUNT');
        IWETH(WETH).withdraw(amountOut);
        TransferHelper.safeTransferETH(to, amountOut);
    }

    // **** LIBRARY FUNCTIONS ****
    function quote(uint amountA, uint reserveA, uint reserveB) 
                public pure virtual override returns (uint amountB) 
    {
        return FeSwapLibrary.quote(amountA, reserveA, reserveB);
    }

    function getAmountOut(uint amountIn, uint reserveIn, uint reserveOut)
                public view virtual override returns (uint amountOut)
    {
        return FeSwapLibrary.getAmountOut(amountIn, reserveIn, reserveOut);
    }

    function getAmountIn(uint amountOut, uint reserveIn, uint reserveOut)
                public view virtual override returns (uint amountIn)
    {
        return FeSwapLibrary.getAmountIn(amountOut, reserveIn, reserveOut);
    }

    function estimateAmountsOut(uint amountIn, address[] calldata path)
                public view virtual override returns (uint[] memory amounts)
    {
        return FeSwapLibrary.estimateAmountsOut(factory, amountIn, path);
    }

    function estimateAmountsIn(uint amountOut, address[] calldata path)
                public view virtual override returns (uint[] memory amounts)
    {
        return FeSwapLibrary.estimateAmountsIn(factory, amountOut, path);
    }

}
