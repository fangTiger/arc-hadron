// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Script} from "forge-std/Script.sol";
import {HadronAssets} from "../src/HadronAssets.sol";

contract Seed2026Q3RwaExpansion is Script {
    struct SeedAsset {
        string name;
        string category;
        uint256 totalShares;
        string metadataURI;
    }

    function run() external {
        HadronAssets assets = HadronAssets(vm.envAddress("HADRON_ASSETS"));
        SeedAsset[] memory seeds = seedAssets();

        vm.startBroadcast();
        for (uint256 index; index < seeds.length; index++) {
            assets.createAsset(
                seeds[index].name, seeds[index].category, seeds[index].totalShares, seeds[index].metadataURI
            );
        }
        vm.stopBroadcast();
    }

    function seedAssets() public pure returns (SeedAsset[] memory seeds) {
        seeds = new SeedAsset[](4);
        seeds[0] = SeedAsset({
            name: "German Bund 10Y",
            category: "sovereign-bonds",
            totalShares: 10_000_000,
            metadataURI: "hadron://assets/de-bund-10y"
        });
        seeds[1] = SeedAsset({
            name: "JGB 5Y",
            category: "sovereign-bonds",
            totalShares: 10_000_000,
            metadataURI: "hadron://assets/jp-jgb-5y"
        });
        seeds[2] = SeedAsset({
            name: "Apex Industrials 2029",
            category: "corporate-bonds",
            totalShares: 5_000_000,
            metadataURI: "hadron://assets/apex-industrials-2029"
        });
        seeds[3] = SeedAsset({
            name: "Helios Utility Note 2031",
            category: "corporate-bonds",
            totalShares: 5_000_000,
            metadataURI: "hadron://assets/helios-utility-2031"
        });
    }
}
