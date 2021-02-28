import { Wallet, Contract } from 'ethers'
import { Web3Provider } from 'ethers/providers'
import { deployContract } from 'ethereum-waffle'
import { BigNumber, bigNumberify, keccak256, solidityPack } from 'ethers/utils'
import { MaxUint256 } from 'ethers/constants'

import { expandTo18Decimals, mineBlock } from './utilities'

import ERC20 from '../../build/ERC20.json'
import FeSwapSimu from '../../build/FeSwapSimu.json'
import FeSwapFactory from '../../build/FeSwapFactory.json'
import FeSwapPair from '../../build/FeSwapPair.json'

import WETH9 from '../../build/WETH9.json'
import FeSwapRouter from '../../build/FeSwapRouter.json'
import RouterEventEmitter from '../../build/RouterEventEmitter.json'
import FeswapTokenCode from '../../../Governance/build/Fesw.json'
import FeswaNFTCode from '../../../Governance/build/FeswaNFT.json'

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
  Feswa:  Contract
  FeswaNFT:   Contract
  tokenIDMatch: string
}

const initPoolPrice = expandTo18Decimals(1).div(5)
const BidStartTime: number = 1615338000   // 2021/02/22 03/10 9:00
const OPEN_BID_DURATION: number =  (3600 * 24 * 14)

export async function v2Fixture(provider: Web3Provider, [wallet, feeTo, pairCreator]: Wallet[]): Promise<V2Fixture> {
  // deploy tokens
  const tokenA = await deployContract(wallet, ERC20, [expandTo18Decimals(10000),"Token A"])
  const tokenB = await deployContract(wallet, ERC20, [expandTo18Decimals(10000),"Token B"])
  const WETH = await deployContract(wallet, WETH9)
  const WETHPartner = await deployContract(wallet, ERC20, [expandTo18Decimals(10000),"WETH Partner"])

  // deploy FeSwap Token contract, sending the total supply to the deployer
  let lastBlock = await provider.getBlock('latest')
  const Feswa = await deployContract(wallet, FeswapTokenCode, [wallet.address, wallet.address, lastBlock.timestamp + 60 * 60])

  // deploy FeSwap NFT contract
  const FeswaNFT = await deployContract(wallet, FeswaNFTCode, [Feswa.address, initPoolPrice, BidStartTime])
  await Feswa.transfer(FeswaNFT.address, expandTo18Decimals(1000_000))

  // deploy FeSwap factory
  const factoryFS = await deployContract(wallet, FeSwapFactory, [wallet.address], overrides)

  // deploy FeSwap routers
  const routerFS = await deployContract(wallet, FeSwapRouter, [factoryFS.address, FeswaNFT.address, WETH.address], overrides)

  // event emitter for testing
  const routerEventEmitter = await deployContract(wallet, RouterEventEmitter, [])

  // initialize FeSwap
  await factoryFS.setFeeTo(feeTo.address)
  await factoryFS.setRouterFeSwap(routerFS.address)
//  await factoryFS.createPair(tokenA.address, tokenB.address, pairCreator.address, overrides)

  await mineBlock(provider, BidStartTime + 1)
  const  tokenIDMatch = keccak256( 
                            solidityPack( ['address', 'address', 'address'],
                            (tokenA.address.toLowerCase() <= tokenB.address.toLowerCase())
                            ? [FeswaNFT.address, tokenA.address, tokenB.address] 
                            : [FeswaNFT.address, tokenB.address, tokenA.address] ) )

  await FeswaNFT.connect(pairCreator).BidFeswaPair(tokenA.address, tokenB.address, pairCreator.address,
                { ...overrides, value: initPoolPrice } )

  // BidDelaying time out
  lastBlock = await provider.getBlock('latest')
  await mineBlock(provider, lastBlock.timestamp + OPEN_BID_DURATION + 1 ) 
  await FeswaNFT.connect(pairCreator).FeswaPairSettle(tokenIDMatch)
  await routerFS.connect(pairCreator).createFeswaPair(tokenIDMatch, pairCreator.address, MaxUint256)

  await factoryFS.createPair(tokenB.address, WETHPartner.address, pairCreator.address, overrides)  
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
    Feswa,
    FeswaNFT,
    tokenIDMatch
  }
}
