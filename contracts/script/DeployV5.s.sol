// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Script, console2} from "forge-std/Script.sol";
import {HadronAssets} from "../src/HadronAssets.sol";
import {HadronMarket} from "../src/HadronMarket.sol";
import {HadronYield} from "../src/HadronYield.sol";

/// @notice 部署 V5 三合约并一次性锁定收益钩子；部署产物 JSON 由广播任务写入。
contract DeployV5 is Script {
    uint16 private constant INITIAL_FEE_BPS = 50;

    function run() external returns (HadronAssets assets, HadronMarket market, HadronYield yieldDistributor) {
        uint256 deployerPrivateKey = vm.envUint("DEPLOYER_PRIVATE_KEY");
        address deployer = vm.addr(deployerPrivateKey);
        address treasury = vm.envAddress("TREASURY_ADDRESS");

        vm.startBroadcast(deployerPrivateKey);
        assets = new HadronAssets();
        market = new HadronMarket(assets, treasury, INITIAL_FEE_BPS);

        address[] memory excluded = new address[](2);
        excluded[0] = address(market);
        excluded[1] = deployer;
        yieldDistributor = new HadronYield(assets, excluded);

        assets.setYieldHook(address(yieldDistributor));
        vm.stopBroadcast();

        console2.log("HadronAssets:", address(assets));
        console2.log("HadronMarket:", address(market));
        console2.log("HadronYield:", address(yieldDistributor));
        console2.log("Deploy block:", block.number);
    }
}
