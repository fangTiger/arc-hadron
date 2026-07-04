# secondary-market Specification

## Purpose

二级市场能力：份额持有人在一级发行之后自由挂单（listings）与挂买单（bids）交易，支持部分成交、撤单、0.5% 协议费，并以交易所级订单簿与累计深度可视化呈现双边盘口。
## Requirements
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

### Requirement: 买单托管
任何地址 SHALL 可调用 `placeBid(tokenId, amount, pricePerShare)` 挂买单：以原生 USDC 按 `pricePerShare × amount` 全额托管进市场合约，要求 `amount > 0`、`pricePerShare > 0`、`msg.value` 精确等于托管额；合约地址 bidder MUST 通过 ERC165 `IERC1155Receiver` 接口检查（防止不可成交的假买单深度）；发出带 indexed `tokenId` 与 indexed `bidder` 的 `BidPlaced` 事件。

#### Scenario: 成功挂买单
- **WHEN** 地址以合法参数并精确付款挂买单
- **THEN** USDC 全额托管进市场合约，买单可通过 getter 读取，发出 `BidPlaced` 事件

#### Scenario: 付款金额不符被拒绝
- **WHEN** `msg.value` 不等于 `pricePerShare × amount`
- **THEN** 交易 revert

#### Scenario: 零价或零量买单被拒绝
- **WHEN** 以 `amount == 0` 或 `pricePerShare == 0` 挂买单
- **THEN** 交易 revert

#### Scenario: 无 receiver 的合约 bidder 被拒绝
- **WHEN** 未实现 `IERC1155Receiver`（ERC165 检查不通过）的合约地址调用 `placeBid`
- **THEN** 交易 revert

### Requirement: 买单成交与部分成交
任何份额持有人 SHALL 可调用 `fillBid(bidId, amount)`（需先 `setApprovalForAll`）按买单价卖出部分或全部份额：份额转 bidder，托管货款按成交额结算——卖家得 99.5%、0.5%（向下取整）转金库，买单余量递减；已取消或已成交完的买单 MUST 不可再成交；发出带 indexed `tokenId` 与 indexed `bidder` 的 `BidFilled` 事件。

#### Scenario: 部分成交
- **WHEN** 持有人以买单余量的一部分调用 `fillBid`
- **THEN** bidder 得份额、卖家得货款 ×99.5%、金库得 0.5%，买单余量准确递减，发出 `BidFilled` 事件

#### Scenario: 未授权成交被拒绝
- **WHEN** 持有人未对市场合约 `setApprovalForAll` 即调用 `fillBid`
- **THEN** 交易 revert

#### Scenario: 零数量或超余量成交被拒绝
- **WHEN** 以 `amount == 0` 或 `amount > remaining` 调用 `fillBid`
- **THEN** 交易 revert

#### Scenario: 已撤销买单不可成交
- **WHEN** 对已撤销的买单调用 `fillBid`
- **THEN** 交易 revert

### Requirement: 撤买单
仅买单 bidder SHALL 可调用 `cancelBid(bidId)`：剩余托管 USDC（`pricePerShare × remaining`）全额退回 bidder，买单进入已取消状态；已成交完的买单 MUST 不可撤销；发出带 indexed `tokenId` 与 indexed `bidder` 的 `BidCancelled` 事件。

#### Scenario: 部分成交后撤单
- **WHEN** bidder 撤销一个已部分成交的买单
- **THEN** 剩余托管（原托管减已成交额）准确退回 bidder，发出 `BidCancelled` 事件，后续成交 revert

#### Scenario: 非 bidder 撤单被拒绝
- **WHEN** 非 bidder 地址调用 `cancelBid`
- **THEN** 交易 revert

#### Scenario: 全量成交后不可撤单
- **WHEN** bidder 对余量为 0（已全量成交）的买单调用 `cancelBid`
- **THEN** 交易 revert

### Requirement: 买单可读接口与前端呈现
合约 SHALL 暴露 `bidCount`、按 `bidId` 的买单档案 getter（bidder/资产/价格/余量/状态）与按 `tokenId` 查询活跃买单的 `bidsByToken` 接口。前端 SHALL 在资产页展示 BUY ORDERS（价格降序）与卖出成交入口，在持仓页展示 My Bids 管理；`bid-filled` 成交 MUST 与既有成交在价格序列、24H 指标与 AI 快照三处以一致口径计入。

