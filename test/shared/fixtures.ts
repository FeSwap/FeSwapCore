import { Contract, Wallet, providers } from 'ethers'
import { deployContract } from 'ethereum-waffle'

import { expandTo18Decimals } from './utilities'

import ERC20 from '../../build/ERC20.json'
import FeSwapFactory from '../../build/FeSwapFactory.json'
import FeSwapPair from '../../build/FeSwapPair.json'

interface FactoryFixture {
  factory: Contract
}

const overrides = {
  gasLimit: 9999999
}

export async function factoryFixture( [wallet]: Wallet[], _: providers.Web3Provider ): Promise<FactoryFixture> {
  const factory = await deployContract(wallet, FeSwapFactory, [wallet.address], overrides)
  return { factory }
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

  await factory.createUpdatePair(tokenA.address, tokenB.address, wallet.address, overrides)

  const pairAddressAAB = await factory.getPair(tokenA.address, tokenB.address)
  const pairAAB = new Contract(pairAddressAAB, JSON.stringify(FeSwapPair.abi), provider).connect(wallet)
  
  const pairAddressABB = await factory.getPair(tokenB.address, tokenA.address)
  const pairABB = new Contract(pairAddressABB, JSON.stringify(FeSwapPair.abi), provider).connect(wallet)

  return { factory, tokenA, tokenB, tokenC, pairAAB, pairABB }
}
