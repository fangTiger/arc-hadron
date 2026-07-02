// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Script, console2} from "forge-std/Script.sol";
import {HadronMarket} from "../src/HadronMarket.sol";

/// @notice 为市场制造小额一级成交事件；执行方应使用部署/owner 账户广播。
contract SeedTrades is Script {
    uint256 private constant MAX_SINGLE_TRADE_VALUE = 130e18;
    uint256 private constant MAX_NEW_OFFERINGS = 6;

    function run() external {
        uint256 deployerPrivateKey = vm.envUint("DEPLOYER_PRIVATE_KEY");
        HadronMarket market = HadronMarket(vm.envAddress("HADRON_MARKET"));

        vm.startBroadcast(deployerPrivateKey);
        for (uint256 offeringId = 1; offeringId <= 4; offeringId++) {
            _buyIfOpen(market, offeringId);
        }

        uint256 tradedNewOfferings;
        uint256 offeringCount = market.offeringCount();
        for (
            uint256 offeringId = 5;
            offeringId <= offeringCount && tradedNewOfferings < MAX_NEW_OFFERINGS;
            offeringId++
        ) {
            if (_buyIfOpen(market, offeringId)) {
                tradedNewOfferings++;
            }
        }
        vm.stopBroadcast();

        console2.log("Seeded new offerings:", tradedNewOfferings);
    }

    function _buyIfOpen(HadronMarket market, uint256 offeringId) private returns (bool) {
        if (offeringId > market.offeringCount()) {
            console2.log("Skip missing offeringId:", offeringId);
            return false;
        }

        HadronMarket.Offering memory offering = market.getOffering(offeringId);
        if (!offering.active || offering.remaining == 0) {
            console2.log("Skip inactive offeringId:", offeringId);
            return false;
        }

        uint256 targetShares = _targetShares(offering.pricePerShare);
        uint256 tradeCount = _targetTradeCount(offering.pricePerShare * targetShares);
        bool traded;
        for (uint256 tradeIndex = 0; tradeIndex < tradeCount; tradeIndex++) {
            offering = market.getOffering(offeringId);
            if (!offering.active || offering.remaining == 0) {
                break;
            }

            uint256 shares = targetShares;
            if (shares > offering.remaining) {
                shares = offering.remaining;
            }

            uint256 value = offering.pricePerShare * shares;
            if (value > MAX_SINGLE_TRADE_VALUE) {
                console2.log("Skip offeringId over max single value:", offeringId);
                console2.log("Single trade value:", value);
                return traded;
            }

            console2.log("Seed trade offeringId:", offeringId);
            console2.log("Seed trade shares:", shares);
            console2.log("Seed trade value:", value);
            market.buyPrimary{value: value}(offeringId, shares);
            traded = true;
        }

        return traded;
    }

    function _targetShares(uint256 pricePerShare) private pure returns (uint256) {
        if (pricePerShare <= MAX_SINGLE_TRADE_VALUE / 3) {
            return 3;
        }

        return 1;
    }

    function _targetTradeCount(uint256 singleTradeValue) private pure returns (uint256) {
        if (singleTradeValue <= 90e18) {
            return 2;
        }

        return 1;
    }
}
