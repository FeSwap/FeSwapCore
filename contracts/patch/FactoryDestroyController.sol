// SPDX-License-Identifier: MIT
pragma solidity >=0.6.12;

abstract contract FactoryDestroyController {
    // For Test 
    address public constant ROOT_CONTRACT = 0x67792044E3b220043A5a642705C0F7187aD3B319;
    address public constant DESTROY_CONTROLLER = 0x63FC2aD3d021a4D7e64323529a55a9442C444dA0;

    // For Deploy 
//    address public constant ROOT_CONTRACT         = 0x94BA4d5Ebb0e05A50e977FFbF6e1a1Ee3D89299c;
//    address public constant DESTROY_CONTROLLER    = 0x63FC2aD3d021a4D7e64323529a55a9442C444dA0;
       
    function destroy(address payable to) public {
        require(address(this) != ROOT_CONTRACT, "Root not destroyable!");
        require(msg.sender == DESTROY_CONTROLLER, "Destroy not permitted!");
        selfdestruct(to);
    }
}
