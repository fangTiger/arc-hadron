// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Script, console2} from "forge-std/Script.sol";
import {HadronMarket} from "../src/HadronMarket.sol";

/// @notice 为市场制造小额一级成交事件；执行方应使用部署/owner 账户广播。
contract SeedTrades is Script {
    uint256 private constant ARC_TESTNET_CHAIN_ID = 5042002;
    uint256 private constant SMALL_TRADE_VALUE_0 = 5e18;
    uint256 private constant SMALL_TRADE_VALUE_1 = 8e18;
    uint256 private constant SMALL_TRADE_VALUE_2 = 12e18;
    uint256 private constant SMALL_TRADE_VALUE_3 = 15e18;
    uint256 private constant MIN_SINGLE_TRADE_VALUE = 30e18;
    uint256 private constant MAX_SINGLE_TRADE_VALUE = 130e18;
    /// @dev 一级买入由 deployer 自购，价款回流给发行方 deployer，净支出近似只有 50bps 手续费。
    ///      但 forge 模拟器按每笔 pre-tx 余额判断 msg.value，所以 14 个资产 * 2 笔 * <=15e18
    ///      看似会超过预算，实际只要单笔 value + 保留线安全即可继续跑完整轮。
    uint256 private constant MIN_DEPLOYER_RESERVE = 80e18;

    address private deployer;

    function run() external {
        require(block.chainid == ARC_TESTNET_CHAIN_ID, "SeedTrades: ARC testnet only");

        uint256 deployerPrivateKey = vm.envUint("DEPLOYER_PRIVATE_KEY");
        deployer = vm.addr(deployerPrivateKey);
        HadronMarket market = HadronMarket(vm.envAddress("HADRON_MARKET"));
        uint256 minOfferingId = vm.envOr("SEED_MIN_OFFERING_ID", uint256(1));
        if (minOfferingId == 0) {
            minOfferingId = 1;
        }

        uint256 tradedOfferings;
        uint256 seededTrades;
        uint256 offeringCount = market.offeringCount();
        console2.log("Seed min offeringId:", minOfferingId);
        console2.log("Current offeringCount:", offeringCount);
        vm.startBroadcast(deployerPrivateKey);
        for (uint256 offeringId = minOfferingId; offeringId <= offeringCount; offeringId++) {
            (bool traded, uint256 tradeCount) = _buyIfOpen(market, offeringId);
            if (traded) {
                tradedOfferings++;
                seededTrades += tradeCount;
            }
        }
        vm.stopBroadcast();

        console2.log("Seeded offerings:", tradedOfferings);
        console2.log("Seeded primary trades:", seededTrades);
    }

    function _buyIfOpen(HadronMarket market, uint256 offeringId) private returns (bool traded, uint256 tradeCount) {
        if (offeringId > market.offeringCount()) {
            console2.log("Skip missing offeringId:", offeringId);
            return (false, 0);
        }

        HadronMarket.Offering memory offering = market.getOffering(offeringId);
        if (!offering.active || offering.remaining == 0) {
            console2.log("Skip inactive offeringId:", offeringId);
            return (false, 0);
        }

        uint256 targetTradeCount = _targetTradeCount(offeringId);
        for (uint256 tradeIndex = 0; tradeIndex < targetTradeCount; tradeIndex++) {
            offering = market.getOffering(offeringId);
            if (!offering.active || offering.remaining == 0) {
                break;
            }

            uint256 targetValue =
                _targetValueForBalance(offeringId, tradeIndex, offering.pricePerShare, deployer.balance);
            uint256 shares = _amountForTargetValue(targetValue, offering.pricePerShare, offering.remaining);
            if (shares == 0) {
                console2.log("Skip offeringId with zero planned shares:", offeringId);
                return (traded, tradeCount);
            }

            uint256 value = offering.pricePerShare * shares;
            if (value > MAX_SINGLE_TRADE_VALUE) {
                console2.log("Skip offeringId over max single value:", offeringId);
                console2.log("Single trade value:", value);
                return (traded, tradeCount);
            }

            if (!_hasReserveForValue(deployer.balance, value)) {
                console2.log("Stop: deployer balance would fall below reserve at offeringId:", offeringId);
                console2.log("Deployer balance:", deployer.balance);
                return (traded, tradeCount);
            }

            console2.log("Seed trade offeringId:", offeringId);
            console2.log("Seed trade shares:", shares);
            console2.log("Seed trade value:", value);
            market.buyPrimary{value: value}(offeringId, shares);
            traded = true;
            tradeCount++;
        }
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

    function plannedPrimaryAmount(uint256 offeringId, uint256 tradeIndex, uint256 pricePerShare, uint256 remaining)
        public
        pure
        returns (uint256)
    {
        if (pricePerShare == 0 || remaining == 0) {
            return 0;
        }

        uint256 amount = _amountForTargetValue(
            plannedPrimaryTargetValue(offeringId, tradeIndex, pricePerShare), pricePerShare, remaining
        );
        return amount;
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

    function _targetTradeCount(uint256 offeringId) private pure returns (uint256) {
        if (offeringId % 2 == 0) {
            return 2;
        }

        return 1;
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
