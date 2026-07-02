## ADDED Requirements

### Requirement: 挂单托管
任何份额持有人 SHALL 可调用 `list(tokenId, amount, pricePerShare)` 挂单：份额转入市场合约托管（需先 `setApprovalForAll`），要求 `amount > 0`、`pricePerShare > 0`，发出 `Listed` 事件。

#### Scenario: 成功挂单
- **WHEN** 持有人已授权并以合法参数挂单
- **THEN** 份额托管进市场合约，挂单可通过 getter 读取，发出 `Listed` 事件

#### Scenario: 未授权挂单被拒绝
- **WHEN** 持有人未对市场合约 `setApprovalForAll` 即挂单
- **THEN** 交易 revert

#### Scenario: 零价或零量挂单被拒绝
- **WHEN** 以 `amount == 0` 或 `pricePerShare == 0` 挂单
- **THEN** 交易 revert

### Requirement: 二级购买与部分成交
任何地址 SHALL 可调用 `buy(listingId, amount)` 以原生 USDC 精确付款购买挂单的部分或全部：份额转买家，货款 99.5% 转卖家、0.5%（向下取整）转金库，挂单余量递减；已取消或已售罄的挂单 MUST 不可购买。

#### Scenario: 部分成交
- **WHEN** 买家购买挂单余量的一部分
- **THEN** 买家得份额、卖家得货款 ×99.5%、金库得 0.5%，挂单余量准确递减，发出 `Purchased` 事件

#### Scenario: 售罄挂单不可购买
- **WHEN** 对余量为 0 的挂单调用 `buy`
- **THEN** 交易 revert

#### Scenario: 付款金额不符被拒绝
- **WHEN** `msg.value` 不等于 `pricePerShare × amount`
- **THEN** 交易 revert

#### Scenario: 零数量或超余量购买被拒绝
- **WHEN** 以 `amount == 0` 或 `amount > remaining` 调用 `buy`
- **THEN** 交易 revert

### Requirement: 撤单
仅挂单卖家 SHALL 可调用 `cancel(listingId)`：剩余托管份额全额退回卖家，挂单进入已取消状态；已售罄挂单 MUST 不可撤单。

#### Scenario: 部分成交后撤单
- **WHEN** 卖家撤销一个已部分成交的挂单
- **THEN** 剩余份额（原量减已成交量）准确退回卖家钱包，发出 `Cancelled` 事件，后续购买 revert

#### Scenario: 非卖家撤单被拒绝
- **WHEN** 非卖家地址调用 `cancel`
- **THEN** 交易 revert

#### Scenario: 全量成交后不可撤单
- **WHEN** 卖家对余量为 0（已全量成交）的挂单调用 `cancel`
- **THEN** 交易 revert

### Requirement: 挂单可读接口
合约 SHALL 暴露 `listingCount`、按 `listingId` 的挂单档案 getter（卖家/资产/价格/余量/状态）与按 `tokenId` 查询活跃挂单的接口，使详情页与持仓页不依赖事件日志即可读取挂单状态。

#### Scenario: 详情页枚举活跃挂单
- **WHEN** 前端按 `tokenId` 查询活跃挂单
- **THEN** 返回该资产全部未取消且有余量的挂单，与链上实际一致

### Requirement: 对抗性安全约束
全部交易函数 MUST 使用 `nonReentrant` 并遵循 checks-effects-interactions；恶意收款方（重入或 revert 拒收的合约）MUST 不能破坏市场状态或锁死他人资产；owner 权限采用 `Ownable2Step`，`feeBps` 上限 500，且 MUST 不存在可划走用户托管资产的管理员函数。

#### Scenario: 恶意收款合约重入被阻止
- **WHEN** 收款方合约在收款回调中重入市场交易函数
- **THEN** 重入调用 revert，原交易状态一致（份额与资金无重复划转）

#### Scenario: 金库地址变更可追溯
- **WHEN** owner 变更金库地址
- **THEN** 发出 `TreasuryUpdated` 事件；设置零地址 revert
