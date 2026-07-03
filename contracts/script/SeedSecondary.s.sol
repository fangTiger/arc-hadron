// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Script, console2} from "forge-std/Script.sol";
import {HadronAssets} from "../src/HadronAssets.sol";
import {HadronMarket} from "../src/HadronMarket.sol";

/// @notice 为测试网制造二级挂单与变价 Purchased 事件。
/// @dev 该脚本会让 deployer 购买自己的一部分挂单；这是测试网种子数据自成交，用于生成真实二级市场价格事件，不用于生产。
contract SeedSecondary is Script {
    /// @dev 仅允许在 ARC 测试网运行，防止误用于其他链（授权 operator + 自成交均为测试网专用行为）。
    uint256 private constant ARC_TESTNET_CHAIN_ID = 5042002;
    uint256 private constant MAX_SINGLE_TRADE_VALUE = 130e18;
    uint256 private constant MAX_TARGET_ASSETS = 6;
    uint256 private constant MIN_TARGET_ASSETS = 4;
    uint256 private constant MAX_OPEN_LISTINGS_PER_ASSET = 2;
    uint256 private constant BPS_DENOMINATOR = 10_000;

    struct ListingSeedInput {
        address deployer;
        uint256 tokenId;
        uint256 issuePrice;
        uint256 planIndex;
        uint256 targetListCount;
        bool allowSelfBuy;
    }

    function run() external {
        require(block.chainid == ARC_TESTNET_CHAIN_ID, "SeedSecondary: ARC testnet only");

        uint256 deployerPrivateKey = vm.envUint("DEPLOYER_PRIVATE_KEY");
        address deployer = vm.addr(deployerPrivateKey);
        HadronAssets assets = HadronAssets(vm.envAddress("HADRON_ASSETS"));
        HadronMarket market = HadronMarket(vm.envAddress("HADRON_MARKET"));
        uint256 minOfferingId = vm.envOr("SEED_MIN_OFFERING_ID", uint256(1));
        if (minOfferingId == 0) {
            minOfferingId = 1;
        }

        _logRunConfig(deployer, assets, market, minOfferingId);

        vm.startBroadcast(deployerPrivateKey);
        if (!_ensureApproval(assets, market, deployer)) {
            vm.stopBroadcast();
            console2.log(unicode"授权失败，跳过二级种子脚本");
            return;
        }

        uint256 handledAssets;
        uint256 createdListings;
        uint256 selfBuys;
        uint256 offeringCount = market.offeringCount();
        for (
            uint256 offeringId = minOfferingId;
            offeringId <= offeringCount && handledAssets < MAX_TARGET_ASSETS;
            offeringId++
        ) {
            (bool handled, uint256 listed, uint256 bought) =
                _seedOffering(assets, market, deployer, offeringId, handledAssets);
            if (!handled) {
                continue;
            }

            handledAssets++;
            createdListings += listed;
            selfBuys += bought;
        }
        vm.stopBroadcast();

        console2.log(unicode"二级种子处理资产数:", handledAssets);
        console2.log(unicode"二级种子新增挂单数:", createdListings);
        console2.log(unicode"二级种子自成交数:", selfBuys);
        if (handledAssets < MIN_TARGET_ASSETS) {
            console2.log(unicode"可处理资产少于目标下限:", handledAssets);
        }
    }

    function _logRunConfig(
        address deployer,
        HadronAssets assets,
        HadronMarket market,
        uint256 minOfferingId
    ) private view {
        console2.log(unicode"二级种子 deployer:", deployer);
        console2.log(unicode"HadronAssets:", address(assets));
        console2.log(unicode"HadronMarket:", address(market));
        console2.log(unicode"Treasury env:", vm.envAddress("TREASURY_ADDRESS"));
        console2.log(unicode"Market treasury:", market.treasury());
        console2.log(unicode"最小 offeringId:", minOfferingId);
        console2.log(unicode"当前 offeringCount:", market.offeringCount());
        console2.log(unicode"当前 listingCount:", market.listingCount());
        console2.log(unicode"Market feeBps:", market.feeBps());
    }

    function _ensureApproval(HadronAssets assets, HadronMarket market, address owner) private returns (bool) {
        if (assets.isApprovedForAll(owner, address(market))) {
            console2.log(unicode"市场已获 ERC1155 授权");
            return true;
        }

        try assets.setApprovalForAll(address(market), true) {
            console2.log(unicode"已授权市场托管份额:", address(market));
            return true;
        } catch {
            console2.log(unicode"授权市场失败:", address(market));
            return false;
        }
    }

    function _seedOffering(
        HadronAssets assets,
        HadronMarket market,
        address deployer,
        uint256 offeringId,
        uint256 planIndex
    ) private returns (bool handled, uint256 listed, uint256 bought) {
        HadronMarket.Offering memory offering;
        try market.getOffering(offeringId) returns (HadronMarket.Offering memory loadedOffering) {
            offering = loadedOffering;
        } catch {
            console2.log(unicode"跳过无法读取 offeringId:", offeringId);
            return (false, 0, 0);
        }

        if (!offering.active || offering.remaining == 0) {
            console2.log(unicode"跳过非活跃 offeringId:", offeringId);
            return (false, 0, 0);
        }

        uint256 tokenId = offering.tokenId;
        (bool canHandle, uint256 targetListCount, bool allowSelfBuy) =
            _prepareOffering(assets, market, deployer, tokenId, planIndex);
        if (!canHandle) {
            return (false, 0, 0);
        }
        if (targetListCount == 0) {
            return (true, 0, 0);
        }

        (listed, bought) = _createListingsAndMaybeBuy(market, ListingSeedInput({
            deployer: deployer,
            tokenId: tokenId,
            issuePrice: offering.pricePerShare,
            planIndex: planIndex,
            targetListCount: targetListCount,
            allowSelfBuy: allowSelfBuy
        }));
        if (listed == 0) {
            console2.log(unicode"未能创建挂单 tokenId:", tokenId);
            return (false, 0, 0);
        }

        return (true, listed, bought);
    }

    function _prepareOffering(
        HadronAssets assets,
        HadronMarket market,
        address deployer,
        uint256 tokenId,
        uint256 planIndex
    ) private view returns (bool canHandle, uint256 targetListCount, bool allowSelfBuy) {
        uint256 deployerBalance = assets.balanceOf(deployer, tokenId);
        if (deployerBalance == 0) {
            console2.log(unicode"跳过 deployer 无份额 tokenId:", tokenId);
            return (false, 0, false);
        }

        uint256 existingOpenListings = _activeOwnListingCount(market, deployer, tokenId);
        if (existingOpenListings >= MAX_OPEN_LISTINGS_PER_ASSET) {
            console2.log(unicode"跳过已有足够活跃挂单 tokenId:", tokenId);
            console2.log(unicode"已有活跃挂单数:", existingOpenListings);
            return (true, 0, false);
        }

        targetListCount = _planListCount(planIndex);
        allowSelfBuy = existingOpenListings == 0 && _shouldSelfBuy(planIndex);
        if (existingOpenListings > 0) {
            uint256 missingOpenListings = MAX_OPEN_LISTINGS_PER_ASSET - existingOpenListings;
            if (targetListCount > missingOpenListings) {
                targetListCount = missingOpenListings;
            }
        }
        targetListCount = _capListCountByBalance(planIndex, targetListCount, deployerBalance);
        if (targetListCount == 0) {
            console2.log(unicode"跳过余额不足 tokenId:", tokenId);
            return (false, 0, false);
        }

        uint256 plannedAmount = _plannedListingTotal(planIndex, targetListCount);
        if (plannedAmount == 0) {
            console2.log(unicode"跳过余额不足 tokenId:", tokenId);
            return (false, 0, false);
        }

        return (true, targetListCount, allowSelfBuy);
    }

    function _createListingsAndMaybeBuy(
        HadronMarket market,
        ListingSeedInput memory input
    ) private returns (uint256 listed, uint256 bought) {
        uint256[] memory listingIds = new uint256[](input.targetListCount);
        uint256[] memory prices = new uint256[](input.targetListCount);
        uint256[] memory amounts = new uint256[](input.targetListCount);
        for (uint256 listingIndex = 0; listingIndex < input.targetListCount; listingIndex++) {
            uint256 bps = _planBps(input.planIndex, listingIndex);
            uint256 pricePerShare = input.issuePrice * bps / BPS_DENOMINATOR;
            uint256 amount = plannedListingAmount(input.planIndex, listingIndex);
            uint256 listingId = _listOne(market, input.tokenId, amount, pricePerShare, bps);
            if (listingId == 0) {
                continue;
            }

            listingIds[listed] = listingId;
            prices[listed] = pricePerShare;
            amounts[listed] = amount;
            listed++;
        }

        if (input.allowSelfBuy && listed > 1) {
            uint256 buyIndex = _selfBuyIndex(input.planIndex, listed);
            if (
                _buyOne(
                    market,
                    input.deployer,
                    input.tokenId,
                    listingIds[buyIndex],
                    prices[buyIndex],
                    amounts[buyIndex]
                )
            ) {
                bought = 1;
            }
        }
    }

    function _listOne(
        HadronMarket market,
        uint256 tokenId,
        uint256 amount,
        uint256 pricePerShare,
        uint256 bps
    ) private returns (uint256) {
        try market.list(tokenId, amount, pricePerShare) returns (uint256 listingId) {
            console2.log(unicode"二级挂单 listingId:", listingId);
            console2.log(unicode"二级挂单 tokenId:", tokenId);
            console2.log(unicode"二级挂单 amount:", amount);
            console2.log(unicode"二级挂单 pricePerShare:", pricePerShare);
            console2.log(unicode"二级挂单 bps:", bps);
            return listingId;
        } catch {
            console2.log(unicode"二级挂单失败 tokenId:", tokenId);
            console2.log(unicode"失败 pricePerShare:", pricePerShare);
            return 0;
        }
    }

    function _buyOne(
        HadronMarket market,
        address deployer,
        uint256 tokenId,
        uint256 listingId,
        uint256 pricePerShare,
        uint256 listingAmount
    ) private returns (bool) {
        uint256 amount = plannedSelfBuyAmount(pricePerShare, listingAmount);
        if (amount == 0) {
            console2.log(unicode"跳过自成交，单笔 value 超限 listingId:", listingId);
            return false;
        }

        uint256 value = pricePerShare * amount;
        if (value > MAX_SINGLE_TRADE_VALUE) {
            console2.log(unicode"跳过自成交，单笔 value 超限 listingId:", listingId);
            console2.log(unicode"自成交 value:", value);
            return false;
        }
        if (deployer.balance < value) {
            console2.log(unicode"跳过自成交，deployer 原生余额不足 listingId:", listingId);
            console2.log(unicode"自成交 value:", value);
            return false;
        }

        try market.buy{value: value}(listingId, amount) {
            uint256 fee = value * market.feeBps() / BPS_DENOMINATOR;
            console2.log(unicode"二级自成交 listingId:", listingId);
            console2.log(unicode"二级自成交 tokenId:", tokenId);
            console2.log(unicode"二级自成交 amount:", amount);
            console2.log(unicode"二级自成交 value:", value);
            console2.log(unicode"二级自成交 fee:", fee);
            return true;
        } catch {
            console2.log(unicode"二级自成交失败 listingId:", listingId);
            console2.log(unicode"自成交失败 value:", value);
            return false;
        }
    }

    function _activeOwnListingCount(
        HadronMarket market,
        address deployer,
        uint256 tokenId
    ) private view returns (uint256) {
        try market.listingsByToken(tokenId) returns (uint256[] memory listingIds) {
            uint256 ownActiveListings;
            for (uint256 index = 0; index < listingIds.length; index++) {
                HadronMarket.Listing memory listing = market.getListing(listingIds[index]);
                if (listing.seller == deployer && listing.active && listing.remaining > 0) {
                    ownActiveListings++;
                }
            }

            return ownActiveListings;
        } catch {
            return 0;
        }
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

    function _capListCountByBalance(
        uint256 planIndex,
        uint256 targetListCount,
        uint256 deployerBalance
    ) private pure returns (uint256) {
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

    function _planListCount(uint256 planIndex) private pure returns (uint256) {
        uint256 variant = planIndex % 6;
        if (variant == 0 || variant == 2 || variant == 4) {
            return 3;
        }

        return 2;
    }

    function _planBps(uint256 planIndex, uint256 listingIndex) private pure returns (uint256) {
        uint256 variant = planIndex % 6;
        if (variant == 0) {
            if (listingIndex == 0) return 9_700;
            if (listingIndex == 1) return 10_000;
            return 10_300;
        }
        if (variant == 1) {
            if (listingIndex == 0) return 10_000;
            return 10_600;
        }
        if (variant == 2) {
            if (listingIndex == 0) return 9_700;
            if (listingIndex == 1) return 10_300;
            return 10_600;
        }
        if (variant == 3) {
            if (listingIndex == 0) return 10_000;
            return 10_300;
        }
        if (variant == 4) {
            if (listingIndex == 0) return 9_700;
            if (listingIndex == 1) return 10_000;
            return 10_600;
        }

        if (listingIndex == 0) return 10_300;
        return 10_600;
    }

    function _shouldSelfBuy(uint256 planIndex) private pure returns (bool) {
        return planIndex % 2 == 0;
    }

    function _selfBuyIndex(uint256 planIndex, uint256 listed) private pure returns (uint256) {
        uint256 variant = planIndex % 6;
        if (variant == 2 && listed > 1) {
            return 1;
        }
        if (variant == 4) {
            return listed > 2 ? 2 : listed - 1;
        }

        return 0;
    }
}
