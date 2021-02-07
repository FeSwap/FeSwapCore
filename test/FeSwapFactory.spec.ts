import chai, { expect } from 'chai'
import { Contract } from 'ethers'
import { AddressZero, WeiPerEther, MaxUint256 } from 'ethers/constants'
import { bigNumberify } from 'ethers/utils'
import { solidity, MockProvider, createFixtureLoader, deployContract } from 'ethereum-waffle'
import ERC20 from '../build/ERC20.json'

import { expandTo18Decimals, getCreate2AddressFeSwap } from './shared/utilities'
import { factoryFixture } from './shared/fixtures'

import FeSwapPair from '../build/FeSwapPair.json'

chai.use(solidity)

const overrides = {
  gasLimit: 9999999
}

describe('FeSwapFactory', () => {
  const provider = new MockProvider({
    hardfork: 'istanbul',
    mnemonic: 'horn horn horn horn horn horn horn horn horn horn horn horn',
    gasLimit: 9999999
  })
  const [wallet, other] = provider.getWallets()
  const loadFixture = createFixtureLoader(provider, [wallet, other])

  let factory: Contract
  let tokenA: string  
  let tokenB: string  
  const bytecode = `0x${FeSwapPair.evm.bytecode.object}`

  beforeEach(async () => {
    const fixture = await loadFixture(factoryFixture)
    factory = fixture.factory

    const tokenAContract = await deployContract(wallet, ERC20, [expandTo18Decimals(10000),"Token A"], overrides)
    const tokenBContract = await deployContract(wallet, ERC20, [expandTo18Decimals(10000),"Token B"], overrides)
    tokenA = tokenAContract.address
    tokenB = tokenBContract.address

  })

  it('feeTo, feeToSetter, routerFeSwap, feeToCreatePair, allPairsLength', async () => {
    expect(await factory.feeTo()).to.eq(wallet.address)
    expect(await factory.feeToSetter()).to.eq(wallet.address)
    expect(await factory.routerFeSwap()).to.eq(AddressZero)
    expect(await factory.feeToCreatePair()).to.eq(WeiPerEther)   
    expect(await factory.allPairsLength()).to.eq(0)
  })

  async function testCreatePair(tokens: [string, string, string]) {
    const [tokenIn, tokenOut, pairCreator ] = [...tokens]

    const create2AddressAAB  = getCreate2AddressFeSwap(factory.address, [tokenIn, tokenOut], bytecode)
    const create2AddressABB  = getCreate2AddressFeSwap(factory.address, [tokenOut, tokenIn], bytecode)

    await expect(factory.connect(other).createPair(tokenIn, tokenOut, pairCreator))
      .to.be.revertedWith('FeSwap: FORBIDDEN')                          // FeSwap: FORBIDDEN

    const simuRouter = pairCreator  
    await factory.setRouterFeSwap(simuRouter)                          // fake router, just for test

    await expect(factory.createPair(tokenIn, tokenOut, pairCreator))
      .to.emit(factory, 'PairCreated')
      .withArgs(tokenIn, tokenOut, create2AddressAAB, create2AddressABB, bigNumberify(2))

    await expect(factory.createPair(tokenIn, tokenIn, pairCreator))
                .to.be.revertedWith('FeSwap: IDENTICAL_ADDRESSES')      // FeSwap: IDENTICAL_ADDRESSES
    await expect(factory.createPair(tokenOut, tokenOut, pairCreator))
                .to.be.revertedWith('FeSwap: IDENTICAL_ADDRESSES')      // FeSwap: IDENTICAL_ADDRESSES
    await expect(factory.createPair(tokenIn, tokenOut, pairCreator))
                .to.be.revertedWith('FeSwap: PAIR_EXISTS')              // FeSwap: PAIR_EXISTS
    await expect(factory.createPair(tokenOut, tokenIn, pairCreator))
                .to.be.revertedWith('FeSwap: PAIR_EXISTS')              // FeSwap: PAIR_EXISTS
    await expect(factory.createPair(tokenIn, AddressZero, pairCreator))
                .to.be.revertedWith('FeSwap: ZERO_ADDRESS')             // FeSwap: FeSwap: ZERO_ADDRESS
    await expect(factory.createPair(AddressZero, tokenOut, pairCreator))
                .to.be.revertedWith('FeSwap: ZERO_ADDRESS')             // FeSwap: FeSwap: ZERO_ADDRESS

    expect(await factory.getPair(tokenIn, tokenOut)).to.eq(create2AddressAAB)
    expect(await factory.getPair(tokenOut, tokenIn)).to.eq(create2AddressABB)
    expect(await factory.allPairs(0)).to.eq(create2AddressAAB)
    expect(await factory.allPairs(1)).to.eq(create2AddressABB)  
    expect(await factory.allPairsLength()).to.eq(2)

    const pairAAB = new Contract(create2AddressAAB, JSON.stringify(FeSwapPair.abi), provider)
    expect(await pairAAB.factory()).to.eq(factory.address)
    expect(await pairAAB.pairCreator()).to.eq(pairCreator)
    expect(await pairAAB.tokenIn()).to.eq(tokenIn)
    expect(await pairAAB.tokenOut()).to.eq(tokenOut)
    
    const pairABB = new Contract(create2AddressABB, JSON.stringify(FeSwapPair.abi), provider)
    expect(await pairABB.factory()).to.eq(factory.address)
    expect(await pairABB.pairCreator()).to.eq(pairCreator)    
    expect(await pairABB.tokenIn()).to.eq(tokenOut)
    expect(await pairABB.tokenOut()).to.eq(tokenIn)

    // Check that the two pools approve to each other
    const tokenInContract = new Contract(tokenIn, JSON.stringify(ERC20.abi), provider)
    const tokenOutContract = new Contract(tokenOut, JSON.stringify(ERC20.abi), provider)  

    expect(await tokenInContract.allowance(create2AddressAAB,simuRouter)).to.eq(MaxUint256)
    expect(await tokenOutContract.allowance(create2AddressABB,simuRouter)).to.eq(MaxUint256) 
  }

  it('createPair', async () => {
    await testCreatePair([tokenA, tokenB, wallet.address])
  })

  it('createPair:reverse', async () => {
    await testCreatePair([tokenB, tokenA, wallet.address])
  })

  it('createPair:gas', async () => {
    await factory.setRouterFeSwap( wallet.address)
    const tx = await factory.createPair(tokenA, tokenB, wallet.address)
    const receipt = await tx.wait()
    expect(receipt.gasUsed).to.eq(5096745)        // 5122392, 4913779,   UniSwap: 2512920
  })

  it('setFeeTo', async () => {
    await expect(factory.connect(other).setFeeTo(other.address)).to.be.revertedWith('FeSwap: FORBIDDEN')
    await factory.setFeeTo(other.address)
    expect(await factory.feeTo()).to.eq(other.address)
  })

  it('setFeeToSetter', async () => {
    await expect(factory.connect(other).setFeeToSetter(other.address)).to.be.revertedWith('FeSwap: FORBIDDEN')
    await factory.setFeeToSetter(other.address)
    expect(await factory.feeToSetter()).to.eq(other.address)
    await expect(factory.setFeeToSetter(wallet.address)).to.be.revertedWith('FeSwap: FORBIDDEN')
    await factory.connect(other).setFeeTo(other.address)
  })

  it('setRouterFeSwap', async () => {
    await expect(factory.connect(other).setRouterFeSwap(other.address)).to.be.revertedWith('FeSwap: FORBIDDEN')
    await factory.setRouterFeSwap(other.address)
    expect(await factory.routerFeSwap()).to.eq(other.address)
    await factory.setRouterFeSwap(wallet.address)
    expect(await factory.routerFeSwap()).to.eq(wallet.address)  
  })

  it('setFeeToCreatePair', async () => {
    const _feeCreatePair = expandTo18Decimals(2)
    await expect(factory.connect(other).setFeeToCreatePair(_feeCreatePair)).to.be.revertedWith('FeSwap: FORBIDDEN')
    await factory.setFeeToCreatePair(_feeCreatePair)
    expect(await factory.feeToCreatePair()).to.eq(_feeCreatePair)
    await factory.setFeeToCreatePair(expandTo18Decimals(5))
    expect(await factory.feeToCreatePair()).to.eq(expandTo18Decimals(5))  
  })
})
