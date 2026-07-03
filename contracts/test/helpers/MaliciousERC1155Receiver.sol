// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {IERC1155Receiver} from "@openzeppelin/contracts/token/ERC1155/IERC1155Receiver.sol";
import {IERC165} from "@openzeppelin/contracts/utils/introspection/IERC165.sol";
import {HadronAssets} from "../../src/HadronAssets.sol";
import {HadronMarket} from "../../src/HadronMarket.sol";

/// @notice 测试用 ERC1155 接收合约，可模拟拒收、接口伪装与回调重入。
contract MaliciousERC1155Receiver is IERC1155Receiver {
    enum Mode {
        None,
        RevertOnReceive,
        ReenterFillBid,
        ReenterCancelBid,
        ReenterPlaceBid,
        RevertReceive
    }

    Mode public mode;
    bool public supportsReceiverInterface = true;
    bool public reentryAttempted;
    bool public reentryFailed;

    HadronMarket public targetMarket;
    uint256 public targetBidId;
    uint256 public targetTokenId;
    uint256 public reenterAmount;
    uint256 public reenterPricePerShare;
    uint256 public reenterValue;

    receive() external payable {
        if (mode == Mode.RevertReceive) {
            revert("REJECT_PAYMENT");
        }
    }

    function setMode(Mode mode_) external {
        mode = mode_;
        reentryAttempted = false;
        reentryFailed = false;
    }

    function setSupportsReceiverInterface(bool supported) external {
        supportsReceiverInterface = supported;
    }

    function configureReentry(
        HadronMarket market_,
        uint256 bidId_,
        uint256 tokenId_,
        uint256 amount_,
        uint256 pricePerShare_,
        uint256 value_
    ) external {
        targetMarket = market_;
        targetBidId = bidId_;
        targetTokenId = tokenId_;
        reenterAmount = amount_;
        reenterPricePerShare = pricePerShare_;
        reenterValue = value_;
    }

    function callSetApprovalForAll(HadronAssets assets, address operator, bool approved) external {
        assets.setApprovalForAll(operator, approved);
    }

    function callPlaceBid(
        HadronMarket market,
        uint256 tokenId,
        uint256 amount,
        uint256 pricePerShare
    ) external payable returns (uint256) {
        return market.placeBid{value: msg.value}(tokenId, amount, pricePerShare);
    }

    function callFillBid(HadronMarket market, uint256 bidId, uint256 amount) external {
        market.fillBid(bidId, amount);
    }

    function callCancelBid(HadronMarket market, uint256 bidId) external {
        market.cancelBid(bidId);
    }

    function supportsInterface(bytes4 interfaceId) external view returns (bool) {
        if (!supportsReceiverInterface) {
            return false;
        }

        return interfaceId == type(IERC1155Receiver).interfaceId || interfaceId == type(IERC165).interfaceId;
    }

    function onERC1155Received(
        address,
        address,
        uint256,
        uint256,
        bytes calldata
    ) external returns (bytes4) {
        _handleTokenCallback();

        return IERC1155Receiver.onERC1155Received.selector;
    }

    function onERC1155BatchReceived(
        address,
        address,
        uint256[] calldata,
        uint256[] calldata,
        bytes calldata
    ) external returns (bytes4) {
        _handleTokenCallback();

        return IERC1155Receiver.onERC1155BatchReceived.selector;
    }

    function _handleTokenCallback() private {
        if (mode == Mode.RevertOnReceive) {
            revert("REJECT_ERC1155");
        }
        if (
            mode != Mode.ReenterFillBid && mode != Mode.ReenterCancelBid && mode != Mode.ReenterPlaceBid
        ) {
            return;
        }

        reentryAttempted = true;

        if (mode == Mode.ReenterFillBid) {
            try targetMarket.fillBid(targetBidId, reenterAmount) {}
            catch {
                reentryFailed = true;
            }
        } else if (mode == Mode.ReenterCancelBid) {
            try targetMarket.cancelBid(targetBidId) {}
            catch {
                reentryFailed = true;
            }
        } else {
            try targetMarket.placeBid{value: reenterValue}(targetTokenId, reenterAmount, reenterPricePerShare) {}
            catch {
                reentryFailed = true;
            }
        }
    }
}
