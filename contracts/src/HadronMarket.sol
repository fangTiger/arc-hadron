// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {ERC1155Holder} from "@openzeppelin/contracts/token/ERC1155/utils/ERC1155Holder.sol";
import {IERC1155Receiver} from "@openzeppelin/contracts/token/ERC1155/IERC1155Receiver.sol";
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
    mapping(uint256 listingId => Listing listing) private listings;

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
    error DirectTransferNotAllowed();

    constructor(HadronAssets assets_, address treasury_, uint16 feeBps_) Ownable(msg.sender) {
        if (address(assets_) == address(0)) {
            revert ZeroAddress();
        }
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

    /// @notice 仅允许市场合约自身发起的单笔托管转入。
    function onERC1155Received(
        address operator,
        address,
        uint256,
        uint256,
        bytes memory
    ) public view override returns (bytes4) {
        if (operator != address(this)) {
            revert DirectTransferNotAllowed();
        }

        return IERC1155Receiver.onERC1155Received.selector;
    }

    /// @notice 仅允许市场合约自身发起的批量托管转入。
    function onERC1155BatchReceived(
        address operator,
        address,
        uint256[] memory,
        uint256[] memory,
        bytes memory
    ) public view override returns (bytes4) {
        if (operator != address(this)) {
            revert DirectTransferNotAllowed();
        }

        return IERC1155Receiver.onERC1155BatchReceived.selector;
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
        if (amount == 0) {
            revert ZeroAmount();
        }
        if (pricePerShare == 0) {
            revert ZeroPrice();
        }

        uint256 listingId = listingCount + 1;
        listingCount = listingId;
        listings[listingId] = Listing({
            seller: msg.sender,
            tokenId: tokenId,
            pricePerShare: pricePerShare,
            remaining: amount,
            active: true
        });

        assets.safeTransferFrom(msg.sender, address(this), tokenId, amount, "");
        emit Listed(listingId, tokenId, msg.sender, pricePerShare, amount);

        return listingId;
    }

    function cancel(uint256 listingId) external nonReentrant {
        _requireExistingListing(listingId);

        Listing storage listing = listings[listingId];
        if (listing.seller != msg.sender) {
            revert NotSeller();
        }
        if (!listing.active) {
            revert InactiveListing();
        }

        uint256 returnedAmount = listing.remaining;
        listing.active = false;
        listing.remaining = 0;

        assets.safeTransferFrom(address(this), listing.seller, listing.tokenId, returnedAmount, "");
        emit Cancelled(listingId, returnedAmount);
    }

    function buy(uint256 listingId, uint256 amount) external payable nonReentrant {
        Listing storage listing = _requireActiveListing(listingId);
        if (amount == 0) {
            revert ZeroAmount();
        }
        if (amount > listing.remaining) {
            revert ExceedsRemaining();
        }

        uint256 totalPaid = listing.pricePerShare * amount;
        if (msg.value != totalPaid) {
            revert WrongPayment();
        }

        listing.remaining -= amount;
        if (listing.remaining == 0) {
            listing.active = false;
        }

        uint256 fee = totalPaid * feeBps / 10_000;
        uint256 sellerProceeds = totalPaid - fee;
        address seller = listing.seller;

        emit Purchased(listingId, listing.tokenId, msg.sender, seller, amount, totalPaid, fee);
        assets.safeTransferFrom(address(this), msg.sender, listing.tokenId, amount, "");
        _sendValue(seller, sellerProceeds);
        _sendValue(treasury, fee);
    }

    function getListing(uint256 listingId) external view returns (Listing memory) {
        _requireExistingListing(listingId);

        return listings[listingId];
    }

    function listingsByToken(uint256 tokenId) external view returns (uint256[] memory) {
        uint256 activeCount;
        for (uint256 listingId = 1; listingId <= listingCount; listingId++) {
            Listing storage listing = listings[listingId];
            if (listing.active && listing.remaining > 0 && listing.tokenId == tokenId) {
                activeCount++;
            }
        }

        uint256[] memory activeListingIds = new uint256[](activeCount);
        uint256 writeIndex;
        for (uint256 listingId = 1; listingId <= listingCount; listingId++) {
            Listing storage listing = listings[listingId];
            if (listing.active && listing.remaining > 0 && listing.tokenId == tokenId) {
                activeListingIds[writeIndex] = listingId;
                writeIndex++;
            }
        }

        return activeListingIds;
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

    function _requireExistingListing(uint256 listingId) private view {
        if (listingId == 0 || listingId > listingCount) {
            revert InactiveListing();
        }
    }

    function _requireActiveListing(uint256 listingId) private view returns (Listing storage) {
        _requireExistingListing(listingId);

        Listing storage listing = listings[listingId];
        if (!listing.active) {
            revert InactiveListing();
        }

        return listing;
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
