// SPDX-License-Identifier: GPL-3.0
pragma solidity =0.6.12;

import './IFeSwapRouter.sol';

interface IFeSwapRouter {
    function factory() external pure returns (address);
    function feswaNFT() external pure returns (address);
    function WETH() external pure returns (address);

   function ManageFeswaPair(
        uint256 tokenID,
        address pairOwner  
    ) external returns (address pairAAB, address pairABB);
   
    function addLiquidity(
        address tokenA,
        address tokenB,
        uint amountADesired,
        uint amountBDesired,
        uint ratio,        
        address to,
        uint deadline
    ) external returns (uint amountA, uint amountB, uint liquidityAAB, uint liquidityABB);

    function addLiquidityETH(
        address token,
        uint amountTokenDesired,
        uint ratio,
        address to,
        uint deadline
    ) external payable returns (uint amountToken, uint amountETH, uint liquidityTTE, uint liquidityTEE);

    function removeLiquidity(
        address tokenA,
        address tokenB,
        uint liquidityAAB,
        uint liquidityABB,
        uint amountAMin,
        uint amountBMin,
        address to,
        uint deadline
    ) external returns (uint amountA, uint amountB);
    function removeLiquidityETH(
        address token,
        uint liquidityTTE,
        uint liquidityTEE,       
        uint amountTokenMin,
        uint amountETHMin,
        address to,
        uint deadline
    ) external returns (uint amountToken, uint amountETH);
    function removeLiquidityWithPermit(
        address tokenA,
        address tokenB,
        uint liquidityAAB,
        uint amountAMin,
        uint amountBMin,        
        address to,
        uint deadline,
        bool approveMax, uint8 v, bytes32 r, bytes32 s
    ) external returns (uint amountA, uint amountB);
    function removeLiquidityETHWithPermit(
        address token,
        uint liquidityTTE,
        uint amountTokenMin,
        uint amountETHMin,             
        address to,
        uint deadline,
        bool approveMax, uint8 v, bytes32 r, bytes32 s
    ) external returns (uint amountToken, uint amountETH);
    function removeLiquidityETHWithDefaltionTokens(
        address token,
        uint liquidityTTE,
        uint liquidityTEE,        
        uint amountTokenMin,
        uint amountETHMin,
        address to,
        uint deadline
    ) external returns (uint amountETH);
    function removeLiquidityETHWithPermitWithDefaltionTokens(
        address token,
        uint liquidityTTE,
        uint liquidityTEE,        
        address to,
        uint deadline,
        bool approveMax, uint8 v, bytes32 r, bytes32 s
    ) external returns (uint amountETH);

    function swapExactTokensForTokens(
        uint amountIn,
        uint amountOutMin,
        address[] calldata path,
        address to,
        uint deadline
    ) external returns (uint[] memory amounts);
    function swapTokensForExactTokens(
        uint amountOut,
        uint amountInMax,
        address[] calldata path,
        address to,
        uint deadline
    ) external returns (uint[] memory amounts);
    function swapExactETHForTokens(uint amountOutMin, address[] calldata path, address to, uint deadline)
        external
        payable
        returns (uint[] memory amounts);
    function swapTokensForExactETH(uint amountOut, uint amountInMax, address[] calldata path, address to, uint deadline)
        external
        returns (uint[] memory amounts);
    function swapExactTokensForETH(uint amountIn, uint amountOutMin, address[] calldata path, address to, uint deadline)
        external
        returns (uint[] memory amounts);
    function swapETHForExactTokens(uint amountOut, address[] calldata path, address to, uint deadline)
        external
        payable
        returns (uint[] memory amounts);     

    function swapExactTokensForTokensSupportingFeeOnTransferTokens(
        uint amountIn,
        uint amountOutMin,
        address[] calldata path,
        address to,
        uint deadline
    ) external;
    function swapExactETHForTokensSupportingFeeOnTransferTokens(
        uint amountOutMin,
        address[] calldata path,
        address to,
        uint deadline
    ) external payable;
    function swapExactTokensForETHSupportingFeeOnTransferTokens(
        uint amountIn,
        uint amountOutMin,
        address[] calldata path,
        address to,
        uint deadline
    ) external;
    
    function quote(uint amountA, uint reserveA, uint reserveB) external pure returns (uint amountB);
    function getAmountOut(uint amountIn, uint reserveIn, uint reserveOut) external view returns (uint amountOut);
    function getAmountIn(uint amountOut, uint reserveIn, uint reserveOut) external view returns (uint amountIn);
    function estimateAmountsOut(uint amountIn, address[] calldata path) external view returns (uint[] memory amounts);
    function estimateAmountsIn(uint amountOut, address[] calldata path) external view returns (uint[] memory amounts);
}
