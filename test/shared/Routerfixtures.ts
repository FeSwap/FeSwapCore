import { Wallet, Contract } from 'ethers'
import { Web3Provider } from 'ethers/providers'
import { deployContract } from 'ethereum-waffle'

import { expandTo18Decimals } from './utilities'

import ERC20 from '../../build/ERC20.json'
import FeSwapSimu from '../../build/FeSwapSimu.json'
import FeSwapFactory from '../../build/FeSwapFactory.json'
import FeSwapPair from '../../build/FeSwapPair.json'

import WETH9 from '../../build/WETH9.json'
import FeSwapRouter from '../../build/FeSwapRouter.json'
import RouterEventEmitter from '../../build/RouterEventEmitter.json'

const overrides = {
  gasLimit: 9999999
}

interface V2Fixture {
  tokenA: Contract
  tokenB: Contract
  WETH: Contract
  WETHPartner: Contract
  factoryFS: Contract
  routerFS: Contract
  routerEventEmitter: Contract
  router: Contract
  pairAAB: Contract
  pairABB: Contract 
  WETHPairTTE: Contract
  WETHPairTEE: Contract  
}

export async function v2Fixture(provider: Web3Provider, [wallet, feeTo, pairCreator]: Wallet[]): Promise<V2Fixture> {
  // deploy tokens
  const tokenA = await deployContract(wallet, ERC20, [expandTo18Decimals(10000),"Token A"])
  const tokenB = await deployContract(wallet, ERC20, [expandTo18Decimals(10000),"Token B"])
  const WETH = await deployContract(wallet, WETH9)
  const WETHPartner = await deployContract(wallet, ERC20, [expandTo18Decimals(10000),"WETH Partner"])

  // deploy FeSwap factory
  const factoryFS = await deployContract(wallet, FeSwapFactory, [wallet.address], overrides)

  // deploy FeSwap routers
  const routerFS = await deployContract(wallet, FeSwapRouter, [factoryFS.address, WETH.address], overrides)

  // event emitter for testing
  const routerEventEmitter = await deployContract(wallet, RouterEventEmitter, [])

  // initialize FeSwap
  await factoryFS.setFeeTo(feeTo.address)
  await factoryFS.setRouterFeSwap(routerFS.address)
  await factoryFS.createPair(tokenA.address, tokenB.address, pairCreator.address, overrides)
  const pairAddressAAB = await factoryFS.getPair(tokenA.address, tokenB.address)
  const pairAddressABB = await factoryFS.getPair(tokenB.address, tokenA.address)
  const pairAAB = new Contract(pairAddressAAB, JSON.stringify(FeSwapPair.abi), provider).connect(wallet)
  const pairABB = new Contract(pairAddressABB, JSON.stringify(FeSwapPair.abi), provider).connect(wallet)

  await factoryFS.createPair(WETH.address, WETHPartner.address, pairCreator.address, overrides)
  const WETHPairAddressETHIn = await factoryFS.getPair(WETH.address, WETHPartner.address)
  const WETHPairTEE = new Contract(WETHPairAddressETHIn, JSON.stringify(FeSwapPair.abi), provider).connect(wallet)

  const WETHPairAddressETHOut = await factoryFS.getPair(WETHPartner.address, WETH.address)
  const WETHPairTTE = new Contract(WETHPairAddressETHOut, JSON.stringify(FeSwapPair.abi), provider).connect(wallet)
 
  return {
    tokenA,
    tokenB,
    WETH,
    WETHPartner,
    factoryFS,
    routerFS,
    router: routerFS, // the default router, 01 had a minor bug
    routerEventEmitter,
    pairAAB,
    pairABB,
    WETHPairTTE,
    WETHPairTEE,
  }
}
