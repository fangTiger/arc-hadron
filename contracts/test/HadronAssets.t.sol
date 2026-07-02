// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Test} from "forge-std/Test.sol";
import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {ERC1155Holder} from "@openzeppelin/contracts/token/ERC1155/utils/ERC1155Holder.sol";
import {HadronAssets} from "../src/HadronAssets.sol";

contract HadronAssetsTest is Test, ERC1155Holder {
    HadronAssets private assets;

    address private owner = address(this);
    address private nonOwner = address(0xBEEF);

    event TransferSingle(address indexed operator, address indexed from, address indexed to, uint256 id, uint256 value);
    event AssetIssued(uint256 indexed tokenId, string name, string category, uint256 totalShares);

    function setUp() public {
        assets = new HadronAssets();
    }

    function test_CreateAsset_MintsAllSharesToOwner() public {
        uint256 tokenId = assets.createAsset("US T-BILL 2026-Q3", "treasuries", 10_000, "ipfs://treasury");

        assertEq(tokenId, 1);
        assertEq(assets.assetCount(), 1);
        assertEq(assets.balanceOf(owner, tokenId), 10_000);
    }

    function test_CreateAsset_EmitsAssetIssued() public {
        vm.expectEmit(true, true, true, true, address(assets));
        emit TransferSingle(owner, address(0), owner, 1, 10_000);
        vm.expectEmit(true, false, false, true, address(assets));
        emit AssetIssued(1, "US T-BILL 2026-Q3", "treasuries", 10_000);

        assets.createAsset("US T-BILL 2026-Q3", "treasuries", 10_000, "ipfs://treasury");
    }

    function test_CreateAsset_RevertWhen_NotOwner() public {
        vm.expectRevert(abi.encodeWithSelector(Ownable.OwnableUnauthorizedAccount.selector, nonOwner));
        vm.prank(nonOwner);
        assets.createAsset("US T-BILL 2026-Q3", "treasuries", 10_000, "ipfs://treasury");
    }

    function test_CreateAsset_RevertWhen_ZeroShares() public {
        vm.expectRevert(HadronAssets.ZeroShares.selector);

        assets.createAsset("US T-BILL 2026-Q3", "treasuries", 0, "ipfs://treasury");
    }

    function test_CreateAsset_RevertWhen_EmptyName() public {
        vm.expectRevert(HadronAssets.EmptyName.selector);

        assets.createAsset("", "treasuries", 10_000, "ipfs://treasury");
    }

    function test_GetAsset_ReturnsProfile_And_RevertUnknown() public {
        uint256 tokenId = assets.createAsset("GOLD OUNCE VAULT #4", "gold", 500, "ipfs://gold");

        HadronAssets.Asset memory asset = assets.getAsset(tokenId);
        assertEq(asset.name, "GOLD OUNCE VAULT #4");
        assertEq(asset.category, "gold");
        assertEq(asset.totalShares, 500);
        assertEq(asset.metadataURI, "ipfs://gold");

        vm.expectRevert(HadronAssets.UnknownAsset.selector);
        assets.getAsset(999);
    }

    function test_Uri_ReturnsMetadataURI() public {
        uint256 tokenId = assets.createAsset("MARINA TOWER UNIT 12F", "real-estate", 2_000, "ipfs://marina");

        assertEq(assets.uri(tokenId), "ipfs://marina");

        vm.expectRevert(HadronAssets.UnknownAsset.selector);
        assets.uri(999);
    }

    function test_AssetCount_IncrementsAcrossCreations() public {
        uint256 firstTokenId = assets.createAsset("US T-BILL 2026-Q3", "treasuries", 10_000, "ipfs://treasury");
        uint256 secondTokenId = assets.createAsset("GOLD OUNCE VAULT #4", "gold", 500, "ipfs://gold");
        uint256 thirdTokenId = assets.createAsset("MARINA TOWER UNIT 12F", "real-estate", 2_000, "ipfs://marina");

        assertEq(firstTokenId, 1);
        assertEq(secondTokenId, 2);
        assertEq(thirdTokenId, 3);
        assertEq(assets.assetCount(), 3);
    }
}
