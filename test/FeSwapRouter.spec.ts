import chai, { expect } from 'chai'
import { solidity, MockProvider, createFixtureLoader, deployContract } from 'ethereum-waffle'
import { Contract, utils, constants, BigNumber  } from 'ethers'

import IUniswapV2Pair from '../build/IFeSwapPair.json'
import FeSwapPair from '../build/FeSwapPair.json'

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
const rateTriggerArbitrage: number = 10

describe('FeSwapRouter', () => {
  const provider = new MockProvider({
    ganacheOptions: {
      hardfork: 'istanbul',
      mnemonic: 'horn horn horn horn horn horn horn horn horn horn horn horn',
      gasLimit: 9999999
    },
  })

  const [wallet, feeTo, pairOwner]  = provider.getWallets()
  const loadFixture = createFixtureLoader( [wallet, feeTo, pairOwner], provider)

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
    expect(await router.quote(BigNumber.from(1), BigNumber.from(100), BigNumber.from(200))).to.eq(BigNumber.from(2))
    expect(await router.quote(BigNumber.from(2), BigNumber.from(200), BigNumber.from(100))).to.eq(BigNumber.from(1))
    await expect(router.quote(BigNumber.from(0), BigNumber.from(100), BigNumber.from(200))).to.be.revertedWith(
      'FeSwapLibrary: INSUFFICIENT_AMOUNT'
    )
    await expect(router.quote(BigNumber.from(1), BigNumber.from(0), BigNumber.from(200))).to.be.revertedWith(
      'FeSwapLibrary: INSUFFICIENT_LIQUIDITY'
    )
    await expect(router.quote(BigNumber.from(1), BigNumber.from(100), BigNumber.from(0))).to.be.revertedWith(
      'FeSwapLibrary: INSUFFICIENT_LIQUIDITY'
    )
  })

  it('getAmountOut', async () => {
    expect(await router.getAmountOut(BigNumber.from(2), BigNumber.from(100), BigNumber.from(100))).to.eq(BigNumber.from(1))
    expect(await router.getAmountOut(expandTo18Decimals(2), expandTo18Decimals(100), expandTo18Decimals(100)))
            .to.eq(BigNumber.from('1960784313725490196'))
    await expect(router.getAmountOut(BigNumber.from(0), BigNumber.from(100), BigNumber.from(100))).to.be.revertedWith(
      'FeSwapLibrary: INSUFFICIENT_INPUT_AMOUNT'
    )
    await expect(router.getAmountOut(BigNumber.from(2), BigNumber.from(0), BigNumber.from(100))).to.be.revertedWith(
      'FeSwapLibrary: INSUFFICIENT_LIQUIDITY'
    )
    await expect(router.getAmountOut(BigNumber.from(2), BigNumber.from(100), BigNumber.from(0))).to.be.revertedWith(
      'FeSwapLibrary: INSUFFICIENT_LIQUIDITY'
    )
  })

  it('getAmountIn', async () => {
    expect(await router.getAmountIn(BigNumber.from(1), BigNumber.from(100), BigNumber.from(100))).to.eq(BigNumber.from(2))
    expect(await router.getAmountIn(expandTo18Decimals(1), expandTo18Decimals(100), expandTo18Decimals(100)))
            .to.eq(BigNumber.from('1010101010101010102'))
    await expect(router.getAmountIn(BigNumber.from(0), BigNumber.from(100), BigNumber.from(100))).to.be.revertedWith(
      'FeSwapLibrary: INSUFFICIENT_OUTPUT_AMOUNT'
    )
    await expect(router.getAmountIn(BigNumber.from(1), BigNumber.from(0), BigNumber.from(100))).to.be.revertedWith(
      'FeSwapLibrary: INSUFFICIENT_LIQUIDITY'
    )
    await expect(router.getAmountIn(BigNumber.from(1), BigNumber.from(100), BigNumber.from(0))).to.be.revertedWith(
      'FeSwapLibrary: INSUFFICIENT_LIQUIDITY'
    )
  })

  it('getAmountsOutMinor', async () => {
    await tokenA.approve(router.address, constants.MaxUint256)
    await tokenB.approve(router.address, constants.MaxUint256)
    await router.addLiquidity( tokenA.address, tokenB.address, expandTo18Decimals(1000), expandTo18Decimals(1000),
                                50, wallet.address, constants.MaxUint256, overrides)

    await expect(router.estimateAmountsOut(BigNumber.from(2), [tokenA.address])).to.be.revertedWith(
      'FeSwapLibrary: INVALID_PATH'
    )
    const path = [tokenA.address, tokenB.address]
    const estimateAmountsOut = await router.estimateAmountsOut(BigNumber.from(2), path)
    expect(estimateAmountsOut[0]).to.be.equal(BigNumber.from(2))
    expect(estimateAmountsOut[1]).to.be.equal(BigNumber.from(1))
  })

  it('getAmountsOutNormal', async () => {
    await tokenA.approve(router.address, constants.MaxUint256)
    await tokenB.approve(router.address, constants.MaxUint256)
    await router.addLiquidity( tokenA.address, tokenB.address, expandTo18Decimals(1000), expandTo18Decimals(1000),
                                50, wallet.address, constants.MaxUint256, overrides)

    const path = [tokenA.address, tokenB.address]
    const estimateAmountsOut = await router.estimateAmountsOut(expandTo18Decimals(2), path)
    expect(estimateAmountsOut[0]).to.be.equal(expandTo18Decimals(2))
    expect(estimateAmountsOut[1]).to.be.equal(expandTo18Decimals(1000).div(502))            // = 2*500e18/502
  })

  it('getAmountsOutTripple', async () => {
    await tokenA.approve(router.address, constants.MaxUint256)
    await tokenB.approve(router.address, constants.MaxUint256)
    await WETHPartner.approve(router.address, constants.MaxUint256)   
    await router.addLiquidity( tokenA.address, tokenB.address, expandTo18Decimals(1000), expandTo18Decimals(2000),
                                50, wallet.address, constants.MaxUint256, overrides)

    await router.addLiquidity( tokenB.address, WETHPartner.address, expandTo18Decimals(3000), expandTo18Decimals(5000),
                                50, wallet.address, constants.MaxUint256, overrides)                                

    const tokenBOut = expandTo18Decimals(2).mul(1000).div(502)
    const WETHPartnerOut = expandTo18Decimals(2500).mul(tokenBOut).div(expandTo18Decimals(1500).add(tokenBOut))
    const path = [tokenA.address, tokenB.address, WETHPartner.address]

    const estimateAmountsOut = await router.estimateAmountsOut(expandTo18Decimals(2), path)
    expect(estimateAmountsOut[0]).to.be.equal(expandTo18Decimals(2))
    expect(estimateAmountsOut[1]).to.be.equal(tokenBOut)
    expect(estimateAmountsOut[2]).to.be.equal(WETHPartnerOut)    
  })

  it('getAmountsIn', async () => {
    await tokenA.approve(router.address, constants.MaxUint256)
    await tokenB.approve(router.address, constants.MaxUint256)
    await router.addLiquidity( tokenA.address, tokenB.address, expandTo18Decimals(1000), expandTo18Decimals(1000),
                                50, wallet.address, constants.MaxUint256, overrides)

    await expect(router.estimateAmountsIn(BigNumber.from(1), [tokenA.address]))
            .to.be.revertedWith('FeSwapLibrary: INVALID_PATH')
    const path = [tokenA.address, tokenB.address]
    const estimateAmountsIn = await router.estimateAmountsIn(BigNumber.from(1), path)
    expect(estimateAmountsIn[0]).to.be.equal(BigNumber.from(2))
    expect(estimateAmountsIn[1]).to.be.equal(BigNumber.from(1))
  })

  it('getAmountsInTripple', async () => {
    await tokenA.approve(router.address, constants.MaxUint256)
    await tokenB.approve(router.address, constants.MaxUint256)
    await WETHPartner.approve(router.address, constants.MaxUint256)   
    await router.addLiquidity( tokenA.address, tokenB.address, expandTo18Decimals(1000), expandTo18Decimals(2000),
                                50, wallet.address, constants.MaxUint256, overrides)

    await router.addLiquidity( tokenB.address, WETHPartner.address, expandTo18Decimals(3000), expandTo18Decimals(5000),
                                50, wallet.address, constants.MaxUint256, overrides)                                

    const tokenBIn = expandTo18Decimals(2).mul(1500).div(2498).add(1)
    const tokenAIn = expandTo18Decimals(500).mul(tokenBIn).div(expandTo18Decimals(1000).sub(tokenBIn)).add(1)
    const path = [tokenA.address, tokenB.address, WETHPartner.address]
    const estimateAmountsIn = await router.estimateAmountsIn(expandTo18Decimals(2), path)
    expect(estimateAmountsIn[0]).to.be.equal(tokenAIn)
    expect(estimateAmountsIn[1]).to.be.equal(tokenBIn)
    expect(estimateAmountsIn[2]).to.be.equal(expandTo18Decimals(2))  
  })
})

