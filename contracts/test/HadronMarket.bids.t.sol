// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Test} from "forge-std/Test.sol";
import {IERC1155Errors} from "@openzeppelin/contracts/interfaces/draft-IERC6093.sol";
import {ERC1155Holder} from "@openzeppelin/contracts/token/ERC1155/utils/ERC1155Holder.sol";
import {HadronAssets} from "../src/HadronAssets.sol";
import {HadronMarket} from "../src/HadronMarket.sol";

contract HadronMarketBidsTest is Test, ERC1155Holder {
    HadronAssets private assets;
    HadronMarket private market;

    address private treasury = address(0xA11CE);
    address private seller = address(0x51E);
    address private bidder = address(0xB1D);
    address private otherBidder = address(0xC0DE);

    uint256 private tokenId;
    uint256 private otherTokenId;

    uint256 private constant TOTAL_SHARES = 1_000;
    uint256 private constant PRIMARY_PRICE = 1_000_000;
    uint256 private constant BID_PRICE = 2_000_000;

    event TransferSingle(address indexed operator, address indexed from, address indexed to, uint256 id, uint256 value);
    event BidPlaced(
        uint256 indexed bidId,
        uint256 indexed tokenId,
        address indexed bidder,
        uint256 pricePerShare,
        uint256 amount
    );
    event BidFilled(
        uint256 indexed bidId,
        uint256 indexed tokenId,
        address indexed bidder,
        address seller,
        uint256 amount,
        uint256 totalPaid,
        uint256 fee
    );
    event BidCancelled(
        uint256 indexed bidId,
        uint256 indexed tokenId,
        address indexed bidder,
        uint256 pricePerShare,
        uint256 amount,
        uint256 returnedAmount
    );

    receive() external payable {}

    function setUp() public {
        assets = new HadronAssets();
        market = new HadronMarket(assets, treasury, 50);

        tokenId = assets.createAsset("US T-BILL 2026-Q3", "treasuries", TOTAL_SHARES, "ipfs://treasury");
        otherTokenId = assets.createAsset("GOLD OUNCE VAULT #4", "gold", TOTAL_SHARES, "ipfs://gold");
        assets.setApprovalForAll(address(market), true);

        _buyPrimaryTo(seller, tokenId, 200, PRIMARY_PRICE);
        _buyPrimaryTo(seller, otherTokenId, 20, PRIMARY_PRICE);

        vm.prank(seller);
        assets.setApprovalForAll(address(market), true);
        vm.deal(bidder, 1_000 ether);
        vm.deal(otherBidder, 1_000 ether);
    }

    function test_PlaceBid_EscrowsPayment_EmitsEvent() public {
        uint256 amount = 30;
        uint256 totalEscrowed = BID_PRICE * amount;
        uint256 bidderBefore = bidder.balance;

        vm.expectEmit(true, true, true, true, address(market));
        emit BidPlaced(1, tokenId, bidder, BID_PRICE, amount);
        vm.prank(bidder);
        uint256 bidId = market.placeBid{value: totalEscrowed}(tokenId, amount, BID_PRICE);

        assertEq(bidId, 1);
        assertEq(market.bidCount(), 1);
        assertEq(address(market).balance, totalEscrowed);
        assertEq(bidderBefore - bidder.balance, totalEscrowed);

        HadronMarket.Bid memory bid = market.getBid(bidId);
        assertEq(bid.bidder, bidder);
        assertEq(bid.tokenId, tokenId);
        assertEq(bid.pricePerShare, BID_PRICE);
        assertEq(bid.remaining, amount);
        assertTrue(bid.active);
    }

    function test_PlaceBid_EoaBidderPassesReceiverGate() public {
        uint256 bidId = _placeBid(bidder, tokenId, 1, BID_PRICE);

        HadronMarket.Bid memory bid = market.getBid(bidId);
        assertEq(bid.bidder, bidder);
        assertTrue(bid.active);
    }

    function test_PlaceBid_RevertWhen_WrongPayment() public {
        uint256 amount = 2;
        uint256 totalEscrowed = BID_PRICE * amount;

        vm.expectRevert(HadronMarket.WrongPayment.selector);
        vm.prank(bidder);
        market.placeBid{value: totalEscrowed - 1}(tokenId, amount, BID_PRICE);

        vm.expectRevert(HadronMarket.WrongPayment.selector);
        vm.prank(bidder);
        market.placeBid{value: totalEscrowed + 1}(tokenId, amount, BID_PRICE);
    }

    function test_PlaceBid_RevertWhen_ZeroPriceOrAmount() public {
        vm.expectRevert(HadronMarket.ZeroAmount.selector);
        vm.prank(bidder);
        market.placeBid{value: 0}(tokenId, 0, BID_PRICE);

        vm.expectRevert(HadronMarket.ZeroPrice.selector);
        vm.prank(bidder);
        market.placeBid{value: 0}(tokenId, 1, 0);
    }

    function test_FillBid_PartialFill_TransfersSharesAndSplitsFee() public {
        uint256 bidId = _placeBid(bidder, tokenId, 100, BID_PRICE);
        uint256 amount = 40;
        uint256 totalPaid = BID_PRICE * amount;
        uint256 fee = totalPaid * market.feeBps() / 10_000;
        uint256 sellerBefore = seller.balance;
        uint256 treasuryBefore = treasury.balance;
        uint256 marketBefore = address(market).balance;

        vm.expectEmit(true, true, true, true, address(market));
        emit BidFilled(bidId, tokenId, bidder, seller, amount, totalPaid, fee);
        vm.expectEmit(true, true, true, true, address(assets));
        emit TransferSingle(address(market), seller, bidder, tokenId, amount);
        vm.prank(seller);
        market.fillBid(bidId, amount);

        HadronMarket.Bid memory bid = market.getBid(bidId);
        assertEq(bid.remaining, 60);
        assertTrue(bid.active);
        assertEq(assets.balanceOf(bidder, tokenId), amount);
        assertEq(assets.balanceOf(seller, tokenId), 160);
        assertEq(seller.balance - sellerBefore, totalPaid - fee);
        assertEq(treasury.balance - treasuryBefore, fee);
        assertEq(marketBefore - address(market).balance, totalPaid);
    }

    function test_FillBid_TwoPartialFills_DeactivatesAtZero() public {
        uint256 bidId = _placeBid(bidder, tokenId, 100, BID_PRICE);

        vm.prank(seller);
        market.fillBid(bidId, 30);
        vm.prank(seller);
        market.fillBid(bidId, 70);

        HadronMarket.Bid memory bid = market.getBid(bidId);
        assertEq(bid.remaining, 0);
        assertFalse(bid.active);
        assertEq(assets.balanceOf(bidder, tokenId), 100);

        vm.expectRevert(HadronMarket.InactiveBid.selector);
        vm.prank(seller);
        market.fillBid(bidId, 1);
    }

    function test_FillBid_RevertWhen_NotApproved() public {
        uint256 bidId = _placeBid(bidder, tokenId, 10, BID_PRICE);

        vm.prank(seller);
        assets.setApprovalForAll(address(market), false);

        vm.expectRevert(
            abi.encodeWithSelector(IERC1155Errors.ERC1155MissingApprovalForAll.selector, address(market), seller)
        );
        vm.prank(seller);
        market.fillBid(bidId, 1);
    }

    function test_FillBid_RevertWhen_ZeroOrExceedsRemaining() public {
        uint256 bidId = _placeBid(bidder, tokenId, 10, BID_PRICE);

        vm.expectRevert(HadronMarket.ZeroAmount.selector);
        vm.prank(seller);
        market.fillBid(bidId, 0);

        vm.expectRevert(HadronMarket.ExceedsRemaining.selector);
        vm.prank(seller);
        market.fillBid(bidId, 11);
    }

    function test_FillBid_RevertWhen_Cancelled() public {
        uint256 bidId = _placeBid(bidder, tokenId, 10, BID_PRICE);

        vm.prank(bidder);
        market.cancelBid(bidId);

        vm.expectRevert(HadronMarket.InactiveBid.selector);
        vm.prank(seller);
        market.fillBid(bidId, 1);
    }

    function test_CancelBid_RevertWhen_NotBidder() public {
        uint256 bidId = _placeBid(bidder, tokenId, 10, BID_PRICE);

        vm.expectRevert(HadronMarket.NotBidder.selector);
        vm.prank(otherBidder);
        market.cancelBid(bidId);
    }

    function test_CancelBid_AfterPartialFill_ReturnsExactRemainderAndBlocksFill() public {
        uint256 bidId = _placeBid(bidder, tokenId, 100, BID_PRICE);
        vm.prank(seller);
        market.fillBid(bidId, 40);

        uint256 refundAmount = BID_PRICE * 60;
        uint256 bidderBefore = bidder.balance;
        uint256 marketBefore = address(market).balance;

        vm.expectEmit(true, true, true, true, address(market));
        emit BidCancelled(bidId, tokenId, bidder, BID_PRICE, 60, refundAmount);
        vm.prank(bidder);
        market.cancelBid(bidId);

        HadronMarket.Bid memory bid = market.getBid(bidId);
        assertEq(bid.remaining, 0);
        assertFalse(bid.active);
        assertEq(bidder.balance - bidderBefore, refundAmount);
        assertEq(marketBefore - address(market).balance, refundAmount);

        vm.expectRevert(HadronMarket.InactiveBid.selector);
        vm.prank(seller);
        market.fillBid(bidId, 1);
    }

    function test_CancelBid_RevertWhen_FullyFilled() public {
        uint256 bidId = _placeBid(bidder, tokenId, 10, BID_PRICE);
        vm.prank(seller);
        market.fillBid(bidId, 10);

        vm.expectRevert(HadronMarket.InactiveBid.selector);
        vm.prank(bidder);
        market.cancelBid(bidId);
    }

    function test_FillBid_FeeRoundsDownToZero() public {
        uint256 bidId = _placeBid(bidder, tokenId, 1, 1);
        uint256 sellerBefore = seller.balance;
        uint256 treasuryBefore = treasury.balance;

        vm.expectEmit(true, true, true, true, address(market));
        emit BidFilled(bidId, tokenId, bidder, seller, 1, 1, 0);
        vm.prank(seller);
        market.fillBid(bidId, 1);

        HadronMarket.Bid memory bid = market.getBid(bidId);
        assertEq(bid.remaining, 0);
        assertFalse(bid.active);
        assertEq(seller.balance - sellerBefore, 1);
        assertEq(treasury.balance - treasuryBefore, 0);
    }

    function test_GetBid_RevertWhen_NotExisting() public {
        vm.expectRevert(HadronMarket.InactiveBid.selector);
        market.getBid(0);

        vm.expectRevert(HadronMarket.InactiveBid.selector);
        market.getBid(1);
    }

    function test_BidsByToken_ReturnsOnlyActiveWithRemaining() public {
        uint256 activeBidId = _placeBid(bidder, tokenId, 10, BID_PRICE);
        uint256 cancelledBidId = _placeBid(bidder, tokenId, 10, BID_PRICE);
        uint256 filledBidId = _placeBid(bidder, tokenId, 10, BID_PRICE);
        uint256 otherTokenBidId = _placeBid(bidder, otherTokenId, 10, BID_PRICE);

        vm.prank(bidder);
        market.cancelBid(cancelledBidId);

        vm.prank(seller);
        market.fillBid(filledBidId, 10);

        uint256[] memory activeTokenBids = market.bidsByToken(tokenId);
        assertEq(activeTokenBids.length, 1);
        assertEq(activeTokenBids[0], activeBidId);

        uint256[] memory activeOtherTokenBids = market.bidsByToken(otherTokenId);
        assertEq(activeOtherTokenBids.length, 1);
        assertEq(activeOtherTokenBids[0], otherTokenBidId);
    }

    function _placeBid(
        address bidder_,
        uint256 bidTokenId,
        uint256 amount,
        uint256 pricePerShare
    ) private returns (uint256) {
        vm.prank(bidder_);
        return market.placeBid{value: pricePerShare * amount}(bidTokenId, amount, pricePerShare);
    }

    function _buyPrimaryTo(
        address recipient,
        uint256 offeringTokenId,
        uint256 amount,
        uint256 pricePerShare
    ) private {
        uint256 offeringId = market.createPrimaryOffering(offeringTokenId, pricePerShare, amount);
        uint256 totalPaid = pricePerShare * amount;
        vm.deal(recipient, totalPaid);
        vm.prank(recipient);
        market.buyPrimary{value: totalPaid}(offeringId, amount);
    }
}
