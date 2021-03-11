import { Wallet, Contract, providers, utils } from 'ethers'
import { deployContract } from 'ethereum-waffle'

import { expandTo18Decimals, mineBlock } from './utilities'

import ERC20 from '../../build/ERC20.json'
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
  factoryFeswa: Contract
  routerFeswa: Contract
  routerEventEmitter: Contract
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

export async function v2Fixture(
                                  [wallet, feeTo, pairOwner]: Wallet[],
                                  provider: providers.Web3Provider): Promise<V2Fixture> 
{
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
  const factoryFeswa = await deployContract(wallet, FeSwapFactory, [wallet.address], overrides)

  // deploy FeSwap routers
  const routerFeswa = await deployContract(wallet, FeSwapRouter, [factoryFeswa.address, FeswaNFT.address, WETH.address], overrides)

  // event emitter for testing
  const routerEventEmitter = await deployContract(wallet, RouterEventEmitter, [])

  // initialize FeSwap
  await factoryFeswa.setFeeTo(feeTo.address)
  await factoryFeswa.setRouterFeSwap(routerFeswa.address)
//  await factoryFeswa.createUpdatePair(tokenA.address, tokenB.address, pairOwner.address, overrides)

  await mineBlock(provider, BidStartTime + 1)
  const  tokenIDMatch = utils.keccak256( 
                            utils.solidityPack( ['address', 'address', 'address'],
                            (tokenA.address.toLowerCase() <= tokenB.address.toLowerCase())
                            ? [FeswaNFT.address, tokenA.address, tokenB.address] 
                            : [FeswaNFT.address, tokenB.address, tokenA.address] ) )

  await FeswaNFT.connect(pairOwner).BidFeswaPair(tokenA.address, tokenB.address, pairOwner.address,
                { ...overrides, value: initPoolPrice } )

  // BidDelaying time out
  lastBlock = await provider.getBlock('latest')
  await mineBlock(provider, lastBlock.timestamp + OPEN_BID_DURATION + 1 ) 
  await FeswaNFT.connect(pairOwner).FeswaPairSettle(tokenIDMatch)
  await routerFeswa.connect(pairOwner).ManageFeswaPair(tokenIDMatch, pairOwner.address)

  await factoryFeswa.createUpdatePair(tokenB.address, WETHPartner.address, pairOwner.address, overrides)  
  const pairAddressAAB = await factoryFeswa.getPair(tokenA.address, tokenB.address)
  const pairAddressABB = await factoryFeswa.getPair(tokenB.address, tokenA.address)
  const pairAAB = new Contract(pairAddressAAB, JSON.stringify(FeSwapPair.abi), provider).connect(wallet)
  const pairABB = new Contract(pairAddressABB, JSON.stringify(FeSwapPair.abi), provider).connect(wallet)

  await factoryFeswa.createUpdatePair(WETH.address, WETHPartner.address, pairOwner.address, overrides)
  const WETHPairAddressETHIn = await factoryFeswa.getPair(WETH.address, WETHPartner.address)
  const WETHPairTEE = new Contract(WETHPairAddressETHIn, JSON.stringify(FeSwapPair.abi), provider).connect(wallet)

  const WETHPairAddressETHOut = await factoryFeswa.getPair(WETHPartner.address, WETH.address)
  const WETHPairTTE = new Contract(WETHPairAddressETHOut, JSON.stringify(FeSwapPair.abi), provider).connect(wallet)
 
  return {
    tokenA,
    tokenB,
    WETH,
    WETHPartner,
    factoryFeswa,
    routerFeswa,
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
