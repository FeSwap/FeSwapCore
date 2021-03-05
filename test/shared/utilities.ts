import { Contract } from 'ethers'
import { Web3Provider } from 'ethers/providers'
import {
  BigNumber,
  bigNumberify,
  getAddress,
  keccak256,
  defaultAbiCoder,
  toUtf8Bytes,
  solidityPack
} from 'ethers/utils'

import FeSwapPair from '../../build/FeSwapPair.json'

export const MINIMUM_LIQUIDITY = bigNumberify(10).pow(3)

const PERMIT_TYPEHASH = keccak256(
  toUtf8Bytes('Permit(address owner,address spender,uint256 value,uint256 nonce,uint256 deadline)')
)

export function expandTo18Decimals(n: number): BigNumber {
  return bigNumberify(n).mul(bigNumberify(10).pow(18))
}

export function BigNumberPercent(n: BigNumber, ratio: number): BigNumber {
  return n.mul(bigNumberify(ratio)).div(bigNumberify(100))
}

export function RemoveOutPercent(n: BigNumber, ratio: number, Liquidity: BigNumber): BigNumber {
  return n.mul(bigNumberify(ratio)).div(bigNumberify(100)).mul(Liquidity.sub(MINIMUM_LIQUIDITY)).div(Liquidity)
}

export function RemoveLeftPercent(n: BigNumber, ratio: number, Liquidity: BigNumber): BigNumber {
  return n.mul(bigNumberify(ratio)).div(bigNumberify(100)).mul(MINIMUM_LIQUIDITY).div(Liquidity)
}

function getDomainSeparator(name: string, tokenAddress: string) {
  return keccak256(
    defaultAbiCoder.encode(
      ['bytes32', 'bytes32', 'bytes32', 'uint256', 'address'],
      [
        keccak256(toUtf8Bytes('EIP712Domain(string name,string version,uint256 chainId,address verifyingContract)')),
        keccak256(toUtf8Bytes(name)),
        keccak256(toUtf8Bytes('1')),
        1,
        tokenAddress
      ]
    )
  )
}

export function getCreate2Address(
  factoryAddress: string,
  [tokenA, tokenB]: [string, string],
  bytecode: string
): string {
  const [token0, token1] = tokenA < tokenB ? [tokenA, tokenB] : [tokenB, tokenA]
  const create2Inputs = [
    '0xff',
    factoryAddress,
    keccak256(solidityPack(['address', 'address'], [token0, token1])),
    keccak256(bytecode)
  ]
  const sanitizedInputs = `0x${create2Inputs.map(i => i.slice(2)).join('')}`
  return getAddress(`0x${keccak256(sanitizedInputs).slice(-40)}`)
}

export function getFeSwapCodeHash():string {
  const bytecode = `0x${FeSwapPair.evm.bytecode.object}`
  console.log("keccak256(bytecode): ", keccak256(bytecode)) 
  return  keccak256(bytecode)
}

export function getCreate2AddressFeSwap(
  factoryAddress: string,
  [tokenA, tokenB]: [string, string],
  bytecode: string
): string {
  const create2Inputs = [
    '0xff',
    factoryAddress,
    keccak256(solidityPack(['address', 'address'], [tokenA, tokenB])),
    keccak256(bytecode)
  ]
  const sanitizedInputsAAB = `0x${create2Inputs.map(i => i.slice(2)).join('')}`
  return getAddress(`0x${keccak256(sanitizedInputsAAB).slice(-40)}`)
}

export async function getApprovalDigest(
  token: Contract,
  approve: {
    owner: string
    spender: string
    value: BigNumber
  },
  nonce: BigNumber,
  deadline: BigNumber
): Promise<string> {
  const name = await token.name()
  const DOMAIN_SEPARATOR = getDomainSeparator(name, token.address)
  return keccak256(
    solidityPack(
      ['bytes1', 'bytes1', 'bytes32', 'bytes32'],
      [
        '0x19',
        '0x01',
        DOMAIN_SEPARATOR,
        keccak256(
          defaultAbiCoder.encode(
            ['bytes32', 'address', 'address', 'uint256', 'uint256', 'uint256'],
            [PERMIT_TYPEHASH, approve.owner, approve.spender, approve.value, nonce, deadline]
          )
        )
      ]
    )
  )
}

export async function mineBlock(provider: Web3Provider, timestamp: number): Promise<void> {
  await new Promise(async (resolve, reject) => {
    ;(provider._web3Provider.sendAsync as any)(
      { jsonrpc: '2.0', method: 'evm_mine', params: [timestamp] },
      (error: any, result: any): void => {
        if (error) {
          reject(error)
        } else {
          resolve(result)
        }
      }
    )
  })
}

export function encodePrice(reserve0: BigNumber, reserve1: BigNumber) {
  return [reserve1.mul(bigNumberify(2).pow(112)).div(reserve0), reserve0.mul(bigNumberify(2).pow(112)).div(reserve1)]
}


export function  sqrt(y: BigNumber): BigNumber {
  let x: BigNumber
  let z: BigNumber
  
  if (y.gt(3)) {
    z = y;
    x = y.div(2).add(1);
    while (x.lt(z)) {
      z = x;
      x = y.div(x).add(x).div(2);
    }
  } else if (y.isZero()) {
    z = bigNumberify(0);
  } else {
    z = bigNumberify(1);
  }
  return z
}
  
/* 
  library Babylonian {
    function sqrt(uint y) internal pure returns (uint z) {
        if (y > 3) {
            z = y;
            uint x = y / 2 + 1;
            while (x < z) {
                z = x;
                x = (y / x + x) / 2;
            }
        } else if (y != 0) {
            z = 1;
        }
        // else z = 0
    }
}
*/

