// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Test} from "forge-std/Test.sol";
import {ERC1155Holder} from "@openzeppelin/contracts/token/ERC1155/utils/ERC1155Holder.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import {HadronAssets} from "../src/HadronAssets.sol";
import {HadronYield} from "../src/HadronYield.sol";

contract HadronYieldTest is Test, ERC1155Holder {
    HadronAssets private assets;
    HadronYield private yieldContract;
    ExcludedVault private vault;

    address private issuer = address(this);
    address private depositor = address(0xD090);
    address private alice = address(0xA11CE);
    address private bob = address(0xB0B);
    address private carol = address(0xCA20);

    uint256 private tokenId;
    uint256 private otherTokenId;
    uint256 private tinyTokenId;

    uint256 private constant USDC = 1_000_000;
    uint256 private constant SCALE = 1e18;

    event YieldDeposited(uint256 indexed tokenId, address indexed depositor, uint256 amount, uint256 accPerShareAfter);
    event YieldClaimed(uint256 indexed tokenId, address indexed account, uint256 amount);
    event YieldHookSet(address indexed yieldHook);

    receive() external payable {}

    function setUp() public {
        assets = new HadronAssets();
        vault = new ExcludedVault();

        tokenId = assets.createAsset("US T-BILL 2026-Q3", "treasuries", 100, "ipfs://treasury");
        otherTokenId = assets.createAsset("GOLD OUNCE VAULT #4", "gold", 100, "ipfs://gold");
        tinyTokenId = assets.createAsset("MICRO NOTES", "credit", 3, "ipfs://micro");

        address[] memory excluded = new address[](2);
        excluded[0] = issuer;
        excluded[1] = address(vault);
        yieldContract = new HadronYield(assets, excluded);

        vm.deal(depositor, 1_000 * USDC);
    }

    function test_DepositYield_SplitsThirtySeventy() public {
        _transferWithNotify(issuer, alice, tokenId, 30);
        _transferWithNotify(issuer, bob, tokenId, 70);

        vm.expectEmit(true, true, false, true, address(yieldContract));
        emit YieldDeposited(tokenId, depositor, 10 * USDC, (10 * USDC * SCALE) / 100);
        _deposit(tokenId, 10 * USDC);

        assertEq(yieldContract.pendingYield(alice, tokenId), 3 * USDC);
        assertEq(yieldContract.pendingYield(bob, tokenId), 7 * USDC);
    }

    function test_TransferSettlement_KeepsAccruedAndUsesNewBalances() public {
        _transferWithNotify(issuer, alice, tokenId, 100);
        _deposit(tokenId, 10 * USDC);

        _transferWithNotify(alice, bob, tokenId, 50);
        _deposit(tokenId, 10 * USDC);

        assertEq(yieldContract.pendingYield(alice, tokenId), 15 * USDC);
        assertEq(yieldContract.pendingYield(bob, tokenId), 5 * USDC);
    }

    function test_SelfTransfer_IsNoOpForYieldAccounting() public {
        _transferWithNotify(issuer, alice, tokenId, 100);
        _deposit(tokenId, 10 * USDC);

        _transferWithNotify(alice, alice, tokenId, 40);
        _deposit(tokenId, 10 * USDC);

        assertEq(assets.balanceOf(alice, tokenId), 100);
        assertEq(yieldContract.pendingYield(alice, tokenId), 20 * USDC);
    }

    function test_BatchTransfer_SettlesEachTokenId() public {
        uint256[] memory ids = new uint256[](2);
        ids[0] = tokenId;
        ids[1] = otherTokenId;

        uint256[] memory seedAmounts = new uint256[](2);
        seedAmounts[0] = 100;
        seedAmounts[1] = 100;
        _batchTransferWithNotify(issuer, alice, ids, seedAmounts);

        _deposit(tokenId, 10 * USDC);
        _deposit(otherTokenId, 20 * USDC);

        uint256[] memory transferAmounts = new uint256[](2);
        transferAmounts[0] = 40;
        transferAmounts[1] = 10;
        _batchTransferWithNotify(alice, bob, ids, transferAmounts);

        _deposit(tokenId, 10 * USDC);
        _deposit(otherTokenId, 20 * USDC);

        assertEq(yieldContract.pendingYield(alice, tokenId), 16 * USDC);
        assertEq(yieldContract.pendingYield(bob, tokenId), 4 * USDC);
        assertEq(yieldContract.pendingYield(alice, otherTokenId), 38 * USDC);
        assertEq(yieldContract.pendingYield(bob, otherTokenId), 2 * USDC);
    }

    function test_MultipleTokensRemainIndependent() public {
        _transferWithNotify(issuer, alice, tokenId, 100);
        _transferWithNotify(issuer, bob, otherTokenId, 100);

        _deposit(tokenId, 5 * USDC);
        _deposit(otherTokenId, 7 * USDC);

        assertEq(yieldContract.pendingYield(alice, tokenId), 5 * USDC);
        assertEq(yieldContract.pendingYield(alice, otherTokenId), 0);
        assertEq(yieldContract.pendingYield(bob, tokenId), 0);
        assertEq(yieldContract.pendingYield(bob, otherTokenId), 7 * USDC);
    }

    function test_ScaledDustAndOneWeiDeposit_RollIntoNextDeposit() public {
        _transferWithNotify(issuer, alice, tinyTokenId, 1);
        _transferWithNotify(issuer, bob, tinyTokenId, 1);
        _transferWithNotify(issuer, carol, tinyTokenId, 1);

        _deposit(tinyTokenId, 1);

        assertEq(yieldContract.dustScaled(tinyTokenId), 1);
        assertEq(yieldContract.pendingYield(alice, tinyTokenId), 0);
        assertEq(yieldContract.pendingYield(bob, tinyTokenId), 0);
        assertEq(yieldContract.pendingYield(carol, tinyTokenId), 0);

        _deposit(tinyTokenId, 2);

        assertEq(yieldContract.dustScaled(tinyTokenId), 0);
        assertEq(yieldContract.pendingYield(alice, tinyTokenId), 1);
        assertEq(yieldContract.pendingYield(bob, tinyTokenId), 1);
        assertEq(yieldContract.pendingYield(carol, tinyTokenId), 1);
    }

    function test_DepositYield_RevertWhenZeroAmountOrNoCirculatingShares() public {
        vm.expectRevert(HadronYield.ZeroAmount.selector);
        vm.prank(depositor);
        yieldContract.depositYield{value: 0}(tokenId);

        vm.expectRevert(HadronYield.NoCirculatingSupply.selector);
        _deposit(tokenId, 1 * USDC);
    }

    function test_ClaimYield_IsIdempotentAndKeepsRemainder() public {
        _transferWithNotify(issuer, alice, tokenId, 100);
        _deposit(tokenId, 10 * USDC);

        uint256 beforeBalance = alice.balance;
        vm.expectEmit(true, true, false, true, address(yieldContract));
        emit YieldClaimed(tokenId, alice, 10 * USDC);
        vm.prank(alice);
        yieldContract.claimYield(tokenId);

        assertEq(alice.balance - beforeBalance, 10 * USDC);
        assertEq(yieldContract.pendingYield(alice, tokenId), 0);

        beforeBalance = alice.balance;
        vm.prank(alice);
        yieldContract.claimYield(tokenId);

        assertEq(alice.balance, beforeBalance);
        assertEq(yieldContract.pendingYield(alice, tokenId), 0);
    }

    function test_ClaimYieldBatch_DuplicateTokenIdIsIdempotent() public {
        _transferWithNotify(issuer, alice, tokenId, 100);
        _transferWithNotify(issuer, alice, otherTokenId, 100);
        _deposit(tokenId, 10 * USDC);
        _deposit(otherTokenId, 4 * USDC);

        uint256[] memory tokenIds = new uint256[](3);
        tokenIds[0] = tokenId;
        tokenIds[1] = tokenId;
        tokenIds[2] = otherTokenId;

        uint256 beforeBalance = alice.balance;
        vm.prank(alice);
        yieldContract.claimYieldBatch(tokenIds);

        assertEq(alice.balance - beforeBalance, 14 * USDC);
        assertEq(yieldContract.pendingYield(alice, tokenId), 0);
        assertEq(yieldContract.pendingYield(alice, otherTokenId), 0);
    }

    function test_ExcludedTransferCombinations_KeepHistoryAndNoRetroactiveYield() public {
        _transferWithNotify(issuer, alice, tokenId, 50);
        _deposit(tokenId, 10 * USDC);

        _transferWithNotify(issuer, bob, tokenId, 50);
        assertEq(yieldContract.pendingYield(bob, tokenId), 0);

        _deposit(tokenId, 10 * USDC);
        assertEq(yieldContract.pendingYield(alice, tokenId), 15 * USDC);
        assertEq(yieldContract.pendingYield(bob, tokenId), 5 * USDC);

        _transferWithNotify(alice, address(vault), tokenId, 20);
        _deposit(tokenId, 8 * USDC);
        assertEq(yieldContract.pendingYield(alice, tokenId), 18 * USDC);
        assertEq(yieldContract.pendingYield(bob, tokenId), 10 * USDC);
        assertEq(yieldContract.pendingYield(address(vault), tokenId), 0);
        assertEq(yieldContract.excludedBalance(tokenId), 20);

        _transferWithNotify(address(vault), issuer, tokenId, 10);
        assertEq(yieldContract.excludedBalance(tokenId), 20);

        _transferWithNotify(address(vault), bob, tokenId, 10);
        assertEq(yieldContract.pendingYield(bob, tokenId), 10 * USDC);
        assertEq(yieldContract.excludedBalance(tokenId), 10);

        _deposit(tokenId, 9 * USDC);
        assertEq(yieldContract.pendingYield(alice, tokenId), 21 * USDC);
        assertEq(yieldContract.pendingYield(bob, tokenId), 16 * USDC);
    }

    function test_IssuerInventory_IsExcludedFromDistribution() public {
        _transferWithNotify(issuer, alice, tokenId, 30);

        _deposit(tokenId, 9 * USDC);

        assertEq(yieldContract.pendingYield(alice, tokenId), 9 * USDC);
        assertEq(yieldContract.pendingYield(issuer, tokenId), 0);
        assertEq(yieldContract.excludedBalance(tokenId), 70);
    }

    function test_ExcludedEscrow_ReturnsToAccrualWithoutRetroactiveYield() public {
        _transferWithNotify(issuer, alice, tokenId, 100);
        _transferWithNotify(alice, address(vault), tokenId, 60);

        _deposit(tokenId, 4 * USDC);
        assertEq(yieldContract.pendingYield(alice, tokenId), 4 * USDC);
        assertEq(yieldContract.pendingYield(address(vault), tokenId), 0);

        _transferWithNotify(address(vault), alice, tokenId, 60);
        assertEq(yieldContract.pendingYield(alice, tokenId), 4 * USDC);

        _deposit(tokenId, 10 * USDC);
        assertEq(yieldContract.pendingYield(alice, tokenId), 14 * USDC);
    }

    function test_HookUnset_TransferRemainsNormal() public {
        HadronAssets plainAssets = new HadronAssets();
        uint256 plainTokenId = plainAssets.createAsset("PLAIN", "test", 100, "ipfs://plain");

        plainAssets.safeTransferFrom(address(this), alice, plainTokenId, 25, "");

        assertEq(plainAssets.balanceOf(alice, plainTokenId), 25);
        assertEq(plainAssets.balanceOf(address(this), plainTokenId), 75);
    }

    function test_SetYieldHook_EmitsAndLocksOnce() public {
        HadronAssets hookedAssets = new HadronAssets();
        address[] memory excluded = new address[](1);
        excluded[0] = issuer;
        HadronYield hook = new HadronYield(hookedAssets, excluded);

        vm.expectEmit(true, false, false, true, address(hookedAssets));
        emit YieldHookSet(address(hook));
        hookedAssets.setYieldHook(address(hook));

        assertEq(hookedAssets.yieldHook(), address(hook));

        vm.expectRevert(HadronAssets.HookAlreadySet.selector);
        hookedAssets.setYieldHook(address(hook));
    }

    function test_YieldHook_AutoSettlesSingleAndBatchTransfers() public {
        HadronAssets hookedAssets = new HadronAssets();
        address[] memory excluded = new address[](1);
        excluded[0] = issuer;
        HadronYield hookedYield = new HadronYield(hookedAssets, excluded);
        hookedAssets.setYieldHook(address(hookedYield));

        uint256 firstTokenId = hookedAssets.createAsset("HOOKED ONE", "test", 100, "ipfs://one");
        uint256 secondTokenId = hookedAssets.createAsset("HOOKED TWO", "test", 100, "ipfs://two");

        hookedAssets.safeTransferFrom(issuer, alice, firstTokenId, 100, "");
        hookedAssets.safeTransferFrom(issuer, alice, secondTokenId, 100, "");

        vm.prank(depositor);
        hookedYield.depositYield{value: 10 * USDC}(firstTokenId);
        vm.prank(alice);
        hookedAssets.safeTransferFrom(alice, bob, firstTokenId, 40, "");
        vm.prank(depositor);
        hookedYield.depositYield{value: 10 * USDC}(firstTokenId);

        assertEq(hookedYield.pendingYield(alice, firstTokenId), 16 * USDC);
        assertEq(hookedYield.pendingYield(bob, firstTokenId), 4 * USDC);

        vm.prank(depositor);
        hookedYield.depositYield{value: 20 * USDC}(secondTokenId);

        uint256[] memory ids = new uint256[](2);
        ids[0] = firstTokenId;
        ids[1] = secondTokenId;
        uint256[] memory amounts = new uint256[](2);
        amounts[0] = 10;
        amounts[1] = 10;

        vm.prank(alice);
        hookedAssets.safeBatchTransferFrom(alice, bob, ids, amounts, "");

        vm.prank(depositor);
        hookedYield.depositYield{value: 10 * USDC}(firstTokenId);
        vm.prank(depositor);
        hookedYield.depositYield{value: 10 * USDC}(secondTokenId);

        assertEq(hookedYield.pendingYield(alice, firstTokenId), 21 * USDC);
        assertEq(hookedYield.pendingYield(bob, firstTokenId), 9 * USDC);
        assertEq(hookedYield.pendingYield(alice, secondTokenId), 29 * USDC);
        assertEq(hookedYield.pendingYield(bob, secondTokenId), 1 * USDC);
    }

    function test_NotifyTransfer_RevertWhenCallerIsNotAssets() public {
        vm.expectRevert(HadronYield.UnauthorizedCaller.selector);
        yieldContract.notifyTransfer(issuer, alice, tokenId, 1);
    }

    function test_ClaimYield_ReentrantClaimIsRejected() public {
        ReenteringYieldReceiver receiver = new ReenteringYieldReceiver();
        _transferWithNotify(issuer, address(receiver), tokenId, 100);
        _deposit(tokenId, 10 * USDC);
        receiver.configure(yieldContract, tokenId);

        receiver.callClaim(yieldContract, tokenId);

        assertTrue(receiver.reentryAttempted());
        assertTrue(receiver.reentryFailed());
        assertEq(receiver.failureSelector(), ReentrancyGuard.ReentrancyGuardReentrantCall.selector);
        assertEq(address(receiver).balance, 10 * USDC);
        assertEq(yieldContract.pendingYield(address(receiver), tokenId), 0);
    }

    function test_RevertingClaimReceiver_OnlyBlocksOwnClaim() public {
        RejectingYieldReceiver rejectingReceiver = new RejectingYieldReceiver();
        _transferWithNotify(issuer, address(rejectingReceiver), tokenId, 40);
        _transferWithNotify(issuer, alice, tokenId, 60);
        _deposit(tokenId, 10 * USDC);

        vm.expectRevert(HadronYield.TransferFailed.selector);
        rejectingReceiver.callClaim(yieldContract, tokenId);

        assertEq(yieldContract.pendingYield(address(rejectingReceiver), tokenId), 4 * USDC);
        assertEq(yieldContract.pendingYield(alice, tokenId), 6 * USDC);

        uint256 beforeBalance = alice.balance;
        vm.prank(alice);
        yieldContract.claimYield(tokenId);

        assertEq(alice.balance - beforeBalance, 6 * USDC);
        assertEq(yieldContract.pendingYield(address(rejectingReceiver), tokenId), 4 * USDC);
    }

    function testFuzz_Invariant_DepositsEqualPaidPendingAndRemainders(uint256 seed) public {
        _transferWithNotify(issuer, alice, tokenId, 50);
        _transferWithNotify(issuer, bob, tokenId, 30);
        _transferWithNotify(issuer, carol, tokenId, 20);

        address[3] memory accounts = [alice, bob, carol];
        uint256 totalDeposited;
        uint256 totalPaid;

        for (uint256 step; step < 12; step++) {
            uint256 value = uint256(keccak256(abi.encode(seed, step)));
            uint256 action = value % 3;

            if (action == 0) {
                uint256 amount = (value / 3) % (5 * USDC) + 1;
                vm.prank(depositor);
                yieldContract.depositYield{value: amount}(tokenId);
                totalDeposited += amount;
            } else if (action == 1) {
                address from = accounts[(value / 3) % accounts.length];
                address to = accounts[(value / 9) % accounts.length];
                uint256 balance = assets.balanceOf(from, tokenId);
                if (from == to || balance == 0) {
                    continue;
                }

                uint256 amount = (value / 27) % balance + 1;
                _transferWithNotify(from, to, tokenId, amount);
            } else {
                address account = accounts[(value / 3) % accounts.length];
                uint256 beforeBalance = account.balance;
                vm.prank(account);
                yieldContract.claimYield(tokenId);
                totalPaid += account.balance - beforeBalance;
            }
        }

        _assertYieldInvariant(tokenId, accounts, totalDeposited, totalPaid);
    }

    function _deposit(uint256 depositTokenId, uint256 amount) private {
        vm.prank(depositor);
        yieldContract.depositYield{value: amount}(depositTokenId);
    }

    function _transferWithNotify(address from, address to, uint256 transferTokenId, uint256 amount) private {
        vm.prank(address(assets));
        yieldContract.notifyTransfer(from, to, transferTokenId, amount);
        _transferAsset(from, to, transferTokenId, amount);
    }

    function _batchTransferWithNotify(
        address from,
        address to,
        uint256[] memory ids,
        uint256[] memory amounts
    ) private {
        for (uint256 index; index < ids.length; index++) {
            vm.prank(address(assets));
            yieldContract.notifyTransfer(from, to, ids[index], amounts[index]);
        }

        if (from == issuer) {
            assets.safeBatchTransferFrom(from, to, ids, amounts, "");
            return;
        }

        vm.prank(from);
        assets.safeBatchTransferFrom(from, to, ids, amounts, "");
    }

    function _transferAsset(address from, address to, uint256 transferTokenId, uint256 amount) private {
        if (from == address(vault)) {
            vault.transferAsset(assets, to, transferTokenId, amount);
            return;
        }
        if (from == issuer) {
            assets.safeTransferFrom(from, to, transferTokenId, amount, "");
            return;
        }

        vm.prank(from);
        assets.safeTransferFrom(from, to, transferTokenId, amount, "");
    }

    function _assertYieldInvariant(
        uint256 invariantTokenId,
        address[3] memory accounts,
        uint256 totalDeposited,
        uint256 totalPaid
    ) private view {
        uint256 pendingWei;
        uint256 pendingScaled;

        for (uint256 index; index < accounts.length; index++) {
            address account = accounts[index];
            uint256 accountPending = yieldContract.pendingYield(account, invariantTokenId);
            uint256 entitledScaled = assets.balanceOf(account, invariantTokenId) * yieldContract.accPerShare(invariantTokenId);
            uint256 debtScaled = yieldContract.rewardDebtScaled(account, invariantTokenId);
            uint256 accountPendingScaled = yieldContract.accruedScaled(account, invariantTokenId);
            if (entitledScaled > debtScaled) {
                accountPendingScaled += entitledScaled - debtScaled;
            }

            pendingWei += accountPending;
            pendingScaled += accountPendingScaled;
        }

        uint256 scaledRemainder = pendingScaled - pendingWei * SCALE;
        uint256 explainedScaled = totalPaid * SCALE
            + pendingWei * SCALE
            + scaledRemainder
            + yieldContract.dustScaled(invariantTokenId);

        assertEq(totalDeposited * SCALE, explainedScaled);
        assertGe(address(yieldContract).balance, pendingWei);
    }
}

