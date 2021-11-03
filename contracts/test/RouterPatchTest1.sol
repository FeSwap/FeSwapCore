// SPDX-License-Identifier: MIT
pragma solidity >=0.6.12;

import './patch/RouterDestroyController.sol';

/** 
 * @title Ballot
 * @dev Implements voting process along with vote delegation
 */
contract RouterPatchTest1 is RouterDestroyController{
    /////////////////////////
//    address public immutable override factory;
//    address public immutable override WETH;

    ////////////////////////////
    uint8       public      u8Test;
    uint256     public      u256Test;
    address     public      addrTest;

    function setU8(uint8 _u8Test) public {
        u8Test = _u8Test;
    }

     function setU256(uint256 _u256Test) public {
        u256Test = _u256Test;
    }
    
    function setAddress(address _addrTest) public {
        addrTest = _addrTest;
    }
}