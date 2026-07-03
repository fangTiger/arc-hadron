// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Script, console2} from "forge-std/Script.sol";
import {HadronAssets} from "../src/HadronAssets.sol";
import {HadronMarket} from "../src/HadronMarket.sol";

/// @notice 以 0.01 显示份额粒度重新发行全部 14 个种子资产；只写链上状态，不写本地 JSON。
contract SeedV3 is Script {
    uint256 private constant ARC_TESTNET_CHAIN_ID = 5042002;

    struct SeedAsset {
        string name;
        string category;
        uint256 totalShares;
        uint256 offeringAmount;
        uint256 pricePerShare;
        string metadataURI;
    }

    function run() external {
        require(block.chainid == ARC_TESTNET_CHAIN_ID, "SeedV3: ARC testnet only");

        uint256 deployerPrivateKey = vm.envUint("DEPLOYER_PRIVATE_KEY");
        address deployer = vm.addr(deployerPrivateKey);
        HadronAssets assets = HadronAssets(vm.envAddress("HADRON_ASSETS"));
        HadronMarket market = HadronMarket(vm.envAddress("HADRON_MARKET"));

        uint256 currentAssetCount = assets.assetCount();
        console2.log("Current assetCount:", currentAssetCount);
        if (currentAssetCount >= 28) {
            revert("ALREADY_SEEDED_V3");
        }

        SeedAsset[] memory seeds = seedAssets();
        uint256 firstTokenId;
        uint256 lastTokenId;
        uint256 firstOfferingId;
        uint256 lastOfferingId;

        vm.startBroadcast(deployerPrivateKey);
        for (uint256 index = 0; index < seeds.length; index++) {
            (uint256 tokenId, uint256 offeringId) = _seed(assets, market, seeds[index], deployer);
            if (firstTokenId == 0) {
                firstTokenId = tokenId;
                firstOfferingId = offeringId;
            }
            lastTokenId = tokenId;
            lastOfferingId = offeringId;
        }
        vm.stopBroadcast();

        console2.log("Seed V3 tokenId range start:", firstTokenId);
        console2.log("Seed V3 tokenId range end:", lastTokenId);
        console2.log("FIRST_ACTIVE_TOKEN_ID:", firstTokenId);
        console2.log("Seed V3 offeringId range start:", firstOfferingId);
        console2.log("Seed V3 offeringId range end:", lastOfferingId);
    }

    function seedAssets() public pure returns (SeedAsset[] memory seeds) {
        seeds = new SeedAsset[](14);
        seeds[0] = SeedAsset({
            name: "US T-BILL 2026-Q3",
            category: "treasuries",
            totalShares: 1_000_000,
            offeringAmount: 600_000,
            pricePerShare: 100e16,
            metadataURI: "hadron://assets/t-bill-2026-q3"
        });
        seeds[1] = SeedAsset({
            name: "GOLD OUNCE VAULT #4",
            category: "gold",
            totalShares: 50_000,
            offeringAmount: 30_000,
            pricePerShare: 23.8e16,
            metadataURI: "hadron://assets/gold-ounce-4"
        });
        seeds[2] = SeedAsset({
            name: "MARINA TOWER UNIT 12F",
            category: "real-estate",
            totalShares: 200_000,
            offeringAmount: 120_000,
            pricePerShare: 55.5e16,
            metadataURI: "hadron://assets/marina-tower-12f"
        });
        seeds[3] = SeedAsset({
            name: "VERRA CARBON LOT-9",
            category: "carbon",
            totalShares: 800_000,
            offeringAmount: 480_000,
            pricePerShare: 1.85e16,
            metadataURI: "hadron://assets/verra-carbon-9"
        });
        seeds[4] = SeedAsset({
            name: "US T-Note 2028",
            category: "treasuries",
            totalShares: 1_000_000,
            offeringAmount: 600_000,
            pricePerShare: 98.4e16,
            metadataURI: "hadron://assets/us-t-note-2028"
        });
        seeds[5] = SeedAsset({
            name: "Meridian SME Credit Pool A",
            category: "private-credit",
            totalShares: 500_000,
            offeringAmount: 300_000,
            pricePerShare: 50e16,
            metadataURI: "hadron://assets/meridian-sme-credit-a"
        });
        seeds[6] = SeedAsset({
            name: "Atlas Trade Receivables B",
            category: "private-credit",
            totalShares: 600_000,
            offeringAmount: 360_000,
            pricePerShare: 25e16,
            metadataURI: "hadron://assets/atlas-trade-receivables-b"
        });
        seeds[7] = SeedAsset({
            name: "Dockside Logistics Park",
            category: "real-estate",
            totalShares: 300_000,
            offeringAmount: 180_000,
            pricePerShare: 42.75e16,
            metadataURI: "hadron://assets/dockside-logistics-park"
        });
        seeds[8] = SeedAsset({
            name: "Silver Bullion Vault #2",
            category: "commodities",
            totalShares: 200_000,
            offeringAmount: 120_000,
            pricePerShare: 29.4e16,
            metadataURI: "hadron://assets/silver-bullion-vault-2"
        });
        seeds[9] = SeedAsset({
            name: "Gold Standard Offset Bundle",
            category: "carbon",
            totalShares: 600_000,
            offeringAmount: 360_000,
            pricePerShare: 2.4e16,
            metadataURI: "hadron://assets/gold-standard-offset-bundle"
        });
        seeds[10] = SeedAsset({
            name: "Solar Farm Basin-2 Notes",
            category: "infrastructure",
            totalShares: 500_000,
            offeringAmount: 300_000,
            pricePerShare: 78.2e16,
            metadataURI: "hadron://assets/solar-farm-basin-2"
        });
        seeds[11] = SeedAsset({
            name: "Fiber Grid Metro Loop",
            category: "infrastructure",
            totalShares: 250_000,
            offeringAmount: 150_000,
            pricePerShare: 64e16,
            metadataURI: "hadron://assets/fiber-grid-metro-loop"
        });
        seeds[12] = SeedAsset({
            name: "Blue-Chip Art Fraction #7",
            category: "art-collectibles",
            totalShares: 80_000,
            offeringAmount: 48_000,
            pricePerShare: 120e16,
            metadataURI: "hadron://assets/blue-chip-art-fraction-7"
        });
        seeds[13] = SeedAsset({
            name: "Nexus Invoice Pool 2026-07",
            category: "invoice-financing",
            totalShares: 1_200_000,
            offeringAmount: 720_000,
            pricePerShare: 10e16,
            metadataURI: "hadron://assets/nexus-invoice-pool-2026-07"
        });
    }

    function _seed(
        HadronAssets assets,
        HadronMarket market,
        SeedAsset memory seedAsset,
        address owner
    ) private returns (uint256 tokenId, uint256 offeringId) {
        tokenId = assets.createAsset(seedAsset.name, seedAsset.category, seedAsset.totalShares, seedAsset.metadataURI);

        _ensureApproval(assets, market, owner);
        offeringId = market.createPrimaryOffering(tokenId, seedAsset.pricePerShare, seedAsset.offeringAmount);

        console2.log("Seed V3 asset tokenId:", tokenId);
        console2.log("Seed V3 primary offeringId:", offeringId);
    }

    function _ensureApproval(HadronAssets assets, HadronMarket market, address owner) private {
        if (!assets.isApprovedForAll(owner, address(market))) {
            assets.setApprovalForAll(address(market), true);
            console2.log("Approved market:", address(market));
        }
    }
}