contract ExcludedVault is ERC1155Holder {
    function transferAsset(HadronAssets assets, address to, uint256 tokenId, uint256 amount) external {
        assets.safeTransferFrom(address(this), to, tokenId, amount, "");
    }
}

contract ReenteringYieldReceiver is ERC1155Holder {
    HadronYield private target;
    uint256 private targetTokenId;

    bool public reentryAttempted;
    bool public reentryFailed;
    bytes4 public failureSelector;

    receive() external payable {
        reentryAttempted = true;
        try target.claimYield(targetTokenId) {}
        catch (bytes memory reason) {
            reentryFailed = true;
            failureSelector = _selector(reason);
        }
    }

    function configure(HadronYield target_, uint256 tokenId_) external {
        target = target_;
        targetTokenId = tokenId_;
    }

    function callClaim(HadronYield target_, uint256 tokenId_) external {
        target_.claimYield(tokenId_);
    }

    function _selector(bytes memory reason) private pure returns (bytes4 selector) {
        if (reason.length < 4) {
            return bytes4(0);
        }

        assembly {
            selector := mload(add(reason, 32))
        }
    }
}

contract RejectingYieldReceiver is ERC1155Holder {
    receive() external payable {
        revert("REJECT_YIELD");
    }

    function callClaim(HadronYield target, uint256 tokenId) external {
        target.claimYield(tokenId);
    }
}
