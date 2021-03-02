import chai, { expect } from 'chai'
import { solidity, MockProvider, createFixtureLoader, deployContract } from 'ethereum-waffle'
import { Contract } from 'ethers'
import { BigNumber, bigNumberify, keccak256, solidityPack } from 'ethers/utils'
import { MaxUint256 } from 'ethers/constants'
import IUniswapV2Pair from '../build/IFeSwapPair.json'
import FeSwapPair from '../build/FeSwapPair.json'
import { AddressZero } from 'ethers/constants'

import { v2Fixture } from './shared/Routerfixtures'
import { expandTo18Decimals, getApprovalDigest, MINIMUM_LIQUIDITY, getFeSwapCodeHash, mineBlock } from './shared/utilities'

import DeflatingERC20 from '../build/DeflatingERC20.json'
import { ecsign } from 'ethereumjs-util'

chai.use(solidity)

const overrides = {
  gasLimit: 9999999
}

const initPoolPrice = expandTo18Decimals(1).div(5)
const BidStartTime: number = 1615338000   // 2021/02/22 03/10 9:00
const OPEN_BID_DURATION: number =  (3600 * 24 * 14)

describe('FeSwapRouter', () => {
  const provider = new MockProvider({
    hardfork: 'istanbul',
    mnemonic: 'horn horn horn horn horn horn horn horn horn horn horn horn',
    gasLimit: 9999999
  })
  const [wallet, feeTo, pairOwner]  = provider.getWallets()
  const loadFixture = createFixtureLoader(provider, [wallet, feeTo, pairOwner])

  let factory: Contract
  let tokenA: Contract
  let tokenB: Contract
  let router: Contract
  let WETHPartner: Contract 
  let WETH: Contract
  let Feswa:  Contract
  let FeswaNFT:   Contract
  let tokenIDMatch: string

  beforeEach(async ()=> {
    const fixture = await loadFixture(v2Fixture)
    factory = fixture.factoryFeswa
    tokenA = fixture.tokenA
    tokenB = fixture.tokenB
    router = fixture.routerFeswa
    WETHPartner = fixture.WETHPartner
    WETH = fixture.WETH
    Feswa = fixture.Feswa
    FeswaNFT = fixture.FeswaNFT   
    tokenIDMatch = fixture.tokenIDMatch   
  })

  it('Router initialized with factory, WETH', async () => {
    getFeSwapCodeHash()
    expect(await router.factory()).to.eq(factory.address)
    expect(await router.feswaNFT()).to.eq(FeswaNFT.address)
    expect(await router.WETH()).to.eq(WETH.address)

  })

  it('quote', async () => {
    expect(await router.quote(bigNumberify(1), bigNumberify(100), bigNumberify(200))).to.eq(bigNumberify(2))
    expect(await router.quote(bigNumberify(2), bigNumberify(200), bigNumberify(100))).to.eq(bigNumberify(1))
    await expect(router.quote(bigNumberify(0), bigNumberify(100), bigNumberify(200))).to.be.revertedWith(
      'FeSwapLibrary: INSUFFICIENT_AMOUNT'
    )
    await expect(router.quote(bigNumberify(1), bigNumberify(0), bigNumberify(200))).to.be.revertedWith(
      'FeSwapLibrary: INSUFFICIENT_LIQUIDITY'
    )
    await expect(router.quote(bigNumberify(1), bigNumberify(100), bigNumberify(0))).to.be.revertedWith(
      'FeSwapLibrary: INSUFFICIENT_LIQUIDITY'
    )
  })

  it('getAmountOut', async () => {
    expect(await router.getAmountOut(bigNumberify(2), bigNumberify(100), bigNumberify(100))).to.eq(bigNumberify(1))
    expect(await router.getAmountOut(expandTo18Decimals(2), expandTo18Decimals(100), expandTo18Decimals(100)))
            .to.eq(new BigNumber('1960784313725490196'))
    await expect(router.getAmountOut(bigNumberify(0), bigNumberify(100), bigNumberify(100))).to.be.revertedWith(
      'FeSwapLibrary: INSUFFICIENT_INPUT_AMOUNT'
    )
    await expect(router.getAmountOut(bigNumberify(2), bigNumberify(0), bigNumberify(100))).to.be.revertedWith(
      'FeSwapLibrary: INSUFFICIENT_LIQUIDITY'
    )
    await expect(router.getAmountOut(bigNumberify(2), bigNumberify(100), bigNumberify(0))).to.be.revertedWith(
      'FeSwapLibrary: INSUFFICIENT_LIQUIDITY'
    )
  })

  it('getAmountIn', async () => {
    expect(await router.getAmountIn(bigNumberify(1), bigNumberify(100), bigNumberify(100))).to.eq(bigNumberify(2))
    expect(await router.getAmountIn(expandTo18Decimals(1), expandTo18Decimals(100), expandTo18Decimals(100)))
            .to.eq(new BigNumber('1010101010101010102'))
    await expect(router.getAmountIn(bigNumberify(0), bigNumberify(100), bigNumberify(100))).to.be.revertedWith(
      'FeSwapLibrary: INSUFFICIENT_OUTPUT_AMOUNT'
    )
    await expect(router.getAmountIn(bigNumberify(1), bigNumberify(0), bigNumberify(100))).to.be.revertedWith(
      'FeSwapLibrary: INSUFFICIENT_LIQUIDITY'
    )
    await expect(router.getAmountIn(bigNumberify(1), bigNumberify(100), bigNumberify(0))).to.be.revertedWith(
      'FeSwapLibrary: INSUFFICIENT_LIQUIDITY'
    )
  })

  it('getAmountsOutMinor', async () => {
    await tokenA.approve(router.address, MaxUint256)
    await tokenB.approve(router.address, MaxUint256)
    await router.addLiquidity( tokenA.address, tokenB.address, expandTo18Decimals(1000), expandTo18Decimals(1000),
                                50, wallet.address, MaxUint256, overrides)

    await expect(router.estimateAmountsOut(bigNumberify(2), [tokenA.address])).to.be.revertedWith(
      'FeSwapLibrary: INVALID_PATH'
    )
    const path = [tokenA.address, tokenB.address]
    expect(await router.estimateAmountsOut(bigNumberify(2), path)).to.deep.eq([bigNumberify(2), bigNumberify(1)])
  })

  it('getAmountsOutNormal', async () => {
    await tokenA.approve(router.address, MaxUint256)
    await tokenB.approve(router.address, MaxUint256)
    await router.addLiquidity( tokenA.address, tokenB.address, expandTo18Decimals(1000), expandTo18Decimals(1000),
                                50, wallet.address, MaxUint256, overrides)

    const path = [tokenA.address, tokenB.address]
    expect(await router.estimateAmountsOut(expandTo18Decimals(2), path))
                    .to.deep.eq([expandTo18Decimals(2), expandTo18Decimals(1000).div(502)])  // = 2*50e18/502
  })

  it('getAmountsOutTripple', async () => {
    await tokenA.approve(router.address, MaxUint256)
    await tokenB.approve(router.address, MaxUint256)
    await WETHPartner.approve(router.address, MaxUint256)   
    await router.addLiquidity( tokenA.address, tokenB.address, expandTo18Decimals(1000), expandTo18Decimals(2000),
                                50, wallet.address, MaxUint256, overrides)

    await router.addLiquidity( tokenB.address, WETHPartner.address, expandTo18Decimals(3000), expandTo18Decimals(5000),
                                50, wallet.address, MaxUint256, overrides)                                

    const tokenBOut = expandTo18Decimals(2).mul(1000).div(502)
    const WETHPartnerOut = expandTo18Decimals(2500).mul(tokenBOut).div(expandTo18Decimals(1500).add(tokenBOut))
    const path = [tokenA.address, tokenB.address, WETHPartner.address]
    expect(await router.estimateAmountsOut(expandTo18Decimals(2), path))
                    .to.deep.eq([expandTo18Decimals(2), tokenBOut, WETHPartnerOut])  
  })

  it('getAmountsIn', async () => {
    await tokenA.approve(router.address, MaxUint256)
    await tokenB.approve(router.address, MaxUint256)
    await router.addLiquidity( tokenA.address, tokenB.address, expandTo18Decimals(1000), expandTo18Decimals(1000),
                                50, wallet.address, MaxUint256, overrides)

    await expect(router.estimateAmountsIn(bigNumberify(1), [tokenA.address]))
            .to.be.revertedWith('FeSwapLibrary: INVALID_PATH')
    const path = [tokenA.address, tokenB.address]
    expect(await router.estimateAmountsIn(bigNumberify(1), path)).to.deep.eq([bigNumberify(2), bigNumberify(1)])
  })

  it('getAmountsInTripple', async () => {
    await tokenA.approve(router.address, MaxUint256)
    await tokenB.approve(router.address, MaxUint256)
    await WETHPartner.approve(router.address, MaxUint256)   
    await router.addLiquidity( tokenA.address, tokenB.address, expandTo18Decimals(1000), expandTo18Decimals(2000),
                                50, wallet.address, MaxUint256, overrides)

    await router.addLiquidity( tokenB.address, WETHPartner.address, expandTo18Decimals(3000), expandTo18Decimals(5000),
                                50, wallet.address, MaxUint256, overrides)                                

    const tokenBIn = expandTo18Decimals(2).mul(1500).div(2498).add(1)
    const tokenAIn = expandTo18Decimals(500).mul(tokenBIn).div(expandTo18Decimals(1000).sub(tokenBIn)).add(1)
    const path = [tokenA.address, tokenB.address, WETHPartner.address]
    expect(await router.estimateAmountsIn(expandTo18Decimals(2), path))
                    .to.deep.eq([tokenAIn, tokenBIn, expandTo18Decimals(2)])  
  })
})