#### Scenario: 详情页枚举活跃买单
- **WHEN** 前端按 `tokenId` 查询活跃买单
- **THEN** 返回该资产全部未取消且有余量的买单，价格降序展示，与链上实际一致

#### Scenario: 买单成交进入行情口径
- **WHEN** 一笔 `fillBid` 成交后
- **THEN** 活动流、价格序列、24H 成交量与 AI 快照的最近成交均包含该笔，口径一致

### Requirement: 对抗性安全约束
全部交易函数（含 `placeBid`/`fillBid`/`cancelBid`）MUST 使用 `nonReentrant` 并遵循 checks-effects-interactions；恶意收款方（重入或 revert 拒收的合约）与恶意 bidder（拒收退款、ERC1155 receiver 回调重入或回调 revert 的合约）MUST 不能破坏市场状态或锁死他人资产；活跃买单托管额 MUST 满足守恒不变量（invariant/fuzz 测试覆盖）；owner 权限采用 `Ownable2Step`，`feeBps` 上限 500，且 MUST 不存在可划走用户托管资产（份额或买单 USDC）的管理员函数。

#### Scenario: 恶意收款合约重入被阻止
- **WHEN** 收款方合约在收款回调中重入市场交易函数
- **THEN** 重入调用 revert，原交易状态一致（份额与资金无重复划转）

#### Scenario: ERC1155 回调重入被阻止
- **WHEN** bidder 合约在 `fillBid` 的份额接收回调中重入市场交易函数
- **THEN** 重入调用 revert，买单余量与托管额一致

#### Scenario: 拒收退款的 bidder 只伤自己
- **WHEN** bidder 合约在 `cancelBid` 退款时 revert 拒收
- **THEN** 仅该笔撤单失败，其他用户的买单、挂单与资产不受影响

#### Scenario: 金库地址变更可追溯
- **WHEN** owner 变更金库地址
- **THEN** 发出 `TreasuryUpdated` 事件；设置零地址 revert

### Requirement: 订单簿深度可视化
资产详情页 SHALL 提供统一订单簿与累计深度图，将同一 tokenId 的卖单（listings）与买单（bids）聚合为交易所级盘口。订单簿 SHALL 按价位聚合（同价位多单合并数量并计数），卖侧升序、买侧降序，各档展示沿最优价方向的累计数量；SHALL 呈现 spread 行（mid 价与价差百分比）；SHALL 以背景条按 `cum / maxCumulative` 表示每档累计深度。系统 SHALL 提供独立的累计深度面积图。所有价格与数量换算 MUST 复用现有 unit price / SHARE_SCALE 口径，聚合与累计 MUST 全程使用 bigint。本能力为纯呈现层，MUST NOT 改动挂单/购买/买单/撤单的链上行为。

#### Scenario: 同价位聚合与累计
- **WHEN** 某 tokenId 存在多笔同价位挂单或买单
- **THEN** 订单簿将同价位合并为一档（数量求和、显示订单数），卖侧按价升序、买侧按价降序，各档 TOTAL 为沿最优价方向逐档累加的累计数量

#### Scenario: 双边盘口与 spread
- **WHEN** 卖单与买单双边均存在
- **THEN** spread 行显示 mid 价与 `spread (x.x%)`；深度图以 mid 为中线，买侧向左（绿）、卖侧向右（红），累计量单调递增

#### Scenario: 单边或空盘口降级
- **WHEN** 仅存在买单、仅存在卖单或双边均无
- **THEN** 只渲染存在的一侧，spread 行显示 `—`，深度图相应仅画一侧或显示等待深度的空态，不抛错

#### Scenario: 自有订单标注
- **WHEN** 某价位聚合中含当前地址自己的挂单或买单
- **THEN** 该档展示 `You` 角标

#### Scenario: 点击价位定位明细
- **WHEN** 用户点击订单簿某价位行
- **THEN** 页面平滑滚动到下方对应的卖单表（SELL ORDERS）或买单表（BUY ORDERS）并短暂高亮，现有明细表的成交/撤单交互不受影响