describe('FeSwapRouter: ManageFeswaPair', () => {
  const provider = new MockProvider({
    ganacheOptions: {
      hardfork: 'istanbul',
      mnemonic: 'horn horn horn horn horn horn horn horn horn horn horn horn',
      gasLimit: 9999999
    },
  })
  const [wallet, feeTo, pairOwner, newOwner]  = provider.getWallets()
  const loadFixture = createFixtureLoader([wallet, feeTo, pairOwner], provider)

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
    await expect(router.ManageFeswaPair('0xFFFFFFFFFFF', pairOwner.address, rateTriggerArbitrage))
            .to.be.revertedWith('ERC721: owner query for nonexistent token')
  })

  it('ManageFeswaPair: Check Owner', async () => {
    await expect(router.ManageFeswaPair(tokenIDMatch, pairOwner.address, rateTriggerArbitrage))
            .to.be.revertedWith('FeSwap: NOT TOKEN OWNER')
  })

  it('ManageFeswaPair: Change Pair Owner', async () => {
    expect(await pairAAB.pairOwner()).to.be.eq(pairOwner.address)
    expect(await pairABB.pairOwner()).to.be.eq(pairOwner.address)
    await router.connect(pairOwner).ManageFeswaPair(tokenIDMatch, newOwner.address, rateTriggerArbitrage)
    expect(await pairAAB.pairOwner()).to.be.eq(newOwner.address)
    expect(await pairABB.pairOwner()).to.be.eq(newOwner.address)
  })
})

