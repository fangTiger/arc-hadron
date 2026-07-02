// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Test} from "forge-std/Test.sol";
import {IERC1155Receiver} from "@openzeppelin/contracts/token/ERC1155/IERC1155Receiver.sol";
import {ERC1155Holder} from "@openzeppelin/contracts/token/ERC1155/utils/ERC1155Holder.sol";
import {HadronAssets} from "../src/HadronAssets.sol";
import {HadronMarket} from "../src/HadronMarket.sol";

contract HadronMarketConfigTest is Test, ERC1155Holder {
    HadronAssets private assets;
    HadronMarket private market;

    address private treasury = address(0xA11CE);
    address private newTreasury = address(0xB0B);

    event TreasuryUpdated(address newTreasury);

    function setUp() public {
        assets = new HadronAssets();
        market = new HadronMarket(assets, treasury, 50);
    }

    function test_Constructor_SetsConfig() public {
        assertEq(address(market.assets()), address(assets));
        assertEq(market.treasury(), treasury);
        assertEq(market.feeBps(), 50);
        assertEq(market.deployBlock(), block.number);
        assertEq(market.offeringCount(), 0);
        assertEq(market.listingCount(), 0);
    }

    function test_Constructor_RevertWhen_ZeroTreasury() public {
        vm.expectRevert(HadronMarket.ZeroAddress.selector);

        new HadronMarket(assets, address(0), 50);
    }

    function test_Constructor_RevertWhen_FeeTooHigh() public {
        vm.expectRevert(HadronMarket.FeeTooHigh.selector);

        new HadronMarket(assets, treasury, 501);
    }

    function test_SetTreasury_EmitsEvent_And_RevertZero() public {
        vm.expectEmit(false, false, false, true, address(market));
        emit TreasuryUpdated(newTreasury);

        market.setTreasury(newTreasury);

        assertEq(market.treasury(), newTreasury);

        vm.expectRevert(HadronMarket.ZeroAddress.selector);
        market.setTreasury(address(0));
    }

    function test_SupportsERC1155Receiver() public {
        assertTrue(market.supportsInterface(type(IERC1155Receiver).interfaceId));

        uint256 tokenId = assets.createAsset("US T-BILL 2026-Q3", "treasuries", 10_000, "ipfs://treasury");

        assets.safeTransferFrom(address(this), address(market), tokenId, 1, "");

        assertEq(assets.balanceOf(address(market), tokenId), 1);
    }
}
