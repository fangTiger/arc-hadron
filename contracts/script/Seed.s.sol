// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Script, console2} from "forge-std/Script.sol";
import {HadronAssets} from "../src/HadronAssets.sol";
import {HadronMarket} from "../src/HadronMarket.sol";

/// @notice 发行 4 类种子资产并创建一级发行；只写链上状态，不写本地 JSON。
contract Seed is Script {
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
        if (currentAssetCount >= 5) {
            revert("ALREADY_SEEDED");
        }

        vm.startBroadcast(deployerPrivateKey);
        _seed(assets, market, SeedAsset({
            name: "US T-BILL 2026-Q3",
            category: "treasuries",
            totalShares: 10_000,
            offeringAmount: 6_000,
            pricePerShare: 100e18,
            metadataURI: "hadron://assets/t-bill-2026-q3"
        }), deployer);
        _seed(assets, market, SeedAsset({
            name: "GOLD OUNCE VAULT #4",
            category: "gold",
            totalShares: 500,
            offeringAmount: 300,
            pricePerShare: 23.8e18,
            metadataURI: "hadron://assets/gold-ounce-4"
        }), deployer);
        _seed(assets, market, SeedAsset({
            name: "MARINA TOWER UNIT 12F",
            category: "real-estate",
            totalShares: 2_000,
            offeringAmount: 1_200,
            pricePerShare: 55.5e18,
            metadataURI: "hadron://assets/marina-tower-12f"
        }), deployer);
        _seed(assets, market, SeedAsset({
            name: "VERRA CARBON LOT-9",
            category: "carbon",
            totalShares: 8_000,
            offeringAmount: 4_800,
            pricePerShare: 1.85e18,
            metadataURI: "hadron://assets/verra-carbon-9"
        }), deployer);
        vm.stopBroadcast();
    }

    function _ensureApproval(HadronAssets assets, HadronMarket market, address owner) private {
        if (!assets.isApprovedForAll(owner, address(market))) {
            assets.setApprovalForAll(address(market), true);
            console2.log("Approved market:", address(market));
        }
    }

    function _seed(
        HadronAssets assets,
        HadronMarket market,
        SeedAsset memory seedAsset,
        address owner
    ) private {
        uint256 tokenId = _findAssetByName(assets, seedAsset.name);
        if (tokenId == 0) {
            tokenId = assets.createAsset(
                seedAsset.name,
                seedAsset.category,
                seedAsset.totalShares,
                seedAsset.metadataURI
            );
        }

        uint256 existingOfferingId = _findOfferingByToken(market, tokenId);
        if (existingOfferingId != 0) {
            console2.log("Seed asset already offered tokenId:", tokenId);
            console2.log("Existing offeringId:", existingOfferingId);
            return;
        }

        _ensureApproval(assets, market, owner);
        uint256 offeringId = market.createPrimaryOffering(
            tokenId,
            seedAsset.pricePerShare,
            seedAsset.offeringAmount
        );

        console2.log("Seed asset tokenId:", tokenId);
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
