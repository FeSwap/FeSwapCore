// SPDX-License-Identifier: MIT
pragma solidity >=0.6.12;

/**
 * @dev This abstract contract provides a fallback function that delegates all calls to the patch 
 *      using the EVM instruction `delegatecall`. The success and return data of the delegated call 
 *      will be returned back to the caller of the proxy.
 */
abstract contract RouterPatchCaller {
    // DELEGATE_TARGET = uint160(                      // downcast to match the address type.
    //                      uint256(                    // convert to uint to truncate upper digits.
    //                          keccak256(                // compute the CREATE2 hash using 4 inputs.
    //                              abi.encodePacked(       // pack all inputs to the hash together.
    //                                  hex"ff",              // start with 0xff to distinguish from RLP.
    //                                  address(this),        // this contract will be the caller.
    //                                  salt,                 // pass in the supplied salt value.
    //                                  _metamorphicContractInitializationCodeHash // the init code hash.
    //                              )
    //                          )
    //                      )
    //                   )
    //
    // salt = keccak256("Feswap Router Patch") = 0xA79A80C68DB5352E173057DB3DAFDC42FD6ABC2DAB19BFB02F55B49E402B3322
    // metamorphicContractInitializationCode = 0x60006020816004601c335a63aaf10f428752fa60185780fd5b808151803b80938091923cf3
    // _metamorphicContractInitializationCodeHash = keccak256(metamorphicContractInitializationCode)
    //                                            = 0x15bfb1132dc67a984de77a9eef294f7e58964d02c62a359fd6f3c0c1d443e35c 
    // address(this): 0x0BDb999cFA9c47d6d62323a1905F8Eb7B3c9B119 (Test) 
    // address(this): 0x8565570A7cB2b2508F9180AD83e8f58F25e41596 (Goerli) 
    // address(this): 0xc554e3410ba6c6dcd10ef4778d0765fd42081e68 (Rinkeby/BSC/Polygon/Harmoney/Arbitrum/Fantom/Avalance/Heco) 
   
//  address public constant DELEGATE_TARGET = 0x92DD76703DACF9BE7F61CBC7ADAF77319084DBF8;   // (Goerli)
    address public constant DELEGATE_TARGET = 0x1127DfBBa70B8FbF4352A749a79A5090091Ce615;   // (Test)
//  address public constant DELEGATE_TARGET = 0x20E5EDF99ac03Cd978b8A61BAc814B1B6eCda877;   // (BSC/MATIC)
     
    /**
     * @dev Delegates the current call to `DELEGATE_TARGET`.
     *
     * This function does not return to its internall call site, it will return directly to the external caller.
     */

    receive() external virtual payable {
        revert("Refused!");
    }

    /**
     * @dev Fallback function that delegates calls to the address returned by `_implementation()`. Will run if no other
     * function in the contract matches the call data.
     */
    fallback () external payable virtual {
       // solhint-disable-next-line no-inline-assembly
        assembly {
            // Copy msg.data. We take full control of memory in this inline assembly
            // block because it will not return to Solidity code. We overwrite the
            // Solidity scratch pad at memory position 0.
            calldatacopy(0, 0, calldatasize())

            // Call the implementation.
            // out and outsize are 0 because we don't know the size yet.
            let result := delegatecall(gas(), DELEGATE_TARGET, 0, calldatasize(), 0, 0)

            // Copy the returned data.
            returndatacopy(0, 0, returndatasize())

            switch result
            // delegatecall returns 0 on error.
            case 0 { revert(0, returndatasize()) }
            default { return(0, returndatasize()) }
        }
    }
}