describe('FeSwapRouter: Deflation Token Test', () => {
  const provider = new MockProvider({
    ganacheOptions: {
      hardfork: 'istanbul',
      mnemonic: 'horn horn horn horn horn horn horn horn horn horn horn horn',
      gasLimit: 9999999
    },
  })
  const [wallet, feeTo, pairOwner] = provider.getWallets()
  const loadFixture = createFixtureLoader([wallet, feeTo, pairOwner], provider)

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
    await factory.createUpdatePair(DTT.address, WETH.address, wallet.address, rateTriggerArbitrage, overrides)
    const pairAddressTTE = await factory.getPair(DTT.address, WETH.address)
    WETHPairTTE = new Contract(pairAddressTTE, JSON.stringify(IUniswapV2Pair.abi), provider).connect(wallet)

    const pairAddressTEE = await factory.getPair(WETH.address, DTT.address)
    WETHPairTEE = new Contract(pairAddressTEE, JSON.stringify(IUniswapV2Pair.abi), provider).connect(wallet)
  })

  afterEach(async function() {
    expect(await provider.getBalance(router.address)).to.eq(0)
  })

  async function addLiquidity(DTTAmount: BigNumber, WETHAmount: BigNumber, ratio: Number){
    await DTT.approve(router.address, constants.MaxUint256)
    await router.addLiquidityETH(DTT.address, DTTAmount, ratio, wallet.address, constants.MaxUint256, {
      ...overrides,
      value: WETHAmount
    })
  }

  it('removeLiquidityETHFeeOnTransfer: Single Pool Liquidity', async () => {
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

    await WETHPairTTE.approve(router.address, constants.MaxUint256)
    await router.removeLiquidityETHFeeOnTransfer(
      DTT.address,
      liquidity,
      0,
      NaiveDTTExpected,
      WETHExpected,
      pairOwner.address,
      constants.MaxUint256,
      overrides
    )
  })

  it('removeLiquidityETHFeeOnTransfer: Double Pool Liquidity', async () => {
    const DTTAmount = expandTo18Decimals(100)
    const ETHAmount = expandTo18Decimals(4)

    const ratio = 0  
    await addLiquidity(DTTAmount, ETHAmount, ratio)
  
    const DTTInPairTEE = await DTT.balanceOf(WETHPairTEE.address)
    const WETHInPairTEE = await WETH.balanceOf(WETHPairTEE.address)
    const liquidityTEE = await WETHPairTEE.balanceOf(wallet.address)
    const totalSupplyTEE = await WETHPairTEE.totalSupply()
    const NaiveDTTExpectedTEE = DTTInPairTEE.mul(liquidityTEE).div(totalSupplyTEE)
    const WETHExpectedTEE = WETHInPairTEE.mul(liquidityTEE).div(totalSupplyTEE)

    await WETHPairTEE.approve(router.address, constants.MaxUint256)
    await router.removeLiquidityETHFeeOnTransfer(
      DTT.address,
      0, 
      liquidityTEE,
      NaiveDTTExpectedTEE,
      WETHExpectedTEE,
      pairOwner.address,
      constants.MaxUint256,
      overrides
    )
  })

  it('removeLiquidityETHWithPermitFeeOnTransfer', async () => {
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
      constants.MaxUint256
    )
    const { v, r, s } = ecsign(Buffer.from(digest.slice(2), 'hex'), Buffer.from(wallet.privateKey.slice(2), 'hex'))
    const liquidity = await WETHPairTTE.balanceOf(wallet.address)
    await WETHPairTTE.approve(router.address, constants.MaxUint256)

    await router.removeLiquidityETHWithPermitFeeOnTransfer(
      DTT.address,
      liquidity,
      0,
      wallet.address,
      constants.MaxUint256,
      false,
      v,
      r,
      s,
      overrides
    )
  })

    it('swapExactTokensForTokensFeeOnTransfer: DTT -> WETH', async () => {
      const DTTAmount = expandTo18Decimals(5)
        .mul(100)
        .div(99)
      const ETHAmount = expandTo18Decimals(10)
      const amountIn = expandTo18Decimals(1)
      await addLiquidity(DTTAmount, ETHAmount,50)
      
      await DTT.approve(router.address, constants.MaxUint256)
      await router.swapExactTokensForTokensFeeOnTransfer(
        amountIn,
        0,
        [DTT.address, WETH.address],
        wallet.address,
        constants.MaxUint256,
        overrides
      )
      
    })

    // WETH -> DTT
    it('swapExactTokensForTokensFeeOnTransfer: WETH -> DTT', async () => {
      const DTTAmount = expandTo18Decimals(5)
      .mul(100)
      .div(99)
      const ETHAmount = expandTo18Decimals(10)
      const amountIn = expandTo18Decimals(1)
      await addLiquidity(DTTAmount, ETHAmount,50)

      await WETH.deposit({ value: amountIn }) // mint WETH
      await WETH.approve(router.address, constants.MaxUint256)

      await router.swapExactTokensForTokensFeeOnTransfer(
        amountIn,
        0,
        [WETH.address, DTT.address],
        wallet.address,
        constants.MaxUint256,
        overrides
      )
    })
 
  // ETH -> DTT
  it('swapExactETHForTokensFeeOnTransfer', async () => {
    const DTTAmount = expandTo18Decimals(10)
    const ETHAmount = expandTo18Decimals(5)
    const swapAmount = expandTo18Decimals(1)
    const expectedOutputAmount = BigNumber.from('1650000000000000000')  //'1662497915624478906')

    await addLiquidity(DTTAmount, ETHAmount, 0)
     
    await expect( 
      router.swapExactETHForTokensFeeOnTransfer(
        0, [WETH.address, DTT.address],  wallet.address, constants.MaxUint256,
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
      .withArgs(WETHPairTEE.address, constants.AddressZero, expectedOutputAmount.div(100))
      .to.emit(DTT, 'Transfer')
      .withArgs(WETHPairTEE.address, wallet.address, expectedOutputAmount.mul(99).div(100))
      .to.emit(WETHPairTEE, 'Sync')
      .withArgs(ETHAmount.add(swapAmount), (DTTAmount.mul(99).div(100)).sub(expectedOutputAmount))
      .to.emit(WETHPairTEE, 'Swap')
      .withArgs(router.address, swapAmount, 0, expectedOutputAmount, wallet.address)
  })
  
  // DTT -> ETH
  it('swapExactTokensForETHFeeOnTransfer', async () => {
    const DTTAmount = expandTo18Decimals(50)
    const ETHAmount = expandTo18Decimals(10)
    const swapAmount = expandTo18Decimals(1)
    const expectedOutputAmount = BigNumber.from('196078431372549019')

    await addLiquidity(DTTAmount, ETHAmount, 100)
    await DTT.approve(router.address, constants.MaxUint256)

    await expect(
      router.swapExactTokensForETHFeeOnTransfer(
        swapAmount,
        0,
        [DTT.address, WETH.address],
        wallet.address,
        constants.MaxUint256,
        overrides
      )
    )
      .to.emit(DTT, 'Transfer')
      .withArgs(wallet.address, constants.AddressZero, swapAmount.div(100))               // burn value 
      .to.emit(DTT, 'Transfer')
      .withArgs(wallet.address, WETHPairTTE.address, swapAmount.mul(99).div(100))
      .to.emit(WETH, 'Transfer')
      .withArgs(WETHPairTTE.address, router.address, expectedOutputAmount)
      .to.emit(WETHPairTTE, 'Sync')
      .withArgs((DTTAmount.add(swapAmount)).mul(99).div(100), ETHAmount.sub(expectedOutputAmount))
      .to.emit(WETHPairTTE, 'Swap')
      .withArgs(router.address, (swapAmount.mul(99)).div(100), 0, expectedOutputAmount, router.address)
      .to.emit(WETH, 'Withdrawal')
      .withArgs(router.address, expectedOutputAmount)
  })

})

