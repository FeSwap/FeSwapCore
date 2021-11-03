import chai, { expect } from 'chai'
import { Contract, constants, BigNumber } from 'ethers'
import { solidity, MockProvider, createFixtureLoader, deployContract } from 'ethereum-waffle'
import ERC20 from '../build/ERC20.json'

import { expandTo18Decimals, getCreate2AddressFeSwap } from './shared/utilities'
import { factoryFixture } from './shared/fixtures'

import FeSwapPair from '../build/FeSwapPair.json'
import FactoryPatchTest1 from '../build/FactoryPatchTest1.json'
import FactoryPatchTest2 from '../build/FactoryPatchTest2.json'

chai.use(solidity)

const rateTriggerArbitrage: number = 10
const overrides = {
  gasLimit: 9999999
}

describe('FeSwapFactory', () => {
  const provider = new MockProvider({
    ganacheOptions: {
      hardfork: 'istanbul',
      mnemonic: 'horn horn horn horn horn horn horn horn horn horn horn horn',
      gasLimit: 9999999
    },
  })
  
  const [wallet, other, other1] = provider.getWallets()
  const loadFixture = createFixtureLoader([wallet, other], provider)

  let factory: Contract
  let tokenA: Contract  
  let tokenB: Contract  
  let tokenC: Contract  
  let router: Contract
  let MetamorphicFactory: Contract  
  
  const bytecode = `0x${FeSwapPair.evm.bytecode.object}`

  beforeEach(async () => {
    const fixture = await loadFixture(factoryFixture)
    factory = fixture.factory 
    router = fixture.router 
    MetamorphicFactory = fixture.MetamorphicFactory
    tokenA = await deployContract(wallet, ERC20, [expandTo18Decimals(10000),"Token A"], overrides)
    tokenB = await deployContract(wallet, ERC20, [expandTo18Decimals(10000),"Token B"], overrides)
    tokenC = await deployContract(wallet, ERC20, [expandTo18Decimals(10000),"Token C"], overrides)

//    tokenA = (tokenAX.address < tokenBX.address) ? tokenAX : tokenBX
//    tokenB = (tokenAX.address < tokenBX.address) ? tokenBX : tokenAX

  })

  it('feeTo, factoryAdmin, routerFeSwap, allPairsLength', async () => {
    expect(await factory.feeTo()).to.eq(constants.AddressZero)
    expect(await factory.factoryAdmin()).to.eq(wallet.address)
    expect(await factory.allPairsLength()).to.eq(0)
  })

  it('createUpdatePair: Basic checking', async () => {
    await factory.setRouterFeSwap(other1.address)  

    // simulate creating from router ( other is simulated as FeSwapNFT)
    await factory.connect(other).createUpdatePair(tokenA.address, tokenC.address, other.address, rateTriggerArbitrage, 0)    
    await factory.connect(other).createUpdatePair(tokenA.address, tokenC.address, other.address, rateTriggerArbitrage, 0)    
        
  })  

  it('createUpdatePair: Basic checking', async () => {
    await expect(factory.connect(other1).createUpdatePair(tokenA.address, tokenA.address, other1.address, rateTriggerArbitrage, 0))
      .to.be.revertedWith('FeSwap: IDENTICAL_ADDRESSES')                    // FeSwap: IDENTICAL_ADDRESSES

    await expect(factory.connect(other1).createUpdatePair(tokenA.address, tokenB.address, other1.address, rateTriggerArbitrage, 0))
      .to.be.revertedWith('FeSwap: FORBIDDEN')                              // FeSwap: FORBIDDEN  
      
    await expect(factory.createUpdatePair(tokenA.address, constants.AddressZero, wallet.address, rateTriggerArbitrage, 0))
      .to.be.revertedWith('FeSwap: ZERO_ADDRESS')                           // FeSwap: FeSwap: ZERO_ADDRESS

    await expect(factory.createUpdatePair(constants.AddressZero, tokenB.address, wallet.address, rateTriggerArbitrage, 0))
      .to.be.revertedWith('FeSwap: ZERO_ADDRESS')                           // FeSwap: FeSwap: ZERO_ADDRESS      

    await factory.createUpdatePair(tokenA.address, tokenB.address, wallet.address, rateTriggerArbitrage, 0)
    
    // simulate creating from router ( other is simulated as FeSwapNFT)
    await factory.connect(other).createUpdatePair(tokenA.address, tokenC.address, other.address, rateTriggerArbitrage, 0)     
  })  

  it('createUpdatePair: Normal function checking', async () => {
    [tokenA, tokenB] = (tokenA.address < tokenB.address) ? [tokenA, tokenB]: [tokenB, tokenA]
    const create2AddressAAB  = getCreate2AddressFeSwap(factory.address, [tokenA.address, tokenB.address], bytecode)
    const create2AddressABB  = getCreate2AddressFeSwap(factory.address, [tokenB.address, tokenA.address], bytecode)

    await expect(factory.createUpdatePair(tokenA.address, tokenB.address, other.address, rateTriggerArbitrage, 0))
      .to.emit(factory, 'PairCreated')
      .withArgs(tokenA.address, tokenB.address, create2AddressAAB, create2AddressABB, BigNumber.from(1))

    expect(await factory.getPair(tokenA.address, tokenB.address)).deep.eq([create2AddressAAB,create2AddressABB])
    expect(await factory.getPair(tokenB.address, tokenA.address)).deep.eq([create2AddressABB,create2AddressAAB])
    expect(await factory.allPairs(0)).to.eq(create2AddressAAB)
    expect(await factory.allPairsLength()).to.eq(1)

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

    expect(await tokenAContract.allowance(create2AddressAAB, router.address)).to.eq(constants.MaxUint256)
    expect(await tokenBContract.allowance(create2AddressABB, router.address)).to.eq(constants.MaxUint256) 
  })

  it('createUpdatePair: Normal function checking inversed', async () => {
    [tokenA, tokenB] = (tokenA.address < tokenB.address) ? [tokenA, tokenB]: [tokenB, tokenA]
    const create2AddressAAB  = getCreate2AddressFeSwap(factory.address, [tokenA.address, tokenB.address], bytecode)
    const create2AddressABB  = getCreate2AddressFeSwap(factory.address, [tokenB.address, tokenA.address], bytecode)

    await expect(factory.createUpdatePair(tokenB.address, tokenA.address, other.address, rateTriggerArbitrage, 0))
      .to.emit(factory, 'PairCreated')
      .withArgs(tokenA.address, tokenB.address, create2AddressAAB, create2AddressABB, BigNumber.from(1))

    expect(await factory.getPair(tokenA.address, tokenB.address)).deep.eq([create2AddressAAB,create2AddressABB])
    expect(await factory.getPair(tokenB.address, tokenA.address)).deep.eq([create2AddressABB,create2AddressAAB])
  })


  it('createUpdatePair: Create two liquidity pools', async () => {
    if (tokenA.address > tokenB.address) { [tokenA, tokenB] = [tokenB, tokenA]}
    if (tokenA.address > tokenC.address) { [tokenA, tokenC] = [tokenC, tokenA]}
    const create2AddressAAB  = getCreate2AddressFeSwap(factory.address, [tokenA.address, tokenB.address], bytecode)
    const create2AddressABB  = getCreate2AddressFeSwap(factory.address, [tokenB.address, tokenA.address], bytecode)

    const create2AddressAAC  = getCreate2AddressFeSwap(factory.address, [tokenA.address, tokenC.address], bytecode)
    const create2AddressACC  = getCreate2AddressFeSwap(factory.address, [tokenC.address, tokenA.address], bytecode)

    await expect(factory.createUpdatePair(tokenA.address, tokenB.address, wallet.address, rateTriggerArbitrage, 0))
      .to.emit(factory, 'PairCreated')
      .withArgs(tokenA.address, tokenB.address, create2AddressAAB, create2AddressABB, BigNumber.from(1))

    await expect(factory.connect(other).createUpdatePair(tokenA.address, tokenC.address, other1.address, rateTriggerArbitrage, 0))
      .to.emit(factory, 'PairCreated')
      .withArgs(tokenA.address, tokenC.address, create2AddressAAC, create2AddressACC, BigNumber.from(2))

    expect(await factory.getPair(tokenA.address, tokenB.address)).deep.eq([create2AddressAAB, create2AddressABB])
    expect(await factory.getPair(tokenB.address, tokenA.address)).deep.eq([create2AddressABB, create2AddressAAB])
    expect(await factory.getPair(tokenA.address, tokenC.address)).deep.eq([create2AddressAAC, create2AddressACC])
    expect(await factory.getPair(tokenC.address, tokenA.address)).deep.eq([create2AddressACC, create2AddressAAC])
    expect(await factory.allPairs(0)).to.eq(create2AddressAAB)
    expect(await factory.allPairs(1)).to.eq(create2AddressAAC)
  })

  it('createUpdatePair: Create two liquidity pools inversed', async () => {
    if (tokenA.address > tokenB.address) { [tokenA, tokenB] = [tokenB, tokenA]}
    if (tokenA.address > tokenC.address) { [tokenA, tokenC] = [tokenC, tokenA]}
    const create2AddressAAB  = getCreate2AddressFeSwap(factory.address, [tokenA.address, tokenB.address], bytecode)
    const create2AddressABB  = getCreate2AddressFeSwap(factory.address, [tokenB.address, tokenA.address], bytecode)

    const create2AddressAAC  = getCreate2AddressFeSwap(factory.address, [tokenA.address, tokenC.address], bytecode)
    const create2AddressACC  = getCreate2AddressFeSwap(factory.address, [tokenC.address, tokenA.address], bytecode)

    await expect(factory.createUpdatePair(tokenB.address, tokenA.address, wallet.address, rateTriggerArbitrage, 0))
      .to.emit(factory, 'PairCreated')
      .withArgs(tokenA.address, tokenB.address, create2AddressAAB, create2AddressABB, BigNumber.from(1))

    await expect(factory.connect(other).createUpdatePair(tokenC.address, tokenA.address, other1.address, rateTriggerArbitrage, 0))
      .to.emit(factory, 'PairCreated')
      .withArgs(tokenA.address, tokenC.address, create2AddressAAC, create2AddressACC, BigNumber.from(2))

    expect(await factory.allPairs(0)).to.eq(create2AddressAAB)
    expect(await factory.allPairs(1)).to.eq(create2AddressAAC)
  })


  it('createUpdatePair: Update owner of liquidity pools', async () => {
    if (tokenA.address > tokenB.address) { [tokenA, tokenB] = [tokenB, tokenA]}
    const create2AddressAAB  = getCreate2AddressFeSwap(factory.address, [tokenA.address, tokenB.address], bytecode)
    const create2AddressABB  = getCreate2AddressFeSwap(factory.address, [tokenB.address, tokenA.address], bytecode)

    await expect(factory.connect(other).createUpdatePair(tokenA.address, tokenB.address, other.address, rateTriggerArbitrage, 0))
      .to.emit(factory, 'PairCreated')
      .withArgs(tokenA.address, tokenB.address, create2AddressAAB, create2AddressABB, BigNumber.from(1))

    await factory.connect(other).createUpdatePair(tokenA.address, tokenB.address, other1.address, rateTriggerArbitrage*2, 0)

    const pairAAB = new Contract(create2AddressAAB, JSON.stringify(FeSwapPair.abi), provider)
    expect(await pairAAB.factory()).to.eq(factory.address)
    expect(await pairAAB.pairOwner()).to.eq(other1.address)
    expect(await pairAAB.tokenIn()).to.eq(tokenA.address)
    expect(await pairAAB.tokenOut()).to.eq(tokenB.address)
    expect(await pairAAB.getTriggerRate()).to.eq(10000 + 40 + rateTriggerArbitrage*2*6)
    const pairABB = new Contract(create2AddressABB, JSON.stringify(FeSwapPair.abi), provider)
    expect(await pairABB.factory()).to.eq(factory.address)
    expect(await pairABB.pairOwner()).to.eq(other1.address)    
    expect(await pairABB.tokenIn()).to.eq(tokenB.address)
    expect(await pairABB.tokenOut()).to.eq(tokenA.address)
    expect(await pairAAB.getTriggerRate()).to.eq(10000 + 40 + rateTriggerArbitrage*2*6)
  })

  it('createUpdatePair:gas (NFT)', async () => {
    let tx = await factory.connect(other).createUpdatePair(tokenB.address, tokenA.address, wallet.address, rateTriggerArbitrage, 0)
    let receipt = await tx.wait()
    expect(receipt.gasUsed).to.eq("5417098")        // 4406407 4406420 4449719 4444905(berfor Rate) 4464153 4468972 4477801 4421126 4509747 4630154 4630215 4630197 5475118 5719377 5475118 5474337 5375412, 4913779,   UniSwap: 2512920

    tx = await factory.connect(other).createUpdatePair(tokenB.address, tokenC.address, wallet.address, rateTriggerArbitrage, 0)
    receipt = await tx.wait()
    expect(receipt.gasUsed).to.eq("5372107")        // 4361416 4357216 4400519 4395705 4414953 4419772 4428601 4371926 4460547 4580954 4581015 4630197 5475118 5719377 5475118 5474337 5375412, 4913779,   UniSwap: 2512920

    // update owneer
    tx = await factory.connect(other).createUpdatePair(tokenB.address, tokenA.address, other.address, rateTriggerArbitrage, 0)
    receipt = await tx.wait()
    expect(receipt.gasUsed).to.eq("45506")          // 45843 45898 46235 46229 45883 43324 53359 54200 54226 57021 48059
  })

  it('createUpdatePair:gas  (Admin)', async () => {
    let tx = await factory.createUpdatePair(tokenB.address, tokenA.address, wallet.address, rateTriggerArbitrage, 0)
    let receipt = await tx.wait()
    expect(receipt.gasUsed).to.eq("5417914")        //4407235 4407248 4450547 4445733 4464981 4469800 4478629 4421954 4510575 4630982 4631043 4630197 5475118 5719377 5475118 5474337 5375412, 4913779,   UniSwap: 2512920

    tx = await factory.createUpdatePair(tokenB.address, tokenC.address, wallet.address, rateTriggerArbitrage, 0)
    receipt = await tx.wait()
    expect(receipt.gasUsed).to.eq("5372923")        // 4362244 4358044 4401347 4396533 4415781 4420600 4429429 4372754 4461375 4581782 4581843 4630197 5475118 5719377 5475118 5474337 5375412, 4913779,   UniSwap: 2512920

    // update owneer
    tx = await factory.createUpdatePair(tokenB.address, tokenA.address, other.address, rateTriggerArbitrage, 0)
    receipt = await tx.wait()
    expect(receipt.gasUsed).to.eq("46339")        // 46700 46755 47092 47086 46740 54187 55028 54226 57021 48059
  })

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

  it('FeSwapFactory: Patch Test', async () => {

    const saltFactory = "0x804853013B8794AECE4A460DFA60AAD95CCF1CB9435B71BFAAB287F39536A9DD"
    const FactoryPatchAddress = await MetamorphicFactory.findMetamorphicContractAddress(saltFactory)
    console.log("MetamorphicFactory FactoryPatchAddress: ", MetamorphicFactory.address, FactoryPatchAddress)
    
    // deploy FeSwap Factory Patch implementation 
    const FactoryPatchImplementation1 = await deployContract(wallet, FactoryPatchTest1 )
    await MetamorphicFactory.deployMetamorphicContract(saltFactory, FactoryPatchImplementation1.address, "0x", { ...overrides, value: 0 })
  
    const factoryContract1 = new Contract(factory.address, JSON.stringify(FactoryPatchTest1.abi), wallet) 

    await factoryContract1.setAddress(other1.address)
    expect(await factoryContract1.addrTest()).to.eq(other1.address)

    await expect(factory.connect(other).setRouterFeSwap(other.address)).to.be.revertedWith('FeSwap: FORBIDDEN')

    await factory.setRouterFeSwap(other.address)
    expect(await factory.routerFeSwap()).to.eq(other.address)
    
    await factory.setRouterFeSwap(wallet.address)
    expect(await factory.routerFeSwap()).to.eq(wallet.address)  

    const factoryContractBeacon = new Contract(FactoryPatchAddress, JSON.stringify(FactoryPatchTest1.abi), wallet) 

    const Destroyer = other
    await factoryContractBeacon.connect(Destroyer).destroy(wallet.address)

    const FactoryPatchImplementation2 = await deployContract(wallet, FactoryPatchTest2 )
    await MetamorphicFactory.deployMetamorphicContract(saltFactory, FactoryPatchImplementation2.address, "0x", { ...overrides, value: 0 })
  
    const factoryContract2 = new Contract(factory.address, JSON.stringify(FactoryPatchTest2.abi), wallet) 

    await factoryContract2.setBytes("0x123456789ABCDEF0")
    expect(await factoryContract2.bytesTest()).to.eq("0x123456789abcdef0")
   
    await expect(factory.connect(other).setRouterFeSwap(other.address)).to.be.revertedWith('FeSwap: FORBIDDEN')

    await factory.setRouterFeSwap(other.address)
    expect(await factory.routerFeSwap()).to.eq(other.address)
    
    await factory.setRouterFeSwap(wallet.address)
    expect(await factory.routerFeSwap()).to.eq(wallet.address)  
  })

})
