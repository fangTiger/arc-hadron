// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {ERC1155} from "@openzeppelin/contracts/token/ERC1155/ERC1155.sol";
import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {Ownable2Step} from "@openzeppelin/contracts/access/Ownable2Step.sol";

interface IHadronYieldHook {
    function notifyTransfer(address from, address to, uint256 tokenId, uint256 amount) external;
}

/// @title HadronAssets
/// @notice ERC-1155 资产登记合约，owner 可创建资产档案并铸造全部份额。
contract HadronAssets is ERC1155, Ownable2Step {
    struct Asset {
        string name;
        string category;
        uint256 totalShares;
        string metadataURI;
    }

    uint256 public assetCount;
    address public yieldHook;

    mapping(uint256 tokenId => Asset asset) private assets;

    event AssetIssued(uint256 indexed tokenId, string name, string category, uint256 totalShares);
    event YieldHookSet(address indexed yieldHook);

    error EmptyName();
    error ZeroShares();
    error UnknownAsset();
    error ZeroAddress();
    error HookAlreadySet();
    error DuplicateBatchTokenId();

    constructor() ERC1155("") Ownable(msg.sender) {}

    function createAsset(
        string calldata name,
        string calldata category,
        uint256 totalShares,
        string calldata metadataURI
    ) external onlyOwner returns (uint256) {
        if (bytes(name).length == 0) {
            revert EmptyName();
        }
        if (totalShares == 0) {
            revert ZeroShares();
        }

        uint256 tokenId = assetCount + 1;
        assetCount = tokenId;
        assets[tokenId] = Asset({
            name: name,
            category: category,
            totalShares: totalShares,
            metadataURI: metadataURI
        });

        _mint(owner(), tokenId, totalShares, "");
        emit AssetIssued(tokenId, name, category, totalShares);

        return tokenId;
    }

    function getAsset(uint256 tokenId) external view returns (Asset memory) {
        _requireKnownAsset(tokenId);

        return assets[tokenId];
    }

    function uri(uint256 tokenId) public view override returns (string memory) {
        _requireKnownAsset(tokenId);

        return assets[tokenId].metadataURI;
    }

    function setYieldHook(address yieldHook_) external onlyOwner {
        if (yieldHook != address(0)) {
            revert HookAlreadySet();
        }
        if (yieldHook_ == address(0)) {
            revert ZeroAddress();
        }

        yieldHook = yieldHook_;
        emit YieldHookSet(yieldHook_);
    }

    function _update(address from, address to, uint256[] memory ids, uint256[] memory values) internal override {
        address hook = yieldHook;
        if (hook != address(0)) {
            // 重复 tokenId 的批量会让钩子多次读到同一份转账前余额，破坏收益守恒——直接拒绝
            // （批量规模小，O(n²) 检查成本可忽略；重复 id 批量在本系统无正当用途）
            for (uint256 index = 1; index < ids.length; index++) {
                for (uint256 prior; prior < index; prior++) {
                    if (ids[prior] == ids[index]) {
                        revert DuplicateBatchTokenId();
                    }
                }
            }

            for (uint256 index; index < ids.length; index++) {
                IHadronYieldHook(hook).notifyTransfer(from, to, ids[index], values[index]);
            }
        }

        super._update(from, to, ids, values);
    }

    function _requireKnownAsset(uint256 tokenId) private view {
        if (tokenId == 0 || tokenId > assetCount) {
            revert UnknownAsset();
        }
    }
}
