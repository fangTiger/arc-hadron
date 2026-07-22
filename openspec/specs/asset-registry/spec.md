# asset-registry Specification

## Purpose

定义 HadronAssets ERC-1155 资产登记、份额铸造与资产档案可读接口，作为前端资产枚举和市场交易的基础能力。

## Requirements

### Requirement: 资产登记与份额铸造
系统 SHALL 提供 `HadronAssets`（ERC-1155）合约：仅 owner 可调用 `createAsset(name, category, totalShares, metadataURI)` 登记资产档案，`tokenId` 自增，创建时将全部份额铸造给 owner，并发出 `AssetIssued` 事件。

#### Scenario: owner 成功创建资产
- **WHEN** owner 以合法参数调用 `createAsset`
- **THEN** 新 `tokenId` 分配成功，owner 名下份额余额等于 `totalShares`，链上可查 `AssetIssued` 事件

#### Scenario: 非 owner 创建被拒绝
- **WHEN** 非 owner 地址调用 `createAsset`
- **THEN** 交易 revert

#### Scenario: 无效参数被拒绝
- **WHEN** 以 `totalShares == 0` 或空名称调用 `createAsset`
- **THEN** 交易 revert

### Requirement: 资产档案可读接口
合约 SHALL 暴露 `assetCount`、按 `tokenId` 的资产档案 getter 以及 `uri(tokenId)`，使前端不依赖事件日志即可枚举全部资产及其元数据。

#### Scenario: 前端枚举全部资产
- **WHEN** 前端读取 `assetCount` 并按 ID 逐个调用档案 getter
- **THEN** 返回每个资产的名称、类别、份额总量与 metadataURI，与创建时一致
