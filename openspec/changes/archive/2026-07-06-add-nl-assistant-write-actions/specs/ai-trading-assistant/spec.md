## ADDED Requirements

### Requirement: 挂卖意图组装
系统 SHALL 将 `sell` 意图（`sell N <asset> at P`）组装为挂卖交易：解析 asset → tokenId，校验 `N ≤ 当前地址持仓`，校验 price（>0、最多两位小数）。当 price 缺失时，系统 SHALL 追问单价而 MUST NOT 猜测价格。确认卡 SHALL 确定性展示资产、数量、单价、预计所得与**两步授权状态**（`setApprovalForAll` → `list`），并复用现有挂卖交易流。LLM MUST NOT 产出 tokenId 或最终 tx 参数；price 为用户输入，MUST 在确认卡二次确认后才签名。

#### Scenario: 完整挂卖指令
- **WHEN** 用户输入 "sell 5 HADRON at 2.10" 且持仓 ≥ 5
- **THEN** 确认卡展示数量 5、单价 2.10、预计所得与两步授权状态，等待用户确认后经 setApprovalForAll → list 成交

#### Scenario: 缺少价格追问
- **WHEN** 用户输入 "sell 5 HADRON"（未给价）
- **THEN** 助手追问 "At what price per share?"，不发起交易

#### Scenario: 持仓不足拦截
- **WHEN** 挂卖数量超过当前地址持仓
- **THEN** 确认卡提示持仓不足，不发起交易

### Requirement: 撤单意图与消歧
系统 SHALL 将 `cancel` 意图（`cancel my <asset> order`）解析为该地址在此资产的**全部活跃挂卖与买单**，并以消歧卡呈现（每条含侧向、价、量、id）。用户点选一条后，系统 SHALL 对挂卖调用 `cancel(listingId)`（退托管份额）、对买单调用 `cancelBid(bidId)`（退托管 USDC）。当无可撤订单时，系统 SHALL 提示无可撤而 MUST NOT 发起交易。撤单需钱包连接。LLM MUST NOT 产出 listingId / bidId。

#### Scenario: 多单消歧选一
- **WHEN** 用户在某资产同时有活跃挂卖与买单并输入 "cancel my HADRON order"
- **THEN** 消歧卡列出全部可撤订单（挂卖 + 买单），用户点选一条 → 确认 → 对应 cancel / cancelBid 一笔交易

#### Scenario: 无可撤订单
- **WHEN** 当前地址在该资产无任何活跃挂卖或买单
- **THEN** 提示 "No open orders to cancel"，不发起交易

### Requirement: 领取收益意图（单资产与批量）
系统 SHALL 将 `claim` 意图分派为收益领取：带资产时对该 tokenId 调用 `claimYield(tokenId)`；未带资产时 SHALL 汇总当前地址所有 `pendingYield > 0` 的 tokenId 并调用 `claimYieldBatch(tokenIds)`。确认卡 SHALL 确定性展示可领金额（取自链上 `pendingYield`）。当无可领收益时，系统 SHALL 提示无可领而 MUST NOT 发起交易。领取需钱包连接。

#### Scenario: 单资产领取
- **WHEN** 用户输入 "claim my HADRON yield" 且该资产有可领收益
- **THEN** 确认卡展示可领金额，确认后经 claimYield(tokenId) 领取

#### Scenario: 批量领取全部
- **WHEN** 用户输入 "claim my yield"（未带资产）且多个资产有可领收益
- **THEN** 确认卡汇总各资产可领金额，确认后经 claimYieldBatch 一次领取全部

#### Scenario: 无可领收益
- **WHEN** 当前地址无任何可领收益
- **THEN** 提示 "Nothing to claim"，不发起交易

### Requirement: 写动作意图白名单扩展
意图 schema SHALL 新增 `sell`、`cancel`、`claim` 为白名单意图；`deposit`、`transfer` 等超范围写动作 MUST 仍降级为 `unknown`。intentPrompt 与无 key mock 解析器 MUST 同步覆盖新动作。任何不符 schema 的 LLM 输出 MUST 降级为 `unknown`。

#### Scenario: 新写动作被识别
- **WHEN** 用户输入 "sell 5 HADRON at 2.10" / "cancel my HADRON order" / "claim my yield"
- **THEN** 分别解析为 `sell` / `cancel` / `claim` 意图

#### Scenario: 超范围写动作降级
- **WHEN** 用户输入 "deposit 10 USDC yield to HADRON" 或 "transfer ..."
- **THEN** 降级为 `unknown`，回引导话术，不发起交易
