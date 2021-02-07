import { Contract, Wallet } from 'ethers'
import { Web3Provider } from 'ethers/providers'
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

export async function factoryFixture(_: Web3Provider, [wallet]: Wallet[]): Promise<FactoryFixture> {
  const factory = await deployContract(wallet, FeSwapFactory, [wallet.address], overrides)
  return { factory }
}

interface PairFixture extends FactoryFixture {
  tokenA: Contract
  tokenB: Contract
  pairAAB: Contract
  pairABB: Contract
}

export async function pairFixture(provider: Web3Provider, [wallet]: Wallet[]): Promise<PairFixture> {
  const { factory } = await factoryFixture(provider, [wallet])

  const tokenA = await deployContract(wallet, ERC20, [expandTo18Decimals(10000),"Token A"], overrides)
  const tokenB = await deployContract(wallet, ERC20, [expandTo18Decimals(10000),"Token B"], overrides)

  await factory.createPair(tokenA.address, tokenB.address, wallet.address, overrides)

  const pairAddressAAB = await factory.getPair(tokenA.address, tokenB.address)
  const pairAAB = new Contract(pairAddressAAB, JSON.stringify(FeSwapPair.abi), provider).connect(wallet)
  
  const pairAddressABB = await factory.getPair(tokenB.address, tokenA.address)
  const pairABB = new Contract(pairAddressABB, JSON.stringify(FeSwapPair.abi), provider).connect(wallet)

  return { factory, tokenA, tokenB, pairAAB, pairABB }
}
