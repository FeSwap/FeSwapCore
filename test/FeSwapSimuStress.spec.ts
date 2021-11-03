import chai, { expect } from 'chai'
import { Contract, utils, constants, BigNumber } from 'ethers'
import { solidity, MockProvider, createFixtureLoader,deployContract } from 'ethereum-waffle'
import { expandTo18Decimals, mineBlock, encodePrice } from './shared/utilities'
import { pairFixture } from './shared/fixtures'

import WETH9 from '../build/WETH9.json'
import FeSwapRouter from '../build/FeSwapRouter.json'
import RouterEventEmitter from '../build/RouterEventEmitter.json'
import FeSwapFactory from '../build/FeSwapFactory.json'
import FeSwapSimu from '../build/FeSwapSimu.json'

import { v2Fixture } from './shared/Routerfixtures'

const MINIMUM_LIQUIDITY = BigNumber.from(10).pow(3)

chai.use(solidity)

const overrides = {
  gasLimit: 9999999
}

interface PoolState {
    AmountAA: BigNumber,
    AmountB: BigNumber,
    AmountA: BigNumber,
    AmountBB: BigNumber,
    
    LiquityAB: BigNumber,
    LiquityBA: BigNumber,
    
    KLastAB: BigNumber,
    KLastBA: BigNumber,
    
    feeLiquidityPoolAB: BigNumber,
    feeLiquidityCreatorAB: BigNumber,
    
    feeLiquidityPoolBA: BigNumber,
    feeLiquidityCreatorBA: BigNumber
}

interface UserState {
    amountA: BigNumber,
    amountB: BigNumber,
    liquityAB: BigNumber,
    liquityBA: BigNumber,
    liquityUni: BigNumber
} 

