// SPDX-License-Identifier: GPL-3.0
pragma solidity =0.6.12;

library SafeMath {
    function add(uint x, uint y) internal pure returns (uint z) {
        require((z = x + y) >= x, 'ds-math-add-overflow');
    }

    function sub(uint x, uint y) internal pure returns (uint z) {
        require((z = x - y) <= x, 'ds-math-sub-underflow');
    }

    function mul(uint x, uint y) internal pure returns (uint z) {
        require(y == 0 || (z = x * y) / y == x, 'ds-math-mul-overflow');
    }
}

contract FeSwapSimu {
    using SafeMath  for uint;
    
    struct PoolUni {
        uint AmountA;
        uint AmountB;
        uint Liquity;        
        uint KLast;
        uint feeUniPool;
    }
        
    struct Pool {
        uint AmountAA;
        uint AmountB;
        uint AmountA;
        uint AmountBB;  
        
        uint LiquityAB;        
        uint LiquityBA;
        
        uint KLastAB;
        uint KLastBA;
        
        uint feeLiquidityPoolAB;
        uint feeLiquidityCreatorAB;
        
        uint feeLiquidityPoolBA;
        uint feeLiquidityCreatorBA;

        uint arbitrageTime;        
    }

    struct User {
        uint amountA;
        uint amountB;
        uint liquityAB;
        uint liquityBA;
        uint liquityUni;        
    }  
    
    User[25] public users;
    Pool     public pool;
    PoolUni  public poolUni;    

    constructor(uint nTokenA, uint nTokenB) public {
        for( uint i=0; i<25; i++) {
            users[i].amountA = nTokenA * 1 ether;
            users[i].amountB = nTokenB * 1 ether;            
        }
//        pool.AmountAA   = 1_000 * 1 ether;
//        pool.AmountB    = 1_000 * 1 ether;
//        pool.LiquityAB  = 1_000 * 1 ether;
//        pool.AmountA    = 1_000 * 1 ether;
//        pool.AmountBB   = 1_000 * 1 ether;           
//        pool.LiquityBA  = 1_000 * 1 ether;        
    }

    function mineFeeUni() public {
        uint nowKVlaue = sqrt(poolUni.AmountA * poolUni.AmountB);
        if ( nowKVlaue > poolUni.KLast ) {
            uint numerator = (poolUni.Liquity).mul(nowKVlaue.sub(poolUni.KLast));
            uint denominator = nowKVlaue.mul(5).add(poolUni.KLast);
            uint _feeUniPool = numerator / denominator;
            if (_feeUniPool > 0) {
                poolUni.Liquity += _feeUniPool;
                poolUni.feeUniPool += _feeUniPool;
            } 
        }
    }

    function mineFeeAB() public {
        uint nowKVlaue = sqrt(pool.AmountAA * pool.AmountB);
        if ( nowKVlaue > pool.KLastAB ) {
            uint numerator = (pool.LiquityAB).mul(nowKVlaue.sub(pool.KLastAB)).mul(6);
            uint denominator = nowKVlaue.mul(11).add(pool.KLastAB);
            uint liquidityCreator = numerator / (denominator.mul(10));
            if (liquidityCreator > 0) {
                pool.LiquityAB += liquidityCreator;
                pool.feeLiquidityCreatorAB += liquidityCreator;
            } 
            uint liquidityFeswaPool = numerator / (denominator.mul(15));
            if (liquidityFeswaPool > 0) {
                pool.LiquityAB += liquidityFeswaPool;
                pool.feeLiquidityPoolAB += liquidityFeswaPool;
            }     
        }
    }
    
    function mineFeeBA() public {
        uint nowKVlaue = sqrt(pool.AmountA * pool.AmountBB);
        if ( nowKVlaue > pool.KLastBA ) {
            uint numerator = (pool.LiquityBA).mul(nowKVlaue.sub(pool.KLastBA)).mul(6);
            uint denominator = nowKVlaue.mul(11).add(pool.KLastBA);
            uint liquidityCreator = numerator / (denominator.mul(10));
            if (liquidityCreator > 0) {
                pool.LiquityBA += liquidityCreator;
                pool.feeLiquidityCreatorBA += liquidityCreator;
            } 
            uint liquidityFeswaPool = numerator / (denominator.mul(15));
            if (liquidityFeswaPool > 0) {
                pool.LiquityBA += liquidityFeswaPool;
                pool.feeLiquidityPoolBA += liquidityFeswaPool;
            }     
        }
    }
    
    function addLiquidityUni(uint userID, uint nA, uint nB ) public returns ( uint nAddedA, uint nAddedB, uint lpAB) {
        nA *= 1 ether;
        nB *= 1 ether;
        
        mineFeeUni();
        
        if ((poolUni.AmountA == 0) || (poolUni.AmountB == 0)) {
            nAddedA = nA;
            nAddedB = nB;
            lpAB = sqrt(nAddedA * nAddedB) - 1000;
            poolUni.Liquity = 1000;
        } 
        else {
            uint tempB = nA * poolUni.AmountB / poolUni.AmountA;
            uint tempA = nB * poolUni.AmountA / poolUni.AmountB;
            if(tempB <= nB){
                nAddedA = nA;
                nAddedB = tempB;
            }
            else {
                nAddedB = nB;
                nAddedA = tempA;
            }
            uint _lpABA = nAddedA * poolUni.Liquity / poolUni.AmountA;
            uint _lpABB = nAddedB * poolUni.Liquity / poolUni.AmountB;   
            lpAB = min(_lpABA, _lpABB);
        }
        
        poolUni.AmountA += nAddedA;
        poolUni.AmountB += nAddedB; 
        poolUni.Liquity += lpAB;   
        poolUni.KLast = sqrt(poolUni.AmountA * poolUni.AmountB);        
        
        users[userID].amountA -= nAddedA;
        users[userID].amountB -= nAddedB;
        users[userID].liquityUni += lpAB;
    }


    function addLiquidityAB(uint userID, uint nA, uint nB ) public returns ( uint nOutA, uint nOutB, uint lpAB) {
        nA *= 1 ether;
        nB *= 1 ether;
        
        mineFeeAB();
        if ((pool.AmountAA == 0) || (pool.AmountB == 0)) {
            nOutA = nA;
            nOutB = nB;
            lpAB = sqrt(nOutA * nOutB) - 1000;
            pool.LiquityAB = 1000;
        } 
        else {
            uint tempB = nA * pool.AmountB / pool.AmountAA;
            uint tempA = nB * pool.AmountAA / pool.AmountB;
            if(tempB <= nB){
                nOutA = nA;
                nOutB = tempB;
            }
            else {
                nOutB = nB;
                nOutA = tempA;
            }
            uint _lpABA = nOutA * pool.LiquityAB / pool.AmountAA;
            uint _lpABB = nOutB * pool.LiquityAB / pool.AmountB;   
            lpAB = min(_lpABA, _lpABB);
        }
        pool.AmountAA += nOutA;
        pool.AmountB += nOutB; 
        pool.LiquityAB += lpAB;   
        pool.KLastAB = sqrt(pool.AmountAA * pool.AmountB);        
        
        users[userID].amountA -= nOutA;
        users[userID].amountB -= nOutB;
        users[userID].liquityAB += lpAB;
    }
    
    function addLiquidityBA(uint userID, uint nA, uint nB ) public returns ( uint nOutA, uint nOutB, uint lpBA) {
        nA *= 1 ether;
        nB *= 1 ether;
        
        mineFeeBA();
        if ((pool.AmountA == 0) || (pool.AmountBB == 0)) {
            nOutA = nA;
            nOutB = nB;
            lpBA = sqrt(nOutA * nOutB) - 1000;
            pool.LiquityBA = 1000;
        } 
        else {
            uint tempB = nA * pool.AmountBB / pool.AmountA;
            uint tempA = nB * pool.AmountA / pool.AmountBB;
            if(tempB <= nB){
                nOutA = nA;
                nOutB = tempB;
            }
            else {
                nOutB = nB;
                nOutA = tempA;
            }
            uint _lpBAA = nOutA * pool.LiquityBA / pool.AmountA;
            uint _lpBAB = nOutB * pool.LiquityBA / pool.AmountBB;   
            lpBA = min(_lpBAA, _lpBAB);
        }    
        pool.AmountA += nOutA;
        pool.AmountBB += nOutB; 
        pool.LiquityBA += lpBA;
        pool.KLastBA = sqrt(pool.AmountA * pool.AmountBB);         
        
        users[userID].amountA -= nOutA;
        users[userID].amountB -= nOutB;
        users[userID].liquityBA += lpBA;
    }
    
    function removeLiquidityUni(uint userID, uint nLiquidity ) public returns ( uint nRemoveA, uint nRemoveB) {
        require(nLiquidity <= users[userID].liquityUni, "No such Liquidity");
        mineFeeUni();
        
        nRemoveA = nLiquidity.mul(poolUni.AmountA) / poolUni.Liquity;
        nRemoveB = nLiquidity.mul(poolUni.AmountB) / poolUni.Liquity;
        
        users[userID].liquityUni -= nLiquidity;
        poolUni.Liquity -= nLiquidity;
        
        users[userID].amountA += nRemoveA;
        users[userID].amountB += nRemoveB;

        poolUni.AmountA -= nRemoveA;
        poolUni.AmountB -= nRemoveB; 
        poolUni.KLast = sqrt(poolUni.AmountA * poolUni.AmountB);    
    } 

    
    function removeLiquidityAB(uint userID, uint nLiquidity ) public returns ( uint nRemoveA, uint nRemoveB) {
        require(nLiquidity <= users[userID].liquityAB, 'No such Liquidity');
        mineFeeAB();
        
        nRemoveA = nLiquidity.mul(pool.AmountAA) / pool.LiquityAB;
        nRemoveB = nLiquidity.mul(pool.AmountB) / pool.LiquityAB;
        
        users[userID].liquityAB -= nLiquidity;
        pool.LiquityAB -= nLiquidity;
        
        users[userID].amountA += nRemoveA;
        users[userID].amountB += nRemoveB;

        pool.AmountAA -= nRemoveA;
        pool.AmountB -= nRemoveB; 
        pool.KLastAB = sqrt(pool.AmountAA * pool.AmountB);    
    } 

    function removeLiquidityBA(uint userID, uint nLiquidity ) public returns ( uint nRemoveA, uint nRemoveB) {
        require(nLiquidity <= users[userID].liquityBA, "No such Liquidity");
        
        mineFeeBA();
        
        nRemoveA = nLiquidity.mul(pool.AmountA) / pool.LiquityBA;
        nRemoveB = nLiquidity.mul(pool.AmountBB) / pool.LiquityBA;
        
        users[userID].liquityBA -= nLiquidity;
        pool.LiquityBA -= nLiquidity;
        
        users[userID].amountA += nRemoveA;
        users[userID].amountB += nRemoveB;

        pool.AmountA -= nRemoveA;
        pool.AmountBB -= nRemoveB; 
        pool.KLastBA = sqrt(pool.AmountA * pool.AmountBB);    
    }     
    
    function SwapABUni (uint userID, uint nA ) public returns ( uint nOutB ) {
        nA *= 1 ether;
        
        uint amountInWithFee = nA.mul(997);
        uint numerator = amountInWithFee.mul(poolUni.AmountB);
        uint denominator = (poolUni.AmountA).mul(1000).add(amountInWithFee);
        nOutB = numerator / denominator;

        poolUni.AmountA += nA;
        poolUni.AmountB -= nOutB;    
        
        users[userID].amountA -= nA;
        users[userID].amountB += nOutB;        
    }
    
    function SwapBAUni (uint userID, uint nB ) public returns ( uint nOutA ) {
        nB *= 1 ether;
        
        uint amountInWithFee = nB.mul(997);
        uint numerator = amountInWithFee.mul(poolUni.AmountA);
        uint denominator = (poolUni.AmountB).mul(1000).add(amountInWithFee);
        nOutA = numerator / denominator;
        
        poolUni.AmountB += nB;
        poolUni.AmountA -= nOutA;
        
        users[userID].amountB -= nB;
        users[userID].amountA += nOutA;
    }
    
    function SwapAB (uint userID, uint nA ) public returns ( uint nOutB ) {
        nA *= 1 ether;
        arbitrage();
        nOutB = nA * pool.AmountB / (pool.AmountAA + nA);
        pool.AmountAA += nA;
        pool.AmountB -= nOutB;    
        
        users[userID].amountA -= nA;
        users[userID].amountB += nOutB;        
    }
    
    function SwapBA (uint userID, uint nB ) public returns ( uint nOutA ) {
        nB *= 1 ether;
        arbitrage();
        nOutA = nB * pool.AmountA / (pool.AmountBB + nB);

        pool.AmountBB += nB;
        pool.AmountA -= nOutA;    
        
        users[userID].amountB -= nB;
        users[userID].amountA += nOutA;   
    }    

    function arbitrage() public {
        uint productIn = pool.AmountAA * pool.AmountBB;
        uint productOut =pool.AmountA * pool.AmountB;
        if ((productIn *1000) >= (productOut *1010)) {
            uint exchangeA = (productIn - productOut) / ( 2* (pool.AmountB +  pool.AmountBB) );              
            uint exchangeB = (productIn - productOut) / ( 2* (pool.AmountA +  pool.AmountAA) );         
            pool.AmountAA -= exchangeA;
            pool.AmountA += exchangeA; 
            pool.AmountBB -= exchangeB;
            pool.AmountB += exchangeB;
            pool.arbitrageTime += 1;
        }
    }   
    
    function min(uint x, uint y) internal pure returns (uint z) {
        z = x < y ? x : y;
    }

    // babylonian method (https://en.wikipedia.org/wiki/Methods_of_computing_square_roots#Babylonian_method)
    function sqrt(uint y) internal pure returns (uint z) {
        if (y > 3) {
            z = y;
            uint x = y / 2 + 1;
            while (x < z) {
                z = x;
                x = (y / x + x) / 2;
            }
        } else if (y != 0) {
            z = 1;
        }
    }
}