describe('FeSwapRouter: ManageFeswaPair', () => {
  const provider = new MockProvider({
    hardfork: 'istanbul',
    mnemonic: 'horn horn horn horn horn horn horn horn horn horn horn horn',
    gasLimit: 9999999
  })
  const [wallet, feeTo, pairOwner, newOwner]  = provider.getWallets()
  const loadFixture = createFixtureLoader(provider, [wallet, feeTo, pairOwner])

  let router: Contract
  let pairAAB: Contract
  let pairABB: Contract 
  let tokenIDMatch: string

  beforeEach(async ()=> {
    const fixture = await loadFixture(v2Fixture)
    router = fixture.routerFeswa
    pairAAB = fixture.pairAAB 
    pairABB = fixture.pairABB     
    tokenIDMatch = fixture.tokenIDMatch   
  })

  it('ManageFeswaPair: Invalide TokenID', async () => {
    await expect(router.ManageFeswaPair('0xFFFFFFFFFFF', pairOwner.address))
            .to.be.revertedWith('ERC721: owner query for nonexistent token')
  })

  it('ManageFeswaPair: Check Owner', async () => {
    await expect(router.ManageFeswaPair(tokenIDMatch, pairOwner.address))
            .to.be.revertedWith('FeSwap: NOT TOKEN OWNER')
  })

  it('ManageFeswaPair: Change Pair Owner', async () => {
    expect(await pairAAB.pairOwner()).to.be.eq(pairOwner.address)
    expect(await pairABB.pairOwner()).to.be.eq(pairOwner.address)
    await router.connect(pairOwner).ManageFeswaPair(tokenIDMatch, newOwner.address)
    expect(await pairAAB.pairOwner()).to.be.eq(newOwner.address)
    expect(await pairABB.pairOwner()).to.be.eq(newOwner.address)
  })
})

