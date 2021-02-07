import chai, { expect } from 'chai'
import { Contract } from 'ethers'
import { AddressZero, Zero, Two, MaxUint256 } from 'ethers/constants'
import { solidity, MockProvider, createFixtureLoader } from 'ethereum-waffle'

import { BigNumberPercent, expandTo18Decimals, MINIMUM_LIQUIDITY } from './shared/utilities'
import { v2Fixture } from './shared/Routerfixtures'

chai.use(solidity)

const overrides = {
  gasLimit: 9999999
}

describe('FeSwapAddLiquidity', () => {
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
    beforeEach(async function() {
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
    })

    afterEach(async function() {
      expect(await provider.getBalance(router.address)).to.eq(Zero)
    })

    describe("FeSwapAddLiquidity Basic", () => {
      it('factory, WETH', async () => {
        expect(await router.factory()).to.eq(factory.address)
        expect(await router.WETH()).to.eq(WETH.address)
      })

      it('addLiquidity: Ration Error', async () => {
        const tokenAAmount = expandTo18Decimals(1)
        const tokenBAmount = expandTo18Decimals(4)

        await tokenA.approve(router.address, MaxUint256)
        await tokenB.approve(router.address, MaxUint256)
        await expect(
          router.addLiquidity(
            tokenA.address,
            tokenB.address,
            tokenAAmount,
            tokenBAmount,
            101,
            wallet.address,
            MaxUint256,
            overrides
          )
        ).to.be.revertedWith(
          'FeSwap: RATIO EER'
        )
      })  

      it('addLiquidityETH: Ration Error', async () => {
        const WETHPartnerAmount = expandTo18Decimals(100)
        const ETHAmount = expandTo18Decimals(4)

        await WETHPartner.approve(router.address, MaxUint256)
        await expect(
          router.addLiquidityETH(
            WETHPartner.address,
            WETHPartnerAmount,
            101,
            wallet.address,
            MaxUint256,
            { ...overrides, value: ETHAmount }
          )
        ).to.be.revertedWith(
          'FeSwap: RATIO EER'
        )
      })
    })

    describe( " Add Liquidity: Token A || Token B", () => {
      it('addLiquidity: 50-50', async () => {
        const tokenAAmount = expandTo18Decimals(1)
        const tokenBAmount = expandTo18Decimals(4)

        const expectedLiquidity = expandTo18Decimals(2)   
        await tokenA.approve(router.address, MaxUint256)
        await tokenB.approve(router.address, MaxUint256)
        await expect(
          router.addLiquidity(
            tokenA.address,
            tokenB.address,
            tokenAAmount.mul(Two),
            tokenBAmount.mul(Two),
            50,
            wallet.address,
            MaxUint256,
            overrides
          )
        )
          .to.emit(tokenA, 'Transfer')
          .withArgs(wallet.address, pairAAB.address, tokenAAmount)
          .to.emit(tokenB, 'Transfer')
          .withArgs(wallet.address, pairAAB.address, tokenBAmount)
          .to.emit(pairAAB, 'Transfer')
          .withArgs(AddressZero, AddressZero, MINIMUM_LIQUIDITY)
          .to.emit(pairAAB, 'Transfer')
          .withArgs(AddressZero, wallet.address, expectedLiquidity.sub(MINIMUM_LIQUIDITY))
          .to.emit(pairAAB, 'Sync')
          .withArgs(tokenAAmount, tokenBAmount)
          .to.emit(pairAAB, 'Mint')
          .withArgs(router.address, tokenAAmount, tokenBAmount)
          .to.emit(tokenA, 'Transfer')
          .withArgs(wallet.address, pairABB.address, tokenAAmount)
          .to.emit(tokenB, 'Transfer')
          .withArgs(wallet.address, pairABB.address, tokenBAmount)
          .to.emit(pairABB, 'Transfer')
          .withArgs(AddressZero, AddressZero, MINIMUM_LIQUIDITY)
          .to.emit(pairABB, 'Transfer')
          .withArgs(AddressZero, wallet.address, expectedLiquidity.sub(MINIMUM_LIQUIDITY))          
          .to.emit(pairABB, 'Sync')
          .withArgs(tokenBAmount, tokenAAmount)
          .to.emit(pairABB, 'Mint')
          .withArgs(router.address, tokenBAmount, tokenAAmount)

        expect(await pairAAB.balanceOf(wallet.address)).to.eq(expectedLiquidity.sub(MINIMUM_LIQUIDITY))
        expect(await pairABB.balanceOf(wallet.address)).to.eq(expectedLiquidity.sub(MINIMUM_LIQUIDITY))  
      })

      it('addLiquidity: 100-0', async () => {
        const tokenAAmount = expandTo18Decimals(1)
        const tokenBAmount = expandTo18Decimals(4)

        const expectedLiquidity = expandTo18Decimals(2)   
        await tokenA.approve(router.address, MaxUint256)
        await tokenB.approve(router.address, MaxUint256)
        await expect(
          router.addLiquidity(
            tokenA.address,
            tokenB.address,
            tokenAAmount,
            tokenBAmount,
            100,
            wallet.address,
            MaxUint256,
            overrides
          )
        )
          .to.emit(tokenA, 'Transfer')
          .withArgs(wallet.address, pairAAB.address, tokenAAmount)
          .to.emit(tokenB, 'Transfer')
          .withArgs(wallet.address, pairAAB.address, tokenBAmount)
          .to.emit(pairAAB, 'Transfer')
          .withArgs(AddressZero, AddressZero, MINIMUM_LIQUIDITY)
          .to.emit(pairAAB, 'Transfer')
          .withArgs(AddressZero, wallet.address, expectedLiquidity.sub(MINIMUM_LIQUIDITY))
          .to.emit(pairAAB, 'Sync')
          .withArgs(tokenAAmount, tokenBAmount)
          .to.emit(pairAAB, 'Mint')
          .withArgs(router.address, tokenAAmount, tokenBAmount)

        expect(await pairAAB.balanceOf(wallet.address)).to.eq(expectedLiquidity.sub(MINIMUM_LIQUIDITY))
        expect(await pairABB.balanceOf(wallet.address)).to.eq(Zero)   
      })

      it('addLiquidity: 0-100', async () => {
        const tokenAAmount = expandTo18Decimals(1)
        const tokenBAmount = expandTo18Decimals(4)

        const expectedLiquidity = expandTo18Decimals(2)   
        await tokenA.approve(router.address, MaxUint256)
        await tokenB.approve(router.address, MaxUint256)
        await expect(
          router.addLiquidity(
            tokenA.address,
            tokenB.address,
            tokenAAmount,
            tokenBAmount,
            0,
            wallet.address,
            MaxUint256,
            overrides
          )
        )
        .to.emit(tokenA, 'Transfer')
        .withArgs(wallet.address, pairABB.address, tokenAAmount)
        .to.emit(tokenB, 'Transfer')
        .withArgs(wallet.address, pairABB.address, tokenBAmount)
        .to.emit(pairABB, 'Transfer')
        .withArgs(AddressZero, AddressZero, MINIMUM_LIQUIDITY)
        .to.emit(pairABB, 'Transfer')
        .withArgs(AddressZero, wallet.address, expectedLiquidity.sub(MINIMUM_LIQUIDITY))          
        .to.emit(pairABB, 'Sync')
        .withArgs(tokenBAmount, tokenAAmount)
        .to.emit(pairABB, 'Mint')
        .withArgs(router.address, tokenBAmount, tokenAAmount)         

        expect(await pairAAB.balanceOf(wallet.address)).to.eq(Zero)
        expect(await pairABB.balanceOf(wallet.address)).to.eq(expectedLiquidity.sub(MINIMUM_LIQUIDITY))       
      })

      it('addLiquidity: 60-40', async () => {
        const tokenAAmount = expandTo18Decimals(1)
        const tokenBAmount = expandTo18Decimals(4)

        const ratio = 60
        const expectedLiquidity = expandTo18Decimals(2)   
        await tokenA.approve(router.address, MaxUint256)
        await tokenB.approve(router.address, MaxUint256)

        await expect(
          router.addLiquidity(
            tokenA.address,
            tokenB.address,
            tokenAAmount,
            tokenBAmount,
            ratio,
            wallet.address,
            MaxUint256,
            overrides
          )
        )
        .to.emit(tokenA, 'Transfer')
        .withArgs(wallet.address, pairAAB.address, BigNumberPercent(tokenAAmount,ratio))
        .to.emit(tokenB, 'Transfer')
        .withArgs(wallet.address, pairAAB.address, BigNumberPercent(tokenBAmount,ratio))
        .to.emit(pairAAB, 'Transfer')
        .withArgs(AddressZero, AddressZero, MINIMUM_LIQUIDITY)
        .to.emit(pairAAB, 'Transfer')
        .withArgs(AddressZero, wallet.address, BigNumberPercent(expectedLiquidity,ratio).sub(MINIMUM_LIQUIDITY))
        .to.emit(pairAAB, 'Sync')
        .withArgs(BigNumberPercent(tokenAAmount,ratio), BigNumberPercent(tokenBAmount,ratio))
        .to.emit(pairAAB, 'Mint')
        .withArgs(router.address, BigNumberPercent(tokenAAmount,ratio), BigNumberPercent(tokenBAmount,ratio))
        .to.emit(tokenA, 'Transfer')
        .withArgs(wallet.address, pairABB.address, BigNumberPercent(tokenAAmount, 100-ratio))
        .to.emit(tokenB, 'Transfer')
        .withArgs(wallet.address, pairABB.address, BigNumberPercent(tokenBAmount, 100-ratio))
        .to.emit(pairABB, 'Transfer')
        .withArgs(AddressZero, AddressZero, MINIMUM_LIQUIDITY)
        .to.emit(pairABB, 'Transfer')
        .withArgs(AddressZero, wallet.address, BigNumberPercent(expectedLiquidity, 100-ratio).sub(MINIMUM_LIQUIDITY))          
        .to.emit(pairABB, 'Sync')
        .withArgs(BigNumberPercent(tokenBAmount, 100-ratio), BigNumberPercent(tokenAAmount, 100-ratio))
        .to.emit(pairABB, 'Mint')
        .withArgs(router.address, BigNumberPercent(tokenBAmount, 100-ratio), BigNumberPercent(tokenAAmount, 100-ratio))

        expect(await pairAAB.balanceOf(wallet.address)).to.eq(BigNumberPercent(expectedLiquidity, ratio).sub(MINIMUM_LIQUIDITY))
        expect(await pairABB.balanceOf(wallet.address)).to.eq(BigNumberPercent(expectedLiquidity, 100-ratio).sub(MINIMUM_LIQUIDITY))

        // Add Liquidity Again, no MINIMUM_LIQUIDITY burned
        const ratioA = 73         // could be any ratio
        await expect(
          router.addLiquidity(
            tokenA.address,
            tokenB.address,
            tokenAAmount,
            tokenBAmount,
            ratioA,
            wallet.address,
            MaxUint256,
            overrides
          )
        )
        .to.emit(tokenA, 'Transfer')
        .withArgs(wallet.address, pairAAB.address, BigNumberPercent(tokenAAmount,ratioA))
        .to.emit(tokenB, 'Transfer')
        .withArgs(wallet.address, pairAAB.address, BigNumberPercent(tokenBAmount,ratioA))
        .to.emit(pairAAB, 'Transfer')
        .withArgs(AddressZero, wallet.address, BigNumberPercent(expectedLiquidity,ratioA))
        .to.emit(pairAAB, 'Sync')
        .withArgs(BigNumberPercent(tokenAAmount,ratio).add(BigNumberPercent(tokenAAmount,ratioA)), 
                  BigNumberPercent(tokenBAmount,ratio).add(BigNumberPercent(tokenBAmount,ratioA)))
        .to.emit(pairAAB, 'Mint')
        .withArgs(router.address, BigNumberPercent(tokenAAmount,ratioA), BigNumberPercent(tokenBAmount,ratioA))
        .to.emit(tokenA, 'Transfer')
        .withArgs(wallet.address, pairABB.address, BigNumberPercent(tokenAAmount, 100-ratioA))
        .to.emit(tokenB, 'Transfer')
        .withArgs(wallet.address, pairABB.address, BigNumberPercent(tokenBAmount, 100-ratioA))
        .to.emit(pairABB, 'Transfer')
        .withArgs(AddressZero, wallet.address, BigNumberPercent(expectedLiquidity, 100-ratioA))          
        .to.emit(pairABB, 'Sync')
        .withArgs(BigNumberPercent(tokenBAmount, 100-ratioA).add(BigNumberPercent(tokenBAmount, 100-ratio)), 
                  BigNumberPercent(tokenAAmount, 100-ratioA).add(BigNumberPercent(tokenAAmount, 100-ratio)))
        .to.emit(pairABB, 'Mint')
        .withArgs(router.address, BigNumberPercent(tokenBAmount, 100-ratioA), BigNumberPercent(tokenAAmount, 100-ratioA))

        expect(await pairAAB.balanceOf(wallet.address)).to.eq(BigNumberPercent(expectedLiquidity, ratioA)
                      .add(BigNumberPercent(expectedLiquidity, ratio)).sub(MINIMUM_LIQUIDITY))
        expect(await pairABB.balanceOf(wallet.address)).to.eq(BigNumberPercent(expectedLiquidity, 100-ratioA)
                      .add(BigNumberPercent(expectedLiquidity, 100-ratio)).sub(MINIMUM_LIQUIDITY))
                    
      })

      it('Add Liquidity GAS usage： Single Pool ', async () => {
        const tokenAAmount = expandTo18Decimals(1)
        const tokenBAmount = expandTo18Decimals(4)

        const ratio = 100
        await tokenA.approve(router.address, MaxUint256)
        await tokenB.approve(router.address, MaxUint256)
        const tx = await router.addLiquidity(
            tokenA.address,
            tokenB.address,
            tokenAAmount,
            tokenBAmount,
            ratio,
            wallet.address,
            MaxUint256,
            overrides
          )

        const receipt = await tx.wait()
        expect(receipt.gasUsed).to.eq(233241)    // 229016, 228994  Uniswap 213957
      }).retries(3)

      it('Add Liquidity GAS usage： Double Pool ', async () => {
        const tokenAAmount = expandTo18Decimals(1)
        const tokenBAmount = expandTo18Decimals(4)

        const ratio = 70
        await tokenA.approve(router.address, MaxUint256)
        await tokenB.approve(router.address, MaxUint256)
        const tx = await router.addLiquidity(
            tokenA.address,
            tokenB.address,
            tokenAAmount,
            tokenBAmount,
            ratio,
            wallet.address,
            MaxUint256,
            overrides
          )

        const receipt = await tx.wait()
        expect(receipt.gasUsed).to.eq(433922)    // 425472, 425406
      }).retries(3)

    })

    describe( " Add Liquidity ETH: Token || ETH ", () => {
      it('addLiquidityETH: 50-50', async () => {
        const WETHPartnerAmount = expandTo18Decimals(100)
        const ETHAmount = expandTo18Decimals(4)

        const expectedLiquidity = expandTo18Decimals(20)
        await WETHPartner.approve(router.address, MaxUint256)
        await expect(
          router.addLiquidityETH(
            WETHPartner.address,
            WETHPartnerAmount.mul(Two),
            50,
            wallet.address,
            MaxUint256,
            { ...overrides, value: ETHAmount.mul(Two) }
          )
        )
          .to.emit(WETHPartner, 'Transfer')
          .withArgs(wallet.address, WETHPairTTE.address, WETHPartnerAmount)
          .to.emit(WETH, 'Deposit')
          .withArgs(router.address, ETHAmount)
          .to.emit(WETH, 'Transfer')
          .withArgs(router.address, WETHPairTTE.address, ETHAmount)
          .to.emit(WETHPairTTE, 'Transfer')
          .withArgs(AddressZero, AddressZero, MINIMUM_LIQUIDITY)
          .to.emit(WETHPairTTE, 'Transfer')
          .withArgs(AddressZero, wallet.address, expectedLiquidity.sub(MINIMUM_LIQUIDITY))
          .to.emit(WETHPairTTE, 'Sync')
          .withArgs(WETHPartnerAmount, ETHAmount)
          .to.emit(WETHPairTTE, 'Mint')
          .withArgs(router.address, WETHPartnerAmount, ETHAmount)
          .to.emit(WETHPartner, 'Transfer')
          .withArgs(wallet.address, WETHPairTEE.address, WETHPartnerAmount)
          .to.emit(WETH, 'Deposit')
          .withArgs(router.address, ETHAmount)
          .to.emit(WETH, 'Transfer')
          .withArgs(router.address, WETHPairTEE.address, ETHAmount)
          .to.emit(WETHPairTEE, 'Transfer')
          .withArgs(AddressZero, AddressZero, MINIMUM_LIQUIDITY)
          .to.emit(WETHPairTEE, 'Transfer')
          .withArgs(AddressZero, wallet.address, expectedLiquidity.sub(MINIMUM_LIQUIDITY))
          .to.emit(WETHPairTEE, 'Sync')
          .withArgs(ETHAmount, WETHPartnerAmount)
          .to.emit(WETHPairTEE, 'Mint')
          .withArgs(router.address,ETHAmount, WETHPartnerAmount)

        expect(await WETHPairTTE.balanceOf(wallet.address)).to.eq(expectedLiquidity.sub(MINIMUM_LIQUIDITY))
        expect(await WETHPairTEE.balanceOf(wallet.address)).to.eq(expectedLiquidity.sub(MINIMUM_LIQUIDITY))
      })

      it('addLiquidityETH: 100-0', async () => {
        const WETHPartnerAmount = expandTo18Decimals(100)
        const ETHAmount = expandTo18Decimals(4)

        const expectedLiquidity = expandTo18Decimals(20)
        await WETHPartner.approve(router.address, MaxUint256)
        await expect(
          router.addLiquidityETH(
            WETHPartner.address,
            WETHPartnerAmount,
            100,
            wallet.address,
            MaxUint256,
            { ...overrides, value: ETHAmount }
          )
        )
          .to.emit(WETHPartner, 'Transfer')
          .withArgs(wallet.address, WETHPairTTE.address, WETHPartnerAmount)
          .to.emit(WETH, 'Deposit')
          .withArgs(router.address, ETHAmount)
          .to.emit(WETH, 'Transfer')
          .withArgs(router.address, WETHPairTTE.address, ETHAmount)
          .to.emit(WETHPairTTE, 'Transfer')
          .withArgs(AddressZero, AddressZero, MINIMUM_LIQUIDITY)
          .to.emit(WETHPairTTE, 'Transfer')
          .withArgs(AddressZero, wallet.address, expectedLiquidity.sub(MINIMUM_LIQUIDITY))
          .to.emit(WETHPairTTE, 'Sync')
          .withArgs(WETHPartnerAmount,ETHAmount)
          .to.emit(WETHPairTTE, 'Mint')
          .withArgs(router.address,WETHPartnerAmount,ETHAmount)
 
        expect(await WETHPairTTE.balanceOf(wallet.address)).to.eq(expectedLiquidity.sub(MINIMUM_LIQUIDITY))
        expect(await WETHPairTEE.balanceOf(wallet.address)).to.eq(Zero)
      })      

      it('addLiquidityETH: 0-100', async () => {
        const WETHPartnerAmount = expandTo18Decimals(100)
        const ETHAmount = expandTo18Decimals(4)

        const expectedLiquidity = expandTo18Decimals(20)
        await WETHPartner.approve(router.address, MaxUint256)
        await expect(
          router.addLiquidityETH(
            WETHPartner.address,
            WETHPartnerAmount,
            0,
            wallet.address,
            MaxUint256,
            { ...overrides, value: ETHAmount }
          )
        )
          .to.emit(WETHPartner, 'Transfer')
          .withArgs(wallet.address, WETHPairTEE.address, WETHPartnerAmount)
          .to.emit(WETH, 'Deposit')
          .withArgs(router.address, ETHAmount)
          .to.emit(WETH, 'Transfer')
          .withArgs(router.address, WETHPairTEE.address, ETHAmount)          
          .to.emit(WETHPairTEE, 'Transfer')
          .withArgs(AddressZero, AddressZero, MINIMUM_LIQUIDITY)
          .to.emit(WETHPairTEE, 'Transfer')
          .withArgs(AddressZero, wallet.address, expectedLiquidity.sub(MINIMUM_LIQUIDITY))
          .to.emit(WETHPairTEE, 'Sync')
          .withArgs(ETHAmount, WETHPartnerAmount)
          .to.emit(WETHPairTEE, 'Mint')
          .withArgs(router.address,ETHAmount, WETHPartnerAmount)

        expect(await WETHPairTTE.balanceOf(wallet.address)).to.eq(Zero)
        expect(await WETHPairTEE.balanceOf(wallet.address)).to.eq(expectedLiquidity.sub(MINIMUM_LIQUIDITY))
      })

      it('addLiquidityETH: 30-70', async () => {
        const WETHPartnerAmount = expandTo18Decimals(100)
        const ETHAmount = expandTo18Decimals(4)

        const ratio = 30
        const expectedLiquidity = expandTo18Decimals(20)
        await WETHPartner.approve(router.address, MaxUint256)

        await expect(
          router.addLiquidityETH(
            WETHPartner.address,
            WETHPartnerAmount,
            ratio,
            wallet.address,
            MaxUint256,
            { ...overrides, value: ETHAmount }
          )
        )
          .to.emit(WETHPartner, 'Transfer')
          .withArgs(wallet.address, WETHPairTTE.address, BigNumberPercent(WETHPartnerAmount,ratio))
          .to.emit(WETH, 'Deposit')
          .withArgs(router.address, BigNumberPercent(ETHAmount,ratio))
          .to.emit(WETH, 'Transfer')
          .withArgs(router.address, WETHPairTTE.address, BigNumberPercent(ETHAmount,ratio))             
          .to.emit(WETHPairTTE, 'Transfer')
          .withArgs(AddressZero, AddressZero, MINIMUM_LIQUIDITY)
          .to.emit(WETHPairTTE, 'Transfer')
          .withArgs(AddressZero, wallet.address, BigNumberPercent(expectedLiquidity,ratio).sub(MINIMUM_LIQUIDITY))
          .to.emit(WETHPairTTE, 'Sync')
          .withArgs(BigNumberPercent(WETHPartnerAmount,ratio),BigNumberPercent(ETHAmount,ratio))
          .to.emit(WETHPairTTE, 'Mint')
          .withArgs(router.address,BigNumberPercent(WETHPartnerAmount,ratio),BigNumberPercent(ETHAmount,ratio))
          .to.emit(WETHPartner, 'Transfer')
          .withArgs(wallet.address, WETHPairTEE.address, BigNumberPercent(WETHPartnerAmount,100-ratio))
          .to.emit(WETH, 'Deposit')
          .withArgs(router.address, BigNumberPercent(ETHAmount,100-ratio))
          .to.emit(WETH, 'Transfer')
          .withArgs(router.address, WETHPairTEE.address, BigNumberPercent(ETHAmount,100-ratio))   
          .to.emit(WETHPairTEE, 'Transfer')
          .withArgs(AddressZero, AddressZero, MINIMUM_LIQUIDITY)
          .to.emit(WETHPairTEE, 'Transfer')
          .withArgs(AddressZero, wallet.address, BigNumberPercent(expectedLiquidity,100-ratio).sub(MINIMUM_LIQUIDITY))
          .to.emit(WETHPairTEE, 'Sync')
          .withArgs(BigNumberPercent(ETHAmount,100-ratio), BigNumberPercent(WETHPartnerAmount,100-ratio))
          .to.emit(WETHPairTEE, 'Mint')
          .withArgs(router.address,BigNumberPercent(ETHAmount,100-ratio),BigNumberPercent(WETHPartnerAmount,100-ratio))

        expect(await WETHPairTTE.balanceOf(wallet.address)).to.eq(BigNumberPercent(expectedLiquidity,ratio).sub(MINIMUM_LIQUIDITY))
        expect(await WETHPairTEE.balanceOf(wallet.address)).to.eq(BigNumberPercent(expectedLiquidity,100-ratio).sub(MINIMUM_LIQUIDITY))

        const ratioA = 30
        await expect(
          router.addLiquidityETH(
            WETHPartner.address,
            WETHPartnerAmount,
            ratioA,
            wallet.address,
            MaxUint256,
            { ...overrides, value: ETHAmount }
          )
        )
          .to.emit(WETHPartner, 'Transfer')
          .withArgs(wallet.address, WETHPairTTE.address, BigNumberPercent(WETHPartnerAmount,ratioA))
          .to.emit(WETH, 'Deposit')
          .withArgs(router.address, BigNumberPercent(ETHAmount,ratioA))
          .to.emit(WETH, 'Transfer')
          .withArgs(router.address, WETHPairTTE.address, BigNumberPercent(ETHAmount,ratioA))             
          .to.emit(WETHPairTTE, 'Transfer')
          .withArgs(AddressZero, wallet.address, BigNumberPercent(expectedLiquidity, ratioA))
          .to.emit(WETHPairTTE, 'Sync')
          .withArgs(BigNumberPercent(WETHPartnerAmount,ratioA).add(BigNumberPercent(WETHPartnerAmount,ratio)),
                    BigNumberPercent(ETHAmount,ratioA).add(BigNumberPercent(ETHAmount,ratio)))
          .to.emit(WETHPairTTE, 'Mint')
          .withArgs(router.address,BigNumberPercent(WETHPartnerAmount,ratioA),BigNumberPercent(ETHAmount,ratioA))
          .to.emit(WETHPartner, 'Transfer')
          .withArgs(wallet.address, WETHPairTEE.address, BigNumberPercent(WETHPartnerAmount,100-ratioA))
          .to.emit(WETH, 'Deposit')
          .withArgs(router.address, BigNumberPercent(ETHAmount,100-ratioA))
          .to.emit(WETH, 'Transfer')
          .withArgs(router.address, WETHPairTEE.address, BigNumberPercent(ETHAmount,100-ratioA))   
          .to.emit(WETHPairTEE, 'Transfer')
          .withArgs(AddressZero, wallet.address, BigNumberPercent(expectedLiquidity,100-ratioA))
          .to.emit(WETHPairTEE, 'Sync')
          .withArgs(BigNumberPercent(ETHAmount,100-ratioA).add(BigNumberPercent(ETHAmount,100-ratio)), 
                    BigNumberPercent(WETHPartnerAmount,100-ratioA).add(BigNumberPercent(WETHPartnerAmount,100-ratio)))
          .to.emit(WETHPairTEE, 'Mint')
          .withArgs(router.address,BigNumberPercent(ETHAmount,100-ratioA),BigNumberPercent(WETHPartnerAmount,100-ratioA))

        expect(await WETHPairTTE.balanceOf(wallet.address)).to.eq(BigNumberPercent(expectedLiquidity,ratioA)
                      .add(BigNumberPercent(expectedLiquidity,ratio)).sub(MINIMUM_LIQUIDITY))
        expect(await WETHPairTEE.balanceOf(wallet.address)).to.eq(BigNumberPercent(expectedLiquidity,100-ratioA)
                      .add(BigNumberPercent(expectedLiquidity,100-ratio)).sub(MINIMUM_LIQUIDITY))
      })

      it('Add-Liquidity-ETH GAS usage： Single Pool ', async () => {
        const WETHPartnerAmount = expandTo18Decimals(100)
        const ETHAmount = expandTo18Decimals(4)

        const ratio = 0
        await WETHPartner.approve(router.address, MaxUint256)
        const tx = await router.addLiquidityETH(
            WETHPartner.address,
            WETHPartnerAmount,
            ratio,
            wallet.address,
            MaxUint256,
            { ...overrides, value: ETHAmount }
          )

        const receipt = await tx.wait()
        expect(receipt.gasUsed).to.eq(239993)    // 235746, Uniswap 220495
      }).retries(3)

      it('Add-Liquidity-ETH GAS usage： Double Pool ', async () => {
        const WETHPartnerAmount = expandTo18Decimals(100)
        const ETHAmount = expandTo18Decimals(4)

        const ratio = 40
        await WETHPartner.approve(router.address, MaxUint256)
        const tx = await router.addLiquidityETH(
            WETHPartner.address,
            WETHPartnerAmount,
            ratio,
            wallet.address,
            MaxUint256,
            { ...overrides, value: ETHAmount }
          )

        const receipt = await tx.wait()
        expect(receipt.gasUsed).to.eq(452311)  //443839,  443817
      }).retries(3)

    })  
})
