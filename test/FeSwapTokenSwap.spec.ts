import chai, { expect } from 'chai'
import { Contract } from 'ethers'
import { AddressZero, Zero, MaxUint256 } from 'ethers/constants'
import { BigNumber, bigNumberify } from 'ethers/utils'
import { solidity, MockProvider, createFixtureLoader } from 'ethereum-waffle'
import { ecsign } from 'ethereumjs-util'

import {  BigNumberPercent, RemoveOutPercent, RemoveLeftPercent, expandTo18Decimals, 
          getApprovalDigest, mineBlock, MINIMUM_LIQUIDITY } from './shared/utilities'
import { v2Fixture } from './shared/Routerfixtures'

chai.use(solidity)

const overrides = {
  gasLimit: 9999999
}

describe('FeSwapTokenSwap', () => {
    const provider = new MockProvider({
      hardfork: 'istanbul',
      mnemonic: 'horn horn horn horn horn horn horn horn horn horn horn horn',
      gasLimit: 9999999
    })
    const [wallet, feeTo, pairOwner] = provider.getWallets()
    const loadFixture = createFixtureLoader(provider, [wallet, feeTo, pairOwner])

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
      routerEventEmitter = fixture.routerEventEmitter
    })

    afterEach(async function() {
      expect(await provider.getBalance(router.address)).to.eq(Zero)
    })

    describe( "FeSwap Swap Test", () => {

      async function addLiquidity(tokenAAmount: BigNumber, tokenBAmount: BigNumber, ratio: Number) {
        await tokenA.approve(router.address, MaxUint256)
        await tokenB.approve(router.address, MaxUint256)
        await router.addLiquidity(
            tokenA.address,
            tokenB.address,
            tokenAAmount,
            tokenBAmount,
            ratio,
            wallet.address,
            MaxUint256,
            overrides
          )
      }
          
      describe('swapExactTokensForTokens', async() => {
        const tokenAAmount = expandTo18Decimals(5)
        const tokenBAmount = expandTo18Decimals(10)
        const swapAmount = expandTo18Decimals(1)
        const expectedOutputAmount = bigNumberify('1666666666666666666')

        beforeEach(async () => {
          await addLiquidity(tokenAAmount, tokenBAmount, 100)
        })

        afterEach(async () => {
          const reserves = await pairAAB.getReserves()
          expect(await tokenA.balanceOf(pairAAB.address)).to.eq(reserves[0])
          expect(await tokenB.balanceOf(pairAAB.address)).to.eq(reserves[1]) 
        })
        
        it('happy path', async () => {
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
        })

        it('amounts', async () => {
          await tokenA.approve(routerEventEmitter.address, MaxUint256)
          await expect(
            routerEventEmitter.swapExactTokensForTokens(
              router.address,
              swapAmount,
              0,
              [tokenA.address, tokenB.address],
              wallet.address,
              MaxUint256,
              overrides
            )
          )
            .to.emit(routerEventEmitter, 'Amounts')
            .withArgs([swapAmount, expectedOutputAmount])
        })

        it('gas', async () => {
          // ensure that setting price{0,1}CumulativeLast for the first time doesn't affect our gas math
          await mineBlock(provider, (await provider.getBlock('latest')).timestamp + 1)
          await pairAAB.sync(overrides)

          await tokenA.approve(router.address, MaxUint256)
          await mineBlock(provider, (await provider.getBlock('latest')).timestamp + 1)
          const tx = await router.swapExactTokensForTokens(
            swapAmount,
            0,
            [tokenA.address, tokenB.address],
            wallet.address,
            MaxUint256,
            overrides
          )
          const receipt = await tx.wait()
          expect(receipt.gasUsed).to.eq(175981)     // 189689 192574 // 110796
        }).retries(3)
        
      })

      describe('swapTokensForExactTokens', () => {
        const tokenAAmount = expandTo18Decimals(5)
        const tokenBAmount = expandTo18Decimals(10)
        const expectedSwapAmount = bigNumberify('625000000000000001')  //626880641925777332 (Half pool, 0.3% fee)
        const outputAmount = expandTo18Decimals(1)

        beforeEach(async () => {
          await addLiquidity(tokenAAmount, tokenBAmount, 50)
        })

        it('happy path', async () => {
          await tokenA.approve(router.address, MaxUint256)
          await expect(
            router.swapTokensForExactTokens(
              outputAmount,
              MaxUint256,
              [tokenA.address, tokenB.address],
              wallet.address,
              MaxUint256,
              overrides
            )
          )
            .to.emit(tokenA, 'Transfer')
            .withArgs(wallet.address, pairAAB.address, expectedSwapAmount)
            .to.emit(tokenB, 'Transfer')
            .withArgs(pairAAB.address, wallet.address, outputAmount)
            .to.emit(pairAAB, 'Sync')
            .withArgs(BigNumberPercent(tokenAAmount,50).add(expectedSwapAmount), BigNumberPercent(tokenBAmount,50).sub(outputAmount))
            .to.emit(pairAAB, 'Swap')
            .withArgs(router.address, expectedSwapAmount, 0, 0, outputAmount, wallet.address)
        })

        it('gas', async () => {
          await tokenA.approve(router.address, MaxUint256)
          const tx = await router.swapTokensForExactTokens(
              outputAmount,
              MaxUint256,
              [tokenA.address, tokenB.address],
              wallet.address,
              MaxUint256,
              overrides
            )
          const receipt = await tx.wait()
          expect(receipt.gasUsed).to.eq(133572)     // 189689 192574 // 110796
        }).retries(3)

        it('amounts', async () => {
          await tokenA.approve(routerEventEmitter.address, MaxUint256)
          await expect(
            routerEventEmitter.swapTokensForExactTokens(
              router.address,
              outputAmount,
              MaxUint256,
              [tokenA.address, tokenB.address],
              wallet.address,
              MaxUint256,
              overrides
            )
          )
            .to.emit(routerEventEmitter, 'Amounts')
            .withArgs([expectedSwapAmount, outputAmount])
        })
      })

      describe('swapExactETHForTokens', () => {
        const WETHPartnerAmount = expandTo18Decimals(10)
        const ETHAmount = expandTo18Decimals(5)
        const swapAmount = expandTo18Decimals(1)      // ETH amount
        const expectedOutputAmount = bigNumberify('1666666666666666666')  //'1662497915624478906')

        beforeEach(async () => {
          await WETHPartner.transfer(WETHPairTEE.address, WETHPartnerAmount)
          await WETH.deposit({ value: ETHAmount })
          await WETH.transfer(WETHPairTEE.address, ETHAmount)
          await WETHPairTEE.mint(wallet.address, overrides)
        })

        it('happy path', async () => {
          await expect(
            router.swapExactETHForTokens(0, [WETH.address,WETHPartner.address], wallet.address, MaxUint256, {
              ...overrides,
              value: swapAmount
            })
          )
            .to.emit(WETH, 'Deposit')
            .withArgs(router.address, swapAmount)
            .to.emit(WETH, 'Transfer')
            .withArgs(router.address, WETHPairTEE.address, swapAmount)
            .to.emit(WETHPartner, 'Transfer')
            .withArgs(WETHPairTEE.address, wallet.address, expectedOutputAmount)
            .to.emit(WETHPairTEE, 'Sync')
            .withArgs(ETHAmount.add(swapAmount),WETHPartnerAmount.sub(expectedOutputAmount))
            .to.emit(WETHPairTEE, 'Swap')
            .withArgs(router.address, swapAmount, 0, 0, expectedOutputAmount, wallet.address)
        })

        it('amounts', async () => {
          await expect(
            routerEventEmitter.swapExactETHForTokens(
              router.address,
              0,
              [WETH.address, WETHPartner.address],
              wallet.address,
              MaxUint256,
              {
                ...overrides,
                value: swapAmount
              }
            )
          )
            .to.emit(routerEventEmitter, 'Amounts')
            .withArgs([swapAmount, expectedOutputAmount])
        })

        it('gas', async () => {
          const tx = await router.swapExactETHForTokens(
            0,
            [WETH.address, WETHPartner.address],
            wallet.address,
            MaxUint256,
            {
              ...overrides,
              value: swapAmount
            }
          )
          const receipt = await tx.wait()
          expect(receipt.gasUsed).to.eq(171456)    // 228000,  Why increase so much 118034
        }).retries(3)
      })

      describe('swapTokensForExactETH', () => {
        const WETHPartnerAmount = expandTo18Decimals(5)
        const ETHAmount = expandTo18Decimals(10)
        const expectedSwapAmount = bigNumberify('555555555555555556')
        const outputAmount = expandTo18Decimals(1)

        beforeEach(async () => {
          await WETHPartner.transfer(WETHPairTTE.address, WETHPartnerAmount)
          await WETH.deposit({ value: ETHAmount })
          await WETH.transfer(WETHPairTTE.address, ETHAmount)
          await WETHPairTTE.mint(wallet.address, overrides)
        })

        it('happy path', async () => {
          await WETHPartner.approve(router.address, MaxUint256)
          await expect(
            router.swapTokensForExactETH(
              outputAmount,
              MaxUint256,
              [WETHPartner.address, WETH.address],
              wallet.address,
              MaxUint256,
              overrides
            )
          )
            .to.emit(WETHPartner, 'Transfer')
            .withArgs(wallet.address, WETHPairTTE.address, expectedSwapAmount)
            .to.emit(WETH, 'Transfer')
            .withArgs(WETHPairTTE.address, router.address, outputAmount)
            .to.emit(WETHPairTTE, 'Sync')
            .withArgs(WETHPartnerAmount.add(expectedSwapAmount), ETHAmount.sub(outputAmount))
            .to.emit(WETHPairTTE, 'Swap')
            .withArgs(router.address, expectedSwapAmount, 0, 0, outputAmount, router.address)
            .to.emit(WETH, 'Withdrawal')
            .withArgs(router.address, outputAmount)            
        })

        it('gas', async () => {
          await WETHPartner.approve(router.address, MaxUint256)
          const tx = await router.swapTokensForExactETH(
              outputAmount,
              MaxUint256,
              [WETHPartner.address, WETH.address],
              wallet.address,
              MaxUint256,
              overrides
            )
            const receipt = await tx.wait()
            expect(receipt.gasUsed).to.eq(224922)    // 228000,  Why increase so much 118034
        }).retries(3)                      

        it('amounts', async () => {
          await WETHPartner.approve(routerEventEmitter.address, MaxUint256)
          await expect(
            routerEventEmitter.swapTokensForExactETH(
              router.address,
              outputAmount,
              MaxUint256,
              [WETHPartner.address, WETH.address],
              wallet.address,
              MaxUint256,
              overrides
            )
          )
            .to.emit(routerEventEmitter, 'Amounts')
            .withArgs([expectedSwapAmount, outputAmount])
        })
      })

      describe('swapExactTokensForETH', () => {
        const WETHPartnerAmount = expandTo18Decimals(50)
        const ETHAmount = expandTo18Decimals(10)
        const swapAmount = expandTo18Decimals(1)
        const expectedOutputAmount = bigNumberify('196078431372549019')

        beforeEach(async () => {
          await WETHPartner.transfer(WETHPairTTE.address, WETHPartnerAmount)
          await WETH.deposit({ value: ETHAmount })
          await WETH.transfer(WETHPairTTE.address, ETHAmount)
          await WETHPairTTE.mint(wallet.address, overrides)
        })

        it('happy path', async () => {
          await WETHPartner.approve(router.address, MaxUint256)
          const WETHPairTokenTT = await WETHPairTTE.tokenIn()
          await expect(
            router.swapExactTokensForETH(
              swapAmount,
              0,
              [WETHPartner.address, WETH.address],
              wallet.address,
              MaxUint256,
              overrides
            )
          )
            .to.emit(WETHPartner, 'Transfer')
            .withArgs(wallet.address, WETHPairTTE.address, swapAmount)
            .to.emit(WETH, 'Transfer')
            .withArgs(WETHPairTTE.address, router.address, expectedOutputAmount)
            .to.emit(WETHPairTTE, 'Sync')
            .withArgs(WETHPartnerAmount.add(swapAmount), ETHAmount.sub(expectedOutputAmount))
            .to.emit(WETHPairTTE, 'Swap')
            .withArgs(router.address, swapAmount, 0, 0, expectedOutputAmount, router.address)
        })

        it('gas', async () => {
          await WETHPartner.approve(router.address, MaxUint256)
          const tx = await router.swapExactTokensForETH(
            swapAmount,
            0,
            [WETHPartner.address, WETH.address],
            wallet.address,
            MaxUint256,
            overrides
          )
          const receipt = await tx.wait()
          expect(receipt.gasUsed).to.eq(224473)    // 228000,  Why increase so much 118034
        }).retries(3)

        it('amounts', async () => {
          await WETHPartner.approve(routerEventEmitter.address, MaxUint256)
          await expect(
            routerEventEmitter.swapExactTokensForETH(
              router.address,
              swapAmount,
              0,
              [WETHPartner.address, WETH.address],
              wallet.address,
              MaxUint256,
              overrides
            )
          )
            .to.emit(routerEventEmitter, 'Amounts')
            .withArgs([swapAmount, expectedOutputAmount])
        })
      })

      describe('swapETHForExactTokens', () => {
        const WETHPartnerAmount = expandTo18Decimals(100)
        const ETHAmount = expandTo18Decimals(5)
        const expectedSwapAmount = bigNumberify('154639175257731959')
        const outputAmount = expandTo18Decimals(3)

        beforeEach(async () => {
          await WETHPartner.transfer(WETHPairTEE.address, WETHPartnerAmount)
          await WETH.deposit({ value: ETHAmount })
          await WETH.transfer(WETHPairTEE.address, ETHAmount)
          await WETHPairTEE.mint(wallet.address, overrides)
        })

        it('happy path', async () => {
          const WETHPairTokenTT = await WETHPairTEE.tokenIn()
          await expect(
            router.swapETHForExactTokens(
              outputAmount,
              [WETH.address, WETHPartner.address],
              wallet.address,
              MaxUint256,
              {
                ...overrides,
                value: expectedSwapAmount
              }
            )
          )
            .to.emit(WETH, 'Transfer')
            .withArgs(router.address, WETHPairTEE.address, expectedSwapAmount)
            .to.emit(WETHPartner, 'Transfer')
            .withArgs(WETHPairTEE.address, wallet.address, outputAmount)
            .to.emit(WETHPairTEE, 'Sync')
            .withArgs(ETHAmount.add(expectedSwapAmount),WETHPartnerAmount.sub(outputAmount))
            .to.emit(WETHPairTEE, 'Swap')
            .withArgs(router.address, expectedSwapAmount, 0, 0, outputAmount, wallet.address)
        })

        it('gas', async () => {
          const WETHPairTokenTT = await WETHPairTEE.tokenIn()
          const tx = await router.swapETHForExactTokens(
              outputAmount,
              [WETH.address, WETHPartner.address],
              wallet.address,
              MaxUint256,
              {
                ...overrides,
                value: expectedSwapAmount
              }
          )
          const receipt = await tx.wait()
          expect(receipt.gasUsed).to.eq(213648)    // 228000,  Why increase so much 118034
        }).retries(3)

        it('amounts', async () => {
          await expect(
            routerEventEmitter.swapETHForExactTokens(
              router.address,
              outputAmount,
              [WETH.address, WETHPartner.address],
              wallet.address,
              MaxUint256,
              {
                ...overrides,
                value: expectedSwapAmount
              }
            )
          )
            .to.emit(routerEventEmitter, 'Amounts')
            .withArgs([expectedSwapAmount, outputAmount])
        })
      })
    })
})
