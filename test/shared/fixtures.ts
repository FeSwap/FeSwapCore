import { Contract, Wallet, providers } from 'ethers'
import { deployContract } from 'ethereum-waffle'

import { expandTo18Decimals } from './utilities'

import ERC20 from '../../build/ERC20.json'
import FeSwapFactory from '../../build/FeSwapFactory.json'
import FeSwapPair from '../../build/FeSwapPair.json'
import FeSwapRouter from '../../build/FeSwapRouter.json'
import WETH9 from '../../build/WETH9.json'
import MetamorphicContractFactory from '../../../Governance/build/MetamorphicContractFactory.json'

interface FactoryFixture {
  factory: Contract
  router: Contract
  MetamorphicFactory: Contract
}

const rateTriggerArbitrage: number = 10
const overrides = {
  gasLimit: 9999999
}

export async function factoryFixture( [wallet, NFTsimu]: Wallet[], _: providers.Web3Provider ): Promise<FactoryFixture> {
  // NFT address is fake
  // Get Router address
  const routerAddress = Contract.getContractAddress({ from: wallet.address, nonce: 3 })
  const factory = await deployContract(wallet, FeSwapFactory, [wallet.address, routerAddress, NFTsimu.address], overrides)

  // deploy FeSwap MetamorphicContractFactory
  const MetamorphicFactory = await deployContract(wallet, MetamorphicContractFactory)

  // deploy FeSwap routers
  const WETH = await deployContract(wallet, WETH9)
  const router = await deployContract(wallet, FeSwapRouter, [factory.address, WETH.address], overrides)

  return { factory, router, MetamorphicFactory }
}

interface PairFixture {
  factory: Contract
  tokenA: Contract
  tokenB: Contract
  tokenC: Contract
  pairAAB: Contract
  pairABB: Contract
}

export async function pairFixture( [wallet]: Wallet[], provider: providers.Web3Provider ): Promise<PairFixture> {
  const { factory } = await factoryFixture( [wallet], provider )

  const tokenA = await deployContract(wallet, ERC20, [expandTo18Decimals(10000),"Token A"], overrides)
  const tokenB = await deployContract(wallet, ERC20, [expandTo18Decimals(10000),"Token B"], overrides)
  const tokenC = await deployContract(wallet, ERC20, [expandTo18Decimals(10000),"Token C"], overrides)

  await factory.createUpdatePair(tokenA.address, tokenB.address, wallet.address, rateTriggerArbitrage, 0, overrides)

  const pairAddressAAB = await factory.getPair(tokenA.address, tokenB.address)
  const pairAAB = new Contract(pairAddressAAB, JSON.stringify(FeSwapPair.abi), provider).connect(wallet)
  
  const pairAddressABB = await factory.getPair(tokenB.address, tokenA.address)
  const pairABB = new Contract(pairAddressABB, JSON.stringify(FeSwapPair.abi), provider).connect(wallet)


  return { factory, tokenA, tokenB, tokenC, pairAAB, pairABB }
}
