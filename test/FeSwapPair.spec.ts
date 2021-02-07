import chai, { expect } from 'chai'
import { Contract } from 'ethers'
import { solidity, MockProvider, createFixtureLoader,deployContract } from 'ethereum-waffle'
import { BigNumber, bigNumberify } from 'ethers/utils'

import { expandTo18Decimals, mineBlock, encodePrice } from './shared/utilities'
import { pairFixture } from './shared/fixtures'
import { AddressZero, MaxUint256 } from 'ethers/constants'
import WETH9 from '../build/WETH9.json'
import FeSwapRouter from '../build/FeSwapRouter.json'
import RouterEventEmitter from '../build/RouterEventEmitter.json'
import FeSwapFactory from '../build/FeSwapFactory.json'
import { v2Fixture } from './shared/Routerfixtures'

const MINIMUM_LIQUIDITY = bigNumberify(10).pow(3)

chai.use(solidity)

const overrides = {
  gasLimit: 9999999
}

describe('FeSwapPair', () => {
  const provider = new MockProvider({
    hardfork: 'istanbul',
    mnemonic: 'horn horn horn horn horn horn horn horn horn horn horn horn',
    gasLimit: 9999999
  })
  const [wallet, feeTo, pairCreator] = provider.getWallets()
  const loadFixture = createFixtureLoader(provider, [wallet, feeTo, pairCreator])

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

  beforeEach(async () => {
    const fixture = await loadFixture(v2Fixture)
    tokenA = fixture.tokenA
    tokenB = fixture.tokenB
    WETH = fixture.WETH
    WETHPartner = fixture.WETHPartner
    factory = fixture.factoryFS
    router = fixture.routerFS
    pairAAB = fixture.pairAAB
    pairABB = fixture.pairABB      
    WETHPairTTE = fixture.WETHPairTTE
    WETHPairTEE = fixture.WETHPairTEE    
    routerEventEmitter = fixture.routerEventEmitter
    await factory.setRouterFeSwap(feeTo.address)
  })

  async function pairMintAAB(tokenAAmount: BigNumber, tokenBAmount: BigNumber, expectedLiquidityAAB:BigNumber ) {
    await tokenA.transfer(pairAAB.address, tokenAAmount)
    await tokenB.transfer(pairAAB.address, tokenBAmount)
    await expect(pairAAB.mint(wallet.address, overrides))
      .to.emit(pairAAB, 'Transfer') 
      .withArgs(AddressZero, AddressZero, MINIMUM_LIQUIDITY)
      .to.emit(pairAAB, 'Transfer')
      .withArgs(AddressZero, wallet.address, expectedLiquidityAAB.sub(MINIMUM_LIQUIDITY))
      .to.emit(pairAAB, 'Sync')
      .withArgs(tokenAAmount, tokenBAmount)
      .to.emit(pairAAB, 'Mint')
      .withArgs(wallet.address, tokenAAmount, tokenBAmount)

      expect(await pairAAB.totalSupply()).to.eq(expectedLiquidityAAB)
      expect(await pairAAB.balanceOf(wallet.address)).to.eq(expectedLiquidityAAB.sub(MINIMUM_LIQUIDITY))
      expect(await tokenA.balanceOf(pairAAB.address)).to.eq(tokenAAmount)
      expect(await tokenB.balanceOf(pairAAB.address)).to.eq(tokenBAmount)
      const reservesAAB = await pairAAB.getReserves()
      expect(reservesAAB[0]).to.eq(tokenAAmount)
      expect(reservesAAB[1]).to.eq(tokenBAmount)
  }

  async function pairMintABB(tokenAAmount: BigNumber, tokenBAmount: BigNumber, expectedLiquidityABB:BigNumber ) {
    await tokenA.transfer(pairABB.address, tokenAAmount)
    await tokenB.transfer(pairABB.address, tokenBAmount)
    await expect(pairABB.mint(wallet.address, overrides))
      .to.emit(pairABB, 'Transfer') 
      .withArgs(AddressZero, AddressZero, MINIMUM_LIQUIDITY)
      .to.emit(pairABB, 'Transfer')
      .withArgs(AddressZero, wallet.address, expectedLiquidityABB.sub(MINIMUM_LIQUIDITY))
      .to.emit(pairABB, 'Sync')
      .withArgs(tokenBAmount, tokenAAmount)
      .to.emit(pairABB, 'Mint')
      .withArgs(wallet.address, tokenBAmount, tokenAAmount)

      expect(await pairABB.totalSupply()).to.eq(expectedLiquidityABB)
      expect(await pairABB.balanceOf(wallet.address)).to.eq(expectedLiquidityABB.sub(MINIMUM_LIQUIDITY))
      expect(await tokenA.balanceOf(pairABB.address)).to.eq(tokenAAmount)
      expect(await tokenB.balanceOf(pairABB.address)).to.eq(tokenBAmount)
      const reservesABB = await pairABB.getReserves()
      expect(reservesABB[0]).to.eq(tokenBAmount)
      expect(reservesABB[1]).to.eq(tokenAAmount)     
  }

  it('mint: AAB', async () => {
  /*  
    const tokenAAAmount = expandTo18Decimals(9)
    const tokenBAAmount = expandTo18Decimals(4)
    const expectedLiquidityAAB = expandTo18Decimals(6)
 
    // Test pool(AA, B)
    await pairMintAAB(tokenAAAmount, tokenBAAmount, expectedLiquidityAAB)
   
    const tokenABAmount = expandTo18Decimals(25);
    const tokenBBAmount = expandTo18Decimals(36);
    const expectedLiquidityABB = expandTo18Decimals(30);

    // Test pool(A, BB)
    await pairMintABB(tokenABAmount, tokenBBAmount, expectedLiquidityABB )
  */
    {
      const tokenAAmount = expandTo18Decimals(9)
      const tokenBAmount = expandTo18Decimals(4)
      const expectedLiquidityAAB = expandTo18Decimals(6)

      await tokenA.transfer(pairAAB.address, tokenAAmount)
      await tokenB.transfer(pairAAB.address, tokenBAmount)
      await expect(pairAAB.mint(wallet.address, overrides))
        .to.emit(pairAAB, 'Transfer') 
        .withArgs(AddressZero, AddressZero, MINIMUM_LIQUIDITY)
        .to.emit(pairAAB, 'Transfer')
        .withArgs(AddressZero, wallet.address, expectedLiquidityAAB.sub(MINIMUM_LIQUIDITY))
        .to.emit(pairAAB, 'Sync')
        .withArgs(tokenAAmount, tokenBAmount)
        .to.emit(pairAAB, 'Mint')
        .withArgs(wallet.address, tokenAAmount, tokenBAmount) 

      expect(await pairAAB.totalSupply()).to.eq(expectedLiquidityAAB)
      expect(await pairAAB.balanceOf(wallet.address)).to.eq(expectedLiquidityAAB.sub(MINIMUM_LIQUIDITY))
      expect(await tokenA.balanceOf(pairAAB.address)).to.eq(tokenAAmount)
      expect(await tokenB.balanceOf(pairAAB.address)).to.eq(tokenBAmount)
      const reservesAAB = await pairAAB.getReserves()
      expect(reservesAAB[0]).to.eq(tokenAAmount)
      expect(reservesAAB[1]).to.eq(tokenBAmount)
    }
    {
      // Test pool(A, BB)
      const tokenAAmount = expandTo18Decimals(25);
      const tokenBAmount = expandTo18Decimals(36);
      const expectedLiquidityABB = expandTo18Decimals(30);

      await tokenA.transfer(pairABB.address, tokenAAmount)
      await tokenB.transfer(pairABB.address, tokenBAmount)
   
      await expect(pairABB.mint(wallet.address, overrides))
        .to.emit(pairABB, 'Transfer')
        .withArgs(AddressZero, AddressZero, MINIMUM_LIQUIDITY)
        .to.emit(pairABB, 'Transfer')
        .withArgs(AddressZero, wallet.address, expectedLiquidityABB.sub(MINIMUM_LIQUIDITY))
        .to.emit(pairABB, 'Sync')
        .withArgs(tokenBAmount, tokenAAmount)
        .to.emit(pairABB, 'Mint')
        .withArgs(wallet.address, tokenBAmount, tokenAAmount)

      expect(await pairABB.totalSupply()).to.eq(expectedLiquidityABB)
      expect(await pairABB.balanceOf(wallet.address)).to.eq(expectedLiquidityABB.sub(MINIMUM_LIQUIDITY))
      expect(await tokenA.balanceOf(pairABB.address)).to.eq(tokenAAmount)
      expect(await tokenB.balanceOf(pairABB.address)).to.eq(tokenBAmount)
      const reservesABB = await pairABB.getReserves()
      expect(reservesABB[0]).to.eq(tokenBAmount)
      expect(reservesABB[1]).to.eq(tokenAAmount)
    }    
  })

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

  const swapTestCases: BigNumber[][] = [
    [1, 5, 10, '1666666666666666666'],
    [1, 10, 5, '454545454545454545'],

    [2, 5, 10, '2857142857142857142'],
    [2, 10, 5, '833333333333333333'],

    [1, 10, 10,     '909090909090909090'],
    [1, 100, 100,   '990099009900990099'],
    [1, 1000, 1000, '999000999000999000']
  ].map(a => a.map(n => (typeof n === 'string' ? bigNumberify(n) : expandTo18Decimals(n))))
  swapTestCases.forEach((swapTestCase, i) => {
    it(`getInputPrice:${i}`, async () => {
      const [swapAmount, tokenAAmount, tokenBAmount, expectedOutputAmount] = swapTestCase
      await addLiquidityAAB(tokenAAmount, tokenBAmount)
      await tokenA.transfer(pairAAB.address, swapAmount)
      await expect(pairAAB.swap(expectedOutputAmount.add(1), wallet.address, '0x', overrides)).to.be.revertedWith(
        'FeSwap: K'
      )
      await pairAAB.swap(expectedOutputAmount, wallet.address, '0x', overrides)
    })
  })

  const optimisticTestCases: BigNumber[][] = [
    [5, 10, 1, '997000000000000000'], // For Flash Swap , 0.3% fee are charged.
    [10, 5, 1, '997000000000000000'],
    [5, 5, 1, '997000000000000000'],
    [5, 5, '1003009027081243732', 1] 
  ].map(a => a.map(n => (typeof n === 'string' ? bigNumberify(n) : expandTo18Decimals(n))))
  optimisticTestCases.forEach((optimisticTestCase, i) => {
    it(`optimistic:${i}`, async () => {
      const [tokenAAmount, tokenBAmount, inputAmount, outputAmount] = optimisticTestCase
      await addLiquidityAAB(tokenAAmount, tokenBAmount)
      await tokenB.transfer(pairAAB.address, inputAmount)
      await expect(pairAAB.swap(outputAmount.add(1), wallet.address, '0x', overrides)).to.be.revertedWith(
        'FeSwap: K'
      )
      await pairAAB.swap(outputAmount, wallet.address, '0x', overrides)
    })
  })

  it('swap:tokenA', async () => {
    const tokenAAmount = expandTo18Decimals(5)
    const tokenBAmount = expandTo18Decimals(10)
    await addLiquidityAAB(tokenAAmount, tokenBAmount)

    const swapAmount = expandTo18Decimals(1)
    const expectedOutputAmount = bigNumberify('1666666666666666666')
    await tokenA.transfer(pairAAB.address, swapAmount)
    await expect(pairAAB.swap(expectedOutputAmount, wallet.address, '0x', overrides))
      .to.emit(tokenB, 'Transfer')
      .withArgs(pairAAB.address, wallet.address, expectedOutputAmount)
      .to.emit(pairAAB, 'Sync')
      .withArgs(tokenAAmount.add(swapAmount), tokenBAmount.sub(expectedOutputAmount))
      .to.emit(pairAAB, 'Swap')
      .withArgs(wallet.address, swapAmount, 0, 0, expectedOutputAmount, wallet.address)

    const reserves = await pairAAB.getReserves()
    expect(reserves[0]).to.eq(tokenAAmount.add(swapAmount))
    expect(reserves[1]).to.eq(tokenBAmount.sub(expectedOutputAmount))
    expect(await tokenA.balanceOf(pairAAB.address)).to.eq(tokenAAmount.add(swapAmount))
    expect(await tokenB.balanceOf(pairAAB.address)).to.eq(tokenBAmount.sub(expectedOutputAmount))
    const totalSupplytokenA = await tokenA.totalSupply()
    const totalSupplytokenB = await tokenB.totalSupply()
    expect(await tokenA.balanceOf(wallet.address)).to.eq(totalSupplytokenA.sub(tokenAAmount).sub(swapAmount))
    expect(await tokenB.balanceOf(wallet.address)).to.eq(totalSupplytokenB.sub(tokenBAmount).add(expectedOutputAmount))
  })

  it('swap:tokenB', async () => {
    const tokenAAmount = expandTo18Decimals(5)
    const tokenBAmount = expandTo18Decimals(10)
    await addLiquidityABB(tokenAAmount, tokenBAmount)

    const swapAmount = expandTo18Decimals(1)
    const expectedOutputAmount = bigNumberify('454545454545454545')
    await tokenB.transfer(pairABB.address, swapAmount)
    await expect(pairABB.swap(expectedOutputAmount, wallet.address, '0x', overrides))
      .to.emit(tokenA, 'Transfer')
      .withArgs(pairABB.address, wallet.address, expectedOutputAmount)
      .to.emit(pairABB, 'Sync')
      .withArgs(tokenBAmount.add(swapAmount), tokenAAmount.sub(expectedOutputAmount))
      .to.emit(pairABB, 'Swap')
      .withArgs(wallet.address, swapAmount, 0, 0, expectedOutputAmount, wallet.address)

    const reserves = await pairABB.getReserves()
    expect(reserves[0]).to.eq(tokenBAmount.add(swapAmount))
    expect(reserves[1]).to.eq(tokenAAmount.sub(expectedOutputAmount))
    expect(await tokenA.balanceOf(pairABB.address)).to.eq(tokenAAmount.sub(expectedOutputAmount))
    expect(await tokenB.balanceOf(pairABB.address)).to.eq(tokenBAmount.add(swapAmount))
    const totalSupplytokenA = await tokenA.totalSupply()
    const totalSupplytokenB = await tokenB.totalSupply()
    expect(await tokenA.balanceOf(wallet.address)).to.eq(totalSupplytokenA.sub(tokenAAmount).add(expectedOutputAmount))
    expect(await tokenB.balanceOf(wallet.address)).to.eq(totalSupplytokenB.sub(tokenBAmount).sub(swapAmount))
  })

  it('swap:gas', async () => {
    const tokenAAmount = expandTo18Decimals(5)
    const tokenBAmount = expandTo18Decimals(10)
    await addLiquidityABB(tokenAAmount, tokenBAmount)

    // ensure that setting price{0,1}CumulativeLast for the first time doesn't affect our gas math
    await mineBlock(provider, (await provider.getBlock('latest')).timestamp + 1)
    await pairABB.sync(overrides)

    const swapAmount = expandTo18Decimals(1)
    const expectedOutputAmount = bigNumberify('454545454545454545')
    await tokenB.transfer(pairABB.address, swapAmount)
    await mineBlock(provider, (await provider.getBlock('latest')).timestamp + 1)
    const tx = await pairABB.swap(expectedOutputAmount, wallet.address, '0x', overrides)
    const receipt = await tx.wait()
    expect(receipt.gasUsed).to.eq(72712)      // 73384
  })

  it('burn', async () => {
    const tokenAAmount = expandTo18Decimals(3)
    const tokenBAmount = expandTo18Decimals(3)
    await addLiquidityAAB(tokenAAmount, tokenBAmount)

    const expectedLiquidity = expandTo18Decimals(3)
    await pairAAB.transfer(pairAAB.address, expectedLiquidity.sub(MINIMUM_LIQUIDITY))
    await expect(pairAAB.burn(wallet.address, overrides))
      .to.emit(pairAAB, 'Transfer')
      .withArgs(pairAAB.address, AddressZero, expectedLiquidity.sub(MINIMUM_LIQUIDITY))
      .to.emit(tokenA, 'Transfer')
      .withArgs(pairAAB.address, wallet.address, tokenAAmount.sub(1000))
      .to.emit(tokenB, 'Transfer')
      .withArgs(pairAAB.address, wallet.address, tokenBAmount.sub(1000))
      .to.emit(pairAAB, 'Sync')
      .withArgs(1000, 1000)
      .to.emit(pairAAB, 'Burn')
      .withArgs(wallet.address, tokenAAmount.sub(1000), tokenBAmount.sub(1000), wallet.address)

    expect(await pairAAB.balanceOf(wallet.address)).to.eq(0)
    expect(await pairAAB.totalSupply()).to.eq(MINIMUM_LIQUIDITY)
    expect(await tokenA.balanceOf(pairAAB.address)).to.eq(1000)
    expect(await tokenB.balanceOf(pairAAB.address)).to.eq(1000)
    const totalSupplytokenA = await tokenA.totalSupply()
    const totalSupplytokenB = await tokenB.totalSupply()
    expect(await tokenA.balanceOf(wallet.address)).to.eq(totalSupplytokenA.sub(1000))
    expect(await tokenB.balanceOf(wallet.address)).to.eq(totalSupplytokenB.sub(1000))
  })

  it('price{0,1}CumulativeLast', async () => {
    const tokenAAmount = expandTo18Decimals(3)
    const tokenBAmount = expandTo18Decimals(3)
    await addLiquidityAAB(tokenAAmount, tokenBAmount)

    const blockTimestamp = (await pairAAB.getReserves())[2]
    await mineBlock(provider, blockTimestamp + 1)
    await pairAAB.sync(overrides)

    const initialPrice = encodePrice(tokenAAmount, tokenBAmount)
    expect(await pairAAB.price0CumulativeLast()).to.eq(initialPrice[0])
    expect(await pairAAB.price1CumulativeLast()).to.eq(initialPrice[1])
    expect((await pairAAB.getReserves())[2]).to.eq(blockTimestamp + 1)

    const swapAmount = expandTo18Decimals(4)
    await tokenA.transfer(pairAAB.address, swapAmount)
    await mineBlock(provider, blockTimestamp + 10)
    // swap to a new price eagerly instead of syncing
    // just to make the new price, not the correct swap value
    await pairAAB.swap(expandTo18Decimals(1), wallet.address, '0x', overrides) 

    expect(await pairAAB.price0CumulativeLast()).to.eq(initialPrice[0].mul(10))
    expect(await pairAAB.price1CumulativeLast()).to.eq(initialPrice[1].mul(10))
    expect((await pairAAB.getReserves())[2]).to.eq(blockTimestamp + 10)

    await mineBlock(provider, blockTimestamp + 20)
    await pairAAB.sync(overrides)

    const newPrice = encodePrice(expandTo18Decimals(7), expandTo18Decimals(2))
    expect(await pairAAB.price0CumulativeLast()).to.eq(initialPrice[0].mul(10).add(newPrice[0].mul(10)))
    expect(await pairAAB.price1CumulativeLast()).to.eq(initialPrice[1].mul(10).add(newPrice[1].mul(10)))
    expect((await pairAAB.getReserves())[2]).to.eq(blockTimestamp + 20)
  
  })

  it('feeTo:off', async () => {
    const tokenAAmount = expandTo18Decimals(1000)
    const tokenBAmount = expandTo18Decimals(1000)
    await addLiquidityAAB(tokenAAmount, tokenBAmount)

    const swapAmount = expandTo18Decimals(1)
    const expectedOutputAmount = bigNumberify('999000999000999000')
    await tokenA.transfer(pairAAB.address, swapAmount)
    await pairAAB.swap(expectedOutputAmount, wallet.address, '0x', overrides)

    const expectedLiquidity = expandTo18Decimals(1000)
    await pairAAB.transfer(pairAAB.address, expectedLiquidity.sub(MINIMUM_LIQUIDITY))
    await pairAAB.burn(wallet.address, overrides)
    expect(await pairAAB.totalSupply()).to.eq(MINIMUM_LIQUIDITY) 
  })

  it('Swap without arbitrage', async () => {
    const tokenAAmount = expandTo18Decimals(1000)
    const tokenBAmount = expandTo18Decimals(1000)
    await addLiquidityAAB(tokenAAmount, tokenBAmount)
    await addLiquidityABB(tokenAAmount, tokenBAmount)
 
    const swapAmount = expandTo18Decimals(10)
    const expectedOutputAmount = bigNumberify('9900990099009900990')   // 996006981039903216 9999507437690867894
    await tokenA.transfer(pairAAB.address, swapAmount)
    await pairAAB.swap(expectedOutputAmount, wallet.address, '0x', overrides)

    const expectedOutputAmountA = bigNumberify('9999507437690867894')     // call swap directly, no arbitrage
    await tokenB.transfer(pairABB.address, swapAmount)

    await expect(pairABB.swap(expectedOutputAmountA, wallet.address, '0x', overrides)).to.be.revertedWith('FeSwap: K')

    const expectedLiquidity = expandTo18Decimals(1000)
    await pairAAB.transfer(pairAAB.address, expectedLiquidity.sub(MINIMUM_LIQUIDITY))
    await pairAAB.burn(wallet.address, overrides)
    expect(await pairAAB.totalSupply()).to.eq(MINIMUM_LIQUIDITY)
    expect(await pairAAB.balanceOf(feeTo.address)).to.eq('0')     // no fee

    const tokenALeft = expandTo18Decimals(1000).add(swapAmount).mul(MINIMUM_LIQUIDITY).div(expectedLiquidity)
    const tokenBRemove = (expandTo18Decimals(1000).sub(expectedOutputAmount).mul(expectedLiquidity.sub(MINIMUM_LIQUIDITY)).div(expectedLiquidity))   
    const tokenBLeft = expandTo18Decimals(1000).sub(expectedOutputAmount).sub(tokenBRemove)
    expect(await tokenA.balanceOf(pairAAB.address)).to.eq(tokenALeft)
    expect(await tokenB.balanceOf(pairAAB.address)).to.eq(tokenBLeft)  
  }) 

  it('Swap Arbitrage', async () => {

    await tokenA.approve(router.address, MaxUint256)
    await tokenB.approve(router.address, MaxUint256)          

    const tokenAAmount = expandTo18Decimals(1000)
    const tokenBAmount = expandTo18Decimals(1000)
    await addLiquidityAAB(tokenAAmount, tokenBAmount)
    await addLiquidityABB(tokenAAmount, tokenBAmount)

    const swapAmount = expandTo18Decimals(10)
    const expectedOutputAmount = bigNumberify('9900990099009900990') 

    await expect(
      router.swapExactTokensForTokens(
        swapAmount,
        0,
        [tokenA.address, tokenB.address],
        wallet.address,
        MaxUint256,
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
      .withArgs(router.address, swapAmount, 0, 0, expectedOutputAmount, wallet.address)
    
    expect(await tokenA.balanceOf(pairAAB.address)).to.eq('1010000000000000000000')
    expect(await tokenB.balanceOf(pairAAB.address)).to.eq( '990099009900990099010')
      
    const BalanceABA = await tokenA.balanceOf(pairAAB.address)
    const BalanceABB = await tokenB.balanceOf(pairAAB.address) 
    const BalanceBAA = await tokenA.balanceOf(pairABB.address)
    const BalanceBAB = await tokenB.balanceOf(pairABB.address)                     

    const arbitrageLB = bigNumberify('4950495049504950495')
    const arbitrageLA = bigNumberify('4999999999999999999')    
    
    const expectedOutputAmountA = bigNumberify('9999507437690867894')   //9999507437690867894

    await expect(
      router.swapExactTokensForTokens(
      swapAmount,
      0,
      [tokenB.address, tokenA.address],
      wallet.address,
      MaxUint256,
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
      .withArgs(router.address, swapAmount, 0, 0, expectedOutputAmountA, wallet.address)

      const AAmount = expandTo18Decimals(10)
      const BAmount = expandTo18Decimals(10)
      await router.addLiquidity(  tokenA.address, tokenB.address, AAmount, expandTo18Decimals(20),
                                  100, wallet.address, MaxUint256, overrides  )
                                   
      await router.addLiquidity(  tokenA.address, tokenB.address, expandTo18Decimals(20), BAmount,
                                  0, wallet.address, MaxUint256, overrides  )

      const AmountTokeAofWallet = await tokenA.balanceOf(wallet.address)
      const AmountTokeBofWallet = await tokenB.balanceOf(wallet.address)                                   
      const LiquityWalletAB = await pairAAB.balanceOf(wallet.address)
      const LiquityWalletBA = await pairABB.balanceOf(wallet.address) 

      const feeToAAB = await pairAAB.balanceOf(feeTo.address)
      const feeCreateAAB = await pairAAB.balanceOf(pairCreator.address)  
      const feeToABB = await pairABB.balanceOf(feeTo.address)
      const feeCreateABB = await pairABB.balanceOf(pairCreator.address)  

      expect(AmountTokeAofWallet).to.eq('7980099492685568592026')
      expect(AmountTokeBofWallet).to.eq('7980000000000000000000')
      expect(LiquityWalletAB).to.eq('1009950259018259232354')
      expect(LiquityWalletBA).to.eq('1009949768906003382721')   

      expect(feeToAAB).to.eq('412534021180854')
      expect(feeCreateAAB).to.eq('618801031771281')
      expect(feeToABB).to.eq('412534021180854')
      expect(feeCreateABB).to.eq('618801031771281')               
      
//      console.log( "     Add After:", AmountTokeAofWallet.toString(), AmountTokeBofWallet.toString(), 
//                                  LiquityWalletAB.toString(), LiquityWalletBA.toString() ) 
//      console.log( "Fee  Add After:", feeToAAB.toString(), feeCreateAAB.toString(), 
///                                 feeToABB.toString(), feeCreateABB.toString() ) 
                                  
      const AmountTokeAofPairAAB = await tokenA.balanceOf(pairAAB.address)
      const AmountTokeBofPairAAB = await tokenB.balanceOf(pairAAB.address)       
      const AmountTokeAofPairABB = await tokenA.balanceOf(pairABB.address)
      const AmountTokeBofPairABB = await tokenB.balanceOf(pairABB.address)  

      expect(AmountTokeAofPairAAB).to.eq('1015000000000000000001')
      expect(AmountTokeBofPairAAB).to.eq('1004950495049504950495')
      expect(AmountTokeAofPairABB).to.eq('1004900507314431407973')
      expect(AmountTokeBofPairABB).to.eq('1015049504950495049505')   
 
//      console.log( "Pair Add After:",  AmountTokeAofPairAAB.toString(), AmountTokeBofPairAAB.toString(), 
//                                        AmountTokeAofPairABB.toString(), AmountTokeBofPairABB.toString() )                                     

      const TotalLiquityAB = await pairAAB.totalSupply()
      const KValueLastAB = await pairAAB.kLast()
      const TotalLiquityBA = await pairABB.totalSupply() 
      const KValueLastBA = await pairAAB.kLast()

      expect(TotalLiquityAB).to.eq('1009951290353312185489')
      expect(KValueLastAB).to.eq('1020024752475247524753429950495049504950495')
      expect(TotalLiquityBA).to.eq('1009950800241056335856')
      expect(KValueLastBA).to.eq('1020024752475247524753429950495049504950495')   

//      console.log( "Supply & KLast:",   TotalLiquityAB.toString(), KValueLastAB.toString(), 
//                                        TotalLiquityBA.toString(), KValueLastBA.toString() )  
//                                        
//      console.log( "\r\n")                                           

    }) 
})
