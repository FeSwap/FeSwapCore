// SPDX-License-Identifier: GPL-3.0
pragma solidity =0.6.12;

import '../FeSwapERC20.sol';

contract ERC20 is FeSwapERC20 {
    string public tokenName;
    
    constructor(uint _totalSupply, string memory _name) public {
        _mint(msg.sender, _totalSupply);
        tokenName = _name;
    }
}
