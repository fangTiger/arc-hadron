// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Script, console2} from "forge-std/Script.sol";
import {HadronAssets} from "../src/HadronAssets.sol";
import {HadronMarket} from "../src/HadronMarket.sol";

/// @notice 扩容 10 个 M2R 资产并为每个资产创建一级发行；只写链上状态，不写本地 JSON。
contract SeedV2 is Script {
    struct SeedAsset {
        string name;
        string category;
        uint256 totalShares;
        uint256 offeringAmount;
        uint256 pricePerShare;
        string metadataURI;
    }

    function run() external {
        uint256 deployerPrivateKey = vm.envUint("DEPLOYER_PRIVATE_KEY");
        address deployer = vm.addr(deployerPrivateKey);
        HadronAssets assets = HadronAssets(vm.envAddress("HADRON_ASSETS"));
        HadronMarket market = HadronMarket(vm.envAddress("HADRON_MARKET"));

        uint256 currentAssetCount = assets.assetCount();
        console2.log("Current assetCount:", currentAssetCount);
        if (currentAssetCount >= 14) {
            revert("ALREADY_SEEDED_V2");
        }

        vm.startBroadcast(deployerPrivateKey);
        _seed(
            assets,
            market,
            SeedAsset({
                name: "US T-Note 2028",
                category: "treasuries",
                totalShares: 10_000,
                offeringAmount: 6_000,
                pricePerShare: 98.4e18,
                metadataURI: "hadron://assets/us-t-note-2028"
            }),
            deployer
        );
        _seed(
            assets,
            market,
            SeedAsset({
                name: "Meridian SME Credit Pool A",
                category: "private-credit",
                totalShares: 5_000,
                offeringAmount: 3_000,
                pricePerShare: 50e18,
                metadataURI: "hadron://assets/meridian-sme-credit-a"
            }),
            deployer
        );
        _seed(
            assets,
            market,
            SeedAsset({
                name: "Atlas Trade Receivables B",
                category: "private-credit",
                totalShares: 6_000,
                offeringAmount: 3_600,
                pricePerShare: 25e18,
                metadataURI: "hadron://assets/atlas-trade-receivables-b"
            }),
            deployer
        );
        _seed(
            assets,
            market,
            SeedAsset({
                name: "Dockside Logistics Park",
                category: "real-estate",
                totalShares: 3_000,
                offeringAmount: 1_800,
                pricePerShare: 42.75e18,
                metadataURI: "hadron://assets/dockside-logistics-park"
            }),
            deployer
        );
        _seed(
            assets,
            market,
            SeedAsset({
                name: "Silver Bullion Vault #2",
                category: "commodities",
                totalShares: 2_000,
                offeringAmount: 1_200,
                pricePerShare: 29.4e18,
                metadataURI: "hadron://assets/silver-bullion-vault-2"
            }),
            deployer
        );
        _seed(
            assets,
            market,
            SeedAsset({
                name: "Gold Standard Offset Bundle",
                category: "carbon",
                totalShares: 6_000,
                offeringAmount: 3_600,
                pricePerShare: 2.4e18,
                metadataURI: "hadron://assets/gold-standard-offset-bundle"
            }),
            deployer
        );
        _seed(
            assets,
            market,
            SeedAsset({
                name: "Solar Farm Basin-2 Notes",
                category: "infrastructure",
                totalShares: 5_000,
                offeringAmount: 3_000,
                pricePerShare: 78.2e18,
                metadataURI: "hadron://assets/solar-farm-basin-2"
            }),
            deployer
        );
        _seed(
            assets,
            market,
            SeedAsset({
                name: "Fiber Grid Metro Loop",
                category: "infrastructure",
                totalShares: 2_500,
                offeringAmount: 1_500,
                pricePerShare: 64e18,
                metadataURI: "hadron://assets/fiber-grid-metro-loop"
            }),
            deployer
        );
        _seed(
            assets,
            market,
            SeedAsset({
                name: "Blue-Chip Art Fraction #7",
                category: "art-collectibles",
                totalShares: 800,
                offeringAmount: 480,
                pricePerShare: 120e18,
                metadataURI: "hadron://assets/blue-chip-art-fraction-7"
            }),
            deployer
        );
        _seed(
            assets,
            market,
            SeedAsset({
                name: "Nexus Invoice Pool 2026-07",
                category: "invoice-financing",
                totalShares: 12_000,
                offeringAmount: 7_200,
                pricePerShare: 10e18,
                metadataURI: "hadron://assets/nexus-invoice-pool-2026-07"
            }),
            deployer
        );
        vm.stopBroadcast();
    }

    function _ensureApproval(HadronAssets assets, HadronMarket market, address owner) private {
        if (!assets.isApprovedForAll(owner, address(market))) {
            assets.setApprovalForAll(address(market), true);
            console2.log("Approved market:", address(market));
        }
    }

    function _seed(HadronAssets assets, HadronMarket market, SeedAsset memory seedAsset, address owner) private {
        uint256 tokenId = _findAssetByName(assets, seedAsset.name);
        if (tokenId == 0) {
            tokenId =
                assets.createAsset(seedAsset.name, seedAsset.category, seedAsset.totalShares, seedAsset.metadataURI);
        }

        uint256 existingOfferingId = _findOfferingByToken(market, tokenId);
        if (existingOfferingId != 0) {
            console2.log("Seed V2 asset already offered tokenId:", tokenId);
            console2.log("Existing offeringId:", existingOfferingId);
            return;
        }

        _ensureApproval(assets, market, owner);
        uint256 offeringId = market.createPrimaryOffering(tokenId, seedAsset.pricePerShare, seedAsset.offeringAmount);

        console2.log("Seed V2 asset tokenId:", tokenId);
        console2.log("Primary offeringId:", offeringId);
    }

    function _findAssetByName(HadronAssets assets, string memory name) private view returns (uint256) {
        uint256 assetCount = assets.assetCount();
        bytes32 targetNameHash = keccak256(bytes(name));
        for (uint256 tokenId = 1; tokenId <= assetCount; tokenId++) {
            HadronAssets.Asset memory asset = assets.getAsset(tokenId);
            if (keccak256(bytes(asset.name)) == targetNameHash) {
                return tokenId;
            }
        }

        return 0;
    }

    function _findOfferingByToken(HadronMarket market, uint256 tokenId) private view returns (uint256) {
        uint256 offeringCount = market.offeringCount();
        for (uint256 offeringId = 1; offeringId <= offeringCount; offeringId++) {
            HadronMarket.Offering memory offering = market.getOffering(offeringId);
            if (offering.tokenId == tokenId) {
                return offeringId;
            }
        }

        return 0;
    }
}
