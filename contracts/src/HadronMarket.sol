// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {ERC1155Holder} from "@openzeppelin/contracts/token/ERC1155/utils/ERC1155Holder.sol";
import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {Ownable2Step} from "@openzeppelin/contracts/access/Ownable2Step.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import {HadronAssets} from "./HadronAssets.sol";

/// @title HadronMarket
/// @notice RWA 份额的一级发行与二级挂单市场骨架。
contract HadronMarket is ERC1155Holder, Ownable2Step, ReentrancyGuard {
    struct Offering {
        uint256 tokenId;
        uint256 pricePerShare;
        uint256 remaining;
        bool active;
    }

    struct Listing {
        address seller;
        uint256 tokenId;
        uint256 pricePerShare;
        uint256 remaining;
        bool active;
    }

    uint16 public constant MAX_FEE_BPS = 500;
    HadronAssets public immutable assets;
    uint256 public immutable deployBlock;
    address public treasury;
    uint16 public feeBps;
    uint256 public offeringCount;
    uint256 public listingCount;

    mapping(uint256 offeringId => Offering offering) private offerings;

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
    event TreasuryUpdated(address newTreasury);

    error ZeroAddress();
    error FeeTooHigh();
    error ZeroAmount();
    error ZeroPrice();
    error InactiveOffering();
    error InactiveListing();
    error ExceedsRemaining();
    error WrongPayment();
    error NotSeller();
    error TransferFailed();

    constructor(HadronAssets assets_, address treasury_, uint16 feeBps_) Ownable(msg.sender) {
        if (treasury_ == address(0)) {
            revert ZeroAddress();
        }
        if (feeBps_ > MAX_FEE_BPS) {
            revert FeeTooHigh();
        }

        assets = assets_;
        deployBlock = block.number;
        treasury = treasury_;
        feeBps = feeBps_;
    }

    function createPrimaryOffering(
        uint256 tokenId,
        uint256 pricePerShare,
        uint256 amount
    ) external onlyOwner returns (uint256) {
        if (pricePerShare == 0) {
            revert ZeroPrice();
        }
        if (amount == 0) {
            revert ZeroAmount();
        }

        uint256 offeringId = offeringCount + 1;
        offeringCount = offeringId;
        offerings[offeringId] = Offering({
            tokenId: tokenId,
            pricePerShare: pricePerShare,
            remaining: amount,
            active: true
        });

        assets.safeTransferFrom(owner(), address(this), tokenId, amount, "");
        emit OfferingCreated(offeringId, tokenId, pricePerShare, amount);

        return offeringId;
    }

    function closePrimaryOffering(uint256 offeringId) external onlyOwner {
        Offering storage offering = _requireActiveOffering(offeringId);
        uint256 returnedAmount = offering.remaining;

        offering.active = false;
        offering.remaining = 0;

        assets.safeTransferFrom(address(this), owner(), offering.tokenId, returnedAmount, "");
        emit OfferingClosed(offeringId, returnedAmount);
    }

    function buyPrimary(uint256 offeringId, uint256 amount) external payable nonReentrant {
        Offering storage offering = _requireActiveOffering(offeringId);
        if (amount == 0) {
            revert ZeroAmount();
        }
        if (amount > offering.remaining) {
            revert ExceedsRemaining();
        }

        uint256 totalPaid = offering.pricePerShare * amount;
        if (msg.value != totalPaid) {
            revert WrongPayment();
        }

        offering.remaining -= amount;
        if (offering.remaining == 0) {
            offering.active = false;
        }

        uint256 fee = totalPaid * feeBps / 10_000;
        uint256 sellerProceeds = totalPaid - fee;
        address seller = owner();

        emit PrimarySale(offeringId, offering.tokenId, msg.sender, amount, totalPaid, fee);
        assets.safeTransferFrom(address(this), msg.sender, offering.tokenId, amount, "");
        _sendValue(seller, sellerProceeds);
        _sendValue(treasury, fee);
    }

    function getOffering(uint256 offeringId) external view returns (Offering memory) {
        _requireExistingOffering(offeringId);

        return offerings[offeringId];
    }

    function list(uint256 tokenId, uint256 amount, uint256 pricePerShare) external nonReentrant returns (uint256) {
        tokenId;
        amount;
        pricePerShare;
        revert("NOT_IMPLEMENTED");
    }

    function cancel(uint256 listingId) external nonReentrant {
        listingId;
        revert("NOT_IMPLEMENTED");
    }

    function buy(uint256 listingId, uint256 amount) external payable nonReentrant {
        listingId;
        amount;
        revert("NOT_IMPLEMENTED");
    }

    function getListing(uint256 listingId) external view returns (Listing memory) {
        listingId;
        revert("NOT_IMPLEMENTED");
    }

    function listingsByToken(uint256 tokenId) external view returns (uint256[] memory) {
        tokenId;
        revert("NOT_IMPLEMENTED");
    }

    function setTreasury(address newTreasury) external onlyOwner {
        if (newTreasury == address(0)) {
            revert ZeroAddress();
        }

        treasury = newTreasury;
        emit TreasuryUpdated(newTreasury);
    }

    function _requireExistingOffering(uint256 offeringId) private view {
        if (offeringId == 0 || offeringId > offeringCount) {
            revert InactiveOffering();
        }
    }

    function _requireActiveOffering(uint256 offeringId) private view returns (Offering storage) {
        _requireExistingOffering(offeringId);

        Offering storage offering = offerings[offeringId];
        if (!offering.active) {
            revert InactiveOffering();
        }

        return offering;
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
