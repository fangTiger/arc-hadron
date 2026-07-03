// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import {HadronAssets} from "./HadronAssets.sol";

/// @title HadronYield
/// @notice 按 ERC-1155 份额比例分配原生 USDC 收益。
contract HadronYield is ReentrancyGuard {
    uint256 public constant SCALE = 1e18;

    HadronAssets public immutable assets;

    mapping(uint256 tokenId => uint256) public accPerShare;
    mapping(uint256 tokenId => uint256) public dustScaled;
    mapping(uint256 tokenId => uint256) public excludedBalance;
    mapping(address account => mapping(uint256 tokenId => uint256)) public rewardDebtScaled;
    mapping(address account => mapping(uint256 tokenId => uint256)) public accruedScaled;

    mapping(address account => bool) private excludedAccounts;

    event YieldDeposited(uint256 indexed tokenId, address indexed depositor, uint256 amount, uint256 accPerShareAfter);
    event YieldClaimed(uint256 indexed tokenId, address indexed account, uint256 amount);

    error ZeroAddress();
    error ZeroAmount();
    error NoCirculatingSupply();
    error UnauthorizedCaller();
    error TransferFailed();

    constructor(HadronAssets assets_, address[] memory excluded_) {
        if (address(assets_) == address(0)) {
            revert ZeroAddress();
        }

        assets = assets_;

        uint256 assetCount = assets_.assetCount();
        for (uint256 index; index < excluded_.length; index++) {
            address account = excluded_[index];
            if (account == address(0)) {
                revert ZeroAddress();
            }
            if (excludedAccounts[account]) {
                continue;
            }

            excludedAccounts[account] = true;
            for (uint256 tokenId = 1; tokenId <= assetCount; tokenId++) {
                excludedBalance[tokenId] += assets_.balanceOf(account, tokenId);
            }
        }
    }

    function depositYield(uint256 tokenId) external payable {
        if (msg.value == 0) {
            revert ZeroAmount();
        }

        HadronAssets.Asset memory asset = assets.getAsset(tokenId);
        uint256 circulating = asset.totalShares - excludedBalance[tokenId];
        if (circulating == 0) {
            revert NoCirculatingSupply();
        }

        uint256 numerator = msg.value * SCALE + dustScaled[tokenId];
        accPerShare[tokenId] += numerator / circulating;
        dustScaled[tokenId] = numerator % circulating;

        emit YieldDeposited(tokenId, msg.sender, msg.value, accPerShare[tokenId]);
    }

    function claimYield(uint256 tokenId) external nonReentrant {
        _claimYield(msg.sender, tokenId);
    }

    function claimYieldBatch(uint256[] calldata tokenIds) external nonReentrant {
        for (uint256 index; index < tokenIds.length; index++) {
            _claimYield(msg.sender, tokenIds[index]);
        }
    }

    function pendingYield(address account, uint256 tokenId) external view returns (uint256) {
        return _pendingScaled(account, tokenId) / SCALE;
    }

    function notifyTransfer(address from, address to, uint256 tokenId, uint256 amount) external {
        if (msg.sender != address(assets)) {
            revert UnauthorizedCaller();
        }
        if (from == to || amount == 0) {
            return;
        }

        uint256 currentAcc = accPerShare[tokenId];
        bool fromExcluded = excludedAccounts[from];
        bool toExcluded = excludedAccounts[to];

        if (from != address(0)) {
            if (fromExcluded) {
                if (!toExcluded) {
                    _decreaseExcluded(tokenId, amount);
                }
            } else {
                uint256 fromBalance = assets.balanceOf(from, tokenId);
                _settle(from, tokenId, fromBalance, currentAcc);
                rewardDebtScaled[from][tokenId] = _balanceAfterDecrease(fromBalance, amount) * currentAcc;
            }
        }

        if (to != address(0)) {
            if (toExcluded) {
                if (!fromExcluded) {
                    excludedBalance[tokenId] += amount;
                }
            } else {
                uint256 toBalance = assets.balanceOf(to, tokenId);
                _settle(to, tokenId, toBalance, currentAcc);
                rewardDebtScaled[to][tokenId] = (toBalance + amount) * currentAcc;
            }
        }
    }

    function isExcluded(address account) external view returns (bool) {
        return excludedAccounts[account];
    }

    function _claimYield(address account, uint256 tokenId) private {
        _settleCurrent(account, tokenId);

        uint256 claimableScaled = accruedScaled[account][tokenId];
        uint256 amount = claimableScaled / SCALE;
        if (amount == 0) {
            return;
        }

        accruedScaled[account][tokenId] = claimableScaled - amount * SCALE;
        emit YieldClaimed(tokenId, account, amount);
        _sendValue(account, amount);
    }

    function _settleCurrent(address account, uint256 tokenId) private {
        if (excludedAccounts[account]) {
            return;
        }

        uint256 balance = assets.balanceOf(account, tokenId);
        uint256 currentAcc = accPerShare[tokenId];
        _settle(account, tokenId, balance, currentAcc);
        rewardDebtScaled[account][tokenId] = balance * currentAcc;
    }

    function _settle(address account, uint256 tokenId, uint256 balance, uint256 currentAcc) private {
        uint256 entitledScaled = balance * currentAcc;
        uint256 debtScaled = rewardDebtScaled[account][tokenId];
        if (entitledScaled > debtScaled) {
            accruedScaled[account][tokenId] += entitledScaled - debtScaled;
        }
    }

    function _pendingScaled(address account, uint256 tokenId) private view returns (uint256) {
        if (excludedAccounts[account]) {
            return 0;
        }

        uint256 entitledScaled = assets.balanceOf(account, tokenId) * accPerShare[tokenId];
        uint256 debtScaled = rewardDebtScaled[account][tokenId];
        uint256 newlyAccrued;
        if (entitledScaled > debtScaled) {
            newlyAccrued = entitledScaled - debtScaled;
        }

        return accruedScaled[account][tokenId] + newlyAccrued;
    }

    function _balanceAfterDecrease(uint256 balance, uint256 amount) private pure returns (uint256) {
        if (amount >= balance) {
            return 0;
        }

        return balance - amount;
    }

    function _decreaseExcluded(uint256 tokenId, uint256 amount) private {
        uint256 current = excludedBalance[tokenId];
        if (amount >= current) {
            excludedBalance[tokenId] = 0;
            return;
        }

        excludedBalance[tokenId] = current - amount;
    }

    function _sendValue(address recipient, uint256 amount) private {
        if (amount == 0) {
            return;
        }

        (bool success,) = recipient.call{value: amount}("");
        if (!success) {
            revert TransferFailed();
        }
    }
}
