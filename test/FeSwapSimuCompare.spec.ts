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
    feeLiquidityCreatorBA: BigNumber,
    arbitrageTime: BigNumber
}

interface PoolUniState {
    AmountA: BigNumber,
    AmountB: BigNumber,
    Liquity: BigNumber,
    KLast: BigNumber,
    feeUniPool: BigNumber
} 

interface UserState {
    amountA: BigNumber,
    amountB: BigNumber,
    liquityAB: BigNumber,
    liquityBA: BigNumber,
    liquityUni: BigNumber
} 

describe('FeSwapSimuCompare: ', () => {
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
    
   
    async function CheckSimuConsistent(_last: boolean = false) {
        const poolState: PoolState = await FeSwapSimuContract.pool()
        const userState: UserState = await FeSwapSimuContract.users(1)

        const AmountTokeA = await tokenA.balanceOf(wallet.address)
        const AmountTokeB = await tokenB.balanceOf(wallet.address)
        const LiquityWalletAB = await pairAAB.balanceOf(wallet.address)
        const LiquityWalletBA = await pairABB.balanceOf(wallet.address) 
        const totalSupplyAB = await pairAAB.totalSupply()
        const totalSupplyBA = await pairABB.totalSupply()   

        expect(LiquityWalletAB).to.eq(userState.liquityAB)
        expect(LiquityWalletBA).to.eq(userState.liquityBA)     
        expect(totalSupplyAB).to.eq(poolState.LiquityAB)
        expect(totalSupplyBA).to.eq(poolState.LiquityBA)  

        if( _last) {
            console.log(poolState, userState)
            console.log(    AmountTokeA.toString(), AmountTokeB.toString(),
                            LiquityWalletAB.toString(), LiquityWalletBA.toString())
        }
    }

    function DisplayUser(userInfo: string, userState: UserState){
        console.log( "Pool Status: " + userInfo + "\r\n",    
                    "amountA: "+userState.amountA.toString()+"\r\n", "amountB: "+userState.amountB.toString()+"\r\n",
                    "liquityAB: "+userState.liquityAB.toString()+"\r\n", "liquityBA: "+userState.liquityBA.toString()+"\r\n",
                    "liquityUni: "+userState.liquityUni.toString()+"\r\n")  
    }    

    async function DisplayStatus(){
        const poolState: PoolState = await FeSwapSimuContract.pool()
        const UniState: PoolUniState = await FeSwapSimuContract.poolUni()
        const userState1: UserState = await FeSwapSimuContract.users(1)
        const userState2: UserState = await FeSwapSimuContract.users(2)
        const userState3: UserState = await FeSwapSimuContract.users(3)
        const userState4: UserState = await FeSwapSimuContract.users(4)

        console.log(    "Pool Status:\r\n","AmountAA:"+poolState.AmountAA.toString()+"\r\n", "AmountB: "+poolState.AmountB.toString()+"\r\n",
                        "AmountA: "+poolState.AmountAA.toString()+"\r\n", "AmountBB: "+poolState.AmountB.toString()+"\r\n",
                        "LiquityAB: "+poolState.LiquityAB.toString()+"\r\n", "LiquityBA: "+poolState.LiquityBA.toString()+"\r\n",
                        "KLastAB: "+poolState.KLastAB.toString()+"\r\n", "KLastBA: "+poolState.KLastBA.toString()+"\r\n", 
                        "feeLiquidityPoolAB: "+poolState.feeLiquidityPoolAB.toString()+"\r\n", "feeLiquidityCreatorAB: "+poolState.feeLiquidityCreatorAB.toString()+"\r\n",                                          
                        "feeLiquidityPoolBA: "+poolState.feeLiquidityPoolBA.toString()+"\r\n", "feeLiquidityCreatorBA: "+poolState.feeLiquidityCreatorBA.toString()+"\r\n",
                        "arbitrageTime: "+poolState.arbitrageTime.toString()+"\r\n") 

        console.log( "PoolUni Status:\r\n",    
                        "AmountA: "+UniState.AmountA.toString()+"\r\n", "AmountB: "+UniState.AmountB.toString()+"\r\n",
                        "Liquity: "+UniState.Liquity.toString()+"\r\n", "KLast: "+UniState.KLast.toString()+"\r\n",
                        "feeUniPool: "+UniState.feeUniPool.toString()+"\r\n")

        DisplayUser("User 1", userState1)    
        DisplayUser("User 2", userState2)                       
        DisplayUser("User 3", userState3)    
        DisplayUser("User 4", userState4)
       
    }    

    async function CompareUserStatus() {
        const userState1: UserState = await FeSwapSimuContract.users(1)
        const userState2: UserState = await FeSwapSimuContract.users(2)
        const userState3: UserState = await FeSwapSimuContract.users(3)
        const userState4: UserState = await FeSwapSimuContract.users(4)

        const KvalueAdded1: number =    parseFloat((userState1.amountA).toString()) * parseFloat((userState1.amountB).toString()) - 6.4e47
        const KvalueAdded2: number =    parseFloat((userState2.amountA).toString()) * parseFloat((userState2.amountB).toString()) - 6.4e47
        console.log( "KvalueAdded1: "+KvalueAdded1, "KvalueAdded2: "+KvalueAdded2, "KvalueAddedRatio: "+(KvalueAdded1 / KvalueAdded2))

        const KvalueLost3: number =    6.4e47 - parseFloat((userState3.amountA).toString()) * parseFloat((userState3.amountB).toString())
        const KvalueLost4: number =    6.4e47 - parseFloat((userState4.amountA).toString()) * parseFloat((userState4.amountB).toString()) 
        console.log( "KvalueLost3: "+KvalueLost3, "KvalueLost4: "+KvalueLost4, "KvalueLostRatio: "+KvalueLost3 / KvalueLost4 )
    } 
    
    async function DisplayUserStatus(j: number,  userState : UserState, userStateUni : UserState ) {
        DisplayUser(`User ${5+j}`, userState)
        DisplayUser(`User Uni ${15+j}`, userStateUni)       
        const KvalueAdded1: number =    parseFloat((userState.amountA).toString()) * parseFloat((userState.amountB).toString()) - 6.4e47
        const KvalueAdded2: number =    parseFloat((userStateUni.amountA).toString()) * parseFloat((userStateUni.amountB).toString()) - 6.4e47
        console.log( "KvalueAdded: "+KvalueAdded1, "KvalueAddedUni: "+KvalueAdded2, "KvalueAddedRatio: "+(KvalueAdded1 / KvalueAdded2))
    } 
    
    it(`Swap Arbitrage Compare: test Init`, async () => {
        await init()
    })

    it(`Swap Arbitrage Compare: test Prepare`, async () => {
        FeSwapSimuContract  = await deployContract(wallet, FeSwapSimu, [40000, 16000000 ], overrides)
    })

    it(`Swap Arbitrage Compare: Add liquidity`, async () => {
        await FeSwapSimuContract.addLiquidityAB( 1, 5000, 2000000 )
        await FeSwapSimuContract.addLiquidityBA( 1, 5000, 2000000 )
        await FeSwapSimuContract.addLiquidityUni( 2, 10000, 4000000 )
        await DisplayStatus()
    })

    let AddStep: number = 100/10
    let NextAddId: number = AddStep
    for(let i=0; i<110; i++)
    {
        it(`Swap Arbitrage Stress test ${i}`, async () => {

            await FeSwapSimuContract.SwapAB (3, 1 ) 
            await FeSwapSimuContract.SwapBA (3, 600 )
            await FeSwapSimuContract.SwapABUni (4, 1 )
            await FeSwapSimuContract.SwapBAUni (4, 600 ) 
            
            if( (i>0) && ((i % AddStep) == 0) ) { 
                await FeSwapSimuContract.addLiquidityAB( 5+(i/AddStep)-1, 50, 400000 )
                await FeSwapSimuContract.addLiquidityBA( 5+(i/AddStep)-1, 50, 400000 )
                await FeSwapSimuContract.addLiquidityUni( 15+(i/AddStep)-1, 100, 400000 )   // just put larger Token B
            }
        })
    }

    it(`Swap Arbitrage Stress: Check Before Remove`, async () => {
        await DisplayStatus()
    })

    for(let j=0; j<10; j++) {
        it(`Swap Arbitrage Stress: Remove All Uni Liquidity ${j}`, async () => {
            const userState: UserState = await FeSwapSimuContract.users(5+j)
            const userStateUni: UserState = await FeSwapSimuContract.users(15+j)           
            DisplayUser(`User ${5+j}`, userState)
            DisplayUser(`User ${15+j}`, userStateUni)           
         })
    }

    it(`Swap Arbitrage Stress: Remove All`, async () => {
        const userState1: UserState = await FeSwapSimuContract.users(1)
        const userState2: UserState = await FeSwapSimuContract.users(2)

        await FeSwapSimuContract.removeLiquidityAB(1,userState1.liquityAB)
        await FeSwapSimuContract.removeLiquidityBA(1,userState1.liquityBA)
        await FeSwapSimuContract.removeLiquidityUni(2,userState2.liquityUni)
    })

    for(let j=0; j<10; j++) {
        it(`Swap Arbitrage Stress: Remove All Uni Liquidity ${j}`, async () => {

            let userState: UserState = await FeSwapSimuContract.users(5+j)
            await FeSwapSimuContract.removeLiquidityAB(5+j,userState.liquityAB)
            await FeSwapSimuContract.removeLiquidityBA(5+j,userState.liquityBA)
            userState = await FeSwapSimuContract.users(5+j)

            let userStateUni: UserState = await FeSwapSimuContract.users(15+j)
            await FeSwapSimuContract.removeLiquidityUni(15+j,userStateUni.liquityUni)
            userStateUni = await FeSwapSimuContract.users(15+j)

            DisplayUserStatus(j, userState, userStateUni)
         })
    }

    it(`Swap Arbitrage Stress: Check After Remove`, async () => {
        await DisplayStatus()
        await CompareUserStatus()
    })

})