describe('FeSwapRouter: Deflation Token Test', () => {
  const provider = new MockProvider({
    hardfork: 'istanbul',
    mnemonic: 'horn horn horn horn horn horn horn horn horn horn horn horn',
    gasLimit: 9999999
  })
  const [wallet, feeTo, pairOwner] = provider.getWallets()
  const loadFixture = createFixtureLoader(provider, [wallet, feeTo, pairOwner])

  let factory: Contract
  let DTT: Contract
  let WETH: Contract
  let router: Contract
  let WETHPairTTE: Contract
  let WETHPairTEE: Contract

  beforeEach(async function() {
    const fixture = await loadFixture(v2Fixture)

    WETH = fixture.WETH
    router = fixture.routerFeswa
    factory = fixture.factoryFeswa

    DTT = await deployContract(wallet, DeflatingERC20, [expandTo18Decimals(10000)])

    // make a DTT<>WETH pair
    await factory.createUpdatePair(DTT.address, WETH.address, wallet.address, overrides)
    const pairAddressTTE = await factory.getPair(DTT.address, WETH.address)
    WETHPairTTE = new Contract(pairAddressTTE, JSON.stringify(IUniswapV2Pair.abi), provider).connect(wallet)

    const pairAddressTEE = await factory.getPair(WETH.address, DTT.address)
    WETHPairTEE = new Contract(pairAddressTEE, JSON.stringify(IUniswapV2Pair.abi), provider).connect(wallet)
  })

  afterEach(async function() {
    expect(await provider.getBalance(router.address)).to.eq(0)
  })

  async function addLiquidity(DTTAmount: BigNumber, WETHAmount: BigNumber, ratio: Number){
    await DTT.approve(router.address, MaxUint256)
    await router.addLiquidityETH(DTT.address, DTTAmount, ratio, wallet.address, MaxUint256, {
      ...overrides,
      value: WETHAmount
    })
  }

  it('removeLiquidityETHWithDefaltionTokens: Single Pool Liquidity', async () => {
    const DTTAmount = expandTo18Decimals(100)
    const ETHAmount = expandTo18Decimals(4)

    const ratio = 100
    await addLiquidity(DTTAmount, ETHAmount, ratio)

    const DTTInPair = await DTT.balanceOf(WETHPairTTE.address)
    const WETHInPair = await WETH.balanceOf(WETHPairTTE.address)
    const liquidity = await WETHPairTTE.balanceOf(wallet.address)
    const totalSupply = await WETHPairTTE.totalSupply()
    const NaiveDTTExpected = DTTInPair.mul(liquidity).div(totalSupply)
    const WETHExpected = WETHInPair.mul(liquidity).div(totalSupply)

    console.log('DTTInPair', DTTInPair.toString())
    console.log('WETHInPair', WETHInPair.toString())
    console.log('liquidity', liquidity.toString())
    console.log('totalSupply', totalSupply.toString())
    console.log('NaiveDTTExpected', NaiveDTTExpected.toString())
    console.log('WETHExpected', WETHExpected.toString())    
 
    await WETHPairTTE.approve(router.address, MaxUint256)
    await router.removeLiquidityETHWithDefaltionTokens(
      DTT.address,
      liquidity,
      0,
      NaiveDTTExpected,
      WETHExpected,
      pairOwner.address,
      MaxUint256,
      overrides
    )
    
    {
    const DTTInPair = await DTT.balanceOf(WETHPairTTE.address)
    const WETHInPair = await WETH.balanceOf(WETHPairTTE.address)
    const liquidity = await WETHPairTTE.balanceOf(pairOwner.address)
    const totalSupply = await WETHPairTTE.totalSupply()
    const NaiveDTTExpected = DTTInPair.mul(liquidity).div(totalSupply)
    const WETHExpected = WETHInPair.mul(liquidity).div(totalSupply)

    console.log('DTTInPair', DTTInPair.toString())
    console.log('WETHInPair', WETHInPair.toString())
    console.log('liquidity', liquidity.toString())
    console.log('totalSupply', totalSupply.toString())
    console.log('NaiveDTTExpected', NaiveDTTExpected.toString())
    console.log('WETHExpected', WETHExpected.toString()) 
    }

  })


  it('removeLiquidityETHWithDefaltionTokens: Double Pool Liquidity', async () => {
    const DTTAmount = expandTo18Decimals(100)
    const ETHAmount = expandTo18Decimals(4)

    const ratio = 0  
    await addLiquidity(DTTAmount, ETHAmount, ratio)
/*
    const DTTInPairTTE = await DTT.balanceOf(WETHPairTTE.address)
    const WETHInPairTTE = await WETH.balanceOf(WETHPairTTE.address)
    const liquidityTTE = await WETHPairTTE.balanceOf(wallet.address)
    const totalSupplyTTE = await WETHPairTTE.totalSupply()
    const NaiveDTTExpectedTTE = DTTInPairTTE.mul(liquidityTTE).div(totalSupplyTTE)
    const WETHExpectedTTE = WETHInPairTTE.mul(liquidityTTE).div(totalSupplyTTE)

    console.log('DTTInPairTTE', DTTInPairTTE.toString())
    console.log('WETHInPairTTE', WETHInPairTTE.toString())
    console.log('liquidityTTE', liquidityTTE.toString())
    console.log('totalSupplyTTE', totalSupplyTTE.toString())
    console.log('NaiveDTTExpectedTTE', NaiveDTTExpectedTTE.toString())
    console.log('WETHExpectedTTE', WETHExpectedTTE.toString())    
*/
    const DTTInPairTEE = await DTT.balanceOf(WETHPairTEE.address)
    const WETHInPairTEE = await WETH.balanceOf(WETHPairTEE.address)
    const liquidityTEE = await WETHPairTEE.balanceOf(wallet.address)
    const totalSupplyTEE = await WETHPairTEE.totalSupply()
    const NaiveDTTExpectedTEE = DTTInPairTEE.mul(liquidityTEE).div(totalSupplyTEE)
    const WETHExpectedTEE = WETHInPairTEE.mul(liquidityTEE).div(totalSupplyTEE)

    console.log('DTTInPairTEE', DTTInPairTEE.toString())
    console.log('WETHInPairTEE', WETHInPairTEE.toString())
    console.log('liquidityTEE', liquidityTEE.toString())
    console.log('totalSupplyTEE', totalSupplyTEE.toString())
    console.log('NaiveDTTExpectedTEE', NaiveDTTExpectedTEE.toString())
    console.log('WETHExpectedTEE', WETHExpectedTEE.toString())    


    await WETHPairTTE.approve(router.address, MaxUint256)
    await router.removeLiquidityETHWithDefaltionTokens(
      DTT.address,
      0,  //liquidityTTE,
      liquidityTEE,
      0, //NaiveDTTExpectedTTE,  //.add(NaiveDTTExpectedTEE),
      0, // WETHExpectedTTE,      //.add(WETHExpectedTEE),
      pairOwner.address,
      MaxUint256,
      overrides
    )
    
    {
      /*
      const DTTInPairTTE = await DTT.balanceOf(WETHPairTTE.address)
      const WETHInPairTTE = await WETH.balanceOf(WETHPairTTE.address)
      const liquidityTTE = await WETHPairTTE.balanceOf(wallet.address)
      const totalSupplyTTE = await WETHPairTTE.totalSupply()
      const NaiveDTTExpectedTTE = DTTInPairTTE.mul(liquidityTTE).div(totalSupplyTTE)
      const WETHExpectedTTE = WETHInPairTTE.mul(liquidityTTE).div(totalSupplyTTE)
  
      console.log('DTTInPairTTE', DTTInPairTTE.toString())
      console.log('WETHInPairTTE', WETHInPairTTE.toString())
      console.log('liquidityTTE', liquidityTTE.toString())
      console.log('totalSupplyTTE', totalSupplyTTE.toString())
      console.log('NaiveDTTExpectedTTE', NaiveDTTExpectedTTE.toString())
      console.log('WETHExpectedTTE', WETHExpectedTTE.toString())    
  */
      const DTTInPairTEE = await DTT.balanceOf(WETHPairTEE.address)
      const WETHInPairTEE = await WETH.balanceOf(WETHPairTEE.address)
      const liquidityTEE = await WETHPairTEE.balanceOf(wallet.address)
      const totalSupplyTEE = await WETHPairTEE.totalSupply()
      const NaiveDTTExpectedTEE = DTTInPairTEE.mul(liquidityTEE).div(totalSupplyTEE)
      const WETHExpectedTEE = WETHInPairTEE.mul(liquidityTEE).div(totalSupplyTEE)
  
      console.log('DTTInPairTEE', DTTInPairTEE.toString())
      console.log('WETHInPairTEE', WETHInPairTEE.toString())
      console.log('liquidityTEE', liquidityTEE.toString())
      console.log('totalSupplyTEE', totalSupplyTEE.toString())
      console.log('NaiveDTTExpectedTEE', NaiveDTTExpectedTEE.toString())
      console.log('WETHExpectedTEE', WETHExpectedTEE.toString())    
   
    }

  })


  it('removeLiquidityETHWithPermitWithDefaltionTokens', async () => {
    const DTTAmount = expandTo18Decimals(1)
      .mul(100)
      .div(99)
    const ETHAmount = expandTo18Decimals(4)

     await addLiquidity(DTTAmount, ETHAmount, 100)
    const expectedLiquidity = expandTo18Decimals(2)

    const nonce = await WETHPairTTE.nonces(wallet.address)
    const digest = await getApprovalDigest(
      WETHPairTTE,
      { owner: wallet.address, spender: router.address, value: expectedLiquidity.sub(MINIMUM_LIQUIDITY) },
      nonce,
      MaxUint256
    )
    const { v, r, s } = ecsign(Buffer.from(digest.slice(2), 'hex'), Buffer.from(wallet.privateKey.slice(2), 'hex'))
    const liquidity = await WETHPairTTE.balanceOf(wallet.address)
    await WETHPairTTE.approve(router.address, MaxUint256)

    await router.removeLiquidityETHWithPermitWithDefaltionTokens(
      DTT.address,
      liquidity,
      0,
      wallet.address,
      MaxUint256,
      false,
      v,
      r,
      s,
      overrides
    )
  })

    it('swapExactTokensForTokensSupportingFeeOnTransferTokens: DTT -> WETH', async () => {
      const DTTAmount = expandTo18Decimals(5)
        .mul(100)
        .div(99)
      const ETHAmount = expandTo18Decimals(10)
      const amountIn = expandTo18Decimals(1)
      await addLiquidity(DTTAmount, ETHAmount,50)
      
      await DTT.approve(router.address, MaxUint256)
      await router.swapExactTokensForTokensSupportingFeeOnTransferTokens(
        amountIn,
        0,
        [DTT.address, WETH.address],
        wallet.address,
        MaxUint256,
        overrides
      )
      
    })

    // WETH -> DTT
    it('swapExactTokensForTokensSupportingFeeOnTransferTokens: WETH -> DTT', async () => {
      const DTTAmount = expandTo18Decimals(5)
      .mul(100)
      .div(99)
      const ETHAmount = expandTo18Decimals(10)
      const amountIn = expandTo18Decimals(1)
      await addLiquidity(DTTAmount, ETHAmount,50)

      await WETH.deposit({ value: amountIn }) // mint WETH
      await WETH.approve(router.address, MaxUint256)

      await router.swapExactTokensForTokensSupportingFeeOnTransferTokens(
        amountIn,
        0,
        [WETH.address, DTT.address],
        wallet.address,
        MaxUint256,
        overrides
      )
    })
 
  // ETH -> DTT
  it('swapExactETHForTokensSupportingFeeOnTransferTokens', async () => {
    const DTTAmount = expandTo18Decimals(10)
    const ETHAmount = expandTo18Decimals(5)
    const swapAmount = expandTo18Decimals(1)
    const expectedOutputAmount = bigNumberify('1650000000000000000')  //'1662497915624478906')

    await addLiquidity(DTTAmount, ETHAmount, 0)
     
    await expect( 
      router.swapExactETHForTokensSupportingFeeOnTransferTokens(
        0, [WETH.address, DTT.address],  wallet.address, MaxUint256,
        {
          ...overrides,
          value: swapAmount
        }
      )
    )
      .to.emit(WETH, 'Deposit')
      .withArgs(router.address, swapAmount)
      .to.emit(WETH, 'Transfer')
      .withArgs(router.address, WETHPairTEE.address, swapAmount)
      .to.emit(DTT, 'Transfer')
      .withArgs(WETHPairTEE.address, AddressZero, expectedOutputAmount.div(100))
      .to.emit(DTT, 'Transfer')
      .withArgs(WETHPairTEE.address, wallet.address, expectedOutputAmount.mul(99).div(100))
      .to.emit(WETHPairTEE, 'Sync')
      .withArgs(ETHAmount.add(swapAmount), (DTTAmount.mul(99).div(100)).sub(expectedOutputAmount))
      .to.emit(WETHPairTEE, 'Swap')
      .withArgs(router.address, swapAmount, 0, 0, expectedOutputAmount, wallet.address)
  })
  

  // DTT -> ETH
  it('swapExactTokensForETHSupportingFeeOnTransferTokens', async () => {
    const DTTAmount = expandTo18Decimals(50)
    const ETHAmount = expandTo18Decimals(10)
    const swapAmount = expandTo18Decimals(1)
    const expectedOutputAmount = bigNumberify('196078431372549019')

    await addLiquidity(DTTAmount, ETHAmount, 100)
    await DTT.approve(router.address, MaxUint256)

    await expect(
      router.swapExactTokensForETHSupportingFeeOnTransferTokens(
        swapAmount,
        0,
        [DTT.address, WETH.address],
        wallet.address,
        MaxUint256,
        overrides
      )
    )
      .to.emit(DTT, 'Transfer')
      .withArgs(wallet.address, AddressZero, swapAmount.div(100))               // burn value 
      .to.emit(DTT, 'Transfer')
      .withArgs(wallet.address, WETHPairTTE.address, swapAmount.mul(99).div(100))
      .to.emit(WETH, 'Transfer')
      .withArgs(WETHPairTTE.address, router.address, expectedOutputAmount)
      .to.emit(WETHPairTTE, 'Sync')
      .withArgs((DTTAmount.add(swapAmount)).mul(99).div(100), ETHAmount.sub(expectedOutputAmount))
      .to.emit(WETHPairTTE, 'Swap')
      .withArgs(router.address, (swapAmount.mul(99)).div(100), 0, 0, expectedOutputAmount, router.address)
      .to.emit(WETH, 'Withdrawal')
      .withArgs(router.address, expectedOutputAmount)
  })
})

