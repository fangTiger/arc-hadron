## ADDED Requirements

### Requirement: 创建一级发行
`HadronMarket` SHALL 允许仅 owner 调用 `createPrimaryOffering(tokenId, pricePerShare, amount)`：份额从 owner 转入市场合约托管（需先 `setApprovalForAll`），并要求 `pricePerShare > 0`、`amount > 0`。市场合约 MUST 继承 `ERC1155Holder`。

#### Scenario: 成功创建发行
- **WHEN** owner 已授权市场合约并以合法参数创建发行
- **THEN** 份额托管进市场合约，发行状态可通过 getter 读取，发出 `OfferingCreated(offeringId, tokenId, pricePerShare, amount)` 事件（`offeringId`、`tokenId` 为 `indexed`）

#### Scenario: 非 owner 创建被拒绝
- **WHEN** 非 owner 调用 `createPrimaryOffering`
- **THEN** 交易 revert

#### Scenario: 未授权时创建被拒绝
- **WHEN** owner 未对市场合约 `setApprovalForAll` 即创建发行
- **THEN** 交易 revert

### Requirement: 一级购买与协议费分账
任何地址 SHALL 可调用 `buyPrimary(offeringId, amount)` 以原生 USDC 精确付款（`msg.value == pricePerShare × amount`，链上按 18 位小数 wei 计价，经 2026-07-02 冒烟交易实证）购买：份额直转买家，货款的 99.5% 转 owner、0.5%（向下取整）转金库；`amount` MUST 满足 `0 < amount <= remaining`。

#### Scenario: 成功购买 N 份
- **WHEN** 买家以精确金额购买 N 份
- **THEN** 买家份额 +N、发行余量 -N，owner 与金库按 99.5%/0.5% 分账，发出 `PrimarySale` 事件

#### Scenario: 付款金额不符被拒绝
- **WHEN** `msg.value` 不等于总价（不足或超付）
- **THEN** 交易 revert

#### Scenario: 超出余量被拒绝
- **WHEN** 购买数量大于发行余量或等于 0
- **THEN** 交易 revert

#### Scenario: 小额成交协议费为零
- **WHEN** 总价 × 0.5% 向下取整为 0
- **THEN** 交易成功且金库分账为 0（已知行为，非缺陷）

### Requirement: 关闭一级发行
owner SHALL 可调用 `closePrimaryOffering(offeringId)` 关闭发行并取回全部剩余托管份额；已关闭的发行 MUST 不可购买。

#### Scenario: 关闭发行并退回库存
- **WHEN** owner 关闭一个尚有余量的发行
- **THEN** 剩余份额全额退回 owner，发出 `OfferingClosed` 事件，后续对该发行的购买 revert

### Requirement: 市场合约配置不变量与发行可读接口
`HadronMarket` 构造时 MUST 校验 `treasury != address(0)` 且 `feeBps <= 500`，违反即 revert；合约 SHALL 暴露 `offeringCount`、按 `offeringId` 的发行档案 getter（tokenId/价格/余量/状态）与部署区块常量，使前端不依赖事件日志即可枚举全部发行。

#### Scenario: 非法构造参数被拒绝
- **WHEN** 以零地址金库或 `feeBps > 500` 部署市场合约
- **THEN** 部署 revert

#### Scenario: 前端枚举全部发行
- **WHEN** 前端读取 `offeringCount` 并按 ID 逐个调用发行 getter
- **THEN** 返回每个发行的资产、单价、余量与开放状态，与链上实际一致
