// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Test} from "forge-std/Test.sol";
import {ERC1155Holder} from "@openzeppelin/contracts/token/ERC1155/utils/ERC1155Holder.sol";
import {HadronAssets} from "../src/HadronAssets.sol";
import {HadronMarket} from "../src/HadronMarket.sol";
import {MaliciousERC1155Receiver} from "./helpers/MaliciousERC1155Receiver.sol";
import {MaliciousReceiver} from "./helpers/MaliciousReceiver.sol";

contract HadronMarketAdversarialTest is Test, ERC1155Holder {
    HadronAssets private assets;
    HadronMarket private market;

    address private owner = address(this);
    address private treasury = address(0xA11CE);
    address private seller = address(0x51E);
    address private buyer = address(0xB0B);
    address private otherBuyer = address(0xC0DE);

    uint256 private tokenId;

    uint256 private constant TOTAL_SHARES = 10_000;
    uint256 private constant PRIMARY_PRICE = 1_000_000;
    uint256 private constant SECONDARY_PRICE = 2_000_000;

    receive() external payable {}

    function setUp() public {
        assets = new HadronAssets();
        market = new HadronMarket(assets, treasury, 50);
        tokenId = assets.createAsset("US T-BILL 2026-Q3", "treasuries", TOTAL_SHARES, "ipfs://treasury");
        assets.setApprovalForAll(address(market), true);

        vm.deal(buyer, 1_000 ether);
        vm.deal(otherBuyer, 1_000 ether);
        vm.deal(seller, 1_000 ether);
    }

    function test_Reentrancy_MaliciousSellerOnBuy() public {
        MaliciousReceiver maliciousSeller = new MaliciousReceiver();
        _buyPrimaryToReceiver(maliciousSeller, 20, PRIMARY_PRICE);
        maliciousSeller.callSetApprovalForAll(assets, address(market), true);

        uint256 listingId = maliciousSeller.callList(market, tokenId, 20, SECONDARY_PRICE);
        maliciousSeller.configureReentry(market, listingId, 1, SECONDARY_PRICE);
        maliciousSeller.setMode(MaliciousReceiver.Mode.ReenterBuy);

        HadronMarket.Listing memory beforeListing = market.getListing(listingId);
        uint256 marketTokenBefore = assets.balanceOf(address(market), tokenId);
        uint256 buyerTokenBefore = assets.balanceOf(buyer, tokenId);
        uint256 buyerBalanceBefore = buyer.balance;
        uint256 maliciousBalanceBefore = address(maliciousSeller).balance;
        uint256 treasuryBalanceBefore = treasury.balance;

        vm.expectRevert(HadronMarket.TransferFailed.selector);
        vm.prank(buyer);
        market.buy{value: SECONDARY_PRICE * 10}(listingId, 10);

        HadronMarket.Listing memory afterListing = market.getListing(listingId);
        assertEq(afterListing.seller, beforeListing.seller);
        assertEq(afterListing.tokenId, beforeListing.tokenId);
        assertEq(afterListing.pricePerShare, beforeListing.pricePerShare);
        assertEq(afterListing.remaining, beforeListing.remaining);
        assertEq(afterListing.active, beforeListing.active);
        assertEq(assets.balanceOf(address(market), tokenId), marketTokenBefore);
        assertEq(assets.balanceOf(buyer, tokenId), buyerTokenBefore);
        assertEq(buyer.balance, buyerBalanceBefore);
        assertEq(address(maliciousSeller).balance, maliciousBalanceBefore);
        assertEq(treasury.balance, treasuryBalanceBefore);
    }

    function test_RevertingReceiver_CannotLockOthers() public {
        MaliciousReceiver rejectingSeller = new MaliciousReceiver();
        _buyPrimaryToReceiver(rejectingSeller, 20, PRIMARY_PRICE);
        rejectingSeller.callSetApprovalForAll(assets, address(market), true);
        uint256 rejectingListingId = rejectingSeller.callList(market, tokenId, 20, SECONDARY_PRICE);
        rejectingSeller.setMode(MaliciousReceiver.Mode.RevertReceive);

        _buyPrimaryTo(seller, 10, PRIMARY_PRICE);
        vm.prank(seller);
        assets.setApprovalForAll(address(market), true);
        vm.prank(seller);
        uint256 normalListingId = market.list(tokenId, 10, SECONDARY_PRICE);

        vm.expectRevert(HadronMarket.TransferFailed.selector);
        vm.prank(buyer);
        market.buy{value: SECONDARY_PRICE * 5}(rejectingListingId, 5);

        rejectingSeller.callCancel(market, rejectingListingId);
        HadronMarket.Listing memory rejectingListing = market.getListing(rejectingListingId);
        assertFalse(rejectingListing.active);
        assertEq(rejectingListing.remaining, 0);
        assertEq(assets.balanceOf(address(rejectingSeller), tokenId), 20);

        vm.prank(otherBuyer);
        market.buy{value: SECONDARY_PRICE * 10}(normalListingId, 10);

        HadronMarket.Listing memory normalListing = market.getListing(normalListingId);
        assertFalse(normalListing.active);
        assertEq(normalListing.remaining, 0);
        assertEq(assets.balanceOf(otherBuyer, tokenId), 10);
    }

    function test_PlaceBid_RevertWhenContractBidderDoesNotExposeReceiver() public {
        PlainBidder plainBidder = new PlainBidder();
        uint256 totalEscrowed = SECONDARY_PRICE * 10;
        vm.deal(address(plainBidder), totalEscrowed);

        vm.expectRevert(HadronMarket.BidderNotReceiver.selector);
        plainBidder.callPlaceBid{value: totalEscrowed}(market, tokenId, 10, SECONDARY_PRICE);
    }

    function test_PlaceBid_RevertWhenReceiverInterfaceDisabled() public {
        MaliciousERC1155Receiver contractBidder = new MaliciousERC1155Receiver();
        contractBidder.setSupportsReceiverInterface(false);
        uint256 totalEscrowed = SECONDARY_PRICE * 10;
        vm.deal(address(contractBidder), totalEscrowed);

        vm.expectRevert(HadronMarket.BidderNotReceiver.selector);
        contractBidder.callPlaceBid{value: totalEscrowed}(market, tokenId, 10, SECONDARY_PRICE);
    }

    function test_FillBid_RevertWhenBidderReceiverRejectsShares_StateUnchanged() public {
        _seedSellerShares(20);
        MaliciousERC1155Receiver contractBidder = new MaliciousERC1155Receiver();
        uint256 bidId = _placeContractBid(contractBidder, 10, SECONDARY_PRICE);
        contractBidder.setMode(MaliciousERC1155Receiver.Mode.RevertOnReceive);

        HadronMarket.Bid memory beforeBid = market.getBid(bidId);
        uint256 marketBalanceBefore = address(market).balance;
        uint256 sellerSharesBefore = assets.balanceOf(seller, tokenId);
        uint256 bidderSharesBefore = assets.balanceOf(address(contractBidder), tokenId);

        vm.expectRevert(bytes("REJECT_ERC1155"));
        vm.prank(seller);
        market.fillBid(bidId, 5);

        _assertBidEquals(bidId, beforeBid);
        assertEq(address(market).balance, marketBalanceBefore);
        assertEq(assets.balanceOf(seller, tokenId), sellerSharesBefore);
        assertEq(assets.balanceOf(address(contractBidder), tokenId), bidderSharesBefore);
    }

    function test_FillBid_BidderReceiverReenterFillBidBlocked_SettlesOnce() public {
        _seedSellerShares(20);
        MaliciousERC1155Receiver contractBidder = new MaliciousERC1155Receiver();
        uint256 bidId = _placeContractBid(contractBidder, 10, SECONDARY_PRICE);
        contractBidder.configureReentry(market, bidId, tokenId, 1, SECONDARY_PRICE, SECONDARY_PRICE);
        contractBidder.setMode(MaliciousERC1155Receiver.Mode.ReenterFillBid);

        vm.prank(seller);
        market.fillBid(bidId, 5);

        HadronMarket.Bid memory bid = market.getBid(bidId);
        assertTrue(contractBidder.reentryAttempted());
        assertTrue(contractBidder.reentryFailed());
        assertEq(bid.remaining, 5);
        assertTrue(bid.active);
        assertEq(assets.balanceOf(address(contractBidder), tokenId), 5);
        assertEq(_activeBidEscrow(), address(market).balance);
    }

    function test_FillBid_BidderReceiverReenterPlaceBidBlocked_SettlesOnce() public {
        _seedSellerShares(20);
        MaliciousERC1155Receiver contractBidder = new MaliciousERC1155Receiver();
        uint256 bidId = _placeContractBid(contractBidder, 10, SECONDARY_PRICE);
        contractBidder.configureReentry(market, bidId, tokenId, 1, SECONDARY_PRICE, SECONDARY_PRICE);
        contractBidder.setMode(MaliciousERC1155Receiver.Mode.ReenterPlaceBid);
        vm.deal(address(contractBidder), SECONDARY_PRICE);

        uint256 bidCountBefore = market.bidCount();

        vm.prank(seller);
        market.fillBid(bidId, 5);

        HadronMarket.Bid memory bid = market.getBid(bidId);
        assertTrue(contractBidder.reentryAttempted());
        assertTrue(contractBidder.reentryFailed());
        assertEq(market.bidCount(), bidCountBefore);
        assertEq(bid.remaining, 5);
        assertTrue(bid.active);
        assertEq(assets.balanceOf(address(contractBidder), tokenId), 5);
        assertEq(_activeBidEscrow(), address(market).balance);
    }

    function test_FillBid_BidderReceiverReenterCancelBidBlocked_SettlesOnce() public {
        _seedSellerShares(20);
        MaliciousERC1155Receiver contractBidder = new MaliciousERC1155Receiver();
        uint256 bidId = _placeContractBid(contractBidder, 10, SECONDARY_PRICE);
        contractBidder.configureReentry(market, bidId, tokenId, 1, SECONDARY_PRICE, SECONDARY_PRICE);
        contractBidder.setMode(MaliciousERC1155Receiver.Mode.ReenterCancelBid);

        vm.prank(seller);
        market.fillBid(bidId, 4);

        HadronMarket.Bid memory bid = market.getBid(bidId);
        assertTrue(contractBidder.reentryAttempted());
        assertTrue(contractBidder.reentryFailed());
        assertEq(bid.remaining, 6);
        assertTrue(bid.active);
        assertEq(assets.balanceOf(address(contractBidder), tokenId), 4);
        assertEq(_activeBidEscrow(), address(market).balance);
    }

    function test_CancelBid_RevertWhenBidderRejectsRefund_DoesNotBlockOthers() public {
        MaliciousERC1155Receiver rejectingBidder = new MaliciousERC1155Receiver();
        uint256 bidId = _placeContractBid(rejectingBidder, 10, SECONDARY_PRICE);
        rejectingBidder.setMode(MaliciousERC1155Receiver.Mode.RevertReceive);
        uint256 marketBalanceBefore = address(market).balance;

        vm.expectRevert(HadronMarket.TransferFailed.selector);
        rejectingBidder.callCancelBid(market, bidId);

        HadronMarket.Bid memory bid = market.getBid(bidId);
        assertTrue(bid.active);
        assertEq(bid.remaining, 10);
        assertEq(address(market).balance, marketBalanceBefore);

        uint256 normalBidId = _placeBid(otherBuyer, 3, SECONDARY_PRICE);
        vm.prank(otherBuyer);
        market.cancelBid(normalBidId);

        _seedSellerShares(5);
        vm.prank(seller);
        uint256 listingId = market.list(tokenId, 5, SECONDARY_PRICE);
        vm.prank(buyer);
        market.buy{value: SECONDARY_PRICE}(listingId, 1);

        HadronMarket.Listing memory listing = market.getListing(listingId);
        assertTrue(listing.active);
        assertEq(listing.remaining, 4);
    }

    function test_FillBid_RevertWhenMaliciousSellerReentersPayment_StateUnchanged() public {
        MaliciousReceiver maliciousSeller = new MaliciousReceiver();
        _buyPrimaryToReceiver(maliciousSeller, 20, PRIMARY_PRICE);
        maliciousSeller.callSetApprovalForAll(assets, address(market), true);
        uint256 bidId = _placeBid(buyer, 10, SECONDARY_PRICE);
        maliciousSeller.configureBidReentry(market, bidId, 1);
        maliciousSeller.setMode(MaliciousReceiver.Mode.ReenterFillBid);

        HadronMarket.Bid memory beforeBid = market.getBid(bidId);
        uint256 marketBalanceBefore = address(market).balance;
        uint256 bidderSharesBefore = assets.balanceOf(buyer, tokenId);
        uint256 sellerSharesBefore = assets.balanceOf(address(maliciousSeller), tokenId);
        uint256 treasuryBefore = treasury.balance;

        vm.expectRevert(HadronMarket.TransferFailed.selector);
        maliciousSeller.callFillBid(market, bidId, 5);

        _assertBidEquals(bidId, beforeBid);
        assertEq(address(market).balance, marketBalanceBefore);
        assertEq(assets.balanceOf(buyer, tokenId), bidderSharesBefore);
        assertEq(assets.balanceOf(address(maliciousSeller), tokenId), sellerSharesBefore);
        assertEq(treasury.balance, treasuryBefore);
    }

    function test_FillBid_RevertWhenMaliciousSellerRejectsPayment_StateUnchanged() public {
        MaliciousReceiver rejectingSeller = new MaliciousReceiver();
        _buyPrimaryToReceiver(rejectingSeller, 20, PRIMARY_PRICE);
        rejectingSeller.callSetApprovalForAll(assets, address(market), true);
        uint256 bidId = _placeBid(buyer, 10, SECONDARY_PRICE);
        rejectingSeller.setMode(MaliciousReceiver.Mode.RevertReceive);

        HadronMarket.Bid memory beforeBid = market.getBid(bidId);
        uint256 marketBalanceBefore = address(market).balance;
        uint256 bidderSharesBefore = assets.balanceOf(buyer, tokenId);
        uint256 sellerSharesBefore = assets.balanceOf(address(rejectingSeller), tokenId);
        uint256 treasuryBefore = treasury.balance;

        vm.expectRevert(HadronMarket.TransferFailed.selector);
        rejectingSeller.callFillBid(market, bidId, 5);

        _assertBidEquals(bidId, beforeBid);
        assertEq(address(market).balance, marketBalanceBefore);
        assertEq(assets.balanceOf(buyer, tokenId), bidderSharesBefore);
        assertEq(assets.balanceOf(address(rejectingSeller), tokenId), sellerSharesBefore);
        assertEq(treasury.balance, treasuryBefore);
    }

    function testFuzz_BuyPrimary_ExactPaymentInvariant(uint96 price, uint64 amount) public {
        uint256 pricePerShare = bound(uint256(price), 1, 1 ether);
        uint256 shareAmount = bound(uint256(amount), 1, 1_000);
        uint256 totalPaid = pricePerShare * shareAmount;
        uint256 offeringId = market.createPrimaryOffering(tokenId, pricePerShare, shareAmount);

        vm.deal(buyer, totalPaid + 1);

        vm.expectRevert(HadronMarket.WrongPayment.selector);
        vm.prank(buyer);
        market.buyPrimary{value: totalPaid - 1}(offeringId, shareAmount);

        vm.expectRevert(HadronMarket.WrongPayment.selector);
        vm.prank(buyer);
        market.buyPrimary{value: totalPaid + 1}(offeringId, shareAmount);

        uint256 ownerBefore = owner.balance;
        uint256 treasuryBefore = treasury.balance;

        vm.prank(buyer);
        market.buyPrimary{value: totalPaid}(offeringId, shareAmount);

        uint256 ownerDelta = owner.balance - ownerBefore;
        uint256 treasuryDelta = treasury.balance - treasuryBefore;
        assertEq(ownerDelta + treasuryDelta, totalPaid);
        assertEq(assets.balanceOf(buyer, tokenId), shareAmount);
    }

    function testFuzz_SecondaryLifecycle(uint64 listAmt, uint64 buyAmt) public {
        uint256 listedAmount = bound(uint256(listAmt), 1, 1_000);
        uint256 boughtAmount = bound(uint256(buyAmt), 1, listedAmount);

        _buyPrimaryTo(seller, listedAmount, PRIMARY_PRICE);
        vm.prank(seller);
        assets.setApprovalForAll(address(market), true);
        vm.prank(seller);
        uint256 listingId = market.list(tokenId, listedAmount, SECONDARY_PRICE);

        vm.prank(buyer);
        market.buy{value: SECONDARY_PRICE * boughtAmount}(listingId, boughtAmount);

        uint256 activeRemaining;
        uint256[] memory activeListings = market.listingsByToken(tokenId);
        for (uint256 index; index < activeListings.length; index++) {
            HadronMarket.Listing memory listing = market.getListing(activeListings[index]);
            activeRemaining += listing.remaining;
        }

        assertEq(assets.balanceOf(address(market), tokenId), activeRemaining);
    }

    function testFuzz_BidEscrowConservation(uint256 seed) public {
        _seedSellerShares(50);

        for (uint256 step; step < 8; step++) {
            uint256 value = uint256(keccak256(abi.encode(seed, step)));
            uint256 action = value % 3;

            if (action == 0) {
                uint256 amount = value % 5 + 1;
                uint256 pricePerShare = value % 1 ether + 1;
                address bidOwner = address(uint160(0xB100 + step));
                uint256 totalEscrowed = amount * pricePerShare;
                vm.deal(bidOwner, totalEscrowed);
                vm.prank(bidOwner);
                market.placeBid{value: totalEscrowed}(tokenId, amount, pricePerShare);
            } else if (market.bidCount() > 0) {
                uint256 bidId = value % market.bidCount() + 1;
                HadronMarket.Bid memory bid = market.getBid(bidId);
                if (bid.active && bid.remaining > 0) {
                    if (action == 1 && assets.balanceOf(seller, tokenId) > 0) {
                        vm.prank(seller);
                        market.fillBid(bidId, 1);
                    } else if (action == 2) {
                        vm.prank(bid.bidder);
                        market.cancelBid(bidId);
                    }
                }
            }
        }

        assertLe(_activeBidEscrow(), address(market).balance);
    }

    function testFuzz_FeeNeverExceedsCap(uint96 price, uint64 amount) public {
        uint256 pricePerShare = bound(uint256(price), 1, 1 ether);
        uint256 shareAmount = bound(uint256(amount), 1, 1_000);
        uint256 totalPaid = pricePerShare * shareAmount;
        uint256 offeringId = market.createPrimaryOffering(tokenId, pricePerShare, shareAmount);
        uint256 treasuryBefore = treasury.balance;

        vm.deal(buyer, totalPaid);
        vm.prank(buyer);
        market.buyPrimary{value: totalPaid}(offeringId, shareAmount);

        uint256 fee = treasury.balance - treasuryBefore;
        uint256 maxFee = totalPaid * market.MAX_FEE_BPS() / 10_000;
        assertLe(fee, maxFee);
    }

    function _seedSellerShares(uint256 amount) private {
        _buyPrimaryTo(seller, amount, PRIMARY_PRICE);
        vm.prank(seller);
        assets.setApprovalForAll(address(market), true);
    }

    function _placeBid(address bidOwner, uint256 amount, uint256 pricePerShare) private returns (uint256) {
        uint256 totalEscrowed = amount * pricePerShare;
        vm.deal(bidOwner, totalEscrowed);
        vm.prank(bidOwner);
        return market.placeBid{value: totalEscrowed}(tokenId, amount, pricePerShare);
    }

    function _placeContractBid(
        MaliciousERC1155Receiver contractBidder,
        uint256 amount,
        uint256 pricePerShare
    ) private returns (uint256) {
        uint256 totalEscrowed = amount * pricePerShare;
        vm.deal(address(contractBidder), totalEscrowed);
        return contractBidder.callPlaceBid{value: totalEscrowed}(market, tokenId, amount, pricePerShare);
    }

    function _assertBidEquals(uint256 bidId, HadronMarket.Bid memory expected) private view {
        HadronMarket.Bid memory actual = market.getBid(bidId);
        assertEq(actual.bidder, expected.bidder);
        assertEq(actual.tokenId, expected.tokenId);
        assertEq(actual.pricePerShare, expected.pricePerShare);
        assertEq(actual.remaining, expected.remaining);
        assertEq(actual.active, expected.active);
    }

    function _activeBidEscrow() private view returns (uint256 totalEscrowed) {
        for (uint256 bidId = 1; bidId <= market.bidCount(); bidId++) {
            HadronMarket.Bid memory bid = market.getBid(bidId);
            if (bid.active && bid.remaining > 0) {
                totalEscrowed += bid.pricePerShare * bid.remaining;
            }
        }
    }

    function _buyPrimaryTo(address recipient, uint256 amount, uint256 pricePerShare) private {
        uint256 offeringId = market.createPrimaryOffering(tokenId, pricePerShare, amount);
        uint256 totalPaid = pricePerShare * amount;
        vm.deal(recipient, totalPaid);
        vm.prank(recipient);
        market.buyPrimary{value: totalPaid}(offeringId, amount);
    }

    function _buyPrimaryToReceiver(MaliciousReceiver receiver, uint256 amount, uint256 pricePerShare) private {
        uint256 offeringId = market.createPrimaryOffering(tokenId, pricePerShare, amount);
        uint256 totalPaid = pricePerShare * amount;
        vm.deal(address(receiver), totalPaid);
        receiver.callBuyPrimary{value: totalPaid}(market, offeringId, amount);
    }
}

contract PlainBidder {
    function callPlaceBid(
        HadronMarket market,
        uint256 tokenId,
        uint256 amount,
        uint256 pricePerShare
    ) external payable returns (uint256) {
        return market.placeBid{value: msg.value}(tokenId, amount, pricePerShare);
    }
}
