// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Script} from "forge-std/Script.sol";
import {HadronAssets} from "../src/HadronAssets.sol";

contract Seed2026Q4RwaBreadthExpansion is Script {
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
        seeds = new SeedAsset[](8);
        seeds[0] = SeedAsset({
            name: "USDC Treasury MMF A",
            category: "money-market-funds",
            totalShares: 2_000_000,
            metadataURI: "hadron://assets/usdc-treasury-mmf-a"
        });
        seeds[1] = SeedAsset({
            name: "SGD Liquidity Note 2026",
            category: "money-market-funds",
            totalShares: 1_500_000,
            metadataURI: "hadron://assets/sgd-liquidity-note-2026"
        });
        seeds[2] = SeedAsset({
            name: "Prime Mortgage Pool 2026-08",
            category: "mortgages",
            totalShares: 750_000,
            metadataURI: "hadron://assets/prime-mortgage-pool-2026-08"
        });
        seeds[3] = SeedAsset({
            name: "Sunbelt Rental Mortgage B",
            category: "mortgages",
            totalShares: 650_000,
            metadataURI: "hadron://assets/sunbelt-rental-mortgage-b"
        });
        seeds[4] = SeedAsset({
            name: "GPU Lease 2027",
            category: "equipment-finance",
            totalShares: 400_000,
            metadataURI: "hadron://assets/gpu-lease-2027"
        });
        seeds[5] = SeedAsset({
            name: "Railcar Lease Pool 2028",
            category: "equipment-finance",
            totalShares: 550_000,
            metadataURI: "hadron://assets/railcar-lease-pool-2028"
        });
        seeds[6] = SeedAsset({
            name: "Indie Catalog Royalty A",
            category: "music-royalties",
            totalShares: 300_000,
            metadataURI: "hadron://assets/indie-catalog-royalty-a"
        });
        seeds[7] = SeedAsset({
            name: "Streaming Royalty Basket 2026",
            category: "music-royalties",
            totalShares: 450_000,
            metadataURI: "hadron://assets/streaming-royalty-basket-2026"
        });
    }
}
