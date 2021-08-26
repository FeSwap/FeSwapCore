import chai, { expect } from 'chai'
import { Contract, constants, utils, BigNumber } from 'ethers'
import { solidity, MockProvider, createFixtureLoader,deployContract } from 'ethereum-waffle'

import { expandTo18Decimals, mineBlock, encodePrice, sqrt } from './shared/utilities'

import { v2Fixture } from './shared/Routerfixtures'

const MINIMUM_LIQUIDITY = BigNumber.from(10).pow(3)

chai.use(solidity)

const rateTriggerArbitrage: number = 10
const overrides = {
  gasLimit: 9999999
}

describe('FeSwapPair', () => {
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

  let factory: Contract
  let router: Contract
  let pairAAB: Contract
  let pairABB: Contract
  let tokenIDMatch: string

  beforeEach(async () => {
    const fixture = await loadFixture(v2Fixture)
    tokenA = fixture.tokenA
    tokenB = fixture.tokenB
    factory = fixture.factoryFeswa
    router = fixture.routerFeswa
    pairAAB = fixture.pairAAB
    pairABB = fixture.pairABB     
    tokenIDMatch = fixture.tokenIDMatch    
   })

  it('Mint: AAB', async () => {
    {
      // Test pool(AA, B)
      const tokenAAmount = expandTo18Decimals(9)
      const tokenBAmount = expandTo18Decimals(4)
      const expectedLiquidityAAB = expandTo18Decimals(6)

      await tokenA.transfer(pairAAB.address, tokenAAmount)
      await tokenB.transfer(pairAAB.address, tokenBAmount)
      await expect(pairAAB.mint(wallet.address, overrides))
        .to.emit(pairAAB, 'Transfer') 
        .withArgs(constants.AddressZero, constants.AddressZero, MINIMUM_LIQUIDITY)
        .to.emit(pairAAB, 'Transfer')
        .withArgs(constants.AddressZero, wallet.address, expectedLiquidityAAB.sub(MINIMUM_LIQUIDITY))
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
        .withArgs(constants.AddressZero, constants.AddressZero, MINIMUM_LIQUIDITY)
        .to.emit(pairABB, 'Transfer')
        .withArgs(constants.AddressZero, wallet.address, expectedLiquidityABB.sub(MINIMUM_LIQUIDITY))
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

  // y' = x'*Y/(X+x')
  const swapTestCases: BigNumber[][] = [
    [1, 5, 10, '1666666666666666666'],
    [1, 10, 5, '454545454545454545'],

    [2, 5, 10, '2857142857142857142'],
    [2, 10, 5, '833333333333333333'],

    [1, 10, 10,     '909090909090909090'],
    [1, 100, 100,   '990099009900990099'],
    [1, 1000, 1000, '999000999000999000']
  ].map(a => a.map(n => (typeof n === 'string' ? BigNumber.from(n) : expandTo18Decimals(n))))

  swapTestCases.forEach((swapTestCase, i) => {
    it(`Swap test: given tInputPrice:${i}, check output amount`, async () => {
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
  ].map(a => a.map(n => (typeof n === 'string' ? BigNumber.from(n) : expandTo18Decimals(n))))

  optimisticTestCases.forEach((optimisticTestCase, i) => {
    it(`Swap test: input OutToken, output same OutPut, (simualte Flash swap): ${i}`, async () => {
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
    const expectedOutputAmount = BigNumber.from('1666666666666666666')
    await tokenA.transfer(pairAAB.address, swapAmount)
    await expect(pairAAB.swap(expectedOutputAmount, wallet.address, '0x', overrides))
      .to.emit(tokenB, 'Transfer')
      .withArgs(pairAAB.address, wallet.address, expectedOutputAmount)
      .to.emit(pairAAB, 'Sync')
      .withArgs(tokenAAmount.add(swapAmount), tokenBAmount.sub(expectedOutputAmount))
      .to.emit(pairAAB, 'Swap')
      .withArgs(wallet.address, swapAmount, 0, expectedOutputAmount, wallet.address)

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
    const expectedOutputAmount = BigNumber.from('454545454545454545')
    await tokenB.transfer(pairABB.address, swapAmount)
    await expect(pairABB.swap(expectedOutputAmount, wallet.address, '0x', overrides))
      .to.emit(tokenA, 'Transfer')
      .withArgs(pairABB.address, wallet.address, expectedOutputAmount)
      .to.emit(pairABB, 'Sync')
      .withArgs(tokenBAmount.add(swapAmount), tokenAAmount.sub(expectedOutputAmount))
      .to.emit(pairABB, 'Swap')
      .withArgs(wallet.address, swapAmount, 0, expectedOutputAmount, wallet.address)

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

  it('Swap test: Pair AAB: Wrong checking ', async () => {
    const tokenAAmount = expandTo18Decimals(5)
    const tokenBAmount = expandTo18Decimals(10)
    await addLiquidityAAB(tokenAAmount, tokenBAmount)

    const swapAmount = expandTo18Decimals(1)
    const expectedOutputAmount = BigNumber.from('1666666666666666666')
    await tokenA.transfer(pairAAB.address, swapAmount)

    await expect(pairAAB.swap(0, wallet.address, '0x', overrides))
          .to.be.revertedWith('FeSwap: INSUFFICIENT_OUTPUT_AMOUNT')

    const reserves = await pairAAB.getReserves()
    await expect(pairAAB.swap(reserves[1].add(1), wallet.address, '0x', overrides))
          .to.be.revertedWith('FeSwap: INSUFFICIENT_LIQUIDITY')

    await expect(pairAAB.swap(expectedOutputAmount, tokenA.address, '0x', overrides))
          .to.be.revertedWith('FeSwap: INVALID_TO')

    await expect(pairAAB.swap(expectedOutputAmount, tokenB.address, '0x', overrides))
          .to.be.revertedWith('FeSwap: INVALID_TO')

    await expect(pairAAB.swap(expectedOutputAmount.add(1), wallet.address, '0x', overrides))
          .to.be.revertedWith('FeSwap: K')      

  })
  it('Swap test:: Pair ABB Revert K -> Balance checking ', async () => {
    const tokenAAmount = expandTo18Decimals(5)
    const tokenBAmount = expandTo18Decimals(10)
    const inputTokenBAmount = expandTo18Decimals(1)
    let outputAmount = BigNumber.from('997000000000000000')
    await addLiquidityAAB(tokenAAmount, tokenBAmount)

    await tokenB.transfer(pairAAB.address, inputTokenBAmount)
    let TokenABalance = await tokenA.balanceOf(wallet.address)
    let TokenBBalance = await tokenB.balanceOf(wallet.address)
    await expect(pairAAB.swap(outputAmount.add(1), wallet.address, '0x', overrides)).to.be.revertedWith('FeSwap: K')

    // check balance not changed while reverted with K-Value problem
    expect(await tokenA.balanceOf(wallet.address)).to.eq(TokenABalance)
    expect(await tokenB.balanceOf(wallet.address)).to.eq(TokenBBalance)

    // two token input, K value checking: simulate Flash Swap 
    const inputTokenAAmount = expandTo18Decimals(1)
    outputAmount = BigNumber.from('2663666666666666666')
    await tokenA.transfer(pairAAB.address, inputTokenAAmount)

    TokenABalance = await tokenA.balanceOf(wallet.address)
    TokenBBalance = await tokenB.balanceOf(wallet.address)
    await expect(pairAAB.swap(outputAmount.add(1), wallet.address, '0x', overrides)).to.be.revertedWith('FeSwap: K')
    
    // check balance not changed while reverted with K-Value problem
    expect(await tokenA.balanceOf(wallet.address)).to.eq(TokenABalance)
    expect(await tokenB.balanceOf(wallet.address)).to.eq(TokenBBalance)

    // two token input, swap success
    await pairAAB.swap(outputAmount, wallet.address, '0x', overrides)
    expect(await tokenA.balanceOf(wallet.address)).to.eq(TokenABalance)
    expect(await tokenB.balanceOf(wallet.address)).to.eq(TokenBBalance.add(outputAmount))

  })

  it('Swap: Gas', async () => {
    const tokenAAmount = expandTo18Decimals(5)
    const tokenBAmount = expandTo18Decimals(10)
    await addLiquidityABB(tokenAAmount, tokenBAmount)

    // ensure that setting price{0,1}CumulativeLast for the first time doesn't affect our gas math
    await mineBlock(provider, (await provider.getBlock('latest')).timestamp + 1)
    await pairABB.sync(overrides)

    const swapAmount = expandTo18Decimals(1)
    const expectedOutputAmount = BigNumber.from('454545454545454545')
    await tokenB.transfer(pairABB.address, swapAmount)
    await mineBlock(provider, (await provider.getBlock('latest')).timestamp + 1)
    const tx = await pairABB.swap(expectedOutputAmount, wallet.address, '0x', overrides)
    const receipt = await tx.wait()
    expect(receipt.gasUsed).to.eq(72482)      // 72460
  })

  it('Burn', async () => {
    const tokenAAmount = expandTo18Decimals(4)
    const tokenBAmount = expandTo18Decimals(9)
    await addLiquidityAAB(tokenAAmount, tokenBAmount)

    const expectedLiquidity = expandTo18Decimals(6)
    const realLiquidity = expandTo18Decimals(6).sub(MINIMUM_LIQUIDITY)
    const tokenAAmountRemove = realLiquidity.mul(tokenAAmount).div(expectedLiquidity)
    const tokenBAmountRemove = realLiquidity.mul(tokenBAmount).div(expectedLiquidity)

    await pairAAB.transfer(pairAAB.address, realLiquidity)
    await expect(pairAAB.burn(wallet.address, overrides))
      .to.emit(pairAAB, 'Transfer')
      .withArgs(pairAAB.address, constants.AddressZero, realLiquidity)
      .to.emit(tokenA, 'Transfer')
      .withArgs(pairAAB.address, wallet.address, tokenAAmountRemove)
      .to.emit(tokenB, 'Transfer')
      .withArgs(pairAAB.address, wallet.address, tokenBAmountRemove)
      .to.emit(pairAAB, 'Sync')
      .withArgs(tokenAAmount.sub(tokenAAmountRemove), tokenBAmount.sub(tokenBAmountRemove))
      .to.emit(pairAAB, 'Burn')
      .withArgs(wallet.address, tokenAAmountRemove, tokenBAmountRemove, wallet.address)

    expect(await pairAAB.balanceOf(wallet.address)).to.eq(0)
    expect(await pairAAB.totalSupply()).to.eq(MINIMUM_LIQUIDITY)
    expect(await tokenA.balanceOf(pairAAB.address)).to.eq(tokenAAmount.sub(tokenAAmountRemove))
    expect(await tokenB.balanceOf(pairAAB.address)).to.eq(tokenBAmount.sub(tokenBAmountRemove))
    const totalSupplytokenA = await tokenA.totalSupply()
    const totalSupplytokenB = await tokenB.totalSupply()
    expect(await tokenA.balanceOf(wallet.address)).to.eq(totalSupplytokenA.sub(tokenAAmount.sub(tokenAAmountRemove)))
    expect(await tokenB.balanceOf(wallet.address)).to.eq(totalSupplytokenB.sub(tokenBAmount.sub(tokenBAmountRemove)))
  })

  it('Burn: Gas', async () => {
    const tokenAAmount = expandTo18Decimals(4)
    const tokenBAmount = expandTo18Decimals(9)
    await addLiquidityAAB(tokenAAmount, tokenBAmount)

    // ensure that setting price{0,1}CumulativeLast for the first time doesn't affect our gas math
    await mineBlock(provider, (await provider.getBlock('latest')).timestamp + 1)
    await pairABB.sync(overrides)

    const expectedLiquidity = expandTo18Decimals(6)
    await pairAAB.transfer(pairAAB.address, expectedLiquidity.sub(MINIMUM_LIQUIDITY))
    const tx = await pairAAB.burn(wallet.address, overrides)
    const receipt = await tx.wait()
    expect(receipt.gasUsed).to.eq(149961)     //148288  //different liquity ,gas could be different
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

  it('Swap without fee', async () => {
    const tokenAAmount = expandTo18Decimals(1000)
    const tokenBAmount = expandTo18Decimals(1000)
    await addLiquidityAAB(tokenAAmount, tokenBAmount)

    const swapAmount = expandTo18Decimals(1)
    const expectedOutputAmount = BigNumber.from('999000999000999000')
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
    const expectedOutputAmount = BigNumber.from('9900990099009900990')   // 996006981039903216 9999507437690867894
    await tokenA.transfer(pairAAB.address, swapAmount)
    await pairAAB.swap(expectedOutputAmount, wallet.address, '0x', overrides)

    const expectedOutputAmountA = BigNumber.from('9999507437690867894')     // call swap directly, no arbitrage
    await tokenB.transfer(pairABB.address, swapAmount)                    // if arbitrage is executed, this swap could be completed.

    await expect(pairABB.swap(expectedOutputAmountA, wallet.address, '0x', overrides)).to.be.revertedWith('FeSwap: K')

    const expectedLiquidity = expandTo18Decimals(1000)
    await pairAAB.transfer(pairAAB.address, expectedLiquidity.sub(MINIMUM_LIQUIDITY))
    await pairAAB.burn(wallet.address, overrides)
    expect(await pairAAB.totalSupply()).to.eq(MINIMUM_LIQUIDITY)
    expect(await pairAAB.balanceOf(feeTo.address)).to.eq('0')     // no fee

    const tokenALeft = expandTo18Decimals(1000).add(swapAmount).mul(MINIMUM_LIQUIDITY).div(expectedLiquidity)
    // const tokenBLeft = expandTo18Decimals(1000).sub(expectedOutputAmount).mul(MINIMUM_LIQUIDITY).div(expectedLiquidity)  // round out unidentical
    const tokenBRemove = (expandTo18Decimals(1000).sub(expectedOutputAmount).mul(expectedLiquidity.sub(MINIMUM_LIQUIDITY)).div(expectedLiquidity))   
    const tokenBLeft = expandTo18Decimals(1000).sub(expectedOutputAmount).sub(tokenBRemove)
    expect(await tokenA.balanceOf(pairAAB.address)).to.eq(tokenALeft)
    expect(await tokenB.balanceOf(pairAAB.address)).to.eq(tokenBLeft)  
  }) 

  it('Swap Arbitrage', async () => {
    // Approve router
    await tokenA.approve(router.address, constants.MaxUint256)
    await tokenB.approve(router.address, constants.MaxUint256)          

    // Add liquidity to two pools
    const tokenAAmount = expandTo18Decimals(1000)
    const tokenBAmount = expandTo18Decimals(1000)
    const InitLiquidity = expandTo18Decimals(1000)
    await addLiquidityAAB(tokenAAmount, tokenBAmount)
    await addLiquidityABB(tokenAAmount, tokenBAmount)

    // Liquidity
    let LiquityWalletAB = await pairAAB.balanceOf(wallet.address)
    let LiquityWalletBA = await pairABB.balanceOf(wallet.address) 
    expect(LiquityWalletAB).to.eq(InitLiquidity.sub(MINIMUM_LIQUIDITY))
    expect(LiquityWalletBA).to.eq(InitLiquidity.sub(MINIMUM_LIQUIDITY))

    // Swap in and out amount 
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
    
    // check reserves of two pools  
    expect(await tokenA.balanceOf(pairAAB.address)).to.eq('1010000000000000000000')
    expect(await tokenB.balanceOf(pairAAB.address)).to.eq( '990099009900990099010')
     
    // get reserves
    const BalanceABA = await tokenA.balanceOf(pairAAB.address)
    const BalanceABB = await tokenB.balanceOf(pairAAB.address) 

    const BalanceBAA = await tokenA.balanceOf(pairABB.address)
    const BalanceBAB = await tokenB.balanceOf(pairABB.address)                     

    // calculate arbitrage amount
    let N_AA  = tokenAAmount.add(swapAmount)
    let N_B   = tokenBAmount.sub(expectedOutputAmount)
    let N_BB  = tokenBAmount
    let N_A   = tokenAAmount
    
    let arbitrageLA = N_AA.mul(N_BB).sub(N_A.mul(N_B)).div(N_B.add(N_BB).mul(2))
    let arbitrageLB = N_AA.mul(N_BB).sub(N_A.mul(N_B)).div(N_A.add(N_AA).mul(2))    
    expect(arbitrageLA).to.eq(BigNumber.from('4999999999999999999'))
    expect(arbitrageLB).to.eq(BigNumber.from('4950495049504950495'))    

    // calculate swapout amount after arbitrage 
    let PoolABB_AmountA = tokenAAmount.add(arbitrageLA)
    let PoolABB_AmountB = tokenBAmount.sub(arbitrageLB)
    let expectedOutputAmountA = swapAmount.mul(PoolABB_AmountA).div(swapAmount.add(PoolABB_AmountB))
    expect(expectedOutputAmountA).to.eq(BigNumber.from('9999507437690867894'))    

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

      // calculate latest reserves
      N_AA  = tokenAAmount.add(swapAmount).sub(arbitrageLA)
      N_B   = tokenBAmount.sub(expectedOutputAmount).add(arbitrageLB)
      N_BB  = tokenBAmount.sub(arbitrageLB).add(swapAmount)
      N_A   = tokenAAmount.add(arbitrageLA).sub(expectedOutputAmountA)

      // check reserve
      expect(await tokenA.balanceOf(pairAAB.address)).to.eq(N_AA)
      expect(await tokenB.balanceOf(pairAAB.address)).to.eq(N_B)
      expect(await tokenA.balanceOf(pairABB.address)).to.eq(N_A)
      expect(await tokenB.balanceOf(pairABB.address)).to.eq(N_BB)

      // Latest K Value
      const KValueLastAAB = sqrt(N_AA.mul(N_B))
      const KValueLastABB = sqrt(N_A.mul(N_BB))

      // K-Value increasement (6 times)
      const SM_AAB = KValueLastAAB.sub(InitLiquidity).mul(InitLiquidity).mul(6).div(KValueLastAAB.mul(11).add(InitLiquidity)) 
      const SM_ABB = KValueLastABB.sub(InitLiquidity).mul(InitLiquidity).mul(6).div(KValueLastABB.mul(11).add(InitLiquidity))

      // Calulate fee to feeTo and pairOwner of Pool-AAB
      const feetoExpectedAAB = SM_AAB.div(15)
      const feeCreatorExpectedAAB = SM_AAB.div(10)
      const NewLiquid_Mined_AAB = feetoExpectedAAB.add(feeCreatorExpectedAAB)

      // Calulate fee to feeTo and pairOwner of Pool-ABB
      const feetoExpectedABB = SM_ABB.div(15)
      const feeCreatorExpectedABB = SM_ABB.div(10)
      const NewLiquid_Mined_ABB = feetoExpectedABB.add(feeCreatorExpectedABB)

      // add Liquidity to Pair_AAB            
      const PairAAB_AAmount = expandTo18Decimals(10)
      const PairAAB_BAmount = PairAAB_AAmount.mul(N_B).div(N_AA)
      const newLiquidityAAB = PairAAB_AAmount.mul(InitLiquidity.add(NewLiquid_Mined_AAB)).div(N_AA)

      await expect(router.addLiquidity( 
                                        {
                                          tokenA:         tokenA.address,
                                          tokenB:         tokenB.address,
                                          amountADesired: PairAAB_AAmount,
                                          amountBDesired: expandTo18Decimals(20),
                                          amountAMin:     0,
                                          amountBMin:     0,
                                          ratio:          100,
                                        }, wallet.address, constants.MaxUint256, overrides  ))
              .to.emit(tokenA, 'Transfer')
              .withArgs(wallet.address, pairAAB.address, PairAAB_AAmount)
              .to.emit(tokenB, 'Transfer')
              .withArgs(wallet.address, pairAAB.address, PairAAB_BAmount)
              .to.emit(pairAAB, 'Transfer')
              .withArgs(constants.AddressZero, wallet.address, newLiquidityAAB)          
              .to.emit(pairAAB, 'Sync')
              .withArgs(PairAAB_AAmount.add(N_AA), PairAAB_BAmount.add(N_B))
              .to.emit(pairAAB, 'Mint')
              .withArgs(router.address, PairAAB_AAmount, PairAAB_BAmount)         
                          
      const PairABB_BAmount = expandTo18Decimals(10)
      const PairABB_AAmount = PairABB_BAmount.mul(N_A).div(N_BB)     
      // const newLiquidityABB = PairABB_BAmount.mul(InitLiquidity.add(NewLiquid_Mined_ABB)).div(N_BB)  // round out 
      const newLiquidityABB = PairABB_AAmount.mul(InitLiquidity.add(NewLiquid_Mined_ABB)).div(N_A)

      await expect(router.addLiquidity(  
                                        {
                                          tokenA:         tokenA.address,
                                          tokenB:         tokenB.address,
                                          amountADesired: expandTo18Decimals(20),
                                          amountBDesired: PairABB_BAmount,
                                          amountAMin:     0,
                                          amountBMin:     0,
                                          ratio:          0,
                                        }, wallet.address, constants.MaxUint256, overrides  ))
              .to.emit(tokenA, 'Transfer')
              .withArgs(wallet.address, pairABB.address, PairABB_AAmount)
              .to.emit(tokenB, 'Transfer')
              .withArgs(wallet.address, pairABB.address, PairABB_BAmount)
              .to.emit(pairABB, 'Transfer')
              .withArgs(constants.AddressZero, wallet.address, newLiquidityABB)          
              .to.emit(pairABB, 'Sync')
              .withArgs(PairABB_BAmount.add(N_BB), PairABB_AAmount.add(N_A))
              .to.emit(pairABB, 'Mint')
              .withArgs(router.address, PairABB_BAmount, PairABB_AAmount)  

      // check liquidity        
      LiquityWalletAB = await pairAAB.balanceOf(wallet.address)
      LiquityWalletBA = await pairABB.balanceOf(wallet.address) 

      expect(LiquityWalletAB).to.eq(newLiquidityAAB.add(InitLiquidity).sub(MINIMUM_LIQUIDITY))  // eq('1009950259018259232354')
      expect(LiquityWalletBA).to.eq(newLiquidityABB.add(InitLiquidity).sub(MINIMUM_LIQUIDITY))  // eq('1009949768906003382721')

      // check fee to feeTo and pairOwner
      const feeToAAB = await pairAAB.balanceOf(feeTo.address)
      const feeCreateAAB = await pairAAB.balanceOf(pairOwner.address)  
      const feeToABB = await pairABB.balanceOf(feeTo.address)
      const feeCreateABB = await pairABB.balanceOf(pairOwner.address)  

      expect(feeToAAB).to.eq(feetoExpectedAAB)              // eq('412534021180854')
      expect(feeCreateAAB).to.eq(feeCreatorExpectedAAB)     // eq('618801031771281')
      expect(feeToABB).to.eq(feetoExpectedABB)              // eq('412534021180854')
      expect(feeCreateABB).to.eq(feeCreatorExpectedABB)     // eq('618801031771281')
                                  
      // calculate latest reserves
      const AmountTokeAofPairAAB = await tokenA.balanceOf(pairAAB.address)
      const AmountTokeBofPairAAB = await tokenB.balanceOf(pairAAB.address)       
      const AmountTokeAofPairABB = await tokenA.balanceOf(pairABB.address)
      const AmountTokeBofPairABB = await tokenB.balanceOf(pairABB.address)  

      N_AA  = tokenAAmount.add(swapAmount).sub(arbitrageLA).add(PairAAB_AAmount)
      N_B   = tokenBAmount.sub(expectedOutputAmount).add(arbitrageLB).add(PairAAB_BAmount)
      N_BB  = tokenBAmount.sub(arbitrageLB).add(swapAmount).add(PairABB_BAmount)
      N_A   = tokenAAmount.add(arbitrageLA).sub(expectedOutputAmountA).add(PairABB_AAmount)

      expect(AmountTokeAofPairAAB).to.eq(N_AA)          // eq('1015000000000000000001')
      expect(AmountTokeBofPairAAB).to.eq(N_B)           // eq('1004950495049504950495')
      expect(AmountTokeAofPairABB).to.eq(N_A)           // eq('1004900507314431407973')
      expect(AmountTokeBofPairABB).to.eq(N_BB)          // eq('1015049504950495049505')   
 
      // check token pools status
      const TotalLiquityAB = await pairAAB.totalSupply()
      const TotalLiquityBA = await pairABB.totalSupply()
      expect(TotalLiquityAB).to.eq(InitLiquidity.add(NewLiquid_Mined_AAB).add(newLiquidityAAB))   //eq('1009951290353312185489')
      expect(TotalLiquityBA).to.eq(InitLiquidity.add(NewLiquid_Mined_ABB).add(newLiquidityABB))   //eq('1009950800241056335856')

      const KValueLastAB = await pairAAB.kLast()
      const KValueLastBA = await pairABB.kLast()
      expect(KValueLastAB).to.eq(N_AA.mul(N_B))  
      expect(KValueLastBA).to.eq(N_A.mul(N_BB))

    }) 

    it('Swap Arbitrage Gas：no  feeTo and pairOwner fee', async () => {
      // Approve router
      await tokenA.approve(router.address, constants.MaxUint256)
      await tokenB.approve(router.address, constants.MaxUint256)   
      await router.connect(pairOwner).ManageFeswaPair(tokenIDMatch, constants.AddressZero, rateTriggerArbitrage) 
      await factory.setFeeTo(constants.AddressZero) 

      // Add liquidity to two pools
      const tokenAAmount = expandTo18Decimals(1000)
      const tokenBAmount = expandTo18Decimals(1000)
      const InitLiquidity = expandTo18Decimals(1000)
      await addLiquidityAAB(tokenAAmount, tokenBAmount)
      await addLiquidityABB(tokenAAmount, tokenBAmount)
  
      // Liquidity
      let LiquityWalletAB = await pairAAB.balanceOf(wallet.address)
      let LiquityWalletBA = await pairABB.balanceOf(wallet.address) 
      expect(LiquityWalletAB).to.eq(InitLiquidity.sub(MINIMUM_LIQUIDITY))
      expect(LiquityWalletBA).to.eq(InitLiquidity.sub(MINIMUM_LIQUIDITY))
  
      // Swap in and out amount 
      const swapAmount = expandTo18Decimals(10)
      await router.swapExactTokensForTokens(  swapAmount, 0, [tokenA.address, tokenB.address],
                                          wallet.address, constants.MaxUint256, overrides)

      await router.swapExactTokensForTokens(  swapAmount, 0, [tokenB.address, tokenA.address],
                                          wallet.address, constants.MaxUint256, overrides)

      const tx = await router.addLiquidity(  
                                            {
                                              tokenA:         tokenA.address,
                                              tokenB:         tokenB.address,
                                              amountADesired: expandTo18Decimals(10),
                                              amountBDesired: expandTo18Decimals(20),
                                              amountAMin:     0,
                                              amountBMin:     0,
                                              ratio:          100,
                                            }, wallet.address, constants.MaxUint256, overrides  )
      const feeToAAB = await pairAAB.balanceOf(feeTo.address)
      const feeCreateAAB = await pairAAB.balanceOf(pairOwner.address)  
      expect(feeToAAB).to.eq(0)           
      expect(feeCreateAAB).to.eq(0)                         
                                    
      const receipt = await tx.wait()
      expect(receipt.gasUsed).to.eq(109422)      //  123994 131668 157206  //241214
    }).retries(3)

    it('Swap Arbitrage Gas：no  feeTo, but pairOwner fee on', async () => {
      // Approve router
      await tokenA.approve(router.address, constants.MaxUint256)
      await tokenB.approve(router.address, constants.MaxUint256)   
      await router.connect(pairOwner).ManageFeswaPair(tokenIDMatch, constants.AddressZero, rateTriggerArbitrage) 
//      await factory.setFeeTo(constants.AddressZero) 
  
      // Add liquidity to two pools
      const tokenAAmount = expandTo18Decimals(1000)
      const tokenBAmount = expandTo18Decimals(1000)
      const InitLiquidity = expandTo18Decimals(1000)
      await addLiquidityAAB(tokenAAmount, tokenBAmount)
      await addLiquidityABB(tokenAAmount, tokenBAmount)
  
      // Liquidity
      let LiquityWalletAB = await pairAAB.balanceOf(wallet.address)
      let LiquityWalletBA = await pairABB.balanceOf(wallet.address) 
      expect(LiquityWalletAB).to.eq(InitLiquidity.sub(MINIMUM_LIQUIDITY))
      expect(LiquityWalletBA).to.eq(InitLiquidity.sub(MINIMUM_LIQUIDITY))
  
      // Swap in and out amount 
      const swapAmount = expandTo18Decimals(10)
      await router.swapExactTokensForTokens(  swapAmount, 0, [tokenA.address, tokenB.address],
                                          wallet.address, constants.MaxUint256, overrides)

      await router.swapExactTokensForTokens(  swapAmount, 0, [tokenB.address, tokenA.address],
                                          wallet.address, constants.MaxUint256, overrides)

      const tx = await router.addLiquidity(  
                                              {
                                                tokenA:         tokenA.address,
                                                tokenB:         tokenB.address,
                                                amountADesired: expandTo18Decimals(10),
                                                amountBDesired: expandTo18Decimals(20),
                                                amountAMin:     0,
                                                amountBMin:     0,
                                                ratio:          100,
                                              }, wallet.address, constants.MaxUint256, overrides  )
      
      const feeToAAB = await pairAAB.balanceOf(feeTo.address)
      const feeCreateAAB = await pairAAB.balanceOf(pairOwner.address)  
      expect(feeToAAB).to.not.eq(0)           
      expect(feeCreateAAB).to.eq(0)                         
                                    
      const receipt = await tx.wait()
      expect(receipt.gasUsed).to.eq(170632)      //  173200 180874 157206  //241214
    }).retries(3)

    it('Swap Arbitrage Gas：feeTo on, pairOwner fee off', async () => {
      // Approve router
      await tokenA.approve(router.address, constants.MaxUint256)
      await tokenB.approve(router.address, constants.MaxUint256)   
//    await router.connect(pairOwner).ManageFeswaPair(tokenIDMatch, constants.AddressZero, rateTriggerArbitrage) 
      await factory.setFeeTo(constants.AddressZero) 
  
      // Add liquidity to two pools
      const tokenAAmount = expandTo18Decimals(1000)
      const tokenBAmount = expandTo18Decimals(1000)
      const InitLiquidity = expandTo18Decimals(1000)
      await addLiquidityAAB(tokenAAmount, tokenBAmount)
      await addLiquidityABB(tokenAAmount, tokenBAmount)
  
      // Liquidity
      let LiquityWalletAB = await pairAAB.balanceOf(wallet.address)
      let LiquityWalletBA = await pairABB.balanceOf(wallet.address) 
      expect(LiquityWalletAB).to.eq(InitLiquidity.sub(MINIMUM_LIQUIDITY))
      expect(LiquityWalletBA).to.eq(InitLiquidity.sub(MINIMUM_LIQUIDITY))
  
      // Swap in and out amount 
      const swapAmount = expandTo18Decimals(10)
      await router.swapExactTokensForTokens(  swapAmount, 0, [tokenA.address, tokenB.address],
                                          wallet.address, constants.MaxUint256, overrides)

      await router.swapExactTokensForTokens(  swapAmount, 0, [tokenB.address, tokenA.address],
                                          wallet.address, constants.MaxUint256, overrides)

      const tx = await router.addLiquidity( {
                                              tokenA:         tokenA.address,
                                              tokenB:         tokenB.address,
                                              amountADesired: expandTo18Decimals(10),
                                              amountBDesired: expandTo18Decimals(20),
                                              amountAMin:     0,
                                              amountBMin:     0,
                                              ratio:          100,
                                            }, wallet.address, constants.MaxUint256, overrides  )
      
      const feeToAAB = await pairAAB.balanceOf(feeTo.address)
      const feeCreateAAB = await pairAAB.balanceOf(pairOwner.address)  
      expect(feeToAAB).to.eq(0)           
      expect(feeCreateAAB).to.not.eq(0)                         
                                    
      const receipt = await tx.wait()
      expect(receipt.gasUsed).to.eq(172258)      //  174826, 162822 157206  //241214
    }).retries(3)

    it('Swap Arbitrage Gas：feeTo on, pairOwner fee on', async () => {
      // Approve router
      await tokenA.approve(router.address, constants.MaxUint256)
      await tokenB.approve(router.address, constants.MaxUint256)   
//    await router.connect(pairOwner).ManageFeswaPair(tokenIDMatch, constants.AddressZero, rateTriggerArbitrage) 
//    await factory.setFeeTo(constants.AddressZero) 
  
      // Add liquidity to two pools
      const tokenAAmount = expandTo18Decimals(1000)
      const tokenBAmount = expandTo18Decimals(1000)
      const InitLiquidity = expandTo18Decimals(1000)
      await addLiquidityAAB(tokenAAmount, tokenBAmount)
      await addLiquidityABB(tokenAAmount, tokenBAmount)
  
      // Liquidity
      let LiquityWalletAB = await pairAAB.balanceOf(wallet.address)
      let LiquityWalletBA = await pairABB.balanceOf(wallet.address) 
      expect(LiquityWalletAB).to.eq(InitLiquidity.sub(MINIMUM_LIQUIDITY))
      expect(LiquityWalletBA).to.eq(InitLiquidity.sub(MINIMUM_LIQUIDITY))
  
      // Swap in and out amount 
      const swapAmount = expandTo18Decimals(10)
      await router.swapExactTokensForTokens(  swapAmount, 0, [tokenA.address, tokenB.address],
                                          wallet.address, constants.MaxUint256, overrides)

      await router.swapExactTokensForTokens(  swapAmount, 0, [tokenB.address, tokenA.address],
                                          wallet.address, constants.MaxUint256, overrides)

      const tx = await router.addLiquidity( {
                                              tokenA:         tokenA.address,
                                              tokenB:         tokenB.address,
                                              amountADesired: expandTo18Decimals(10),
                                              amountBDesired: expandTo18Decimals(20),
                                              amountAMin:     0,
                                              amountBMin:     0,
                                              ratio:          100,
                                            },  wallet.address, constants.MaxUint256, overrides  )
      
      const feeToAAB = await pairAAB.balanceOf(feeTo.address)
      const feeCreateAAB = await pairAAB.balanceOf(pairOwner.address)  
      expect(feeToAAB).to.not.eq(0)                 // "412534021180854"
      expect(feeCreateAAB).to.not.eq(0)             // "618801031771281"            
                                    
      const receipt = await tx.wait()
      expect(receipt.gasUsed).to.eq(196020)      //  206262 157206  //241214
    }).retries(3)

    it('Swap Arbitrage Gas comparsion', async () => {

      await tokenA.approve(router.address, constants.MaxUint256)
      await tokenB.approve(router.address, constants.MaxUint256)          
  
      const tokenAAmount = expandTo18Decimals(1000)
      const tokenBAmount = expandTo18Decimals(1000)
      await addLiquidityAAB(tokenAAmount, tokenBAmount)
      await addLiquidityABB(tokenAAmount, tokenBAmount)
  
      {
        const swapAmount = expandTo18Decimals(1)
        await router.swapExactTokensForTokens(  swapAmount, 0, [tokenA.address, tokenB.address],
                                                wallet.address, constants.MaxUint256, overrides )

        // No arbitrage triggerded                                        
        const tx = await router.swapExactTokensForTokens( swapAmount, 0,  [tokenB.address, tokenA.address],
                                                wallet.address, constants.MaxUint256,  overrides )
        const receipt = await tx.wait()
        expect(receipt.gasUsed).to.eq(136272)     // 94317 136321 136343 90889
      }
      {
        const swapAmount = expandTo18Decimals(10)
        await router.swapExactTokensForTokens(  swapAmount, 0, [tokenA.address, tokenB.address],
                                              wallet.address, constants.MaxUint256, overrides )
        // Arbitrage triggerded    
        const tx = await router.swapExactTokensForTokens( swapAmount, 0,  [tokenB.address, tokenA.address],
                                              wallet.address, constants.MaxUint256,  overrides )
        const receipt = await tx.wait()
        expect(receipt.gasUsed).to.eq(173866)   //  185915 173915 174757  //241214
      }
    }).retries(3)
})
