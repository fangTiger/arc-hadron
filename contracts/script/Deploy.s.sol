// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Script, console2} from "forge-std/Script.sol";
import {HadronAssets} from "../src/HadronAssets.sol";
import {HadronMarket} from "../src/HadronMarket.sol";

/// @notice 部署 HadronAssets 与 HadronMarket；部署产物 JSON 由调度方在 Step 7.4 写入。
contract Deploy is Script {
    uint16 private constant INITIAL_FEE_BPS = 50;

    function run() external returns (HadronAssets assets, HadronMarket market) {
        uint256 deployerPrivateKey = vm.envUint("DEPLOYER_PRIVATE_KEY");
        address treasury = vm.envAddress("TREASURY_ADDRESS");

        vm.startBroadcast(deployerPrivateKey);
        assets = new HadronAssets();
        market = new HadronMarket(assets, treasury, INITIAL_FEE_BPS);
        vm.stopBroadcast();

        console2.log("HadronAssets:", address(assets));
        console2.log("HadronMarket:", address(market));
        console2.log("Deploy block:", block.number);
    }
}
