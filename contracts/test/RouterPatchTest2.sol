// SPDX-License-Identifier: MIT
pragma solidity >=0.6.12;

import './patch/RouterDestroyController.sol';

/** 
 * @title Ballot
 * @dev Implements voting process along with vote delegation
 */
contract RouterPatchTest2 is RouterDestroyController {
    /////////////////////////
    address public factory;
    address public yeswaNFT;
    address public WETH;

    ////////////////////////////
    uint8       public      u8Test;
    uint256     public      u256Test;
    address     public      addrTest;
    bytes       public      bytesTest;
    uint256[3]  public      arrayTest;

    function setU8(uint8 _u8Test) public {
        u8Test = _u8Test;
    }

     function setU256(uint256 _u256Test) public {
        u256Test = _u256Test;
    }

    function setAddress(address _addrTest) public {
        addrTest = _addrTest;
    }

    function setBytes(bytes calldata _bytesTest) public {
        bytesTest = _bytesTest;
    }   

    function setArray(uint256[3] calldata _arrayTest) public {
        arrayTest[0] = _arrayTest[0];
        arrayTest[1] = _arrayTest[1];
        arrayTest[2] = _arrayTest[2];
    }   
}