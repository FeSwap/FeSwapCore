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
  const [wallet, other, other1] = provider.getWallets()
  const loadFixture = createFixtureLoader(provider, [wallet, other])

  let factory: Contract
  let tokenA: Contract  
  let tokenB: Contract  
  let tokenC: Contract  
  
  const bytecode = `0x${FeSwapPair.evm.bytecode.object}`

  beforeEach(async () => {
    const fixture = await loadFixture(factoryFixture)
    factory = fixture.factory
    tokenA = await deployContract(wallet, ERC20, [expandTo18Decimals(10000),"Token A"], overrides)
    tokenB = await deployContract(wallet, ERC20, [expandTo18Decimals(10000),"Token B"], overrides)
    tokenC = await deployContract(wallet, ERC20, [expandTo18Decimals(10000),"Token C"], overrides)
  })

  it('feeTo, factoryAdmin, routerFeSwap, allPairsLength', async () => {
    expect(await factory.feeTo()).to.eq(AddressZero)
    expect(await factory.factoryAdmin()).to.eq(wallet.address)
    expect(await factory.routerFeSwap()).to.eq(AddressZero)
    expect(await factory.allPairsLength()).to.eq(0)
  })

  it('createUpdatePair: Basic checking', async () => {
    await expect(factory.connect(other1).createUpdatePair(tokenA.address, tokenA.address, other1.address))
      .to.be.revertedWith('FeSwap: IDENTICAL_ADDRESSES')                    // FeSwap: IDENTICAL_ADDRESSES

    await expect(factory.connect(other1).createUpdatePair(tokenA.address, tokenB.address, other1.address))
      .to.be.revertedWith('FeSwap: ZERO_ADDRESS')                           // FeSwap: ZERO_ADDRESS, routerFeSwap is 0

    await factory.setRouterFeSwap(other.address)  
    await expect(factory.connect(other1).createUpdatePair(tokenA.address, tokenB.address, other1.address))
      .to.be.revertedWith('FeSwap: FORBIDDEN')                              // FeSwap: FORBIDDEN  
      
    await expect(factory.createUpdatePair(tokenA.address, AddressZero, wallet.address))
      .to.be.revertedWith('FeSwap: ZERO_ADDRESS')                           // FeSwap: FeSwap: ZERO_ADDRESS

    await expect(factory.createUpdatePair(AddressZero, tokenB.address, wallet.address))
      .to.be.revertedWith('FeSwap: ZERO_ADDRESS')                           // FeSwap: FeSwap: ZERO_ADDRESS      

    await factory.createUpdatePair(tokenA.address, tokenB.address, wallet.address)
    
    // simulate creating from router ( other is simulated as routerFeSwap)
    await factory.connect(other).createUpdatePair(tokenA.address, tokenC.address, other.address)     
  })  

  it('createUpdatePair: Normal function checking', async () => {
    const create2AddressAAB  = getCreate2AddressFeSwap(factory.address, [tokenA.address, tokenB.address], bytecode)
    const create2AddressABB  = getCreate2AddressFeSwap(factory.address, [tokenB.address, tokenA.address], bytecode)

    await factory.setRouterFeSwap(other1.address)                          // simulate router, just for test

    await expect(factory.createUpdatePair(tokenA.address, tokenB.address, other.address))
      .to.emit(factory, 'PairCreated')
      .withArgs(tokenA.address, tokenB.address, create2AddressAAB, create2AddressABB, bigNumberify(2))

    expect(await factory.getPair(tokenA.address, tokenB.address)).to.eq(create2AddressAAB)
    expect(await factory.getPair(tokenB.address, tokenA.address)).to.eq(create2AddressABB)
    expect(await factory.allPairs(0)).to.eq(create2AddressAAB)
    expect(await factory.allPairs(1)).to.eq(create2AddressABB)  
    expect(await factory.allPairsLength()).to.eq(2)

    const pairAAB = new Contract(create2AddressAAB, JSON.stringify(FeSwapPair.abi), provider)
    expect(await pairAAB.factory()).to.eq(factory.address)
    expect(await pairAAB.pairOwner()).to.eq(other.address)
    expect(await pairAAB.tokenIn()).to.eq(tokenA.address)
    expect(await pairAAB.tokenOut()).to.eq(tokenB.address)
    
    const pairABB = new Contract(create2AddressABB, JSON.stringify(FeSwapPair.abi), provider)
    expect(await pairABB.factory()).to.eq(factory.address)
    expect(await pairABB.pairOwner()).to.eq(other.address)    
    expect(await pairABB.tokenIn()).to.eq(tokenB.address)
    expect(await pairABB.tokenOut()).to.eq(tokenA.address)

    // Check that the two pools approve to router
    const tokenAContract = new Contract(tokenA.address, JSON.stringify(ERC20.abi), provider)
    const tokenBContract = new Contract(tokenB.address, JSON.stringify(ERC20.abi), provider)  

    expect(await tokenAContract.allowance(create2AddressAAB, other1.address)).to.eq(MaxUint256)
    expect(await tokenBContract.allowance(create2AddressABB, other1.address)).to.eq(MaxUint256) 
  })

  it('createUpdatePair: Create two liquidity pools', async () => {
    const create2AddressAAB  = getCreate2AddressFeSwap(factory.address, [tokenA.address, tokenB.address], bytecode)
    const create2AddressABB  = getCreate2AddressFeSwap(factory.address, [tokenB.address, tokenA.address], bytecode)

    const create2AddressAAC  = getCreate2AddressFeSwap(factory.address, [tokenA.address, tokenC.address], bytecode)
    const create2AddressACC  = getCreate2AddressFeSwap(factory.address, [tokenC.address, tokenA.address], bytecode)

    await factory.setRouterFeSwap(other1.address)                          // simulate router, just for test

    await expect(factory.createUpdatePair(tokenA.address, tokenB.address, wallet.address))
      .to.emit(factory, 'PairCreated')
      .withArgs(tokenA.address, tokenB.address, create2AddressAAB, create2AddressABB, bigNumberify(2))

    await expect(factory.connect(other1).createUpdatePair(tokenA.address, tokenC.address, other.address))
      .to.emit(factory, 'PairCreated')
      .withArgs(tokenA.address, tokenC.address, create2AddressAAC, create2AddressACC, bigNumberify(4))

    expect(await factory.getPair(tokenA.address, tokenB.address)).to.eq(create2AddressAAB)
    expect(await factory.getPair(tokenB.address, tokenA.address)).to.eq(create2AddressABB)
    expect(await factory.getPair(tokenA.address, tokenC.address)).to.eq(create2AddressAAC)
    expect(await factory.getPair(tokenC.address, tokenA.address)).to.eq(create2AddressACC)
    expect(await factory.allPairs(0)).to.eq(create2AddressAAB)
    expect(await factory.allPairs(1)).to.eq(create2AddressABB)  
    expect(await factory.allPairs(2)).to.eq(create2AddressAAC)
    expect(await factory.allPairs(3)).to.eq(create2AddressACC)    
  })

  it('createUpdatePair: Update owner of liquidity pools', async () => {
    const create2AddressAAB  = getCreate2AddressFeSwap(factory.address, [tokenA.address, tokenB.address], bytecode)
    const create2AddressABB  = getCreate2AddressFeSwap(factory.address, [tokenB.address, tokenA.address], bytecode)

    await factory.setRouterFeSwap(other1.address)                          // simulate router, just for test

    await expect(factory.connect(other1).createUpdatePair(tokenA.address, tokenB.address, other.address))
      .to.emit(factory, 'PairCreated')
      .withArgs(tokenA.address, tokenB.address, create2AddressAAB, create2AddressABB, bigNumberify(2))

    await expect(factory.connect(other1).createUpdatePair(tokenA.address, tokenB.address, other1.address))
      .to.emit(factory, 'PairOwnerChanged')
      .withArgs(create2AddressAAB, create2AddressABB, other.address, other1.address )
  })

  it('createUpdatePair:gas', async () => {
    await factory.setRouterFeSwap( wallet.address)
    let tx = await factory.createUpdatePair(tokenA.address, tokenB.address, wallet.address)
    let receipt = await tx.wait()
    expect(receipt.gasUsed).to.eq(5223877)        // 5219858, 4913779,   UniSwap: 2512920

    // update owneer
    tx = await factory.createUpdatePair(tokenA.address, tokenB.address, other.address)
    receipt = await tx.wait()
    expect(receipt.gasUsed).to.eq(48059)        // 48059
  }).retries(3)

  it('setFeeTo', async () => {
    await expect(factory.connect(other).setFeeTo(other.address)).to.be.revertedWith('FeSwap: FORBIDDEN')
    await factory.setFeeTo(other.address)
    expect(await factory.feeTo()).to.eq(other.address)
  })

  it('setFactoryAdmin', async () => {
    await expect(factory.connect(other).setFactoryAdmin(other.address)).to.be.revertedWith('FeSwap: FORBIDDEN')

    await factory.setFactoryAdmin(other.address)
    expect(await factory.factoryAdmin()).to.eq(other.address)
    
    await expect(factory.setFactoryAdmin(wallet.address)).to.be.revertedWith('FeSwap: FORBIDDEN')
    await factory.connect(other).setFeeTo(wallet.address)
  })

  it('setRouterFeSwap', async () => {
    await expect(factory.connect(other).setRouterFeSwap(other.address)).to.be.revertedWith('FeSwap: FORBIDDEN')

    await factory.setRouterFeSwap(other.address)
    expect(await factory.routerFeSwap()).to.eq(other.address)
    
    await factory.setRouterFeSwap(wallet.address)
    expect(await factory.routerFeSwap()).to.eq(wallet.address)  
  })

})