describe('FeSwapRouter: fee-on-transfer tokens: reloaded', () => {
  const provider = new MockProvider({
    hardfork: 'istanbul',
    mnemonic: 'horn horn horn horn horn horn horn horn horn horn horn horn',
    gasLimit: 9999999
  })
  const [wallet, feeTo, pairOwner] = provider.getWallets()
  const loadFixture = createFixtureLoader(provider, [wallet, feeTo, pairOwner])

  let DTT: Contract
  let DTT2: Contract
  let router: Contract
  let pairDTT: Contract
  let pairDTT2: Contract
  beforeEach(async function() {
    const fixture = await loadFixture(v2Fixture)

    router = fixture.routerFeswa

    DTT = await deployContract(wallet, DeflatingERC20, [expandTo18Decimals(10000)])
    DTT2 = await deployContract(wallet, DeflatingERC20, [expandTo18Decimals(10000)])

    // make a DTT<>WETH pair
    await fixture.factoryFeswa.createUpdatePair(DTT.address, DTT2.address, wallet.address, overrides)
    const pairAddressDTT = await fixture.factoryFeswa.getPair(DTT.address, DTT2.address)
    const pairAddressDTT2 = await fixture.factoryFeswa.getPair(DTT2.address, DTT.address)    

    pairDTT = new Contract(pairAddressDTT, JSON.stringify(FeSwapPair.abi), provider).connect(wallet)
    pairDTT2 = new Contract(pairAddressDTT2, JSON.stringify(FeSwapPair.abi), provider).connect(wallet)

  })

  afterEach(async function() {
    expect(await provider.getBalance(router.address)).to.eq(0)
  })

  async function addLiquidity(DTTAmount: BigNumber, DTT2Amount: BigNumber) {
    await DTT.approve(router.address, MaxUint256)
    await DTT2.approve(router.address, MaxUint256)
    await router.addLiquidity(
      DTT.address,
      DTT2.address,
      DTTAmount,
      DTT2Amount,
      100,
      wallet.address,
      MaxUint256,
      overrides
    )
  }

  it('swapExactTokensForTokensSupportingFeeOnTransferTokens: DTT -> DTT2', async () => {
    const DTTAmount = expandTo18Decimals(5)
    const DTT2Amount = expandTo18Decimals(10)
    const swapAmount = expandTo18Decimals(1)
    const expectedOutputAmount = bigNumberify('1650000000000000000')

    await addLiquidity(DTTAmount, DTT2Amount)

    await expect(
      router.swapExactTokensForTokensSupportingFeeOnTransferTokens(
        swapAmount,
        0,
        [DTT.address, DTT2.address],
        wallet.address,
        MaxUint256,
        overrides
      )
    )
      .to.emit(DTT, 'Transfer')
      .withArgs(wallet.address, AddressZero, swapAmount.div(100))
      .to.emit(DTT, 'Transfer')
      .withArgs(wallet.address, pairDTT.address, swapAmount.mul(99).div(100))
      .to.emit(DTT2, 'Transfer')
      .withArgs(pairDTT.address, AddressZero, expectedOutputAmount.div(100))
      .to.emit(DTT2, 'Transfer')
      .withArgs(pairDTT.address, wallet.address, expectedOutputAmount.mul(99).div(100))        
      .to.emit(pairDTT, 'Sync')
      .withArgs((DTTAmount.add(swapAmount)).mul(99).div(100), (DTT2Amount.mul(99).div(100)).sub(expectedOutputAmount))
      .to.emit(pairDTT, 'Swap')
      .withArgs(router.address, swapAmount.mul(99).div(100), 0, 0, expectedOutputAmount, wallet.address)
  })
})
