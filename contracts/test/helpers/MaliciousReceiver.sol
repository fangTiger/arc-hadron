// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {ERC1155Holder} from "@openzeppelin/contracts/token/ERC1155/utils/ERC1155Holder.sol";
import {HadronAssets} from "../../src/HadronAssets.sol";
import {HadronMarket} from "../../src/HadronMarket.sol";

/// @notice 测试用恶意收款合约，用于模拟拒收与收款回调重入。
contract MaliciousReceiver is ERC1155Holder {
    enum Mode {
        None,
        ReenterBuy,
        ReenterCancel,
        RevertReceive
    }

    Mode public mode;
    HadronMarket public targetMarket;
    uint256 public targetListingId;
    uint256 public reenterAmount;
    uint256 public reenterValue;

    receive() external payable {
        if (mode == Mode.RevertReceive) {
            revert("REJECT_PAYMENT");
        }

        if (mode == Mode.ReenterBuy) {
            targetMarket.buy{value: reenterValue}(targetListingId, reenterAmount);
        } else if (mode == Mode.ReenterCancel) {
            targetMarket.cancel(targetListingId);
        }
    }

    function setMode(Mode mode_) external {
        mode = mode_;
    }

    function configureReentry(
        HadronMarket market_,
        uint256 listingId_,
        uint256 amount_,
        uint256 value_
    ) external {
        targetMarket = market_;
        targetListingId = listingId_;
        reenterAmount = amount_;
        reenterValue = value_;
    }

    function callSetApprovalForAll(HadronAssets assets, address operator, bool approved) external {
        assets.setApprovalForAll(operator, approved);
    }

    function callBuyPrimary(HadronMarket market, uint256 offeringId, uint256 amount) external payable {
        market.buyPrimary{value: msg.value}(offeringId, amount);
    }

    function callList(
        HadronMarket market,
        uint256 tokenId,
        uint256 amount,
        uint256 pricePerShare
    ) external returns (uint256) {
        return market.list(tokenId, amount, pricePerShare);
    }

    function callCancel(HadronMarket market, uint256 listingId) external {
        market.cancel(listingId);
    }
}
