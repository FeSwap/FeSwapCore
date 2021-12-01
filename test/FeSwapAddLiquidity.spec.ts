import chai, { expect } from 'chai'
import { Contract, constants, utils } from 'ethers'
import { solidity, MockProvider, createFixtureLoader } from 'ethereum-waffle'

import { BigNumberPercent, expandTo18Decimals, MINIMUM_LIQUIDITY, getFeSwapCodeHash } from './shared/utilities'
import { v2Fixture } from './shared/Routerfixtures'

chai.use(solidity)

const overrides = {
  gasLimit: 9999999
}

describe('FeSwapAddLiquidity', () => {
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
    beforeEach(async function() {
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
    })

    afterEach(async function() {
      expect(await provider.getBalance(router.address)).to.eq(constants.Zero)
    })

    it('FeSwapAddLiquidity Get Feswap pair Code Hash', async () => {
      getFeSwapCodeHash()
    })

    describe("FeSwapAddLiquidity Basic", () => {
      it('addLiquidity: Ration Error', async () => {
        const tokenAAmount = expandTo18Decimals(1)
        const tokenBAmount = expandTo18Decimals(4)

        await tokenA.approve(router.address, constants.MaxUint256)
        await tokenB.approve(router.address, constants.MaxUint256)
        await expect(
          router.addLiquidity(
            {
              tokenA:         tokenA.address,
              tokenB:         tokenB.address,
              amountADesired: tokenAAmount,
              amountBDesired: tokenBAmount,
              amountAMin:     0,
              amountBMin:     0,
              ratio:          101,
            },
            wallet.address,
            constants.MaxUint256,
            overrides
          )
        ).to.be.revertedWith(
          'FeSwap: RATIO EER'
        )
      })  

      it('addLiquidityETH: Ration Error', async () => {
        const WETHPartnerAmount = expandTo18Decimals(100)
        const ETHAmount = expandTo18Decimals(4)

        await WETHPartner.approve(router.address, constants.MaxUint256)
        await expect(
          router.addLiquidityETH(
            {
              token:              WETHPartner.address,
              amountTokenDesired: WETHPartnerAmount,
              amountTokenMin:     0,
              amountETHMin:       0,
              ratio:              101,
            },
            wallet.address,
            constants.MaxUint256,
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
        await tokenA.approve(router.address, constants.MaxUint256)
        await tokenB.approve(router.address, constants.MaxUint256)
        await expect(
          router.addLiquidity(
            {
              tokenA:         tokenA.address,
              tokenB:         tokenB.address,
              amountADesired: tokenAAmount.mul(constants.Two),
              amountBDesired: tokenBAmount.mul(constants.Two),
              amountAMin:     tokenAAmount.mul(constants.Two),
              amountBMin:     tokenAAmount.mul(constants.Two),
              ratio:          50,
            },
            wallet.address,
            constants.MaxUint256,
            overrides
          )
        )
          .to.emit(tokenA, 'Transfer')
          .withArgs(wallet.address, pairAAB.address, tokenAAmount)
          .to.emit(tokenB, 'Transfer')
          .withArgs(wallet.address, pairAAB.address, tokenBAmount)
          .to.emit(pairAAB, 'Transfer')
          .withArgs(constants.AddressZero, constants.AddressZero, MINIMUM_LIQUIDITY)
          .to.emit(pairAAB, 'Transfer')
          .withArgs(constants.AddressZero, wallet.address, expectedLiquidity.sub(MINIMUM_LIQUIDITY))
          .to.emit(pairAAB, 'Sync')
          .withArgs(tokenAAmount, tokenBAmount)
          .to.emit(pairAAB, 'Mint')
          .withArgs(router.address, tokenAAmount, tokenBAmount)
          .to.emit(tokenA, 'Transfer')
          .withArgs(wallet.address, pairABB.address, tokenAAmount)
          .to.emit(tokenB, 'Transfer')
          .withArgs(wallet.address, pairABB.address, tokenBAmount)
          .to.emit(pairABB, 'Transfer')
          .withArgs(constants.AddressZero, constants.AddressZero, MINIMUM_LIQUIDITY)
          .to.emit(pairABB, 'Transfer')
          .withArgs(constants.AddressZero, wallet.address, expectedLiquidity.sub(MINIMUM_LIQUIDITY))          
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
        await tokenA.approve(router.address, constants.MaxUint256)
        await tokenB.approve(router.address, constants.MaxUint256)
        await expect(
          router.addLiquidity(
            {
              tokenA:         tokenA.address,
              tokenB:         tokenB.address,
              amountADesired: tokenAAmount,
              amountBDesired: tokenBAmount,
              amountAMin:     0,
              amountBMin:     0,
              ratio:          100,
            },
            wallet.address,
            constants.MaxUint256,
            overrides
          )
        )
          .to.emit(tokenA, 'Transfer')
          .withArgs(wallet.address, pairAAB.address, tokenAAmount)
          .to.emit(tokenB, 'Transfer')
          .withArgs(wallet.address, pairAAB.address, tokenBAmount)
          .to.emit(pairAAB, 'Transfer')
          .withArgs(constants.AddressZero, constants.AddressZero, MINIMUM_LIQUIDITY)
          .to.emit(pairAAB, 'Transfer')
          .withArgs(constants.AddressZero, wallet.address, expectedLiquidity.sub(MINIMUM_LIQUIDITY))
          .to.emit(pairAAB, 'Sync')
          .withArgs(tokenAAmount, tokenBAmount)
          .to.emit(pairAAB, 'Mint')
          .withArgs(router.address, tokenAAmount, tokenBAmount)

        expect(await pairAAB.balanceOf(wallet.address)).to.eq(expectedLiquidity.sub(MINIMUM_LIQUIDITY))
        expect(await pairABB.balanceOf(wallet.address)).to.eq(constants.Zero)   
      })

      it('addLiquidity: 0-100', async () => {
        const tokenAAmount = expandTo18Decimals(1)
        const tokenBAmount = expandTo18Decimals(4)

        const expectedLiquidity = expandTo18Decimals(2)   
        await tokenA.approve(router.address, constants.MaxUint256)
        await tokenB.approve(router.address, constants.MaxUint256)
        await expect(
          router.addLiquidity(
            {
              tokenA:         tokenA.address,
              tokenB:         tokenB.address,
              amountADesired: tokenAAmount,
              amountBDesired: tokenBAmount,
              amountAMin:     tokenAAmount,
              amountBMin:     tokenBAmount,
              ratio:          0,
            },
            wallet.address,
            constants.MaxUint256,
            overrides
          )
        )
        .to.emit(tokenA, 'Transfer')
        .withArgs(wallet.address, pairABB.address, tokenAAmount)
        .to.emit(tokenB, 'Transfer')
        .withArgs(wallet.address, pairABB.address, tokenBAmount)
        .to.emit(pairABB, 'Transfer')
        .withArgs(constants.AddressZero, constants.AddressZero, MINIMUM_LIQUIDITY)
        .to.emit(pairABB, 'Transfer')
        .withArgs(constants.AddressZero, wallet.address, expectedLiquidity.sub(MINIMUM_LIQUIDITY))          
        .to.emit(pairABB, 'Sync')
        .withArgs(tokenBAmount, tokenAAmount)
        .to.emit(pairABB, 'Mint')
        .withArgs(router.address, tokenBAmount, tokenAAmount)         

        expect(await pairAAB.balanceOf(wallet.address)).to.eq(constants.Zero)
        expect(await pairABB.balanceOf(wallet.address)).to.eq(expectedLiquidity.sub(MINIMUM_LIQUIDITY))       
      })

      it('addLiquidity: 60-40', async () => {
        const tokenAAmount = expandTo18Decimals(1)
        const tokenBAmount = expandTo18Decimals(4)

        const ratio = 60
        const expectedLiquidity = expandTo18Decimals(2)   
        await tokenA.approve(router.address, constants.MaxUint256)
        await tokenB.approve(router.address, constants.MaxUint256)

        await expect(
          router.addLiquidity(
            {
              tokenA:         tokenA.address,
              tokenB:         tokenB.address,
              amountADesired: tokenAAmount,
              amountBDesired: tokenBAmount,
              amountAMin:     tokenAAmount,
              amountBMin:     tokenBAmount,
              ratio,
            },
            wallet.address,
            constants.MaxUint256,
            overrides
          )
        )
        .to.emit(tokenA, 'Transfer')
        .withArgs(wallet.address, pairAAB.address, BigNumberPercent(tokenAAmount,ratio))
        .to.emit(tokenB, 'Transfer')
        .withArgs(wallet.address, pairAAB.address, BigNumberPercent(tokenBAmount,ratio))
        .to.emit(pairAAB, 'Transfer')
        .withArgs(constants.AddressZero, constants.AddressZero, MINIMUM_LIQUIDITY)
        .to.emit(pairAAB, 'Transfer')
        .withArgs(constants.AddressZero, wallet.address, BigNumberPercent(expectedLiquidity,ratio).sub(MINIMUM_LIQUIDITY))
        .to.emit(pairAAB, 'Sync')
        .withArgs(BigNumberPercent(tokenAAmount,ratio), BigNumberPercent(tokenBAmount,ratio))
        .to.emit(pairAAB, 'Mint')
        .withArgs(router.address, BigNumberPercent(tokenAAmount,ratio), BigNumberPercent(tokenBAmount,ratio))
        .to.emit(tokenA, 'Transfer')
        .withArgs(wallet.address, pairABB.address, BigNumberPercent(tokenAAmount, 100-ratio))
        .to.emit(tokenB, 'Transfer')
        .withArgs(wallet.address, pairABB.address, BigNumberPercent(tokenBAmount, 100-ratio))
        .to.emit(pairABB, 'Transfer')
        .withArgs(constants.AddressZero, constants.AddressZero, MINIMUM_LIQUIDITY)
        .to.emit(pairABB, 'Transfer')
        .withArgs(constants.AddressZero, wallet.address, BigNumberPercent(expectedLiquidity, 100-ratio).sub(MINIMUM_LIQUIDITY))          
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
            {
              tokenA:         tokenA.address,
              tokenB:         tokenB.address,
              amountADesired: tokenAAmount,
              amountBDesired: tokenBAmount,
              amountAMin:     tokenAAmount,
              amountBMin:     tokenBAmount,
              ratio:          ratioA
            },
            wallet.address,
            constants.MaxUint256,
            overrides
          )
        )
        .to.emit(tokenA, 'Transfer')
        .withArgs(wallet.address, pairAAB.address, BigNumberPercent(tokenAAmount,ratioA))
        .to.emit(tokenB, 'Transfer')
        .withArgs(wallet.address, pairAAB.address, BigNumberPercent(tokenBAmount,ratioA))
        .to.emit(pairAAB, 'Transfer')
        .withArgs(constants.AddressZero, wallet.address, BigNumberPercent(expectedLiquidity,ratioA))
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
        .withArgs(constants.AddressZero, wallet.address, BigNumberPercent(expectedLiquidity, 100-ratioA))          
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
        await tokenA.approve(router.address, constants.MaxUint256)
        await tokenB.approve(router.address, constants.MaxUint256)
        const tx = await router.addLiquidity(
            {
              tokenA:         tokenA.address,
              tokenB:         tokenB.address,
              amountADesired: tokenAAmount,
              amountBDesired: tokenBAmount,
              amountAMin:     tokenAAmount,
              amountBMin:     tokenBAmount,
              ratio:          ratio
            },
            wallet.address,
            constants.MaxUint256,
            overrides
          )

        const receipt = await tx.wait()
        expect(receipt.gasUsed).to.eq("230339")    // 230346 230981 230988 232632 232639 232654 232683  232618 233577 234377 234456 236182 236131 236108 238676 238686, 228994  Uniswap 213957
      })

      it('Add Liquidity GAS usage： Double Pool ', async () => {
        const tokenAAmount = expandTo18Decimals(1)
        const tokenBAmount = expandTo18Decimals(4)

        const ratio = 70
        await tokenA.approve(router.address, constants.MaxUint256)
        await tokenB.approve(router.address, constants.MaxUint256)
        const tx = await router.addLiquidity(
            {
              tokenA:         tokenA.address,
              tokenB:         tokenB.address,
              amountADesired: tokenAAmount,
              amountBDesired: tokenBAmount,
              amountAMin:     tokenAAmount,
              amountBMin:     tokenBAmount,
              ratio:          ratio
            },
            wallet.address,
            constants.MaxUint256,
            overrides
          )

        const receipt = await tx.wait()
        expect(receipt.gasUsed).to.eq("427086")    // 427093 428358 428365  431658 431665 431702 431753 431623 433541 435141 435299 438763 438668 438622 443746 443722, 425406
      })
    })

    describe( " Add Liquidity ETH: Token || ETH ", () => {
      it('addLiquidityETH: 50-50', async () => {
        const WETHPartnerAmount = expandTo18Decimals(100)
        const ETHAmount = expandTo18Decimals(4)

        const expectedLiquidity = expandTo18Decimals(20)
        await WETHPartner.approve(router.address, constants.MaxUint256)
        await expect(
          router.addLiquidityETH(
            {
              token:              WETHPartner.address,
              amountTokenDesired: WETHPartnerAmount.mul(constants.Two),
              amountTokenMin:     0,
              amountETHMin:       0,
              ratio:              50,
            },
            wallet.address,
            constants.MaxUint256,
            { ...overrides, value: ETHAmount.mul(constants.Two) }
          )
        )
          .to.emit(WETHPartner, 'Transfer')
          .withArgs(wallet.address, WETHPairTTE.address, WETHPartnerAmount)
          .to.emit(WETH, 'Deposit')
          .withArgs(router.address, ETHAmount)
          .to.emit(WETH, 'Transfer')
          .withArgs(router.address, WETHPairTTE.address, ETHAmount)
          .to.emit(WETHPairTTE, 'Transfer')
          .withArgs(constants.AddressZero, constants.AddressZero, MINIMUM_LIQUIDITY)
          .to.emit(WETHPairTTE, 'Transfer')
          .withArgs(constants.AddressZero, wallet.address, expectedLiquidity.sub(MINIMUM_LIQUIDITY))
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
          .withArgs(constants.AddressZero, constants.AddressZero, MINIMUM_LIQUIDITY)
          .to.emit(WETHPairTEE, 'Transfer')
          .withArgs(constants.AddressZero, wallet.address, expectedLiquidity.sub(MINIMUM_LIQUIDITY))
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
        await WETHPartner.approve(router.address, constants.MaxUint256)
        await expect(
          router.addLiquidityETH(
            {
              token:              WETHPartner.address,
              amountTokenDesired: WETHPartnerAmount,
              amountTokenMin:     WETHPartnerAmount,
              amountETHMin:       ETHAmount,
              ratio:              100,
            },
            wallet.address,
            constants.MaxUint256,
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
          .withArgs(constants.AddressZero, constants.AddressZero, MINIMUM_LIQUIDITY)
          .to.emit(WETHPairTTE, 'Transfer')
          .withArgs(constants.AddressZero, wallet.address, expectedLiquidity.sub(MINIMUM_LIQUIDITY))
          .to.emit(WETHPairTTE, 'Sync')
          .withArgs(WETHPartnerAmount,ETHAmount)
          .to.emit(WETHPairTTE, 'Mint')
          .withArgs(router.address,WETHPartnerAmount,ETHAmount)
 
        expect(await WETHPairTTE.balanceOf(wallet.address)).to.eq(expectedLiquidity.sub(MINIMUM_LIQUIDITY))
        expect(await WETHPairTEE.balanceOf(wallet.address)).to.eq(constants.Zero)
      })      

      it('addLiquidityETH: 0-100', async () => {
        const WETHPartnerAmount = expandTo18Decimals(100)
        const ETHAmount = expandTo18Decimals(4)

        const expectedLiquidity = expandTo18Decimals(20)
        await WETHPartner.approve(router.address, constants.MaxUint256)
        await expect(
          router.addLiquidityETH(
            {
              token:              WETHPartner.address,
              amountTokenDesired: WETHPartnerAmount,
              amountTokenMin:     WETHPartnerAmount,
              amountETHMin:       ETHAmount,
              ratio:              0,
            },
            wallet.address,
            constants.MaxUint256,
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
          .withArgs(constants.AddressZero, constants.AddressZero, MINIMUM_LIQUIDITY)
          .to.emit(WETHPairTEE, 'Transfer')
          .withArgs(constants.AddressZero, wallet.address, expectedLiquidity.sub(MINIMUM_LIQUIDITY))
          .to.emit(WETHPairTEE, 'Sync')
          .withArgs(ETHAmount, WETHPartnerAmount)
          .to.emit(WETHPairTEE, 'Mint')
          .withArgs(router.address,ETHAmount, WETHPartnerAmount)

        expect(await WETHPairTTE.balanceOf(wallet.address)).to.eq(constants.Zero)
        expect(await WETHPairTEE.balanceOf(wallet.address)).to.eq(expectedLiquidity.sub(MINIMUM_LIQUIDITY))
      })

      it('addLiquidityETH: 30-70', async () => {
        const WETHPartnerAmount = expandTo18Decimals(100)
        const ETHAmount = expandTo18Decimals(4)

        const ratio = 30
        const expectedLiquidity = expandTo18Decimals(20)
        await WETHPartner.approve(router.address, constants.MaxUint256)

        await expect(
          router.addLiquidityETH(
            {
              token:              WETHPartner.address,
              amountTokenDesired: WETHPartnerAmount,
              amountTokenMin:     WETHPartnerAmount,
              amountETHMin:       ETHAmount,
              ratio:              ratio,
            },
            wallet.address,
            constants.MaxUint256,
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
          .withArgs(constants.AddressZero, constants.AddressZero, MINIMUM_LIQUIDITY)
          .to.emit(WETHPairTTE, 'Transfer')
          .withArgs(constants.AddressZero, wallet.address, BigNumberPercent(expectedLiquidity,ratio).sub(MINIMUM_LIQUIDITY))
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
          .withArgs(constants.AddressZero, constants.AddressZero, MINIMUM_LIQUIDITY)
          .to.emit(WETHPairTEE, 'Transfer')
          .withArgs(constants.AddressZero, wallet.address, BigNumberPercent(expectedLiquidity,100-ratio).sub(MINIMUM_LIQUIDITY))
          .to.emit(WETHPairTEE, 'Sync')
          .withArgs(BigNumberPercent(ETHAmount,100-ratio), BigNumberPercent(WETHPartnerAmount,100-ratio))
          .to.emit(WETHPairTEE, 'Mint')
          .withArgs(router.address,BigNumberPercent(ETHAmount,100-ratio),BigNumberPercent(WETHPartnerAmount,100-ratio))

        expect(await WETHPairTTE.balanceOf(wallet.address)).to.eq(BigNumberPercent(expectedLiquidity,ratio).sub(MINIMUM_LIQUIDITY))
        expect(await WETHPairTEE.balanceOf(wallet.address)).to.eq(BigNumberPercent(expectedLiquidity,100-ratio).sub(MINIMUM_LIQUIDITY))

        const ratioA = 65
        await expect(
          router.addLiquidityETH(
            {
              token:              WETHPartner.address,
              amountTokenDesired: WETHPartnerAmount,
              amountTokenMin:     WETHPartnerAmount,
              amountETHMin:       ETHAmount,
              ratio:              ratioA,
            },
            wallet.address,
            constants.MaxUint256,
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
          .withArgs(constants.AddressZero, wallet.address, BigNumberPercent(expectedLiquidity, ratioA))
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
          .withArgs(constants.AddressZero, wallet.address, BigNumberPercent(expectedLiquidity,100-ratioA))
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
        await WETHPartner.approve(router.address, constants.MaxUint256)
        const tx = await router.addLiquidityETH(
            {
              token:              WETHPartner.address,
              amountTokenDesired: WETHPartnerAmount,
              amountTokenMin:     WETHPartnerAmount,
              amountETHMin:       ETHAmount,
              ratio:              ratio,
            },
            wallet.address,
            constants.MaxUint256,
            { ...overrides, value: ETHAmount }
          )

        const receipt = await tx.wait()
        expect(receipt.gasUsed).to.eq("236215")    //236208 236836 236829 238486 238479 238486 238486 238508 238523 239417 240217 240421 242115 242043 241998 244554 244520, Uniswap 220495
      })

      it('Add-Liquidity-ETH GAS usage： Double Pool ', async () => {
        const WETHPartnerAmount = expandTo18Decimals(100)
        const ETHAmount = expandTo18Decimals(4)

        const ratio = 40
        await WETHPartner.approve(router.address, constants.MaxUint256)
        const tx = await router.addLiquidityETH(
            {
              token:              WETHPartner.address,
              amountTokenDesired: WETHPartnerAmount,
              amountTokenMin:     WETHPartnerAmount,
              amountETHMin:       ETHAmount,
              ratio:              ratio,
            },
            wallet.address,
            constants.MaxUint256,
            { ...overrides, value: ETHAmount }
          )

        const receipt = await tx.wait()
        expect(receipt.gasUsed).to.eq("444785")  //444778 446015 446008 449315 449359 449396 451061 451184 452784 456520 4564764 456448 456358 461483 461459,  443817
      })

    })  
   
})
