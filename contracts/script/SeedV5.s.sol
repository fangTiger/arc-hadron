// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Script, console2} from "forge-std/Script.sol";
import {HadronAssets} from "../src/HadronAssets.sol";
import {HadronMarket} from "../src/HadronMarket.sol";
import {HadronYield} from "../src/HadronYield.sol";

/// @notice 全新部署后一次性播种 14 个 0.01 份额资产、双边订单簿、成交样本与收益样本。
/// @dev 该脚本只面向 ARC 测试网。买单账户私钥可通过 SEED_BIDDER_PRIVATE_KEYS 传入，缺省回退部署者。
contract SeedV5 is Script {
    uint256 private constant ARC_TESTNET_CHAIN_ID = 5042002;
    uint256 private constant ASSET_COUNT = 14;
    uint256 private constant MAX_BIDS_PER_ASSET = 4;
    uint256 private constant MAX_TOTAL_BIDS = ASSET_COUNT * MAX_BIDS_PER_ASSET;
    uint256 private constant BPS_DENOMINATOR = 10_000;
    uint256 private constant SMALL_TRADE_VALUE_0 = 5e18;
    uint256 private constant SMALL_TRADE_VALUE_1 = 8e18;
    uint256 private constant SMALL_TRADE_VALUE_2 = 12e18;
    uint256 private constant SMALL_TRADE_VALUE_3 = 15e18;
    uint256 private constant MIN_SINGLE_TRADE_VALUE = 30e18;
    uint256 private constant MAX_SINGLE_TRADE_VALUE = 130e18;
    uint256 private constant MIN_DEPLOYER_RESERVE = 80e18;
    uint256 private constant BIDDER_GAS_BUFFER = 3e18;
    uint256 private constant YIELD_SAMPLE_TARGET_COUNT = 3;
    uint256 private constant YIELD_SAMPLE_AMOUNT_0 = 5e18;
    uint256 private constant YIELD_SAMPLE_AMOUNT_1 = 5e18;
    uint256 private constant YIELD_SAMPLE_AMOUNT_2 = 5e18;

    struct SeedAsset {
        string name;
        string category;
        uint256 totalShares;
        uint256 offeringAmount;
        uint256 pricePerShare;
        string metadataURI;
    }

    struct BidSeed {
        uint256 tokenId;
        uint256 amount;
        uint256 pricePerShare;
        uint256 fillAmount;
        uint256 bidId;
        address bidder;
        uint256 bidderPrivateKey;
    }

    struct SeedStats {
        uint256 firstTokenId;
        uint256 lastTokenId;
        uint256 firstOfferingId;
        uint256 lastOfferingId;
        uint256 offeringCount;
        uint256 listingCount;
        uint256 primaryTradeCount;
        uint256 secondarySelfBuyCount;
        uint256 bidCount;
        uint256 bidFillCount;
        uint256 yieldDepositCount;
        uint256 yieldClaimCount;
    }

    struct SeedContext {
        HadronAssets assets;
        HadronMarket market;
        HadronYield yieldDistributor;
        address deployer;
        uint256 bidderCount;
    }

    function run() external {
        require(block.chainid == ARC_TESTNET_CHAIN_ID, "SeedV5: ARC testnet only");

        uint256 deployerPrivateKey = vm.envUint("DEPLOYER_PRIVATE_KEY");
        address deployer = vm.addr(deployerPrivateKey);
        uint256[] memory bidderPrivateKeys = _bidderPrivateKeys(deployerPrivateKey);
        SeedContext memory context = SeedContext({
            assets: HadronAssets(vm.envAddress("HADRON_ASSETS")),
            market: HadronMarket(vm.envAddress("HADRON_MARKET")),
            yieldDistributor: HadronYield(vm.envAddress("HADRON_YIELD")),
            deployer: deployer,
            bidderCount: bidderPrivateKeys.length
        });
        if (context.assets.yieldHook() != address(context.yieldDistributor)) {
            revert("SEED_V5_YIELD_HOOK_MISMATCH");
        }

        uint256 currentAssetCount = context.assets.assetCount();
        console2.log("Current assetCount:", currentAssetCount);
        if (currentAssetCount != 0) {
            revert("SEED_V5_REQUIRES_FRESH_DEPLOYMENT");
        }

        vm.startBroadcast(deployerPrivateKey);
        (BidSeed[] memory bidSeeds, uint256 bidSeedCount, SeedStats memory stats) =
            _seedSellerSide(context, bidderPrivateKeys);
        vm.stopBroadcast();

        stats.bidCount = _placeBids(context.market, bidderPrivateKeys, bidSeeds, bidSeedCount);

        vm.startBroadcast(deployerPrivateKey);
        stats.bidFillCount = _fillBids(context.market, bidSeeds, bidSeedCount);
        stats.yieldDepositCount = _depositYieldSamples(context, bidSeeds, bidSeedCount);
        vm.stopBroadcast();

        stats.yieldClaimCount = _claimYieldSample(context, bidSeeds, bidSeedCount);

        console2.log("Seed V5 tokenId range start:", stats.firstTokenId);
        console2.log("Seed V5 tokenId range end:", stats.lastTokenId);
        console2.log("FIRST_ACTIVE_TOKEN_ID:", stats.firstTokenId);
        console2.log("Seed V5 offering count:", stats.offeringCount);
        console2.log("Seed V5 listing count:", stats.listingCount);
        console2.log("Seed V5 bid count:", stats.bidCount);
        console2.log("Seed V5 primary trade count:", stats.primaryTradeCount);
        console2.log("Seed V5 secondary self-buy count:", stats.secondarySelfBuyCount);
        console2.log("Seed V5 bid fill count:", stats.bidFillCount);
        console2.log("Seed V5 yield deposit count:", stats.yieldDepositCount);
        console2.log("Seed V5 yield claim count:", stats.yieldClaimCount);
        console2.log("Seed V5 deployer:", deployer);
        console2.log("Seed V5 yield:", address(context.yieldDistributor));
    }

    function _seedSellerSide(SeedContext memory context, uint256[] memory bidderPrivateKeys)
        private
        returns (BidSeed[] memory bidSeeds, uint256 bidSeedCount, SeedStats memory stats)
    {
        SeedAsset[] memory seeds = seedAssets();
        bidSeeds = new BidSeed[](MAX_TOTAL_BIDS);

        _ensureApproval(context.assets, context.market, context.deployer);
        for (uint256 index = 0; index < seeds.length; index++) {
            (bidSeedCount, stats) = _seedOneAsset(context, seeds[index], index, bidSeeds, bidSeedCount, stats);
        }

        _fundBidders(context.deployer, bidderPrivateKeys, _bidderFunding(bidSeeds, bidSeedCount, context.bidderCount));
    }

    function _seedOneAsset(
        SeedContext memory context,
        SeedAsset memory seedAsset,
        uint256 planIndex,
        BidSeed[] memory bidSeeds,
        uint256 bidSeedCount,
        SeedStats memory stats
    ) private returns (uint256, SeedStats memory) {
        (uint256 tokenId, uint256 offeringId) = _seedAsset(context.assets, context.market, seedAsset);
        if (stats.firstTokenId == 0) {
            stats.firstTokenId = tokenId;
            stats.firstOfferingId = offeringId;
        }
        stats.lastTokenId = tokenId;
        stats.lastOfferingId = offeringId;
        stats.offeringCount++;

        stats.primaryTradeCount += _seedPrimaryTrades(context.market, context.deployer, offeringId);
        (uint256 listed, uint256 secondaryBuys) =
            _seedSecondaryListings(context, tokenId, seedAsset.pricePerShare, planIndex);
        stats.listingCount += listed;
        stats.secondarySelfBuyCount += secondaryBuys;

        bidSeedCount = _appendBidSeeds(bidSeeds, bidSeedCount, tokenId, seedAsset.pricePerShare, planIndex);

        return (bidSeedCount, stats);
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

    function _seedAsset(HadronAssets assets, HadronMarket market, SeedAsset memory seedAsset)
        private
        returns (uint256 tokenId, uint256 offeringId)
    {
        tokenId = assets.createAsset(seedAsset.name, seedAsset.category, seedAsset.totalShares, seedAsset.metadataURI);
        offeringId = market.createPrimaryOffering(tokenId, seedAsset.pricePerShare, seedAsset.offeringAmount);

        console2.log("Seed V5 asset tokenId:", tokenId);
        console2.log("Seed V5 primary offeringId:", offeringId);
    }

    function _seedPrimaryTrades(HadronMarket market, address deployer, uint256 offeringId)
        private
        returns (uint256 tradeCount)
    {
        uint256 targetTradeCount = _targetTradeCount(offeringId);
        for (uint256 tradeIndex = 0; tradeIndex < targetTradeCount; tradeIndex++) {
            HadronMarket.Offering memory offering = market.getOffering(offeringId);
            if (!offering.active || offering.remaining == 0) {
                break;
            }

            uint256 targetValue =
                _targetValueForBalance(offeringId, tradeIndex, offering.pricePerShare, deployer.balance);
            uint256 shares = plannedPrimaryAmount(offeringId, tradeIndex, offering.pricePerShare, offering.remaining);
            uint256 largeValueShares = _amountForTargetValue(targetValue, offering.pricePerShare, offering.remaining);
            if (largeValueShares > 0) {
                shares = largeValueShares;
            }
            if (shares == 0) {
                console2.log("Skip Seed V5 primary trade with zero shares offeringId:", offeringId);
                break;
            }

            uint256 value = offering.pricePerShare * shares;
            if (value > MAX_SINGLE_TRADE_VALUE) {
                console2.log("Skip Seed V5 primary trade over max value offeringId:", offeringId);
                console2.log("Seed V5 primary value:", value);
                break;
            }
            if (!_hasReserveForValue(deployer.balance, value)) {
                console2.log("Stop Seed V5 primary trades below reserve offeringId:", offeringId);
                console2.log("Deployer balance:", deployer.balance);
                break;
            }

            console2.log("Seed V5 primary trade offeringId:", offeringId);
            console2.log("Seed V5 primary trade shares:", shares);
            console2.log("Seed V5 primary trade value:", value);
            market.buyPrimary{value: value}(offeringId, shares);
            tradeCount++;
        }
    }

    function _seedSecondaryListings(SeedContext memory context, uint256 tokenId, uint256 issuePrice, uint256 planIndex)
        private
        returns (uint256 listed, uint256 bought)
    {
        uint256 targetListCount = _capListCountByBalance(
            planIndex, _planListCount(planIndex), context.assets.balanceOf(context.deployer, tokenId)
        );
        uint256[] memory listingIds = new uint256[](targetListCount);
        uint256[] memory prices = new uint256[](targetListCount);
        uint256[] memory amounts = new uint256[](targetListCount);

        for (uint256 listingIndex = 0; listingIndex < targetListCount; listingIndex++) {
            uint256 bps = _planBps(planIndex, listingIndex);
            uint256 pricePerShare = issuePrice * bps / BPS_DENOMINATOR;
            uint256 amount = plannedListingAmount(planIndex, listingIndex);
            uint256 listingId = context.market.list(tokenId, amount, pricePerShare);

            listingIds[listed] = listingId;
            prices[listed] = pricePerShare;
            amounts[listed] = amount;
            listed++;

            console2.log("Seed V5 listingId:", listingId);
            console2.log("Seed V5 listing tokenId:", tokenId);
            console2.log("Seed V5 listing amount:", amount);
            console2.log("Seed V5 listing pricePerShare:", pricePerShare);
            console2.log("Seed V5 listing bps:", bps);
        }

        if (_shouldSelfBuy(planIndex) && listed > 1) {
            uint256 buyIndex = _selfBuyIndex(planIndex, listed);
            bool didBuy = _buySecondaryListing(
                context.market, context.deployer, tokenId, listingIds[buyIndex], prices[buyIndex], amounts[buyIndex]
            );
            if (didBuy) {
                bought = 1;
            }
        }
    }

    function _buySecondaryListing(
        HadronMarket market,
        address deployer,
        uint256 tokenId,
        uint256 listingId,
        uint256 pricePerShare,
        uint256 listingAmount
    ) private returns (bool) {
        uint256 amount = plannedSelfBuyAmount(pricePerShare, listingAmount);
        if (amount == 0) {
            console2.log("Skip Seed V5 secondary self-buy value cap listingId:", listingId);
            return false;
        }

        uint256 value = pricePerShare * amount;
        if (value > MAX_SINGLE_TRADE_VALUE || deployer.balance < value) {
            console2.log("Skip Seed V5 secondary self-buy listingId:", listingId);
            console2.log("Seed V5 secondary self-buy value:", value);
            return false;
        }

        market.buy{value: value}(listingId, amount);
        uint256 fee = value * market.feeBps() / BPS_DENOMINATOR;
        console2.log("Seed V5 secondary self-buy listingId:", listingId);
        console2.log("Seed V5 secondary self-buy tokenId:", tokenId);
        console2.log("Seed V5 secondary self-buy amount:", amount);
        console2.log("Seed V5 secondary self-buy value:", value);
        console2.log("Seed V5 secondary self-buy fee:", fee);
        return true;
    }

    function _appendBidSeeds(
        BidSeed[] memory bidSeeds,
        uint256 bidSeedCount,
        uint256 tokenId,
        uint256 issuePrice,
        uint256 planIndex
    ) private pure returns (uint256) {
        uint256 targetBidCount = _targetBidCount(planIndex);
        uint256 targetFillCount = _targetBidFillCount(planIndex);
        for (uint256 bidIndex = 0; bidIndex < targetBidCount; bidIndex++) {
            uint256 pricePerShare = issuePrice * _bidBps(bidIndex) / BPS_DENOMINATOR;
            uint256 amount = plannedBidAmount(planIndex, bidIndex, pricePerShare);
            bidSeeds[bidSeedCount] = BidSeed({
                tokenId: tokenId,
                amount: amount,
                pricePerShare: pricePerShare,
                fillAmount: bidIndex < targetFillCount ? plannedBidFillAmount(amount, bidIndex) : 0,
                bidId: 0,
                bidder: address(0),
                bidderPrivateKey: 0
            });
            bidSeedCount++;
        }

        return bidSeedCount;
    }

    function _bidderFunding(BidSeed[] memory bidSeeds, uint256 bidSeedCount, uint256 bidderCount)
        private
        pure
        returns (uint256[] memory funding)
    {
        funding = new uint256[](bidderCount);
        for (uint256 index = 0; index < bidSeedCount; index++) {
            funding[index % bidderCount] += bidSeeds[index].pricePerShare * bidSeeds[index].amount;
        }
    }

    function _fundBidders(address deployer, uint256[] memory bidderPrivateKeys, uint256[] memory funding) private {
        for (uint256 index = 0; index < bidderPrivateKeys.length; index++) {
            address bidder = vm.addr(bidderPrivateKeys[index]);
            if (bidder == deployer || funding[index] == 0) {
                continue;
            }

            uint256 transferAmount = funding[index] + BIDDER_GAS_BUFFER;
            payable(bidder).transfer(transferAmount);
            console2.log("Seed V5 funded bidder:", bidder);
            console2.log("Seed V5 bidder funding:", transferAmount);
        }
    }

    function _placeBids(
        HadronMarket market,
        uint256[] memory bidderPrivateKeys,
        BidSeed[] memory bidSeeds,
        uint256 bidSeedCount
    ) private returns (uint256 bidCount) {
        for (uint256 index = 0; index < bidSeedCount; index++) {
            BidSeed memory bidSeed = bidSeeds[index];
            uint256 bidderPrivateKey = bidderPrivateKeys[index % bidderPrivateKeys.length];
            uint256 value = bidSeed.pricePerShare * bidSeed.amount;

            vm.startBroadcast(bidderPrivateKey);
            uint256 bidId = market.placeBid{value: value}(bidSeed.tokenId, bidSeed.amount, bidSeed.pricePerShare);
            vm.stopBroadcast();

            bidSeeds[index].bidId = bidId;
            bidSeeds[index].bidder = vm.addr(bidderPrivateKey);
            bidSeeds[index].bidderPrivateKey = bidderPrivateKey;
            bidCount++;
            console2.log("Seed V5 bidId:", bidId);
            console2.log("Seed V5 bid tokenId:", bidSeed.tokenId);
            console2.log("Seed V5 bid amount:", bidSeed.amount);
            console2.log("Seed V5 bid pricePerShare:", bidSeed.pricePerShare);
            console2.log("Seed V5 bidder:", vm.addr(bidderPrivateKey));
        }
    }

    function _fillBids(HadronMarket market, BidSeed[] memory bidSeeds, uint256 bidSeedCount)
        private
        returns (uint256 fillCount)
    {
        for (uint256 index = 0; index < bidSeedCount; index++) {
            if (bidSeeds[index].fillAmount == 0) {
                continue;
            }

            market.fillBid(bidSeeds[index].bidId, bidSeeds[index].fillAmount);
            fillCount++;
            console2.log("Seed V5 bid fill bidId:", bidSeeds[index].bidId);
            console2.log("Seed V5 bid fill tokenId:", bidSeeds[index].tokenId);
            console2.log("Seed V5 bid fill amount:", bidSeeds[index].fillAmount);
        }
    }

    function _depositYieldSamples(SeedContext memory context, BidSeed[] memory bidSeeds, uint256 bidSeedCount)
        private
        returns (uint256 depositCount)
    {
        uint256[] memory depositedTokenIds = new uint256[](YIELD_SAMPLE_TARGET_COUNT);

        for (uint256 index = 0; index < bidSeedCount && depositCount < YIELD_SAMPLE_TARGET_COUNT; index++) {
            BidSeed memory bidSeed = bidSeeds[index];
            if (bidSeed.fillAmount == 0 || bidSeed.bidder == address(0) || bidSeed.bidder == context.deployer) {
                continue;
            }
            if (_hasDepositedToken(depositedTokenIds, depositCount, bidSeed.tokenId)) {
                continue;
            }

            uint256 amount = _yieldSampleAmount(depositCount);
            if (context.deployer.balance < amount) {
                console2.log("Skip Seed V5 yield deposit below balance tokenId:", bidSeed.tokenId);
                console2.log("Seed V5 deployer balance:", context.deployer.balance);
                break;
            }

            context.yieldDistributor.depositYield{value: amount}(bidSeed.tokenId);
            depositedTokenIds[depositCount] = bidSeed.tokenId;
            depositCount++;

            console2.log("Seed V5 yield deposit tokenId:", bidSeed.tokenId);
            console2.log("Seed V5 yield deposit amount:", amount);
            console2.log("Seed V5 yield deposit holder:", bidSeed.bidder);
        }

        if (depositCount == 0) {
            console2.log("Skip Seed V5 yield deposits without non-excluded circulating holder");
        }
    }

    function _claimYieldSample(SeedContext memory context, BidSeed[] memory bidSeeds, uint256 bidSeedCount)
        private
        returns (uint256 claimCount)
    {
        for (uint256 index = 0; index < bidSeedCount; index++) {
            BidSeed memory bidSeed = bidSeeds[index];
            if (bidSeed.fillAmount == 0 || bidSeed.bidder == address(0) || bidSeed.bidder == context.deployer) {
                continue;
            }
            if (bidSeed.bidderPrivateKey == 0) {
                continue;
            }

            uint256 pending = context.yieldDistributor.pendingYield(bidSeed.bidder, bidSeed.tokenId);
            if (pending == 0) {
                continue;
            }
            if (bidSeed.bidder.balance == 0) {
                console2.log("Skip Seed V5 yield claim without bidder gas:", bidSeed.bidder);
                continue;
            }

            vm.startBroadcast(bidSeed.bidderPrivateKey);
            context.yieldDistributor.claimYield(bidSeed.tokenId);
            vm.stopBroadcast();

            console2.log("Seed V5 yield claim tokenId:", bidSeed.tokenId);
            console2.log("Seed V5 yield claim account:", bidSeed.bidder);
            console2.log("Seed V5 yield claim pending before:", pending);
            return 1;
        }

        console2.log("Skip Seed V5 yield claim without non-excluded holder");
    }

    function _bidderPrivateKeys(uint256 deployerPrivateKey) private view returns (uint256[] memory bidderPrivateKeys) {
        string memory raw = vm.envOr("SEED_BIDDER_PRIVATE_KEYS", string(""));
        raw = vm.replace(raw, " ", "");
        raw = vm.replace(raw, "\n", "");
        raw = vm.replace(raw, "\t", "");
        if (bytes(raw).length == 0) {
            bidderPrivateKeys = new uint256[](1);
            bidderPrivateKeys[0] = deployerPrivateKey;
            console2.log("Seed V5 bidder count:", uint256(1));
            return bidderPrivateKeys;
        }

        string[] memory parts = vm.split(raw, ",");
        bidderPrivateKeys = new uint256[](parts.length);
        for (uint256 index = 0; index < parts.length; index++) {
            uint256 privateKey = vm.parseUint(parts[index]);
            if (privateKey == 0) {
                revert("SEED_V5_ZERO_BIDDER_KEY");
            }
            bidderPrivateKeys[index] = privateKey;
        }
        console2.log("Seed V5 bidder count:", bidderPrivateKeys.length);
    }

    function _ensureApproval(HadronAssets assets, HadronMarket market, address owner) private {
        if (!assets.isApprovedForAll(owner, address(market))) {
            assets.setApprovalForAll(address(market), true);
            console2.log("Approved market:", address(market));
        }
    }

    function _hasDepositedToken(uint256[] memory depositedTokenIds, uint256 depositCount, uint256 tokenId)
        private
        pure
        returns (bool)
    {
        for (uint256 index = 0; index < depositCount; index++) {
            if (depositedTokenIds[index] == tokenId) {
                return true;
            }
        }

        return false;
    }

    function _yieldSampleAmount(uint256 depositIndex) private pure returns (uint256) {
        if (depositIndex == 0) {
            return YIELD_SAMPLE_AMOUNT_0;
        }
        if (depositIndex == 1) {
            return YIELD_SAMPLE_AMOUNT_1;
        }

        return YIELD_SAMPLE_AMOUNT_2;
    }

    function plannedListingAmount(uint256 planIndex, uint256 listingIndex) public pure returns (uint256) {
        uint256 variant = (planIndex + listingIndex) % 3;
        if (variant == 0) {
            return 100;
        }
        if (variant == 1) {
            return 200;
        }

        return 300;
    }

    function plannedSelfBuyAmount(uint256 pricePerShare, uint256 listingAmount) public pure returns (uint256) {
        if (pricePerShare == 0 || listingAmount == 0) {
            return 0;
        }

        uint256 maxAmount = MAX_SINGLE_TRADE_VALUE / pricePerShare;
        if (maxAmount == 0) {
            return 0;
        }
        if (listingAmount < maxAmount) {
            return listingAmount;
        }

        return maxAmount;
    }

    function plannedPrimaryAmount(uint256 offeringId, uint256 tradeIndex, uint256 pricePerShare, uint256 remaining)
        public
        pure
        returns (uint256)
    {
        if (pricePerShare == 0 || remaining == 0) {
            return 0;
        }

        return _amountForTargetValue(
            plannedPrimaryTargetValue(offeringId, tradeIndex, pricePerShare), pricePerShare, remaining
        );
    }

    function plannedPrimaryTargetValue(uint256 offeringId, uint256 tradeIndex, uint256 pricePerShare)
        public
        pure
        returns (uint256)
    {
        if (pricePerShare == 0) {
            return 0;
        }

        uint256 targetValue = _smallTargetValueByIndex((offeringId + tradeIndex) % 4);
        if (targetValue / pricePerShare == 0) {
            return MAX_SINGLE_TRADE_VALUE;
        }

        return targetValue;
    }

    /// @dev 按目标托管金额定档（而非固定份额数）：deployer 测试网余额有限（≈130 USDC），
    ///      买单托管会长期锁定资金，固定份额在高价资产上单档即可击穿预算。
    ///      目标金额 0.5-1.6 USDC/档，14 资产 × 2-4 档总托管 ≤ ~45 USDC；amount 向下取整最低 1 单位。
    function plannedBidAmount(uint256 planIndex, uint256 bidIndex, uint256 pricePerShare)
        public
        pure
        returns (uint256)
    {
        uint256 variant = (planIndex + bidIndex) % 4;
        uint256 targetValue;
        if (variant == 0) {
            targetValue = 1.2e18;
        } else if (variant == 1) {
            targetValue = 0.8e18;
        } else if (variant == 2) {
            targetValue = 1.6e18;
        } else {
            targetValue = 0.5e18;
        }

        uint256 amount = targetValue / pricePerShare;

        return amount == 0 ? 1 : amount;
    }

    function plannedBidFillAmount(uint256 bidAmount, uint256 fillIndex) public pure returns (uint256) {
        uint256 fillAmount = fillIndex == 0 ? bidAmount / 3 : bidAmount / 4;
        if (fillAmount >= bidAmount) {
            return bidAmount - 1;
        }

        return fillAmount;
    }

    function _targetValueForBalance(
        uint256 offeringId,
        uint256 tradeIndex,
        uint256 pricePerShare,
        uint256 deployerBalance
    ) private pure returns (uint256) {
        uint256 index = (offeringId + tradeIndex) % 4;
        uint256 largeTargetValue = _largeTargetValueByIndex(index);
        if (
            pricePerShare > 0 && largeTargetValue / pricePerShare > 0
                && _hasReserveForValue(deployerBalance, largeTargetValue)
        ) {
            return largeTargetValue;
        }

        return plannedPrimaryTargetValue(offeringId, tradeIndex, pricePerShare);
    }

    function _amountForTargetValue(uint256 targetValue, uint256 pricePerShare, uint256 remaining)
        private
        pure
        returns (uint256)
    {
        if (pricePerShare == 0 || remaining == 0) {
            return 0;
        }

        uint256 amount = targetValue / pricePerShare;
        if (amount > remaining) {
            return remaining;
        }

        return amount;
    }

    function _capListCountByBalance(uint256 planIndex, uint256 targetListCount, uint256 deployerBalance)
        private
        pure
        returns (uint256)
    {
        while (targetListCount > 0 && _plannedListingTotal(planIndex, targetListCount) > deployerBalance) {
            targetListCount--;
        }

        return targetListCount;
    }

    function _plannedListingTotal(uint256 planIndex, uint256 targetListCount) private pure returns (uint256 total) {
        for (uint256 listingIndex = 0; listingIndex < targetListCount; listingIndex++) {
            total += plannedListingAmount(planIndex, listingIndex);
        }
    }

    /// @dev 偶数序资产创建 3 笔并自成交 1 笔，最终通常保留 2 个活跃卖单；奇数序资产直接留 2 笔。
    function _planListCount(uint256 planIndex) private pure returns (uint256) {
        if (planIndex % 2 == 0) {
            return 3;
        }

        return 2;
    }

    /// @dev 复刻 SeedSecondary 的 9400-10800 bps 卖单变价档位。
    function _planBps(uint256 planIndex, uint256 listingIndex) private pure returns (uint256) {
        uint256 variant = planIndex % 10;
        if (variant == 0) {
            if (listingIndex == 0) return 9_400;
            if (listingIndex == 1) return 10_000;
            return 10_800;
        }
        if (variant == 1) {
            if (listingIndex == 0) return 9_700;
            return 10_600;
        }
        if (variant == 2) {
            if (listingIndex == 0) return 9_400;
            if (listingIndex == 1) return 10_300;
            return 10_600;
        }
        if (variant == 3) {
            if (listingIndex == 0) return 10_000;
            return 10_800;
        }
        if (variant == 4) {
            if (listingIndex == 0) return 9_700;
            if (listingIndex == 1) return 10_000;
            return 10_800;
        }
        if (variant == 5) {
            if (listingIndex == 0) return 9_400;
            return 10_600;
        }
        if (variant == 6) {
            if (listingIndex == 0) return 9_400;
            if (listingIndex == 1) return 9_700;
            return 10_300;
        }
        if (variant == 7) {
            if (listingIndex == 0) return 10_000;
            return 10_600;
        }
        if (variant == 8) {
            if (listingIndex == 0) return 9_700;
            if (listingIndex == 1) return 10_300;
            return 10_800;
        }

        if (listingIndex == 0) return 9_400;
        return 10_000;
    }

    function _shouldSelfBuy(uint256 planIndex) private pure returns (bool) {
        return planIndex % 2 == 0;
    }

    function _selfBuyIndex(uint256 planIndex, uint256 listed) private pure returns (uint256) {
        uint256 variant = planIndex % 10;
        if ((variant == 2 || variant == 6 || variant == 8) && listed > 1) {
            return 1;
        }
        if (variant == 4) {
            return listed > 2 ? 2 : listed - 1;
        }

        return 0;
    }

    function _targetTradeCount(uint256 offeringId) private pure returns (uint256) {
        if (offeringId % 2 == 0) {
            return 2;
        }

        return 1;
    }

    function _targetBidCount(uint256 planIndex) private pure returns (uint256) {
        return 2 + (planIndex % 3);
    }

    function _targetBidFillCount(uint256 planIndex) private pure returns (uint256) {
        if (planIndex % 2 == 0) {
            return 2;
        }

        return 1;
    }

    /// @dev 买单价全部低于最低卖单 9400 bps，并按档位递减。
    function _bidBps(uint256 bidIndex) private pure returns (uint256) {
        if (bidIndex == 0) {
            return 9_000;
        }
        if (bidIndex == 1) {
            return 8_700;
        }
        if (bidIndex == 2) {
            return 8_400;
        }

        return 8_100;
    }

    function _hasReserveForValue(uint256 balance, uint256 value) private pure returns (bool) {
        return balance >= value + MIN_DEPLOYER_RESERVE;
    }

    function _smallTargetValueByIndex(uint256 index) private pure returns (uint256) {
        if (index == 0) {
            return SMALL_TRADE_VALUE_0;
        }
        if (index == 1) {
            return SMALL_TRADE_VALUE_1;
        }
        if (index == 2) {
            return SMALL_TRADE_VALUE_2;
        }

        return SMALL_TRADE_VALUE_3;
    }

    function _largeTargetValueByIndex(uint256 index) private pure returns (uint256) {
        if (index == 0) {
            return MIN_SINGLE_TRADE_VALUE;
        }
        if (index == 1) {
            return 55e18;
        }
        if (index == 2) {
            return 90e18;
        }

        return MAX_SINGLE_TRADE_VALUE;
    }
}
