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
        tokenId;
        pricePerShare;
        amount;
        revert("NOT_IMPLEMENTED");
    }

    function closePrimaryOffering(uint256 offeringId) external onlyOwner {
        offeringId;
        revert("NOT_IMPLEMENTED");
    }

    function buyPrimary(uint256 offeringId, uint256 amount) external payable nonReentrant {
        offeringId;
        amount;
        revert("NOT_IMPLEMENTED");
    }

    function getOffering(uint256 offeringId) external view returns (Offering memory) {
        offeringId;
        revert("NOT_IMPLEMENTED");
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
}
