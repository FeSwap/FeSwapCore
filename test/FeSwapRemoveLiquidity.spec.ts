import chai, { expect } from 'chai'
import { Contract, constants, BigNumber } from 'ethers'

import { solidity, MockProvider, createFixtureLoader } from 'ethereum-waffle'
import { ecsign } from 'ethereumjs-util'

import {  BigNumberPercent, RemoveOutPercent, RemoveLeftPercent, expandTo18Decimals, 
          getApprovalDigest, MINIMUM_LIQUIDITY, mineBlock } from './shared/utilities'
import { v2Fixture } from './shared/Routerfixtures'

chai.use(solidity)

const overrides = {
  gasLimit: 9999999
}

describe('FeSwapRemoveLiquidity', () => {
    const provider = new MockProvider({
      ganacheOptions: {
        hardfork: 'istanbul',
        mnemonic: 'horn horn horn horn horn horn horn horn horn horn horn horn',
        gasLimit: 9999999
      },
    })

    const [wallet, feeTo, pairOwner, other] = provider.getWallets()
    const loadFixture = createFixtureLoader([wallet, feeTo, pairOwner, other],provider)

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

    describe( "FeSwap Remove Liquidity", () => {

      async function addLiquidity(tokenAAmount: BigNumber, tokenBAmount: BigNumber, ratio: Number) {
        await tokenA.approve(router.address, constants.MaxUint256)
        await tokenB.approve(router.address, constants.MaxUint256)
        await router.addLiquidity(
            {
              tokenA:         tokenA.address,
              tokenB:         tokenB.address,
              amountADesired: tokenAAmount,
              amountBDesired: tokenBAmount,
              amountAMin:     0,
              amountBMin:     0,
              ratio:          ratio,
            },
            wallet.address,
            constants.MaxUint256,
            overrides
          )
      }

    [10, 30, 50, 69, 80].forEach( (ratio) => {
//    [10].forEach( (ratio) => {
      it(`removeLiquidity ratio is ${ratio}-${100-ratio} `, async () => {
        const tokenAAmount = expandTo18Decimals(100)
        const tokenBAmount = expandTo18Decimals(4)
        await addLiquidity(tokenAAmount, tokenBAmount, ratio)

        const expectedLiquidityAAB = BigNumberPercent(expandTo18Decimals(20),ratio)
        const expectedLiquidityABB = BigNumberPercent(expandTo18Decimals(20),100-ratio)

        await pairAAB.approve(router.address, constants.MaxUint256)
        await pairABB.approve(router.address, constants.MaxUint256)

        await expect(
          router.removeLiquidity(
            {
              tokenA:         tokenA.address,
              tokenB:         tokenB.address,
              liquidityAAB:   expectedLiquidityAAB.sub(MINIMUM_LIQUIDITY),
              liquidityABB:   expectedLiquidityABB.sub(MINIMUM_LIQUIDITY), 
              amountAMin:     0,
              amountBMin:     0,
            },
            other.address,
            constants.MaxUint256,
            overrides
          )
        )
          .to.emit(pairAAB, 'Transfer')
          .withArgs(wallet.address, pairAAB.address, expectedLiquidityAAB.sub(MINIMUM_LIQUIDITY))
          .to.emit(pairAAB, 'Transfer')
          .withArgs(pairAAB.address, constants.AddressZero, expectedLiquidityAAB.sub(MINIMUM_LIQUIDITY))
          .to.emit(tokenA, 'Transfer')
          .withArgs(pairAAB.address, other.address, RemoveOutPercent(tokenAAmount,ratio,expectedLiquidityAAB))
          .to.emit(tokenB, 'Transfer')
          .withArgs(pairAAB.address, other.address, RemoveOutPercent(tokenBAmount,ratio,expectedLiquidityAAB))
          .to.emit(pairAAB, 'Sync')
          .withArgs(RemoveLeftPercent(tokenAAmount,ratio,expectedLiquidityAAB), 
                    RemoveLeftPercent(tokenBAmount,ratio,expectedLiquidityAAB))
          .to.emit(pairAAB, 'Burn')
          .withArgs(router.address, RemoveOutPercent(tokenAAmount,ratio,expectedLiquidityAAB), 
                                    RemoveOutPercent(tokenBAmount,ratio,expectedLiquidityAAB), other.address)
          .to.emit(pairABB, 'Transfer')
          .withArgs(wallet.address, pairABB.address, expectedLiquidityABB.sub(MINIMUM_LIQUIDITY))
          .to.emit(pairABB, 'Transfer')
          .withArgs(pairABB.address, constants.AddressZero, expectedLiquidityABB.sub(MINIMUM_LIQUIDITY))
          .to.emit(tokenB, 'Transfer')
          .withArgs(pairABB.address, other.address, RemoveOutPercent(tokenBAmount,100-ratio,expectedLiquidityABB))
          .to.emit(tokenA, 'Transfer')
          .withArgs(pairABB.address, other.address, RemoveOutPercent(tokenAAmount,100-ratio,expectedLiquidityABB))
          .to.emit(pairABB, 'Sync')
          .withArgs(RemoveLeftPercent(tokenBAmount,100-ratio,expectedLiquidityABB), 
                    RemoveLeftPercent(tokenAAmount,100-ratio,expectedLiquidityABB))
          .to.emit(pairABB, 'Burn')
          .withArgs(router.address, RemoveOutPercent(tokenBAmount,100-ratio,expectedLiquidityABB), 
                                    RemoveOutPercent(tokenAAmount,100-ratio,expectedLiquidityABB), other.address)                                    
        expect(await pairAAB.balanceOf(wallet.address)).to.eq(0)
        expect(await pairABB.balanceOf(wallet.address)).to.eq(0)             
        const totalSupplyToken0 = await tokenA.totalSupply()
        const totalSupplyToken1 = await tokenB.totalSupply()

        expect(await tokenA.balanceOf(wallet.address)).to.eq(totalSupplyToken0.sub(
          RemoveLeftPercent(tokenAAmount,ratio,expectedLiquidityAAB)
          .add(RemoveLeftPercent(tokenAAmount,100-ratio,expectedLiquidityABB)))
          .sub(RemoveOutPercent(tokenAAmount,ratio,expectedLiquidityAAB)
          .add(RemoveOutPercent(tokenAAmount,100-ratio,expectedLiquidityABB))))

        expect(await tokenB.balanceOf(wallet.address)).to.eq(totalSupplyToken1.sub(
          RemoveLeftPercent(tokenBAmount,ratio,expectedLiquidityAAB)
          .add(RemoveLeftPercent(tokenBAmount,100-ratio,expectedLiquidityABB)))
          .sub(RemoveOutPercent(tokenBAmount,ratio,expectedLiquidityAAB)
          .add(RemoveOutPercent(tokenBAmount,100-ratio,expectedLiquidityABB))))

        expect(await tokenA.balanceOf(other.address)).to.eq(
          RemoveOutPercent(tokenAAmount,ratio,expectedLiquidityAAB)
          .add(RemoveOutPercent(tokenAAmount,100-ratio,expectedLiquidityABB)))

        expect(await tokenB.balanceOf(other.address)).to.eq(
          RemoveOutPercent(tokenBAmount,ratio,expectedLiquidityAAB)
          .add(RemoveOutPercent(tokenBAmount,100-ratio,expectedLiquidityABB)))

        // Add liquity Again and the Remove, no MINIMUM_LIQUIDITY clearence
        {
          const tokenAAmount = expandTo18Decimals(100)
          const tokenBAmount = expandTo18Decimals(4)
          await addLiquidity(tokenAAmount, tokenBAmount, ratio)
          
          const expectedLiquidityAAB = BigNumberPercent(expandTo18Decimals(20),ratio)
          const expectedLiquidityABB = BigNumberPercent(expandTo18Decimals(20),100-ratio)

          await pairAAB.approve(router.address, constants.MaxUint256)
          await pairABB.approve(router.address, constants.MaxUint256)

          await expect(
            router.removeLiquidity(
              {
                tokenA:         tokenA.address,
                tokenB:         tokenB.address,
                liquidityAAB:   expectedLiquidityAAB,
                liquidityABB:   expectedLiquidityABB, 
                amountAMin:     0,
                amountBMin:     0,
              },
              wallet.address,
              constants.MaxUint256,
              overrides
            )
          )
            .to.emit(pairAAB, 'Transfer')
            .withArgs(wallet.address, pairAAB.address, expectedLiquidityAAB)
            .to.emit(pairAAB, 'Transfer')
            .withArgs(pairAAB.address, constants.AddressZero, expectedLiquidityAAB)
            .to.emit(tokenA, 'Transfer')
            .withArgs(pairAAB.address, wallet.address, BigNumberPercent(tokenAAmount,ratio))
            .to.emit(tokenB, 'Transfer')
            .withArgs(pairAAB.address, wallet.address, BigNumberPercent(tokenBAmount,ratio))
            .to.emit(pairAAB, 'Sync')
            .withArgs(RemoveLeftPercent(tokenAAmount,ratio,expectedLiquidityAAB), 
                      RemoveLeftPercent(tokenBAmount,ratio,expectedLiquidityAAB))
            .to.emit(pairAAB, 'Burn')
            .withArgs(router.address, BigNumberPercent(tokenAAmount,ratio), BigNumberPercent(tokenBAmount,ratio), wallet.address)
            .to.emit(pairABB, 'Transfer')
            .withArgs(wallet.address, pairABB.address, expectedLiquidityABB)
            .to.emit(pairABB, 'Transfer')
            .withArgs(pairABB.address, constants.AddressZero, expectedLiquidityABB)
            .to.emit(tokenB, 'Transfer')
            .withArgs(pairABB.address, wallet.address, BigNumberPercent(tokenBAmount,100-ratio))
            .to.emit(tokenA, 'Transfer')
            .withArgs(pairABB.address, wallet.address, BigNumberPercent(tokenAAmount,100-ratio))
            .to.emit(pairABB, 'Sync')
            .withArgs(RemoveLeftPercent(tokenBAmount,100-ratio,expectedLiquidityABB), 
                      RemoveLeftPercent(tokenAAmount,100-ratio,expectedLiquidityABB))
            .to.emit(pairABB, 'Burn')
            .withArgs(router.address, BigNumberPercent(tokenBAmount,100-ratio), 
                                      BigNumberPercent(tokenAAmount,100-ratio), wallet.address)                                    

          expect(await pairAAB.balanceOf(wallet.address)).to.eq(0)
          expect(await pairABB.balanceOf(wallet.address)).to.eq(0)               
          const totalSupplyToken0 = await tokenA.totalSupply()
          const totalSupplyToken1 = await tokenB.totalSupply()

          expect(await tokenA.balanceOf(wallet.address)).to.eq(totalSupplyToken0.sub(tokenAAmount))
          expect(await tokenB.balanceOf(wallet.address)).to.eq(totalSupplyToken1.sub(tokenBAmount))
        }
      })
    })

    it("removeLiquidity GAS Test" , async () => {
        const tokenAAmount = expandTo18Decimals(100)
        const tokenBAmount = expandTo18Decimals(4)
        await addLiquidity(tokenAAmount, tokenBAmount, 50)
        
        const expectedLiquidityAAB = BigNumberPercent(expandTo18Decimals(20),50)
        const expectedLiquidityABB = BigNumberPercent(expandTo18Decimals(20),100-50)

        await pairAAB.approve(router.address, constants.MaxUint256)
        await pairABB.approve(router.address, constants.MaxUint256)

        const lastBlock = await provider.getBlock('latest')
        const blockTimestamp = lastBlock.timestamp
        await mineBlock(provider, blockTimestamp + 5)

        let tx = await router.removeLiquidity(
            {
              tokenA:         tokenA.address,
              tokenB:         tokenB.address,
              liquidityAAB:   expectedLiquidityAAB.sub(MINIMUM_LIQUIDITY),
              liquidityABB:   expectedLiquidityABB.sub(MINIMUM_LIQUIDITY), 
              amountAMin:     0,
              amountBMin:     0,
            },
            wallet.address,
            constants.MaxUint256,
            overrides
          )

        let receipt = await tx.wait()
        expect(receipt.gasUsed).to.eq("172170")    // 173551 175130 175327 175288 175376 261297 261216  262816 292738 295958 296217 295951 295862 295816 294280, 246129 258878  Uniswap: 253427

        await addLiquidity(tokenAAmount, tokenBAmount, 50)        
        await mineBlock(provider, blockTimestamp + 10)
        tx = await router.removeLiquidity(
            {
              tokenA:         tokenA.address,
              tokenB:         tokenB.address,
              liquidityAAB:   expectedLiquidityAAB,
              liquidityABB:   expectedLiquidityABB, 
              amountAMin:     0,
              amountBMin:     0,
            },
            wallet.address,
            constants.MaxUint256,
            overrides
          )

        receipt = await tx.wait()
        expect(receipt.gasUsed).to.eq("172122")    // 173503 173510 175082 205130 175130 205327 205376  231297 231216 261216
      })

      it(`removeLiquidity ratio AAB: 100-0 `, async () => {
        const tokenAAmount = expandTo18Decimals(100)
        const tokenBAmount = expandTo18Decimals(4)
        const ratio = 100
        await addLiquidity(tokenAAmount, tokenBAmount, ratio)
        
        const expectedLiquidityAAB = BigNumberPercent(expandTo18Decimals(20),ratio)
        await pairAAB.approve(router.address, constants.MaxUint256)

        await expect(
          router.removeLiquidity(
            {
              tokenA:         tokenA.address,
              tokenB:         tokenB.address,
              liquidityAAB:   expectedLiquidityAAB.sub(MINIMUM_LIQUIDITY),
              liquidityABB:   0, 
              amountAMin:     0,
              amountBMin:     0,
            },
            wallet.address,
            constants.MaxUint256,
            overrides
          )
        )
          .to.emit(pairAAB, 'Transfer')
          .withArgs(wallet.address, pairAAB.address, expectedLiquidityAAB.sub(MINIMUM_LIQUIDITY))
          .to.emit(pairAAB, 'Transfer')
          .withArgs(pairAAB.address, constants.AddressZero, expectedLiquidityAAB.sub(MINIMUM_LIQUIDITY))
          .to.emit(tokenA, 'Transfer')
          .withArgs(pairAAB.address, wallet.address, RemoveOutPercent(tokenAAmount,ratio,expectedLiquidityAAB))
          .to.emit(tokenB, 'Transfer')
          .withArgs(pairAAB.address, wallet.address, RemoveOutPercent(tokenBAmount,ratio,expectedLiquidityAAB))
          .to.emit(pairAAB, 'Sync')
          .withArgs(RemoveLeftPercent(tokenAAmount,ratio,expectedLiquidityAAB), 
                    RemoveLeftPercent(tokenBAmount,ratio,expectedLiquidityAAB))
          .to.emit(pairAAB, 'Burn')
          .withArgs(router.address, RemoveOutPercent(tokenAAmount,ratio,expectedLiquidityAAB), 
                                    RemoveOutPercent(tokenBAmount,ratio,expectedLiquidityAAB), wallet.address)

        expect(await pairAAB.balanceOf(wallet.address)).to.eq(0)
        expect(await pairABB.balanceOf(wallet.address)).to.eq(0)       
        const totalSupplyToken0 = await tokenA.totalSupply()
        const totalSupplyToken1 = await tokenB.totalSupply()
        expect(await tokenA.balanceOf(wallet.address)).to.eq(totalSupplyToken0.sub(
          RemoveLeftPercent(tokenAAmount,ratio,expectedLiquidityAAB)))
        expect(await tokenB.balanceOf(wallet.address)).to.eq(totalSupplyToken1.sub(
          RemoveLeftPercent(tokenBAmount,ratio,expectedLiquidityAAB)))
      })

      it(`removeLiquidity ratio AAB: 100-0：Gas test`, async () => {
        const tokenAAmount = expandTo18Decimals(100)
        const tokenBAmount = expandTo18Decimals(4)
        const ratio = 100
        await addLiquidity(tokenAAmount, tokenBAmount, ratio)
        
        const expectedLiquidityAAB = BigNumberPercent(expandTo18Decimals(20),ratio)
        await pairAAB.approve(router.address, constants.MaxUint256)

        const lastBlock = await provider.getBlock('latest')
        const blockTimestamp = lastBlock.timestamp
        await mineBlock(provider, blockTimestamp + 5)

        let tx = await router.removeLiquidity(
            {
              tokenA:         tokenA.address,
              tokenB:         tokenB.address,
              liquidityAAB:   expectedLiquidityAAB.sub(MINIMUM_LIQUIDITY),
              liquidityABB:   0, 
              amountAMin:     0,
              amountBMin:     0,
            },
            wallet.address,
            constants.MaxUint256,
            overrides
          )
        let receipt = await tx.wait()
        expect(receipt.gasUsed).to.eq("102265")    // 102958 102965 103751 103846 103830 103874 146831 146794 147594 162773 164377 164370 164503 164303 164280 163444, 139258,  246129,  Uniswap: ???

        await addLiquidity(tokenAAmount, tokenBAmount, ratio)
        await mineBlock(provider, blockTimestamp + 10)
        tx = await router.removeLiquidity(
            {
              tokenA:         tokenA.address,
              tokenB:         tokenB.address,
              liquidityAAB:   expectedLiquidityAAB,
              liquidityABB:   0, 
              amountAMin:     0,
              amountBMin:     0,
            },
            wallet.address,
            constants.MaxUint256,
            overrides
          )
        receipt = await tx.wait()
        expect(receipt.gasUsed).to.eq("102241")    // 102934 102941 103727 118751 118744 118846 118874 131831 131794 146794
      })

      it(`removeLiquidity ratio AAB: 0-100 `, async () => {
        const tokenAAmount = expandTo18Decimals(100)
        const tokenBAmount = expandTo18Decimals(4)
        const ratio = 0
        await addLiquidity(tokenAAmount, tokenBAmount, ratio)
        
        const expectedLiquidityABB = BigNumberPercent(expandTo18Decimals(20),100-ratio)
        await pairABB.approve(router.address, constants.MaxUint256)

        await expect( 
          router.removeLiquidity(
            {
              tokenA:         tokenA.address,
              tokenB:         tokenB.address,
              liquidityAAB:   0,
              liquidityABB:   expectedLiquidityABB.sub(MINIMUM_LIQUIDITY), 
              amountAMin:     0,
              amountBMin:     0,
            },
            wallet.address,
            constants.MaxUint256,
            overrides
          )
        )
        .to.emit(pairABB, 'Transfer')
        .withArgs(wallet.address, pairABB.address, expectedLiquidityABB.sub(MINIMUM_LIQUIDITY))
        .to.emit(pairABB, 'Transfer')
        .withArgs(pairABB.address, constants.AddressZero, expectedLiquidityABB.sub(MINIMUM_LIQUIDITY))
        .to.emit(tokenB, 'Transfer')
        .withArgs(pairABB.address, wallet.address, RemoveOutPercent(tokenBAmount,100-ratio,expectedLiquidityABB))
        .to.emit(tokenA, 'Transfer')
        .withArgs(pairABB.address, wallet.address, RemoveOutPercent(tokenAAmount,100-ratio,expectedLiquidityABB))
        .to.emit(pairABB, 'Sync')
        .withArgs(RemoveLeftPercent(tokenBAmount,100-ratio,expectedLiquidityABB), 
                  RemoveLeftPercent(tokenAAmount,100-ratio,expectedLiquidityABB))
        .to.emit(pairABB, 'Burn')
        .withArgs(router.address, RemoveOutPercent(tokenBAmount,100-ratio,expectedLiquidityABB), 
                                  RemoveOutPercent(tokenAAmount,100-ratio,expectedLiquidityABB), wallet.address)                                    

      expect(await pairAAB.balanceOf(wallet.address)).to.eq(0)
      expect(await pairABB.balanceOf(wallet.address)).to.eq(0)           
      const totalSupplyToken0 = await tokenA.totalSupply()
      const totalSupplyToken1 = await tokenB.totalSupply()
      expect(await tokenA.balanceOf(wallet.address)).to.eq(totalSupplyToken0.sub(
        RemoveLeftPercent(tokenAAmount,100-ratio,expectedLiquidityABB)))
      expect(await tokenB.balanceOf(wallet.address)).to.eq(totalSupplyToken1.sub(
        RemoveLeftPercent(tokenBAmount,100-ratio,expectedLiquidityABB)))
      })

      it('removeLiquidityWithPermit Signal Signature', async () => {

        const tokenAAmount = expandTo18Decimals(100)
        const tokenBAmount = expandTo18Decimals(4)
        const ratio = 100
        await addLiquidity(tokenAAmount, tokenBAmount, ratio)
        const nonce = await pairAAB.nonces(wallet.address)
        
        const expectedLiquidityAAB = BigNumberPercent(expandTo18Decimals(20),ratio)

        const digest = await getApprovalDigest(
            pairAAB,
          { owner: wallet.address, spender: router.address, value: expectedLiquidityAAB.sub(MINIMUM_LIQUIDITY) },
          nonce,
          constants.MaxUint256
        )

        const { v, r, s } = ecsign(Buffer.from(digest.slice(2), 'hex'), Buffer.from(wallet.privateKey.slice(2), 'hex'))
        const ZeroBuffer = Buffer.alloc(32)

        await expect( 
          router.removeLiquidityWithPermit(
            {
              tokenA:         tokenA.address,
              tokenB:         tokenB.address,
              liquidityAAB:   expectedLiquidityAAB.sub(MINIMUM_LIQUIDITY),
              liquidityABB:   0, 
              amountAMin:     0,
              amountBMin:     0,
            },
            wallet.address,
            constants.MaxUint256,
            false,
            {v, r, s},
            {v: 0, r: ZeroBuffer, s: ZeroBuffer },
            overrides
          )
        )
          .to.emit(pairAAB, 'Transfer')
          .withArgs(wallet.address, pairAAB.address, expectedLiquidityAAB.sub(MINIMUM_LIQUIDITY))
          .to.emit(pairAAB, 'Transfer')
          .withArgs(pairAAB.address, constants.AddressZero, expectedLiquidityAAB.sub(MINIMUM_LIQUIDITY))
          .to.emit(tokenA, 'Transfer')
          .withArgs(pairAAB.address, wallet.address, RemoveOutPercent(tokenAAmount,ratio,expectedLiquidityAAB))
          .to.emit(tokenB, 'Transfer')
          .withArgs(pairAAB.address, wallet.address, RemoveOutPercent(tokenBAmount,ratio,expectedLiquidityAAB))
          .to.emit(pairAAB, 'Sync')
          .withArgs(RemoveLeftPercent(tokenAAmount,ratio,expectedLiquidityAAB), 
                    RemoveLeftPercent(tokenBAmount,ratio,expectedLiquidityAAB))
          .to.emit(pairAAB, 'Burn')
          .withArgs(router.address, RemoveOutPercent(tokenAAmount,ratio,expectedLiquidityAAB), 
                                    RemoveOutPercent(tokenBAmount,ratio,expectedLiquidityAAB), wallet.address)

        expect(await pairAAB.balanceOf(wallet.address)).to.eq(0)
        expect(await pairABB.balanceOf(wallet.address)).to.eq(0)       
        const totalSupplyToken0 = await tokenA.totalSupply()
        const totalSupplyToken1 = await tokenB.totalSupply()
        expect(await tokenA.balanceOf(wallet.address)).to.eq(totalSupplyToken0.sub(
          RemoveLeftPercent(tokenAAmount,ratio,expectedLiquidityAAB)))
        expect(await tokenB.balanceOf(wallet.address)).to.eq(totalSupplyToken1.sub(
          RemoveLeftPercent(tokenBAmount,ratio,expectedLiquidityAAB)))
      })


      it('removeLiquidityWithPermit Double Signature', async () => {

        const ratio = 30
        const tokenAAmount = expandTo18Decimals(100)
        const tokenBAmount = expandTo18Decimals(4)
        await addLiquidity(tokenAAmount, tokenBAmount, ratio)

        const expectedLiquidityAAB = BigNumberPercent(expandTo18Decimals(20),ratio)
        const expectedLiquidityABB = BigNumberPercent(expandTo18Decimals(20),100-ratio)

        const nonce1 = await pairAAB.nonces(wallet.address)
        const digest1 = await getApprovalDigest(
                                pairAAB,
                                { owner: wallet.address, spender: router.address, value: expectedLiquidityAAB.sub(MINIMUM_LIQUIDITY) },
                                nonce1,
                                constants.MaxUint256
                              )
        const { v: v1, r: r1, s: s1 } = ecsign(Buffer.from(digest1.slice(2), 'hex'), Buffer.from(wallet.privateKey.slice(2), 'hex'))

        const nonce2 = await pairABB.nonces(wallet.address)
        const digest2 = await getApprovalDigest(
                                pairABB,
                                { owner: wallet.address, spender: router.address, value: expectedLiquidityABB.sub(MINIMUM_LIQUIDITY) },
                                nonce2,
                                constants.MaxUint256
                              )
        const { v: v2, r: r2, s: s2 } = ecsign(Buffer.from(digest2.slice(2), 'hex'), Buffer.from(wallet.privateKey.slice(2), 'hex'))

        await expect( 
          router.removeLiquidityWithPermit(
            {
              tokenA:         tokenA.address,
              tokenB:         tokenB.address,
              liquidityAAB:   expectedLiquidityAAB.sub(MINIMUM_LIQUIDITY),
              liquidityABB:   expectedLiquidityABB.sub(MINIMUM_LIQUIDITY), 
              amountAMin:     0,
              amountBMin:     0,
            },
            other.address,
            constants.MaxUint256,
            false,
            { v: v1, r: r1, s: s1 },
            { v: v2, r: r2, s: s2 },
            overrides
          )
        )
          .to.emit(pairAAB, 'Transfer')
          .withArgs(wallet.address, pairAAB.address, expectedLiquidityAAB.sub(MINIMUM_LIQUIDITY))
          .to.emit(pairAAB, 'Transfer')
          .withArgs(pairAAB.address, constants.AddressZero, expectedLiquidityAAB.sub(MINIMUM_LIQUIDITY))
          .to.emit(tokenA, 'Transfer')
          .withArgs(pairAAB.address, other.address, RemoveOutPercent(tokenAAmount,ratio,expectedLiquidityAAB))
          .to.emit(tokenB, 'Transfer')
          .withArgs(pairAAB.address, other.address, RemoveOutPercent(tokenBAmount,ratio,expectedLiquidityAAB))
          .to.emit(pairAAB, 'Sync')
          .withArgs(RemoveLeftPercent(tokenAAmount,ratio,expectedLiquidityAAB), 
                    RemoveLeftPercent(tokenBAmount,ratio,expectedLiquidityAAB))
          .to.emit(pairAAB, 'Burn')
          .withArgs(router.address, RemoveOutPercent(tokenAAmount,ratio,expectedLiquidityAAB), 
                                    RemoveOutPercent(tokenBAmount,ratio,expectedLiquidityAAB), other.address)
          .to.emit(pairABB, 'Transfer')
          .withArgs(wallet.address, pairABB.address, expectedLiquidityABB.sub(MINIMUM_LIQUIDITY))
          .to.emit(pairABB, 'Transfer')
          .withArgs(pairABB.address, constants.AddressZero, expectedLiquidityABB.sub(MINIMUM_LIQUIDITY))
          .to.emit(tokenB, 'Transfer')
          .withArgs(pairABB.address, other.address, RemoveOutPercent(tokenBAmount,100-ratio,expectedLiquidityABB))
          .to.emit(tokenA, 'Transfer')
          .withArgs(pairABB.address, other.address, RemoveOutPercent(tokenAAmount,100-ratio,expectedLiquidityABB))
          .to.emit(pairABB, 'Sync')
          .withArgs(RemoveLeftPercent(tokenBAmount,100-ratio,expectedLiquidityABB), 
                    RemoveLeftPercent(tokenAAmount,100-ratio,expectedLiquidityABB))
          .to.emit(pairABB, 'Burn')
          .withArgs(router.address, RemoveOutPercent(tokenBAmount,100-ratio,expectedLiquidityABB), 
                                    RemoveOutPercent(tokenAAmount,100-ratio,expectedLiquidityABB), other.address)                                    
          expect(await pairAAB.balanceOf(wallet.address)).to.eq(0)
          expect(await pairABB.balanceOf(wallet.address)).to.eq(0)             
          const totalSupplyToken0 = await tokenA.totalSupply()
          const totalSupplyToken1 = await tokenB.totalSupply()

        expect(await tokenA.balanceOf(wallet.address)).to.eq(totalSupplyToken0.sub(
          RemoveLeftPercent(tokenAAmount,ratio,expectedLiquidityAAB)
          .add(RemoveLeftPercent(tokenAAmount,100-ratio,expectedLiquidityABB)))
          .sub(RemoveOutPercent(tokenAAmount,ratio,expectedLiquidityAAB)
          .add(RemoveOutPercent(tokenAAmount,100-ratio,expectedLiquidityABB))))

        expect(await tokenB.balanceOf(wallet.address)).to.eq(totalSupplyToken1.sub(
          RemoveLeftPercent(tokenBAmount,ratio,expectedLiquidityAAB)
          .add(RemoveLeftPercent(tokenBAmount,100-ratio,expectedLiquidityABB)))
          .sub(RemoveOutPercent(tokenBAmount,ratio,expectedLiquidityAAB)
          .add(RemoveOutPercent(tokenBAmount,100-ratio,expectedLiquidityABB))))

        expect(await tokenA.balanceOf(other.address)).to.eq(
          RemoveOutPercent(tokenAAmount,ratio,expectedLiquidityAAB)
          .add(RemoveOutPercent(tokenAAmount,100-ratio,expectedLiquidityABB)))

        expect(await tokenB.balanceOf(other.address)).to.eq(
          RemoveOutPercent(tokenBAmount,ratio,expectedLiquidityAAB)
          .add(RemoveOutPercent(tokenBAmount,100-ratio,expectedLiquidityABB)))
      })    
    })

/////////////////////////
    describe( "FeSwap Remove LiquidityETH", () => {
          
      async function addLiquidityETH(WETHPartnerAmount: BigNumber, ETHAmount: BigNumber, ratio: Number) {
        await WETHPartner.approve(router.address, constants.MaxUint256)
        await router.addLiquidityETH(
            {
              token:              WETHPartner.address,
              amountTokenDesired: WETHPartnerAmount,
              amountTokenMin:     0,
              amountETHMin:       0,
              ratio:              ratio,
            },
            wallet.address,
            constants.MaxUint256,
            { ...overrides, value: ETHAmount }
          )
      }  

      [10, 30, 50, 69, 80].forEach( (ratio) => {   
//      [10].forEach( (ratio) => {              
        it(`removeLiquidityETH ratio is ${ratio}-${100-ratio} `, async () => {

          const WETHPartnerAmount = expandTo18Decimals(100)
          const ETHAmount = expandTo18Decimals(4)
          await addLiquidityETH(WETHPartnerAmount, ETHAmount, ratio)
          
          const expectedLiquidityTTE = BigNumberPercent(expandTo18Decimals(20),ratio)
          const expectedLiquidityTEE = BigNumberPercent(expandTo18Decimals(20),100-ratio)

          await WETHPairTTE.approve(router.address, constants.MaxUint256)
          await WETHPairTEE.approve(router.address, constants.MaxUint256)

          await expect(
            router.removeLiquidityETH(
              {
                tokenA:         WETHPartner.address,
                tokenB:         WETH.address,
                liquidityAAB:   expectedLiquidityTTE.sub(MINIMUM_LIQUIDITY),
                liquidityABB:   expectedLiquidityTEE.sub(MINIMUM_LIQUIDITY), 
                amountAMin:     0,
                amountBMin:     0,
              },
              wallet.address,
              constants.MaxUint256,
              overrides
            )
          )
            .to.emit(WETHPairTTE, 'Transfer')
            .withArgs(wallet.address, WETHPairTTE.address, expectedLiquidityTTE.sub(MINIMUM_LIQUIDITY))
            .to.emit(WETHPairTTE, 'Transfer')
            .withArgs(WETHPairTTE.address, constants.AddressZero, expectedLiquidityTTE.sub(MINIMUM_LIQUIDITY))
            .to.emit(WETHPartner, 'Transfer')
            .withArgs(WETHPairTTE.address, router.address, RemoveOutPercent(WETHPartnerAmount,ratio,expectedLiquidityTTE))
            .to.emit(WETH, 'Transfer')
            .withArgs(WETHPairTTE.address, router.address, RemoveOutPercent(ETHAmount,ratio,expectedLiquidityTTE))
            .to.emit(WETHPairTTE, 'Sync')
            .withArgs(RemoveLeftPercent(WETHPartnerAmount,ratio,expectedLiquidityTTE), 
                      RemoveLeftPercent(ETHAmount,ratio,expectedLiquidityTTE))
            .to.emit(WETHPairTTE, 'Burn')
            .withArgs(router.address, RemoveOutPercent(WETHPartnerAmount,ratio,expectedLiquidityTTE), 
                                      RemoveOutPercent(ETHAmount,ratio,expectedLiquidityTTE), router.address)
            .to.emit(WETHPairTEE, 'Transfer')
            .withArgs(wallet.address, WETHPairTEE.address, expectedLiquidityTEE.sub(MINIMUM_LIQUIDITY))
            .to.emit(WETHPairTEE, 'Transfer')
            .withArgs(WETHPairTEE.address, constants.AddressZero, expectedLiquidityTEE.sub(MINIMUM_LIQUIDITY))
            .to.emit(WETH, 'Transfer')
            .withArgs(WETHPairTEE.address, router.address, RemoveOutPercent(ETHAmount,100-ratio,expectedLiquidityTEE))
            .to.emit(WETHPartner, 'Transfer')
            .withArgs(WETHPairTEE.address, router.address, RemoveOutPercent(WETHPartnerAmount,100-ratio,expectedLiquidityTEE))
            .to.emit(WETHPairTEE, 'Sync')
            .withArgs(RemoveLeftPercent(ETHAmount,100-ratio,expectedLiquidityTEE), 
                      RemoveLeftPercent(WETHPartnerAmount,100-ratio,expectedLiquidityTEE))
            .to.emit(WETHPairTEE, 'Burn')
            .withArgs(router.address, RemoveOutPercent(ETHAmount,100-ratio,expectedLiquidityTEE), 
                                      RemoveOutPercent(WETHPartnerAmount,100-ratio,expectedLiquidityTEE), router.address)
            .to.emit(WETHPartner, 'Transfer')
            .withArgs(router.address, wallet.address, RemoveOutPercent(WETHPartnerAmount,ratio,expectedLiquidityTTE).add
                                                      (RemoveOutPercent(WETHPartnerAmount,100-ratio,expectedLiquidityTEE)))                                                                        

          expect(await WETHPairTTE.balanceOf(wallet.address)).to.eq(0)
          expect(await WETHPairTEE.balanceOf(wallet.address)).to.eq(0)         
          const totalSupplyWETHPartner = await WETHPartner.totalSupply()
          const totalSupplyWETH = await WETH.totalSupply()
          expect(await WETHPartner.balanceOf(wallet.address)).to.eq(totalSupplyWETHPartner.sub(
            RemoveLeftPercent(WETHPartnerAmount,ratio,expectedLiquidityTTE)
            .add(RemoveLeftPercent(WETHPartnerAmount,100-ratio,expectedLiquidityTEE))))
          expect(await WETH.balanceOf(wallet.address)).to.eq(totalSupplyWETH.sub(
            RemoveLeftPercent(ETHAmount,ratio,expectedLiquidityTTE)
            .add(RemoveLeftPercent(ETHAmount,100-ratio,expectedLiquidityTEE))))
          expect(await WETH.balanceOf(WETHPairTTE.address)).to.eq(RemoveLeftPercent(ETHAmount,ratio,expectedLiquidityTTE))   
          expect(await WETH.balanceOf(WETHPairTEE.address)).to.eq(RemoveLeftPercent(ETHAmount,100-ratio,expectedLiquidityTEE))       
           
          // Add liquity Again and the Remove, no MINIMUM_LIQUIDITY clearence
          {
            const WETHPartnerAmount = expandTo18Decimals(100)
            const ETHAmount = expandTo18Decimals(4)
            await addLiquidityETH(WETHPartnerAmount, ETHAmount, ratio)
            
            const expectedLiquidityTTE = BigNumberPercent(expandTo18Decimals(20),ratio)
            const expectedLiquidityTEE = BigNumberPercent(expandTo18Decimals(20),100-ratio)
  
            await WETHPairTTE.approve(router.address, constants.MaxUint256)
            await WETHPairTEE.approve(router.address, constants.MaxUint256)
  
            await expect(
              router.removeLiquidityETH(
                {
                  tokenA:         WETHPartner.address,
                  tokenB:         WETH.address,
                  liquidityAAB:   expectedLiquidityTTE,
                  liquidityABB:   expectedLiquidityTEE, 
                  amountAMin:     0,
                  amountBMin:     0,
                },
                wallet.address,
                constants.MaxUint256,
                overrides
              )
            )
              .to.emit(WETHPairTTE, 'Transfer')
              .withArgs(wallet.address, WETHPairTTE.address, expectedLiquidityTTE)
              .to.emit(WETHPairTTE, 'Transfer')
              .withArgs(WETHPairTTE.address, constants.AddressZero, expectedLiquidityTTE)
              .to.emit(WETHPartner, 'Transfer')
              .withArgs(WETHPairTTE.address, router.address, BigNumberPercent(WETHPartnerAmount,ratio))
              .to.emit(WETH, 'Transfer')
              .withArgs(WETHPairTTE.address, router.address, BigNumberPercent(ETHAmount,ratio))
              .to.emit(WETHPairTTE, 'Sync')
              .withArgs(RemoveLeftPercent(WETHPartnerAmount,ratio,expectedLiquidityTTE), 
                        RemoveLeftPercent(ETHAmount,ratio,expectedLiquidityTTE))
              .to.emit(WETHPairTTE, 'Burn')
              .withArgs(router.address, BigNumberPercent(WETHPartnerAmount,ratio), 
                                        BigNumberPercent(ETHAmount,ratio), router.address)
              .to.emit(WETHPairTEE, 'Transfer')
              .withArgs(wallet.address, WETHPairTEE.address, expectedLiquidityTEE)
              .to.emit(WETHPairTEE, 'Transfer')
              .withArgs(WETHPairTEE.address, constants.AddressZero, expectedLiquidityTEE)
              .to.emit(WETH, 'Transfer')
              .withArgs(WETHPairTEE.address, router.address, BigNumberPercent(ETHAmount,100-ratio))
              .to.emit(WETHPartner, 'Transfer')
              .withArgs(WETHPairTEE.address, router.address, BigNumberPercent(WETHPartnerAmount,100-ratio))
              .to.emit(WETHPairTEE, 'Sync')
              .withArgs(RemoveLeftPercent(ETHAmount,100-ratio,expectedLiquidityTEE), 
                        RemoveLeftPercent(WETHPartnerAmount,100-ratio,expectedLiquidityTEE))
              .to.emit(WETHPairTEE, 'Burn')
              .withArgs(router.address, BigNumberPercent(ETHAmount,100-ratio), 
                                        BigNumberPercent(WETHPartnerAmount,100-ratio), router.address)
              .to.emit(WETHPartner, 'Transfer')
              .withArgs(router.address, wallet.address, BigNumberPercent(WETHPartnerAmount,ratio).add
                                                        (BigNumberPercent(WETHPartnerAmount,100-ratio)))                                                                        
  
           expect(await WETHPairTTE.balanceOf(wallet.address)).to.eq(0)
            expect(await WETHPairTEE.balanceOf(wallet.address)).to.eq(0)         
            const totalSupplyWETHPartner = await WETHPartner.totalSupply()
            const totalSupplyWETH = await WETH.totalSupply()
            expect(await WETHPartner.balanceOf(wallet.address)).to.eq(totalSupplyWETHPartner.sub(
              RemoveLeftPercent(WETHPartnerAmount,ratio,expectedLiquidityTTE)
              .add(RemoveLeftPercent(WETHPartnerAmount,100-ratio,expectedLiquidityTEE))))
            expect(await WETH.balanceOf(wallet.address)).to.eq(totalSupplyWETH.sub(
              RemoveLeftPercent(ETHAmount,ratio,expectedLiquidityTTE)
              .add(RemoveLeftPercent(ETHAmount,100-ratio,expectedLiquidityTEE))))
            expect(await WETH.balanceOf(WETHPairTTE.address)).to.eq(RemoveLeftPercent(ETHAmount,ratio,expectedLiquidityTTE))   
            expect(await WETH.balanceOf(WETHPairTEE.address)).to.eq(RemoveLeftPercent(ETHAmount,100-ratio,expectedLiquidityTEE))       
          }
        })
      }) 

      it("RemoveLiquidityETH GAS Test" , async () => {
        const WETHPartnerAmount = expandTo18Decimals(100)
        const ETHAmount = expandTo18Decimals(4)
        const ratio = 50
        await addLiquidityETH(WETHPartnerAmount, ETHAmount, ratio)
        
        const expectedLiquidityTTE = BigNumberPercent(expandTo18Decimals(20),ratio)
        const expectedLiquidityTEE = BigNumberPercent(expandTo18Decimals(20),100-ratio)

        await WETHPairTTE.approve(router.address, constants.MaxUint256)
        await WETHPairTEE.approve(router.address, constants.MaxUint256)

        const lastBlock = await provider.getBlock('latest')
        const blockTimestamp = lastBlock.timestamp
        await mineBlock(provider, blockTimestamp + 5)

        let tx = await router.removeLiquidityETH(
            {
              tokenA:         WETHPartner.address,
              tokenB:         WETH.address,
              liquidityAAB:   expectedLiquidityTTE.sub(MINIMUM_LIQUIDITY),
              liquidityABB:   expectedLiquidityTEE.sub(MINIMUM_LIQUIDITY), 
              amountAMin:     0,
              amountBMin:     0,
            },
            wallet.address,
            constants.MaxUint256,
            overrides
          )

        let receipt = await tx.wait()
        expect(receipt.gasUsed).to.eq("198477")        //200020 200027 201599  201592 201796  201757 201845 287766 287685 289285 289263 319192 322243 322502 322258 322192 322146 319743, 316529, 284451 : Uniswap: 194881
          
        await addLiquidityETH(WETHPartnerAmount, ETHAmount, ratio)
        await mineBlock(provider, blockTimestamp + 10)
        tx = await router.removeLiquidityETH(
            {
              tokenA:         WETHPartner.address,
              tokenB:         WETH.address,
              liquidityAAB:   expectedLiquidityTTE,
              liquidityABB:   expectedLiquidityTEE, 
              amountAMin:     0,
              amountBMin:     0,
            },
            wallet.address,
            constants.MaxUint256,
            overrides
          )

        receipt = await tx.wait()
        expect(receipt.gasUsed).to.eq("198429")        // 199972 199979 201551 231599 231592 231796 231845 257766 257685
      })
    
      it(`removeLiquidityETH TTE ratio: 100-0 `, async () => {

        const WETHPartnerAmount = expandTo18Decimals(100)
        const ETHAmount = expandTo18Decimals(4)
        const ratio = 100
        await addLiquidityETH(WETHPartnerAmount, ETHAmount, ratio)
        
        const expectedLiquidityTTE = BigNumberPercent(expandTo18Decimals(20),ratio)
        await WETHPairTTE.approve(router.address, constants.MaxUint256)
        await WETHPairTEE.approve(router.address, constants.MaxUint256)

        await expect(
          router.removeLiquidityETH(
            {
              tokenA:         WETHPartner.address,
              tokenB:         WETH.address,
              liquidityAAB:   expectedLiquidityTTE.sub(MINIMUM_LIQUIDITY),
              liquidityABB:   0, 
              amountAMin:     0,
              amountBMin:     0,
            },
            wallet.address,
            constants.MaxUint256,
            overrides
          )
        )
          .to.emit(WETHPairTTE, 'Transfer')
          .withArgs(wallet.address, WETHPairTTE.address, expectedLiquidityTTE.sub(MINIMUM_LIQUIDITY))
          .to.emit(WETHPairTTE, 'Transfer')
          .withArgs(WETHPairTTE.address, constants.AddressZero, expectedLiquidityTTE.sub(MINIMUM_LIQUIDITY))
          .to.emit(WETHPartner, 'Transfer')
          .withArgs(WETHPairTTE.address, router.address, RemoveOutPercent(WETHPartnerAmount,ratio,expectedLiquidityTTE))
          .to.emit(WETH, 'Transfer')
          .withArgs(WETHPairTTE.address, router.address, RemoveOutPercent(ETHAmount,ratio,expectedLiquidityTTE))
          .to.emit(WETHPairTTE, 'Sync')
          .withArgs(RemoveLeftPercent(WETHPartnerAmount,ratio,expectedLiquidityTTE), 
                    RemoveLeftPercent(ETHAmount,ratio,expectedLiquidityTTE))
          .to.emit(WETHPairTTE, 'Burn')
          .withArgs(router.address, RemoveOutPercent(WETHPartnerAmount,ratio,expectedLiquidityTTE), 
                                    RemoveOutPercent(ETHAmount,ratio,expectedLiquidityTTE), router.address)
          .to.emit(WETHPartner, 'Transfer')
          .withArgs(router.address, wallet.address, RemoveOutPercent(WETHPartnerAmount,ratio,expectedLiquidityTTE))

        expect(await WETHPairTTE.balanceOf(wallet.address)).to.eq(0)
        expect(await WETHPairTEE.balanceOf(wallet.address)).to.eq(0)         
        const totalSupplyWETHPartner = await WETHPartner.totalSupply()
        const totalSupplyWETH = await WETH.totalSupply()
        expect(await WETHPartner.balanceOf(wallet.address)).to.eq(totalSupplyWETHPartner.sub(
          RemoveLeftPercent(WETHPartnerAmount,ratio,expectedLiquidityTTE)))
        expect(await WETH.balanceOf(wallet.address)).to.eq(totalSupplyWETH.sub(
          RemoveLeftPercent(ETHAmount,ratio,expectedLiquidityTTE)))
        expect(await WETH.balanceOf(WETHPairTTE.address)).to.eq(RemoveLeftPercent(ETHAmount,ratio,expectedLiquidityTTE))   
      })

      it(`removeLiquidityETH TTE ratio: 100-0: GAS Usage `, async () => {

        const WETHPartnerAmount = expandTo18Decimals(100)
        const ETHAmount = expandTo18Decimals(4)
        const ratio = 100
        await addLiquidityETH(WETHPartnerAmount, ETHAmount, ratio)
        
        const expectedLiquidityTTE = BigNumberPercent(expandTo18Decimals(20),ratio)
        await WETHPairTTE.approve(router.address, constants.MaxUint256)
        await WETHPairTEE.approve(router.address, constants.MaxUint256)

        const lastBlock = await provider.getBlock('latest')
        const blockTimestamp = lastBlock.timestamp
        await mineBlock(provider, blockTimestamp + 5)

        let tx = await router.removeLiquidityETH(
            {
              tokenA:         WETHPartner.address,
              tokenB:         WETH.address,
              liquidityAAB:   expectedLiquidityTTE.sub(MINIMUM_LIQUIDITY),
              liquidityABB:   0, 
              amountAMin:     0,
              amountBMin:     0,
            },
            wallet.address,
            constants.MaxUint256,
            overrides
          )
        let receipt = await tx.wait()
        expect(receipt.gasUsed).to.eq("127935")        // 128790 128797 129583 129678 129662 129706 172663 172626 173426 173404 188592 190025 190151 144677,  284451 : Uniswap: 194881
 
        await addLiquidityETH(WETHPartnerAmount, ETHAmount, ratio)
        await mineBlock(provider, blockTimestamp + 10) 
        tx = await router.removeLiquidityETH(
          {
            tokenA:         WETHPartner.address,
            tokenB:         WETH.address,
            liquidityAAB:   expectedLiquidityTTE,
            liquidityABB:   0, 
            amountAMin:     0,
            amountBMin:     0,
          },
          wallet.address,
          constants.MaxUint256,
          overrides
        )
        receipt = await tx.wait()
        expect(receipt.gasUsed).to.eq("127911")        // 128766 128773 129559 144583 144678 144662 144706 157663 172626
      })

      it(`removeLiquidityTEE ratio: 0-100 `, async () => {

        await pairAAB.approve(router.address, constants.MaxUint256)
        await pairABB.approve(router.address, constants.MaxUint256)

        const WETHPartnerAmount = expandTo18Decimals(100)
        const ETHAmount = expandTo18Decimals(4)
        const ratio = 0
        await addLiquidityETH(WETHPartnerAmount, ETHAmount, ratio)
        
        const expectedLiquidityTEE = BigNumberPercent(expandTo18Decimals(20),100-ratio)

        await WETHPairTTE.approve(router.address, constants.MaxUint256)
        await WETHPairTEE.approve(router.address, constants.MaxUint256)

        await expect(
          router.removeLiquidityETH(
            {
              tokenA:         WETHPartner.address,
              tokenB:         WETH.address,
              liquidityAAB:   0,
              liquidityABB:   expectedLiquidityTEE.sub(MINIMUM_LIQUIDITY), 
              amountAMin:     0,
              amountBMin:     0,
            },
            wallet.address,
            constants.MaxUint256,
            overrides
          )
        )
          .to.emit(WETHPairTEE, 'Transfer')
          .withArgs(wallet.address, WETHPairTEE.address, expectedLiquidityTEE.sub(MINIMUM_LIQUIDITY))
          .to.emit(WETHPairTEE, 'Transfer')
          .withArgs(WETHPairTEE.address, constants.AddressZero, expectedLiquidityTEE.sub(MINIMUM_LIQUIDITY))
          .to.emit(WETH, 'Transfer')
          .withArgs(WETHPairTEE.address, router.address, RemoveOutPercent(ETHAmount,100-ratio,expectedLiquidityTEE))
          .to.emit(WETHPartner, 'Transfer')
          .withArgs(WETHPairTEE.address, router.address, RemoveOutPercent(WETHPartnerAmount,100-ratio,expectedLiquidityTEE))
          .to.emit(WETHPairTEE, 'Sync')
          .withArgs(RemoveLeftPercent(ETHAmount,100-ratio,expectedLiquidityTEE), 
                    RemoveLeftPercent(WETHPartnerAmount,100-ratio,expectedLiquidityTEE))
          .to.emit(WETHPairTEE, 'Burn')
          .withArgs(router.address, RemoveOutPercent(ETHAmount,100-ratio,expectedLiquidityTEE), 
                                    RemoveOutPercent(WETHPartnerAmount,100-ratio,expectedLiquidityTEE), router.address)
          .to.emit(WETHPartner, 'Transfer')
          .withArgs(router.address, wallet.address, RemoveOutPercent(WETHPartnerAmount,100-ratio,expectedLiquidityTEE))

        expect(await WETHPairTTE.balanceOf(wallet.address)).to.eq(0)
        expect(await WETHPairTEE.balanceOf(wallet.address)).to.eq(0)         
        const totalSupplyWETHPartner = await WETHPartner.totalSupply()
        const totalSupplyWETH = await WETH.totalSupply()
        expect(await WETHPartner.balanceOf(wallet.address)).to.eq(totalSupplyWETHPartner.sub(
          RemoveLeftPercent(WETHPartnerAmount,100-ratio,expectedLiquidityTEE)))
        expect(await WETH.balanceOf(wallet.address)).to.eq(totalSupplyWETH.sub(
          RemoveLeftPercent(ETHAmount,100-ratio,expectedLiquidityTEE)))
        expect(await WETH.balanceOf(WETHPairTEE.address)).to.eq(RemoveLeftPercent(ETHAmount,100-ratio,expectedLiquidityTEE))       
      })

      it(`removeLiquidityETHWithPermit Signal Signature`, async () => {

        const WETHPartnerAmount = expandTo18Decimals(100)
        const ETHAmount = expandTo18Decimals(4)
        const ratio = 100
        await addLiquidityETH(WETHPartnerAmount, ETHAmount, ratio)
        
        const expectedLiquidityTTE = BigNumberPercent(expandTo18Decimals(20),ratio)
        
        const nonce = await WETHPairTTE.nonces(wallet.address)
        const digest = await getApprovalDigest(
          WETHPairTTE,
          { owner: wallet.address, spender: router.address, value: expectedLiquidityTTE.sub(MINIMUM_LIQUIDITY) },
          nonce,
          constants.MaxUint256
        )

        const { v, r, s } = ecsign(Buffer.from(digest.slice(2), 'hex'), Buffer.from(wallet.privateKey.slice(2), 'hex'))
        const ZeroBuffer = Buffer.alloc(32)

        await expect(
          router.removeLiquidityETHWithPermit(
            {
              tokenA:         WETHPartner.address,
              tokenB:         WETH.address,
              liquidityAAB:   expectedLiquidityTTE.sub(MINIMUM_LIQUIDITY),
              liquidityABB:   0, 
              amountAMin:     0,
              amountBMin:     0,
            },
            wallet.address,
            constants.MaxUint256,
            false,
            {v, r, s},
            {v: 0, r: ZeroBuffer, s: ZeroBuffer },        
            overrides
          )
        )
          .to.emit(WETHPairTTE, 'Transfer')
          .withArgs(wallet.address, WETHPairTTE.address, expectedLiquidityTTE.sub(MINIMUM_LIQUIDITY))
          .to.emit(WETHPairTTE, 'Transfer')
          .withArgs(WETHPairTTE.address, constants.AddressZero, expectedLiquidityTTE.sub(MINIMUM_LIQUIDITY))
          .to.emit(WETHPartner, 'Transfer')
          .withArgs(WETHPairTTE.address, router.address, RemoveOutPercent(WETHPartnerAmount,ratio,expectedLiquidityTTE))
          .to.emit(WETH, 'Transfer')
          .withArgs(WETHPairTTE.address, router.address, RemoveOutPercent(ETHAmount,ratio,expectedLiquidityTTE))
          .to.emit(WETHPairTTE, 'Sync')
          .withArgs(RemoveLeftPercent(WETHPartnerAmount,ratio,expectedLiquidityTTE), 
                    RemoveLeftPercent(ETHAmount,ratio,expectedLiquidityTTE))
          .to.emit(WETHPairTTE, 'Burn')
          .withArgs(router.address, RemoveOutPercent(WETHPartnerAmount,ratio,expectedLiquidityTTE), 
                                    RemoveOutPercent(ETHAmount,ratio,expectedLiquidityTTE), router.address)
          .to.emit(WETHPartner, 'Transfer')
          .withArgs(router.address, wallet.address, RemoveOutPercent(WETHPartnerAmount,ratio,expectedLiquidityTTE))

        expect(await WETHPairTTE.balanceOf(wallet.address)).to.eq(0)
        expect(await WETHPairTEE.balanceOf(wallet.address)).to.eq(0)         
        const totalSupplyWETHPartner = await WETHPartner.totalSupply()
        const totalSupplyWETH = await WETH.totalSupply()
        expect(await WETHPartner.balanceOf(wallet.address)).to.eq(totalSupplyWETHPartner.sub(
          RemoveLeftPercent(WETHPartnerAmount,ratio,expectedLiquidityTTE)))
        expect(await WETH.balanceOf(wallet.address)).to.eq(totalSupplyWETH.sub(
          RemoveLeftPercent(ETHAmount,ratio,expectedLiquidityTTE)))
        expect(await WETH.balanceOf(WETHPairTTE.address)).to.eq(RemoveLeftPercent(ETHAmount,ratio,expectedLiquidityTTE))   
      })

      it(`removeLiquidityETHWithPermit Double Signature`, async () => {

        const ratio = 40
        const WETHPartnerAmount = expandTo18Decimals(100)
        const ETHAmount = expandTo18Decimals(4)
        await addLiquidityETH(WETHPartnerAmount, ETHAmount, ratio)
        
        const expectedLiquidityTTE = BigNumberPercent(expandTo18Decimals(20),ratio)
        const expectedLiquidityTEE = BigNumberPercent(expandTo18Decimals(20),100-ratio)

        const nonce1 = await WETHPairTTE.nonces(wallet.address)
        const digest1 = await getApprovalDigest(
          WETHPairTTE,
          { owner: wallet.address, spender: router.address, value: expectedLiquidityTTE.sub(MINIMUM_LIQUIDITY) },
          nonce1,
          constants.MaxUint256
        )
        const { v: v1, r: r1, s: s1 } = ecsign(Buffer.from(digest1.slice(2), 'hex'), Buffer.from(wallet.privateKey.slice(2), 'hex'))

        const nonce2 = await WETHPairTEE.nonces(wallet.address)
        const digest2 = await getApprovalDigest(
          WETHPairTEE,
          { owner: wallet.address, spender: router.address, value: expectedLiquidityTEE.sub(MINIMUM_LIQUIDITY) },
          nonce2,
          constants.MaxUint256
        )
        const { v: v2, r: r2, s: s2 } = ecsign(Buffer.from(digest2.slice(2), 'hex'), Buffer.from(wallet.privateKey.slice(2), 'hex'))

        await expect(
          router.removeLiquidityETHWithPermit(
            {
              tokenA:         WETHPartner.address,
              tokenB:         WETH.address,
              liquidityAAB:   expectedLiquidityTTE.sub(MINIMUM_LIQUIDITY),
              liquidityABB:   expectedLiquidityTEE.sub(MINIMUM_LIQUIDITY), 
              amountAMin:     0,
              amountBMin:     0,
            },
            wallet.address,
            constants.MaxUint256,
            false,
            {v: v1, r: r1, s: s1},
            {v: v2, r: r2, s: s2},  
            overrides
          )
        )
          .to.emit(WETHPairTTE, 'Transfer')
          .withArgs(wallet.address, WETHPairTTE.address, expectedLiquidityTTE.sub(MINIMUM_LIQUIDITY))
          .to.emit(WETHPairTTE, 'Transfer')
          .withArgs(WETHPairTTE.address, constants.AddressZero, expectedLiquidityTTE.sub(MINIMUM_LIQUIDITY))
          .to.emit(WETHPartner, 'Transfer')
          .withArgs(WETHPairTTE.address, router.address, RemoveOutPercent(WETHPartnerAmount,ratio,expectedLiquidityTTE))
          .to.emit(WETH, 'Transfer')
          .withArgs(WETHPairTTE.address, router.address, RemoveOutPercent(ETHAmount,ratio,expectedLiquidityTTE))
          .to.emit(WETHPairTTE, 'Sync')
          .withArgs(RemoveLeftPercent(WETHPartnerAmount,ratio,expectedLiquidityTTE), 
                    RemoveLeftPercent(ETHAmount,ratio,expectedLiquidityTTE))
          .to.emit(WETHPairTTE, 'Burn')
          .withArgs(router.address, RemoveOutPercent(WETHPartnerAmount,ratio,expectedLiquidityTTE), 
                                    RemoveOutPercent(ETHAmount,ratio,expectedLiquidityTTE), router.address)
          .to.emit(WETHPairTEE, 'Transfer')
          .withArgs(wallet.address, WETHPairTEE.address, expectedLiquidityTEE.sub(MINIMUM_LIQUIDITY))
          .to.emit(WETHPairTEE, 'Transfer')
          .withArgs(WETHPairTEE.address, constants.AddressZero, expectedLiquidityTEE.sub(MINIMUM_LIQUIDITY))
          .to.emit(WETH, 'Transfer')
          .withArgs(WETHPairTEE.address, router.address, RemoveOutPercent(ETHAmount,100-ratio,expectedLiquidityTEE))
          .to.emit(WETHPartner, 'Transfer')
          .withArgs(WETHPairTEE.address, router.address, RemoveOutPercent(WETHPartnerAmount,100-ratio,expectedLiquidityTEE))
          .to.emit(WETHPairTEE, 'Sync')
          .withArgs(RemoveLeftPercent(ETHAmount,100-ratio,expectedLiquidityTEE), 
                    RemoveLeftPercent(WETHPartnerAmount,100-ratio,expectedLiquidityTEE))
          .to.emit(WETHPairTEE, 'Burn')
          .withArgs(router.address, RemoveOutPercent(ETHAmount,100-ratio,expectedLiquidityTEE), 
                                    RemoveOutPercent(WETHPartnerAmount,100-ratio,expectedLiquidityTEE), router.address)
          .to.emit(WETHPartner, 'Transfer')
          .withArgs(router.address, wallet.address, RemoveOutPercent(WETHPartnerAmount,ratio,expectedLiquidityTTE).add
                                                    (RemoveOutPercent(WETHPartnerAmount,100-ratio,expectedLiquidityTEE)))                                                                        

        expect(await WETHPairTTE.balanceOf(wallet.address)).to.eq(0)
        expect(await WETHPairTEE.balanceOf(wallet.address)).to.eq(0)         
        const totalSupplyWETHPartner = await WETHPartner.totalSupply()
        const totalSupplyWETH = await WETH.totalSupply()
        expect(await WETHPartner.balanceOf(wallet.address)).to.eq(totalSupplyWETHPartner.sub(
          RemoveLeftPercent(WETHPartnerAmount,ratio,expectedLiquidityTTE)
          .add(RemoveLeftPercent(WETHPartnerAmount,100-ratio,expectedLiquidityTEE))))
        expect(await WETH.balanceOf(wallet.address)).to.eq(totalSupplyWETH.sub(
          RemoveLeftPercent(ETHAmount,ratio,expectedLiquidityTTE)
          .add(RemoveLeftPercent(ETHAmount,100-ratio,expectedLiquidityTEE))))
        expect(await WETH.balanceOf(WETHPairTTE.address)).to.eq(RemoveLeftPercent(ETHAmount,ratio,expectedLiquidityTTE))   
        expect(await WETH.balanceOf(WETHPairTEE.address)).to.eq(RemoveLeftPercent(ETHAmount,100-ratio,expectedLiquidityTEE))       
      })
    })
})