describe('FeSwapSimuStress: ', () => {
    const provider = new MockProvider({
        ganacheOptions: {
          hardfork: 'istanbul',
          mnemonic: 'horn horn horn horn horn horn horn horn horn horn horn horn',
          gasLimit: 9999999
        },
      })
    const [wallet, feeTo, pairOwner] = provider.getWallets()
    const loadFixture = createFixtureLoader([wallet, feeTo, pairOwner], provider)

    let tokenA: Contract
    let tokenB: Contract
    let WETH: Contract
    let WETHPartner: Contract
    let factory: Contract
    let router: Contract
    let pairAAB: Contract
    let pairABB: Contract
    let WETHPairTTE: Contract
    let WETHPairTEE: Contract    
    let routerEventEmitter: Contract
    let FeSwapSimuContract: Contract

    async function init() {
        const fixture = await loadFixture(v2Fixture)
        tokenA = fixture.tokenA
        tokenB = fixture.tokenB
        WETH = fixture.WETH
        WETHPartner = fixture.WETHPartner
        factory = fixture.factoryFeswa
        router = fixture.routerFeswa
        pairAAB = fixture.pairAAB
        pairABB = fixture.pairABB      
        WETHPairTTE = fixture.WETHPairTTE
        WETHPairTEE = fixture.WETHPairTEE    
        routerEventEmitter = fixture.routerEventEmitter
    }
    
    async function addLiquidityAAB(tokenAAmount: BigNumber, tokenBAmount: BigNumber) {
        await tokenA.transfer(pairAAB.address, tokenAAmount)
        await tokenB.transfer(pairAAB.address, tokenBAmount)
        await pairAAB.mint(wallet.address, overrides)
    }

    async function addLiquidityABB(tokenAAmount: BigNumber, tokenBAmount: BigNumber) {
        await tokenA.transfer(pairABB.address, tokenAAmount)
        await tokenB.transfer(pairABB.address, tokenBAmount)
        await pairABB.mint(wallet.address, overrides)
    }

    async function SimuAddLiquityt(userID: Number) {
        await FeSwapSimuContract.addLiquidityAB( userID, 10, 30 )
        await FeSwapSimuContract.addLiquidityBA( userID, 30, 10 )
    }
    
    async function CheckSimuConsistent(_last: boolean = false) {
        const poolState: PoolState = await FeSwapSimuContract.pool()
        const userState: UserState = await FeSwapSimuContract.users(1)

        const AmountTokeA = await tokenA.balanceOf(wallet.address)
        const AmountTokeB = await tokenB.balanceOf(wallet.address)
        const LiquityWalletAB = await pairAAB.balanceOf(wallet.address)
        const LiquityWalletBA = await pairABB.balanceOf(wallet.address) 
        const totalSupplyAB = await pairAAB.totalSupply()
        const totalSupplyBA = await pairABB.totalSupply()   

        expect(AmountTokeA).to.eq(userState.amountA)
        expect(AmountTokeB).to.eq(userState.amountB)

        expect(LiquityWalletAB).to.eq(userState.liquityAB)
        expect(LiquityWalletBA).to.eq(userState.liquityBA)     
        expect(totalSupplyAB).to.eq(poolState.LiquityAB)
        expect(totalSupplyBA).to.eq(poolState.LiquityBA)  

        if( _last) {
            console.log(poolState, userState)
            console.log(    AmountTokeA.toHexString(), AmountTokeB.toHexString(),
                            LiquityWalletAB.toHexString(), LiquityWalletBA.toHexString())
        }
    }

    it(`Swap Arbitrage: test Init`, async () => {
        await init()
        await tokenA.approve(router.address, constants.MaxUint256)
        await tokenB.approve(router.address, constants.MaxUint256)   
        await pairAAB.approve(router.address, constants.MaxUint256)
        await pairABB.approve(router.address, constants.MaxUint256)  
    })

  it('Swap Arbitrage', async () => {
    const tokenAAmount = expandTo18Decimals(1000)
    const tokenBAmount = expandTo18Decimals(1000)
    await addLiquidityAAB(tokenAAmount, tokenBAmount)
    await addLiquidityABB(tokenAAmount, tokenBAmount)

    const swapAmount = expandTo18Decimals(10)
    const expectedOutputAmount = BigNumber.from('9900990099009900990') 

    await expect(
      router.swapExactTokensForTokens(
        swapAmount,
        0,
        [tokenA.address, tokenB.address],
        wallet.address,
        constants.MaxUint256,
        overrides
      )
    )
      .to.emit(tokenA, 'Transfer')
      .withArgs(wallet.address, pairAAB.address, swapAmount)
      .to.emit(tokenB, 'Transfer')
     .withArgs(pairAAB.address, wallet.address, expectedOutputAmount)
      .to.emit(pairAAB, 'Sync')
      .withArgs(tokenAAmount.add(swapAmount), tokenBAmount.sub(expectedOutputAmount))
      .to.emit(pairAAB, 'Swap')
      .withArgs(router.address, swapAmount, 0, expectedOutputAmount, wallet.address)
    
    expect(await tokenA.balanceOf(pairAAB.address)).to.eq('1010000000000000000000')
    expect(await tokenB.balanceOf(pairAAB.address)).to.eq( '990099009900990099010')
      
    const BalanceABA = await tokenA.balanceOf(pairAAB.address)
    const BalanceABB = await tokenB.balanceOf(pairAAB.address) 
    const BalanceBAA = await tokenA.balanceOf(pairABB.address)
    const BalanceBAB = await tokenB.balanceOf(pairABB.address)                     

    const arbitrageLB = BigNumber.from('4950495049504950495')
    const arbitrageLA = BigNumber.from('4999999999999999999')    
    
    const expectedOutputAmountA = BigNumber.from('9999507437690867894')   //9999507437690867894

    await expect(
      router.swapExactTokensForTokens(
      swapAmount,
      0,
      [tokenB.address, tokenA.address],
      wallet.address,
      constants.MaxUint256,
      overrides
      )
    )  
      .to.emit(tokenB, 'Transfer')
      .withArgs(pairABB.address, pairAAB.address, arbitrageLB)
      .to.emit(tokenA, 'Transfer')
      .withArgs(pairAAB.address, pairABB.address, arbitrageLA)
      .to.emit(pairABB, 'Sync')
      .withArgs(BalanceBAB.sub(arbitrageLB), BalanceBAA.add(arbitrageLA))
      .to.emit(pairAAB, 'Sync')
      .withArgs(BalanceABA.sub(arbitrageLA), BalanceABB.add(arbitrageLB))          
      .to.emit(tokenB, 'Transfer')
      .withArgs(wallet.address, pairABB.address, swapAmount)
      .to.emit(tokenA, 'Transfer') 
      .withArgs(pairABB.address, wallet.address, expectedOutputAmountA)
      .to.emit(pairABB, 'Sync')
      .withArgs(BalanceBAB.sub(arbitrageLB).add(swapAmount), BalanceBAA.add(arbitrageLA).sub(expectedOutputAmountA))
      .to.emit(pairABB, 'Swap')
      .withArgs(router.address, swapAmount, 0, expectedOutputAmountA, wallet.address)

      const AAmount = expandTo18Decimals(10)
      const BAmount = expandTo18Decimals(10)
      await router.addLiquidity(  {
                                    tokenA:         tokenA.address,
                                    tokenB:         tokenB.address,
                                    amountADesired: AAmount,
                                    amountBDesired: expandTo18Decimals(20),
                                    amountAMin:     0,
                                    amountBMin:     0,
                                    ratio:          100,
                                  },
                                  wallet.address, constants.MaxUint256, overrides  )

      await router.addLiquidity(  {
                                    tokenA:         tokenA.address,
                                    tokenB:         tokenB.address,
                                    amountADesired: expandTo18Decimals(20),
                                    amountBDesired: BAmount,
                                    amountAMin:     0,
                                    amountBMin:     0,
                                    ratio:          0,
                                  },                                  
                                  wallet.address, constants.MaxUint256, overrides  )

      let AmountTokeAofWallet = await tokenA.balanceOf(wallet.address)
      let AmountTokeBofWallet = await tokenB.balanceOf(wallet.address)                                   
      let LiquityWalletAB = await pairAAB.balanceOf(wallet.address)
      let LiquityWalletBA = await pairABB.balanceOf(wallet.address) 

      let feeToAAB = await pairAAB.balanceOf(feeTo.address)
      let feeCreateAAB = await pairAAB.balanceOf(pairOwner.address)  
      let feeToABB = await pairABB.balanceOf(feeTo.address)
      let feeCreateABB = await pairABB.balanceOf(pairOwner.address)  

      expect(AmountTokeAofWallet).to.eq('7980099492685568592026')
      expect(AmountTokeBofWallet).to.eq('7980000000000000000000')
      expect(LiquityWalletAB).to.eq('1009950259018259232354')
      expect(LiquityWalletBA).to.eq('1009949768906003382721')   

      expect(feeToAAB).to.eq('412534021180854')
      expect(feeCreateAAB).to.eq('618801031771281')
      expect(feeToABB).to.eq('412534021180854')
      expect(feeCreateABB).to.eq('618801031771281')               
      
      let AmountTokeAofPairAAB = await tokenA.balanceOf(pairAAB.address)
      let AmountTokeBofPairAAB = await tokenB.balanceOf(pairAAB.address)       
      let AmountTokeAofPairABB = await tokenA.balanceOf(pairABB.address)
      let AmountTokeBofPairABB = await tokenB.balanceOf(pairABB.address)  

      expect(AmountTokeAofPairAAB).to.eq('1015000000000000000001')
      expect(AmountTokeBofPairAAB).to.eq('1004950495049504950495')
      expect(AmountTokeAofPairABB).to.eq('1004900507314431407973')
      expect(AmountTokeBofPairABB).to.eq('1015049504950495049505')   
 
      let TotalLiquityAB = await pairAAB.totalSupply()
      var {_kLast: KValueLastAB} = await pairAAB.getOracleInfo()
      let TotalLiquityBA = await pairABB.totalSupply() 
      var {_kLast: KValueLastBA} = await pairABB.getOracleInfo()

      expect(TotalLiquityAB).to.eq('1009951290353312185489')
      expect(KValueLastAB).to.eq('1020024752475247524753429950495049504950495')
      expect(TotalLiquityBA).to.eq('1009950800241056335856')
      expect(KValueLastBA).to.eq('1020023762474014930152445391114223486703365')   

      await router.removeLiquidity( {
                                      tokenA:         tokenA.address,
                                      tokenB:         tokenB.address,
                                      liquidityAAB:   LiquityWalletAB,
                                      liquidityABB:   0, 
                                      amountAMin:     0,
                                      amountBMin:     0,
                                    },                                    
                                    wallet.address, constants.MaxUint256, overrides  )

      await router.removeLiquidity( {
                                      tokenA:         tokenA.address,
                                      tokenB:         tokenB.address,
                                      liquidityAAB:   0,
                                      liquidityABB:   LiquityWalletBA, 
                                      amountAMin:     0,
                                      amountBMin:     0,
                                    },                                          
                                    wallet.address, constants.MaxUint256, overrides  )   
                                    
      AmountTokeAofWallet = await tokenA.balanceOf(wallet.address)
      AmountTokeBofWallet = await tokenB.balanceOf(wallet.address)                                   
      LiquityWalletAB = await pairAAB.balanceOf(wallet.address)
      LiquityWalletBA = await pairABB.balanceOf(wallet.address) 

      feeToAAB = await pairAAB.balanceOf(feeTo.address)
      feeCreateAAB = await pairAAB.balanceOf(pairOwner.address)  
      feeToABB = await pairABB.balanceOf(feeTo.address)
      feeCreateABB = await pairABB.balanceOf(pairOwner.address)  

      expect(AmountTokeAofWallet).to.eq('9999997937331513399267')
      expect(AmountTokeBofWallet).to.eq('9999997937229909119349')
      expect(LiquityWalletAB).to.eq('0')
      expect(LiquityWalletBA).to.eq('0')   

      expect(feeToAAB).to.eq('412534021180854')
      expect(feeCreateAAB).to.eq('618801031771281')
      expect(feeToABB).to.eq('412534021180854')
      expect(feeCreateABB).to.eq('618801031771281')               
      
      AmountTokeAofPairAAB = await tokenA.balanceOf(pairAAB.address)
      AmountTokeBofPairAAB = await tokenB.balanceOf(pairAAB.address)       
      AmountTokeAofPairABB = await tokenA.balanceOf(pairABB.address)
      AmountTokeBofPairABB = await tokenB.balanceOf(pairABB.address)  

      expect(AmountTokeAofPairAAB).to.eq('1036490659248752')
      expect(AmountTokeBofPairAAB).to.eq('1026228375493814')
      expect(AmountTokeAofPairABB).to.eq('1026177827351981')
      expect(AmountTokeBofPairABB).to.eq('1036541715386837')   

      TotalLiquityAB = await pairAAB.totalSupply()
      var {_kLast: KValueLastAB} = await pairAAB.getOracleInfo()
      TotalLiquityBA = await pairABB.totalSupply() 
      var {_kLast: KValueLastBA} = await pairABB.getOracleInfo()

      expect(TotalLiquityAB).to.eq('1031335052953135')
      expect(KValueLastAB).to.eq('1063676125455359084144263220128')
      expect(TotalLiquityBA).to.eq('1031335052953135')
      expect(KValueLastBA).to.eq('1063676125455359846586773274097')   
    })

    it(`Swap Arbitrage Stress: test Init`, async () => {
        await init()
    })

    it(`Swap Arbitrage Stress: test Prepare`, async () => {
        await factory.setRouterFeSwap(feeTo.address)
        FeSwapSimuContract  = await deployContract(wallet, FeSwapSimu, [10000,10000], overrides)
        await tokenA.approve(router.address, constants.MaxUint256)
        await tokenB.approve(router.address, constants.MaxUint256)  
        await pairAAB.approve(router.address, constants.MaxUint256)
        await pairABB.approve(router.address, constants.MaxUint256)
    })

    it(`Swap Arbitrage Stress: Add liquidity`, async () => {
        await FeSwapSimuContract.addLiquidityAB( 1, 1000, 1000 )
        await FeSwapSimuContract.addLiquidityBA( 1, 1000, 1000 )

        const tokenAAmount = expandTo18Decimals(1000)
        const tokenBAmount = expandTo18Decimals(1000)
        await addLiquidityAAB(tokenAAmount, tokenBAmount)
        await addLiquidityABB(tokenAAmount, tokenBAmount)

        const poolState: PoolState = await FeSwapSimuContract.pool()
        const userState: UserState = await FeSwapSimuContract.users(1)

        const LiquityWalletAB = await pairAAB.balanceOf(wallet.address)
        const LiquityWalletBA = await pairABB.balanceOf(wallet.address) 
        const totalSupplyAB = await pairAAB.totalSupply()
        const totalSupplyBA = await pairABB.totalSupply()   

        expect(LiquityWalletAB).to.eq(userState.liquityAB)
        expect(LiquityWalletBA).to.eq(userState.liquityBA)     
        expect(totalSupplyAB).to.eq(poolState.LiquityAB)
        expect(totalSupplyBA).to.eq(poolState.LiquityBA)        
    })

    for(let i=0; i<100; i++)
    {
        it(`Swap Arbitrage Stress test ${i}`, async () => {

            if( (i % 10) == 3) { 
                await SimuAddLiquityt(1) 

                const AAmount = expandTo18Decimals(10)
                const BAmount = expandTo18Decimals(10)
                await router.addLiquidity(  {
                                              tokenA:         tokenA.address,
                                              tokenB:         tokenB.address,
                                              amountADesired: AAmount,
                                              amountBDesired: expandTo18Decimals(1000000),
                                              amountAMin:     0,
                                              amountBMin:     0,
                                              ratio:          100,                                            
                                            },                                        
                                            wallet.address, constants.MaxUint256, overrides )
  
                await router.addLiquidity(  {
                                              tokenA:         tokenA.address,
                                              tokenB:         tokenB.address,
                                              amountADesired: expandTo18Decimals(1000000),
                                              amountBDesired: BAmount,
                                              amountAMin:     0,
                                              amountBMin:     0,
                                              ratio:          0,                                            
                                            },                                                
                                            wallet.address, constants.MaxUint256, overrides  )
            }

            await FeSwapSimuContract.SwapAB (1, 10 ) 
            await FeSwapSimuContract.SwapBA (1, 10 )

            const swapAmount = expandTo18Decimals(10)
            await router.swapExactTokensForTokens(  swapAmount, 0, [tokenA.address, tokenB.address], 
                                                    wallet.address, constants.MaxUint256, overrides )
            await router.swapExactTokensForTokens(  swapAmount, 0, [tokenB.address, tokenA.address], 
                                                    wallet.address, constants.MaxUint256, overrides ) 
            
            if( (i % 10) == 5)
                await CheckSimuConsistent()

        })
    }

    it(`Swap Arbitrage Stress: Last Check`, async () => {
        await CheckSimuConsistent()
    })

    it(`Swap Arbitrage Stress: Remove All`, async () => {
        let LiquityWalletAB = await pairAAB.balanceOf(wallet.address)
        let LiquityWalletBA = await pairABB.balanceOf(wallet.address) 
        await router.removeLiquidity(   {
                                          tokenA:         tokenA.address,
                                          tokenB:         tokenB.address,
                                          liquidityAAB:   LiquityWalletAB,
                                          liquidityABB:   0, 
                                          amountAMin:     0,
                                          amountBMin:     0,
                                        },  
                                        wallet.address, constants.MaxUint256, overrides  )

        await router.removeLiquidity(   {
                                          tokenA:         tokenA.address,
                                          tokenB:         tokenB.address,
                                          liquidityAAB:   0,
                                          liquidityABB:   LiquityWalletBA, 
                                          amountAMin:     0,
                                          amountBMin:     0,
                                        },                                      
                                        wallet.address, constants.MaxUint256, overrides  )    

        await FeSwapSimuContract.removeLiquidityAB(1,LiquityWalletAB)
        await FeSwapSimuContract.removeLiquidityBA(1,LiquityWalletBA)

//        await CheckSimuConsistent(true)
        await CheckSimuConsistent()
    })

})
