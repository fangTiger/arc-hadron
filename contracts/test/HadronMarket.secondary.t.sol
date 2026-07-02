// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Test} from "forge-std/Test.sol";
import {IERC1155Errors} from "@openzeppelin/contracts/interfaces/draft-IERC6093.sol";
import {ERC1155Holder} from "@openzeppelin/contracts/token/ERC1155/utils/ERC1155Holder.sol";
import {HadronAssets} from "../src/HadronAssets.sol";
import {HadronMarket} from "../src/HadronMarket.sol";

contract HadronMarketSecondaryTest is Test, ERC1155Holder {
    HadronAssets private assets;
    HadronMarket private market;

    address private owner = address(this);
    address private treasury = address(0xA11CE);
    address private seller = address(0x51E);
    address private buyer = address(0xB0B);
    address private otherBuyer = address(0xC0DE);

    uint256 private tokenId;
    uint256 private otherTokenId;

    uint256 private constant TOTAL_SHARES = 1_000;
    uint256 private constant PRIMARY_PRICE = 1_000_000;
    uint256 private constant SECONDARY_PRICE = 2_000_000;

    event TransferSingle(address indexed operator, address indexed from, address indexed to, uint256 id, uint256 value);
    event Listed(
        uint256 indexed listingId,
        uint256 indexed tokenId,
        address indexed seller,
        uint256 pricePerShare,
        uint256 amount
    );
    event Cancelled(uint256 indexed listingId, uint256 returnedAmount);
    event Purchased(
        uint256 indexed listingId,
        uint256 indexed tokenId,
        address indexed buyer,
        address seller,
        uint256 amount,
        uint256 totalPaid,
        uint256 fee
    );

    receive() external payable {}

    function setUp() public {
        assets = new HadronAssets();
        market = new HadronMarket(assets, treasury, 50);

        tokenId = assets.createAsset("US T-BILL 2026-Q3", "treasuries", TOTAL_SHARES, "ipfs://treasury");
        otherTokenId = assets.createAsset("GOLD OUNCE VAULT #4", "gold", TOTAL_SHARES, "ipfs://gold");
        assets.setApprovalForAll(address(market), true);

        uint256 offeringId = market.createPrimaryOffering(tokenId, PRIMARY_PRICE, 100);
        uint256 otherOfferingId = market.createPrimaryOffering(otherTokenId, PRIMARY_PRICE, 10);

        vm.deal(seller, 1_000 ether);
        vm.prank(seller);
        market.buyPrimary{value: PRIMARY_PRICE * 100}(offeringId, 100);

        vm.prank(seller);
        market.buyPrimary{value: PRIMARY_PRICE * 10}(otherOfferingId, 10);

        vm.prank(seller);
        assets.setApprovalForAll(address(market), true);
        vm.deal(buyer, 1_000 ether);
        vm.deal(otherBuyer, 1_000 ether);
    }

    function test_List_EscrowsShares_EmitsEvent() public {
        vm.expectEmit(true, true, true, true, address(assets));
        emit TransferSingle(address(market), seller, address(market), tokenId, 100);
        vm.expectEmit(true, true, true, true, address(market));
        emit Listed(1, tokenId, seller, SECONDARY_PRICE, 100);

        vm.prank(seller);
        uint256 listingId = market.list(tokenId, 100, SECONDARY_PRICE);

        assertEq(listingId, 1);
        assertEq(market.listingCount(), 1);
        assertEq(assets.balanceOf(seller, tokenId), 0);
        assertEq(assets.balanceOf(address(market), tokenId), 100);

        HadronMarket.Listing memory listing = market.getListing(listingId);
        assertEq(listing.seller, seller);
        assertEq(listing.tokenId, tokenId);
        assertEq(listing.pricePerShare, SECONDARY_PRICE);
        assertEq(listing.remaining, 100);
        assertTrue(listing.active);
    }

    function test_List_RevertWhen_NotApproved() public {
        vm.prank(seller);
        assets.setApprovalForAll(address(market), false);

        vm.expectRevert(
            abi.encodeWithSelector(IERC1155Errors.ERC1155MissingApprovalForAll.selector, address(market), seller)
        );
        vm.prank(seller);
        market.list(tokenId, 100, SECONDARY_PRICE);
    }

    function test_List_RevertWhen_ZeroPriceOrAmount() public {
        vm.expectRevert(HadronMarket.ZeroAmount.selector);
        vm.prank(seller);
        market.list(tokenId, 0, SECONDARY_PRICE);

        vm.expectRevert(HadronMarket.ZeroPrice.selector);
        vm.prank(seller);
        market.list(tokenId, 100, 0);
    }

    function test_Buy_PartialFill_SplitsFee() public {
        uint256 listingId = _list(tokenId, 100, SECONDARY_PRICE);
        uint256 amount = 40;
        uint256 totalPaid = SECONDARY_PRICE * amount;
        uint256 fee = totalPaid * market.feeBps() / 10_000;
        uint256 sellerBefore = seller.balance;
        uint256 treasuryBefore = treasury.balance;
        uint256 buyerBefore = buyer.balance;

        vm.expectEmit(true, true, true, true, address(market));
        emit Purchased(listingId, tokenId, buyer, seller, amount, totalPaid, fee);
        vm.expectEmit(true, true, true, true, address(assets));
        emit TransferSingle(address(market), address(market), buyer, tokenId, amount);
        vm.prank(buyer);
        market.buy{value: totalPaid}(listingId, amount);

        HadronMarket.Listing memory listing = market.getListing(listingId);
        assertEq(listing.remaining, 60);
        assertTrue(listing.active);
        assertEq(assets.balanceOf(buyer, tokenId), amount);
        assertEq(assets.balanceOf(address(market), tokenId), 60);
        assertEq(seller.balance - sellerBefore, totalPaid - fee);
        assertEq(treasury.balance - treasuryBefore, fee);
        assertEq(buyerBefore - buyer.balance, totalPaid);
    }

    function test_Buy_RevertWhen_SoldOutOrCancelled() public {
        uint256 soldOutListingId = _list(tokenId, 10, SECONDARY_PRICE);
        vm.prank(buyer);
        market.buy{value: SECONDARY_PRICE * 10}(soldOutListingId, 10);

        vm.expectRevert(HadronMarket.InactiveListing.selector);
        vm.prank(buyer);
        market.buy{value: SECONDARY_PRICE}(soldOutListingId, 1);

        uint256 cancelledListingId = _list(tokenId, 10, SECONDARY_PRICE);
        vm.prank(seller);
        market.cancel(cancelledListingId);

        vm.expectRevert(HadronMarket.InactiveListing.selector);
        vm.prank(buyer);
        market.buy{value: SECONDARY_PRICE}(cancelledListingId, 1);
    }

    function test_Buy_RevertWhen_WrongPayment() public {
        uint256 listingId = _list(tokenId, 10, SECONDARY_PRICE);
        uint256 totalPaid = SECONDARY_PRICE * 2;

        vm.expectRevert(HadronMarket.WrongPayment.selector);
        vm.prank(buyer);
        market.buy{value: totalPaid - 1}(listingId, 2);

        vm.expectRevert(HadronMarket.WrongPayment.selector);
        vm.prank(buyer);
        market.buy{value: totalPaid + 1}(listingId, 2);
    }

    function test_Buy_RevertWhen_ZeroOrExceedsRemaining() public {
        uint256 listingId = _list(tokenId, 10, SECONDARY_PRICE);

        vm.expectRevert(HadronMarket.ZeroAmount.selector);
        vm.prank(buyer);
        market.buy{value: 0}(listingId, 0);

        vm.expectRevert(HadronMarket.ExceedsRemaining.selector);
        vm.prank(buyer);
        market.buy{value: SECONDARY_PRICE * 11}(listingId, 11);
    }

    function test_Cancel_AfterPartialFill_ReturnsExactRemainder() public {
        uint256 listingId = _list(tokenId, 100, SECONDARY_PRICE);
        vm.prank(buyer);
        market.buy{value: SECONDARY_PRICE * 40}(listingId, 40);

        vm.expectEmit(true, true, true, true, address(assets));
        emit TransferSingle(address(market), address(market), seller, tokenId, 60);
        vm.expectEmit(true, false, false, true, address(market));
        emit Cancelled(listingId, 60);
        vm.prank(seller);
        market.cancel(listingId);

        HadronMarket.Listing memory listing = market.getListing(listingId);
        assertEq(listing.remaining, 0);
        assertFalse(listing.active);
        assertEq(assets.balanceOf(seller, tokenId), 60);
        assertEq(assets.balanceOf(address(market), tokenId), 0);

        vm.expectRevert(HadronMarket.InactiveListing.selector);
        vm.prank(buyer);
        market.buy{value: SECONDARY_PRICE}(listingId, 1);
    }

    function test_Cancel_RevertWhen_NotSeller() public {
        uint256 listingId = _list(tokenId, 10, SECONDARY_PRICE);

        vm.expectRevert(HadronMarket.NotSeller.selector);
        vm.prank(buyer);
        market.cancel(listingId);
    }

    function test_Cancel_RevertWhen_FullyFilled() public {
        uint256 listingId = _list(tokenId, 10, SECONDARY_PRICE);
        vm.prank(buyer);
        market.buy{value: SECONDARY_PRICE * 10}(listingId, 10);

        vm.expectRevert(HadronMarket.InactiveListing.selector);
        vm.prank(seller);
        market.cancel(listingId);
    }

    function test_ListingsByToken_ReturnsOnlyActive() public {
        uint256 activeListingId = _list(tokenId, 10, SECONDARY_PRICE);
        uint256 cancelledListingId = _list(tokenId, 10, SECONDARY_PRICE);
        uint256 soldOutListingId = _list(tokenId, 10, SECONDARY_PRICE);
        uint256 otherTokenListingId = _list(otherTokenId, 10, SECONDARY_PRICE);

        vm.prank(seller);
        market.cancel(cancelledListingId);

        vm.prank(buyer);
        market.buy{value: SECONDARY_PRICE * 10}(soldOutListingId, 10);

        uint256[] memory activeTokenListings = market.listingsByToken(tokenId);
        assertEq(activeTokenListings.length, 1);
        assertEq(activeTokenListings[0], activeListingId);

        uint256[] memory activeOtherTokenListings = market.listingsByToken(otherTokenId);
        assertEq(activeOtherTokenListings.length, 1);
        assertEq(activeOtherTokenListings[0], otherTokenListingId);
    }

    function _list(uint256 listedTokenId, uint256 amount, uint256 pricePerShare) private returns (uint256) {
        vm.prank(seller);
        return market.list(listedTokenId, amount, pricePerShare);
    }
}
