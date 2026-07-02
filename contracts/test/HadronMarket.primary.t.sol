// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Test} from "forge-std/Test.sol";
import {IERC1155Errors} from "@openzeppelin/contracts/interfaces/draft-IERC6093.sol";
import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {ERC1155Holder} from "@openzeppelin/contracts/token/ERC1155/utils/ERC1155Holder.sol";
import {HadronAssets} from "../src/HadronAssets.sol";
import {HadronMarket} from "../src/HadronMarket.sol";

contract HadronMarketPrimaryTest is Test, ERC1155Holder {
    HadronAssets private assets;
    HadronMarket private market;

    address private owner = address(this);
    address private treasury = address(0xA11CE);
    address private buyer = address(0xB0B);
    address private nonOwner = address(0xCAFE);

    uint256 private tokenId;
    uint256 private constant TOTAL_SHARES = 1_000;
    uint256 private constant PRICE_PER_SHARE = 1_000_000;

    event TransferSingle(address indexed operator, address indexed from, address indexed to, uint256 id, uint256 value);
    event OfferingCreated(uint256 indexed offeringId, uint256 indexed tokenId, uint256 pricePerShare, uint256 amount);
    event OfferingClosed(uint256 indexed offeringId, uint256 returnedAmount);
    event PrimarySale(
        uint256 indexed offeringId,
        uint256 indexed tokenId,
        address indexed buyer,
        uint256 amount,
        uint256 totalPaid,
        uint256 fee
    );

    receive() external payable {}

    function setUp() public {
        assets = new HadronAssets();
        market = new HadronMarket(assets, treasury, 50);

        tokenId = assets.createAsset("US T-BILL 2026-Q3", "treasuries", TOTAL_SHARES, "ipfs://treasury");
        assets.setApprovalForAll(address(market), true);
        vm.deal(buyer, 1_000 ether);
    }

    function test_CreateOffering_EscrowsShares_EmitsEvent() public {
        vm.expectEmit(true, true, true, true, address(assets));
        emit TransferSingle(address(market), owner, address(market), tokenId, 100);
        vm.expectEmit(true, true, false, true, address(market));
        emit OfferingCreated(1, tokenId, PRICE_PER_SHARE, 100);

        uint256 offeringId = market.createPrimaryOffering(tokenId, PRICE_PER_SHARE, 100);

        assertEq(offeringId, 1);
        assertEq(market.offeringCount(), 1);
        assertEq(assets.balanceOf(address(market), tokenId), 100);
        assertEq(assets.balanceOf(owner, tokenId), 900);

        HadronMarket.Offering memory offering = market.getOffering(offeringId);
        assertEq(offering.tokenId, tokenId);
        assertEq(offering.pricePerShare, PRICE_PER_SHARE);
        assertEq(offering.remaining, 100);
        assertTrue(offering.active);
    }

    function test_CreateOffering_RevertWhen_NotOwner() public {
        vm.expectRevert(abi.encodeWithSelector(Ownable.OwnableUnauthorizedAccount.selector, nonOwner));
        vm.prank(nonOwner);
        market.createPrimaryOffering(tokenId, PRICE_PER_SHARE, 100);
    }

    function test_CreateOffering_RevertWhen_NotApproved() public {
        assets.setApprovalForAll(address(market), false);

        vm.expectRevert(
            abi.encodeWithSelector(IERC1155Errors.ERC1155MissingApprovalForAll.selector, address(market), owner)
        );
        market.createPrimaryOffering(tokenId, PRICE_PER_SHARE, 100);
    }

    function test_CreateOffering_RevertWhen_ZeroPriceOrAmount() public {
        vm.expectRevert(HadronMarket.ZeroPrice.selector);
        market.createPrimaryOffering(tokenId, 0, 100);

        vm.expectRevert(HadronMarket.ZeroAmount.selector);
        market.createPrimaryOffering(tokenId, PRICE_PER_SHARE, 0);
    }

    function test_BuyPrimary_TransfersShares_SplitsFee() public {
        uint256 offeringId = _createOffering(100, PRICE_PER_SHARE);
        uint256 amount = 40;
        uint256 totalPaid = PRICE_PER_SHARE * amount;
        uint256 fee = totalPaid * market.feeBps() / 10_000;
        uint256 ownerBefore = owner.balance;
        uint256 treasuryBefore = treasury.balance;
        uint256 buyerBefore = buyer.balance;

        vm.expectEmit(true, true, true, true, address(market));
        emit PrimarySale(offeringId, tokenId, buyer, amount, totalPaid, fee);
        vm.prank(buyer);
        market.buyPrimary{value: totalPaid}(offeringId, amount);

        HadronMarket.Offering memory offering = market.getOffering(offeringId);
        assertEq(offering.remaining, 60);
        assertTrue(offering.active);
        assertEq(assets.balanceOf(buyer, tokenId), amount);
        assertEq(assets.balanceOf(address(market), tokenId), 60);
        assertEq(owner.balance - ownerBefore, totalPaid - fee);
        assertEq(treasury.balance - treasuryBefore, fee);
        assertEq(buyerBefore - buyer.balance, totalPaid);
    }

    function test_BuyPrimary_RevertWhen_WrongPayment() public {
        uint256 offeringId = _createOffering(100, PRICE_PER_SHARE);
        uint256 amount = 2;
        uint256 totalPaid = PRICE_PER_SHARE * amount;

        vm.expectRevert(HadronMarket.WrongPayment.selector);
        vm.prank(buyer);
        market.buyPrimary{value: totalPaid - 1}(offeringId, amount);

        vm.expectRevert(HadronMarket.WrongPayment.selector);
        vm.prank(buyer);
        market.buyPrimary{value: totalPaid + 1}(offeringId, amount);
    }

    function test_BuyPrimary_RevertWhen_ExceedsRemaining_OrZero() public {
        uint256 offeringId = _createOffering(5, PRICE_PER_SHARE);

        vm.expectRevert(HadronMarket.ZeroAmount.selector);
        vm.prank(buyer);
        market.buyPrimary{value: 0}(offeringId, 0);

        vm.expectRevert(HadronMarket.ExceedsRemaining.selector);
        vm.prank(buyer);
        market.buyPrimary{value: PRICE_PER_SHARE * 6}(offeringId, 6);
    }

    function test_BuyPrimary_FeeRoundsDownToZero() public {
        uint256 offeringId = _createOffering(1, 199);
        uint256 ownerBefore = owner.balance;
        uint256 treasuryBefore = treasury.balance;

        vm.expectEmit(true, true, true, true, address(market));
        emit PrimarySale(offeringId, tokenId, buyer, 1, 199, 0);
        vm.prank(buyer);
        market.buyPrimary{value: 199}(offeringId, 1);

        HadronMarket.Offering memory offering = market.getOffering(offeringId);
        assertEq(offering.remaining, 0);
        assertFalse(offering.active);
        assertEq(assets.balanceOf(buyer, tokenId), 1);
        assertEq(owner.balance - ownerBefore, 199);
        assertEq(treasury.balance - treasuryBefore, 0);
    }

    function test_CloseOffering_ReturnsRemaining_BlocksBuy() public {
        uint256 offeringId = _createOffering(100, PRICE_PER_SHARE);
        uint256 buyAmount = 25;
        uint256 totalPaid = PRICE_PER_SHARE * buyAmount;

        vm.prank(buyer);
        market.buyPrimary{value: totalPaid}(offeringId, buyAmount);

        vm.expectEmit(true, true, true, true, address(assets));
        emit TransferSingle(address(market), address(market), owner, tokenId, 75);
        vm.expectEmit(true, false, false, true, address(market));
        emit OfferingClosed(offeringId, 75);
        market.closePrimaryOffering(offeringId);

        HadronMarket.Offering memory offering = market.getOffering(offeringId);
        assertEq(offering.remaining, 0);
        assertFalse(offering.active);
        assertEq(assets.balanceOf(owner, tokenId), 975);
        assertEq(assets.balanceOf(address(market), tokenId), 0);

        vm.expectRevert(HadronMarket.InactiveOffering.selector);
        vm.prank(buyer);
        market.buyPrimary{value: PRICE_PER_SHARE}(offeringId, 1);
    }

    function test_GetOffering_EnumerableViaCount() public {
        uint256 firstOfferingId = _createOffering(100, PRICE_PER_SHARE);
        uint256 secondOfferingId = _createOffering(200, PRICE_PER_SHARE * 2);

        assertEq(firstOfferingId, 1);
        assertEq(secondOfferingId, 2);
        assertEq(market.offeringCount(), 2);

        HadronMarket.Offering memory firstOffering = market.getOffering(1);
        assertEq(firstOffering.tokenId, tokenId);
        assertEq(firstOffering.pricePerShare, PRICE_PER_SHARE);
        assertEq(firstOffering.remaining, 100);
        assertTrue(firstOffering.active);

        HadronMarket.Offering memory secondOffering = market.getOffering(2);
        assertEq(secondOffering.tokenId, tokenId);
        assertEq(secondOffering.pricePerShare, PRICE_PER_SHARE * 2);
        assertEq(secondOffering.remaining, 200);
        assertTrue(secondOffering.active);

        vm.expectRevert(HadronMarket.InactiveOffering.selector);
        market.getOffering(3);
    }

    function _createOffering(uint256 amount, uint256 pricePerShare) private returns (uint256) {
        return market.createPrimaryOffering(tokenId, pricePerShare, amount);
    }
}