describe('FeSwapRouter: fee-on-transfer tokens: reloaded', () => {
  const provider = new MockProvider({
    ganacheOptions: {
      hardfork: 'istanbul',
      mnemonic: 'horn horn horn horn horn horn horn horn horn horn horn horn',
      gasLimit: 9999999
    },
  })
  const [wallet, feeTo, pairOwner] = provider.getWallets()
  const loadFixture = createFixtureLoader([wallet, feeTo, pairOwner], provider)

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
    await fixture.factoryFeswa.createUpdatePair(DTT.address, DTT2.address, wallet.address, rateTriggerArbitrage, overrides)
    const pairAddressDTT = await fixture.factoryFeswa.getPair(DTT.address, DTT2.address)
    const pairAddressDTT2 = await fixture.factoryFeswa.getPair(DTT2.address, DTT.address)    

    pairDTT = new Contract(pairAddressDTT, JSON.stringify(FeSwapPair.abi), provider).connect(wallet)
    pairDTT2 = new Contract(pairAddressDTT2, JSON.stringify(FeSwapPair.abi), provider).connect(wallet)

  })

  afterEach(async function() {
    expect(await provider.getBalance(router.address)).to.eq(0)
  })

  async function addLiquidity(DTTAmount: BigNumber, DTT2Amount: BigNumber) {
    await DTT.approve(router.address, constants.MaxUint256)
    await DTT2.approve(router.address, constants.MaxUint256)
    await router.addLiquidity(
      DTT.address,
      DTT2.address,
      DTTAmount,
      DTT2Amount,
      100,
      wallet.address,
      constants.MaxUint256,
      overrides
    )
  }

  it('swapExactTokensForTokensFeeOnTransfer: DTT -> DTT2', async () => {
    const DTTAmount = expandTo18Decimals(5)
    const DTT2Amount = expandTo18Decimals(10)
    const swapAmount = expandTo18Decimals(1)
    const expectedOutputAmount = BigNumber.from('1650000000000000000')

    await addLiquidity(DTTAmount, DTT2Amount)

    await expect(
      router.swapExactTokensForTokensFeeOnTransfer(
        swapAmount,
        0,
        [DTT.address, DTT2.address],
        wallet.address,
        constants.MaxUint256,
        overrides
      )
    )
      .to.emit(DTT, 'Transfer')
      .withArgs(wallet.address, constants.AddressZero, swapAmount.div(100))
      .to.emit(DTT, 'Transfer')
      .withArgs(wallet.address, pairDTT.address, swapAmount.mul(99).div(100))
      .to.emit(DTT2, 'Transfer')
      .withArgs(pairDTT.address, constants.AddressZero, expectedOutputAmount.div(100))
      .to.emit(DTT2, 'Transfer')
      .withArgs(pairDTT.address, wallet.address, expectedOutputAmount.mul(99).div(100))        
      .to.emit(pairDTT, 'Sync')
      .withArgs((DTTAmount.add(swapAmount)).mul(99).div(100), (DTT2Amount.mul(99).div(100)).sub(expectedOutputAmount))
      .to.emit(pairDTT, 'Swap')
      .withArgs(router.address, swapAmount.mul(99).div(100), 0, expectedOutputAmount, wallet.address)
  })
})

