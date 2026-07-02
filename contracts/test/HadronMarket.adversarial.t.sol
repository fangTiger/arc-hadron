// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Test} from "forge-std/Test.sol";
import {ERC1155Holder} from "@openzeppelin/contracts/token/ERC1155/utils/ERC1155Holder.sol";
import {HadronAssets} from "../src/HadronAssets.sol";
import {HadronMarket} from "../src/HadronMarket.sol";
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
