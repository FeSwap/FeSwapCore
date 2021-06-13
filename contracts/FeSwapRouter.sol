// SPDX-License-Identifier: GPL-3.0
pragma solidity =0.6.12;
pragma experimental ABIEncoderV2;

import './interfaces/IFeSwapFactory.sol';
import './libraries/TransferHelper.sol';

import './interfaces/IFeSwapRouter.sol';
import './libraries/FeSwapLibrary.sol';
import './libraries/SafeMath.sol';
import './interfaces/IERC20.sol';
import './interfaces/IWETH.sol';

    enum PoolRunningPhase {
        BidToStart,
        BidPhase, 
        BidDelaying,
        BidSettled,
        PoolHolding, 
        PoolForSale
    }

    struct FeswaPair {
        address tokenA;
        address tokenB;
        uint256 currentPrice;
        uint64  timeCreated;
        uint64  lastBidTime; 
        PoolRunningPhase  poolState;
    }

    
interface IFeswaNFT {
    // Views
    function ownerOf(uint256 tokenId) external view returns (address owner);
    function getPoolInfo(uint256 tokenId) external view returns (address, FeswaPair memory);
}

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
        (address nftOwner, FeswaPair memory NftBidInfo) = IFeswaNFT(feswaNFT).getPoolInfo(tokenID);
        require(msg.sender == nftOwner, 'FeSwap: NOT TOKEN OWNER');
        require(NftBidInfo.poolState >= PoolRunningPhase.BidSettled, 'FeSwap: NOT ALLOWED');
        (address tokenA, address tokenB) = (NftBidInfo.tokenA, NftBidInfo.tokenB);
        (pairAAB, pairABB) = IFeSwapFactory(factory).createUpdatePair(tokenA, tokenB, pairOwner, rateTrigger); 
    }

    // **** ADD LIQUIDITY ****
    function _addLiquidity( address tokenIn, 
                            address tokenOut, 
                            uint amountInDesired, 
                            uint amountOutDesired,
                            uint amountInMin,
                            uint amountOutMin 
    ) internal virtual view returns (uint amountIn, uint amountOut, address pair) {
        pair = IFeSwapFactory(factory).getPair(tokenIn, tokenOut);
        require(pair != address(0), 'FeSwap: NOT CREATED');
        (uint reserveIn, uint reserveOut, ,) = IFeSwapPair(pair).getReserves();
        if (reserveIn == 0 && reserveOut == 0) {
            (amountIn, amountOut) = (amountInDesired, amountOutDesired);
        } else {
            uint amountOutOptimal = FeSwapLibrary.quote(amountInDesired, reserveIn, reserveOut);
            if (amountOutOptimal <= amountOutDesired) {
                require(amountOutOptimal >= amountOutMin, 'FeSwap: LESS_OUT_AMOUNT');
                (amountIn, amountOut) = (amountInDesired, amountOutOptimal);
            } else {
                uint amountInOptimal = FeSwapLibrary.quote(amountOutDesired, reserveOut, reserveIn);
                assert(amountInOptimal <= amountInDesired);
                require(amountInOptimal >= amountInMin, 'FeSwap: LESS_IN_AMOUNT');
                (amountIn, amountOut) = (amountInOptimal, amountOutDesired);
            }
        }
    }

    function addLiquidity(  AddLiquidityParams calldata addParams, 
                            address to, 
                            uint deadline ) 
                external virtual override ensure(deadline) 
                returns (uint amountA, uint amountB, uint liquidityAAB, uint liquidityABB)
    {
        require(addParams.ratio <= 100,  'FeSwap: RATIO EER');
        if(addParams.ratio != uint(0)) {
            address pairA2B;
            uint liquidityA = addParams.amountADesired.mul(addParams.ratio)/100; 
            uint liquidityB = addParams.amountBDesired.mul(addParams.ratio)/100;
            uint amountAMin = addParams.amountAMin.mul(addParams.ratio)/100; 
            uint amountBMin = addParams.amountBMin.mul(addParams.ratio)/100;
            (amountA, amountB, pairA2B) = 
                            _addLiquidity(addParams.tokenA, addParams.tokenB, liquidityA, liquidityB, amountAMin, amountBMin);
            TransferHelper.safeTransferFrom(addParams.tokenA, msg.sender, pairA2B, amountA);
            TransferHelper.safeTransferFrom(addParams.tokenB, msg.sender, pairA2B, amountB);
            liquidityAAB = IFeSwapPair(pairA2B).mint(to);
        }
        if(addParams.ratio != uint(100)) {
            address pairB2A; 
            uint liquidityA = addParams.amountADesired - amountA; 
            uint liquidityB = addParams.amountBDesired - amountB;
            uint amountAMin = (addParams.amountAMin != 0) ? (addParams.amountAMin - amountA) : 0 ; 
            uint amountBMin = (addParams.amountBMin != 0) ? (addParams.amountBMin - amountB) : 0 ;
            (liquidityB, liquidityA, pairB2A) = 
                        _addLiquidity(addParams.tokenB, addParams.tokenA, liquidityB, liquidityA, amountBMin, amountAMin);
            TransferHelper.safeTransferFrom(addParams.tokenA, msg.sender, pairB2A, liquidityA);
            TransferHelper.safeTransferFrom(addParams.tokenB, msg.sender, pairB2A, liquidityB);
            liquidityABB = IFeSwapPair(pairB2A).mint(to);
            amountA += liquidityA;
            amountB += liquidityB;
        }
    }

    function addLiquidityETH(   AddLiquidityETHParams calldata addParams,
                                address to,
                                uint deadline
    )   external virtual override payable ensure(deadline) 
        returns (uint amountToken, uint amountETH, uint liquidityTTE, uint liquidityTEE) 
    {
        require(addParams.ratio <= 100,  'FeSwap: RATIO EER');
        if(addParams.ratio != uint(0)) {        
            address pairTTE;
            uint liquidityToken = addParams.amountTokenDesired.mul(addParams.ratio)/100; 
            uint liquidityETH   = msg.value.mul(addParams.ratio)/100;
            uint amountTokenMin = addParams.amountTokenMin.mul(addParams.ratio)/100; 
            uint amountETHMin   = addParams.amountETHMin.mul(addParams.ratio)/100;
            (amountToken, amountETH, pairTTE) =
                        _addLiquidity(addParams.token, WETH, liquidityToken, liquidityETH, amountTokenMin, amountETHMin);
            TransferHelper.safeTransferFrom(addParams.token, msg.sender, pairTTE, amountToken);
            IWETH(WETH).deposit{value: amountETH}();
            assert(IWETH(WETH).transfer(pairTTE, amountETH));
            liquidityTTE = IFeSwapPair(pairTTE).mint(to);
        }
        if(addParams.ratio != uint(100)){
            address pairTEE;
            uint liquidityToken = addParams.amountTokenDesired - amountToken; 
            uint liquidityETH   = msg.value - amountETH;
            uint amountTokenMin = (addParams.amountTokenMin !=0) ? (addParams.amountTokenMin - amountToken) : 0 ;
            uint amountETHMin   = (addParams.amountETHMin != 0) ? (addParams.amountETHMin - amountETH) : 0 ;
            (liquidityETH, liquidityToken, pairTEE) = 
                    _addLiquidity(WETH, addParams.token, liquidityETH,  liquidityToken, amountETHMin, amountTokenMin);
            TransferHelper.safeTransferFrom(addParams.token, msg.sender, pairTEE, liquidityToken);
            IWETH(WETH).deposit{value: liquidityETH}();
            assert(IWETH(WETH).transfer(pairTEE, liquidityETH));
            liquidityTEE = IFeSwapPair(pairTEE).mint(to);     
            amountToken += liquidityToken;
            amountETH   += liquidityETH;       
        }

        // refund dust eth, if any
        if (msg.value > amountETH) TransferHelper.safeTransferETH(msg.sender, msg.value - amountETH);
    }

    // **** REMOVE LIQUIDITY ****
    function removeLiquidity(
        RemoveLiquidityParams calldata removeParams,
        address to,
        uint deadline
    ) public virtual override ensure(deadline) returns (uint amountA, uint amountB) {
        if(removeParams.liquidityAAB != uint(0)) {
            address pairAAB = FeSwapLibrary.pairFor(factory, removeParams.tokenA, removeParams.tokenB);
            IFeSwapPair(pairAAB).transferFrom(msg.sender, pairAAB, removeParams.liquidityAAB);  // send liquidity to pair
            (amountA, amountB) = IFeSwapPair(pairAAB).burn(to);
        }
        if(removeParams.liquidityABB != uint(0)) {
            address pairABB = FeSwapLibrary.pairFor(factory, removeParams.tokenB, removeParams.tokenA);
            IFeSwapPair(pairABB).transferFrom(msg.sender, pairABB, removeParams.liquidityABB);  // send liquidity to pair
            (uint amountB0, uint amountA0) = IFeSwapPair(pairABB).burn(to);
            amountA += amountA0;
            amountB += amountB0;
        }
        require(amountA >= removeParams.amountAMin, 'FeSwapRouter: INSUFFICIENT_A_AMOUNT');
        require(amountB >= removeParams.amountBMin, 'FeSwapRouter: INSUFFICIENT_B_AMOUNT');
    }

    function removeLiquidityETH(
        RemoveLiquidityParams calldata removeParams,
        address to,
        uint deadline
    ) public virtual override ensure(deadline) returns (uint amountToken, uint amountETH) {
        require(removeParams.tokenB == WETH,  'FeSwap: WRONG WETH');
        (amountToken, amountETH) = removeLiquidity(
            removeParams,    
            address(this),
            deadline
        );
        TransferHelper.safeTransfer(removeParams.tokenA, to, amountToken);
        IWETH(WETH).withdraw(amountETH);
        TransferHelper.safeTransferETH(to, amountETH);
    }

    function removePermit(
        RemoveLiquidityParams calldata removeParams,
        uint deadline,
        bool approveMax, 
        Signature   calldata sigAAB,
        Signature   calldata sigABB
    ) internal {
        if(sigAAB.r != 0){
            address pairAAB = FeSwapLibrary.pairFor(factory, removeParams.tokenA, removeParams.tokenB);
            uint value = approveMax ? uint(-1) : removeParams.liquidityAAB; 
            IFeSwapPair(pairAAB).permit(msg.sender, address(this), value, deadline, sigAAB.v, sigAAB.r, sigAAB.s);
        }
        if(sigABB.r != 0){
            address pairABB = FeSwapLibrary.pairFor(factory, removeParams.tokenB, removeParams.tokenA);
            uint value = approveMax ? uint(-1) : removeParams.liquidityABB; 
            IFeSwapPair(pairABB).permit(msg.sender, address(this), value, deadline, sigABB.v, sigABB.r, sigABB.s);
        }    
    }

    function removeLiquidityWithPermit(
        RemoveLiquidityParams calldata removeParams,
        address to,
        uint deadline,
        bool approveMax, 
        Signature   calldata sigAAB,
        Signature   calldata sigABB
    ) external virtual override returns (uint amountA, uint amountB) {
        removePermit(removeParams, deadline, approveMax, sigAAB, sigABB);
        (amountA, amountB) = removeLiquidity(removeParams, to, deadline);
    }

    function removeLiquidityETHWithPermit(
        RemoveLiquidityParams calldata removeParams,
        address to,
        uint deadline,
        bool approveMax, 
        Signature   calldata sigTTE,
        Signature   calldata sigTEE
    ) external virtual override returns (uint amountToken, uint amountETH) {
        require(removeParams.tokenB == WETH,  'FeSwap: WRONG WETH');
        removePermit(removeParams, deadline, approveMax, sigTTE, sigTEE);
        (amountToken, amountETH) = removeLiquidityETH(removeParams, to, deadline);
    }

    // **** REMOVE LIQUIDITY (supporting deflation tokens) ****
    function removeLiquidityETHFeeOnTransfer(
        RemoveLiquidityParams calldata removeParams,
        address to,
        uint deadline
    ) public virtual override ensure(deadline) returns (uint amountETH) {
        require(removeParams.tokenB == WETH,  'FeSwap: WRONG WETH');
        ( , amountETH) = removeLiquidity(
            removeParams,    
            address(this),
            deadline
        );
        TransferHelper.safeTransfer(removeParams.tokenA, to, IERC20(removeParams.tokenA).balanceOf(address(this)));
        IWETH(WETH).withdraw(amountETH);
        TransferHelper.safeTransferETH(to, amountETH);
    }

    function removeLiquidityETHWithPermitFeeOnTransfer(
        RemoveLiquidityParams calldata removeParams,
        address to,
        uint deadline,
        bool approveMax, 
        Signature   calldata sigTTE,
        Signature   calldata sigTEE
    ) external virtual override returns (uint amountETH) {
        require(removeParams.tokenB == WETH,  'FeSwap: WRONG WETH');
        removePermit(removeParams, deadline, approveMax, sigTTE, sigTEE);
        amountETH = removeLiquidityETHFeeOnTransfer(removeParams, to, deadline);
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
