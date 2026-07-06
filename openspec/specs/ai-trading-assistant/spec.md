# ai-trading-assistant Specification

## Purpose
TBD - created by archiving change add-hadron-nl-assistant. Update Purpose after archive.
## Requirements
### Requirement: 全局助手面板与上下文
系统 SHALL 提供一个全局浮动聊天面板（顶栏入口，任何路由可用）；当用户处于资产详情页时，面板 SHALL 默认带入当前资产作为上下文，使"buy 5"这类省略资产名的输入可解析为当前资产。

#### Scenario: 全局可用
- **WHEN** 用户在任意页面点击顶栏助手入口
- **THEN** 面板滞出，可接收自然语言输入

#### Scenario: 资产页上下文带入
- **WHEN** 用户在某资产详情页打开面板并输入省略资产名的指令（如 "buy 5"）
- **THEN** 助手将当前资产作为默认 asset 解析，无需重复指定符号

### Requirement: 意图解析路由
系统 SHALL 提供服务端路由 `POST /api/ai/intent`，以非流式单次 JSON 响应返回归一化意图。LLM（DeepSeek JSON mode）MUST 仅产出白名单意图之一（`query_price` / `query_depth` / `query_holdings` / `query_yield` / `buy` / `unknown`），MUST NOT 产出任何价格、数量之外的链上数字、地址或交易参数。任何不符 schema 的输出 MUST 降级为 `unknown`。

#### Scenario: 合法意图解析
- **WHEN** 用户输入 "what's the lowest ask for HADRON"
- **THEN** 路由返回 `{ kind: "query_price", asset: "HADRON" }`

#### Scenario: 非白名单降级
- **WHEN** LLM 返回不在白名单的结构或无法解析为交易意图的输入
- **THEN** 路由返回 `{ kind: "unknown" }`，前端回引导话术（可做什么），不发起任何交易

### Requirement: 资产确定性匹配
App SHALL 用 LLM 提取的原始符号/名称字符串对 asset registry 做**确定性匹配**（精确 → 大小写不敏感 → 模糊）。匹配歧义或未命中时，系统 MUST 呈现澄清卡（列候选或提示未找到），且 MUST NOT 发起交易。LLM MUST NOT 直接产出 tokenId。

#### Scenario: 精确匹配
- **WHEN** 输入的符号与目录中某资产唯一匹配
- **THEN** 解析为对应 tokenId 并继续意图处理

#### Scenario: 歧义或未命中
- **WHEN** 提取的资产名匹配多个候选或无匹配
- **THEN** 展示澄清卡（候选列表或 "asset not found"），不发起交易

### Requirement: 读查询确定性卡片
系统 SHALL 将读查询意图分派为确定性链上数据读取并渲染结构化卡片；所有展示的数字 MUST 来自链上 getter，MUST NOT 由 LLM 生成。持仓与收益查询 SHALL 要求钱包连接，未连接时提示连接钱包而非报错。

#### Scenario: 价格查询
- **WHEN** 意图为 `query_price` 且资产已解析
- **THEN** 卡片展示该资产一级发行价与二级最低卖/最高买（数字取自链上），无第二次 LLM 调用

#### Scenario: 未连接钱包的持仓查询
- **WHEN** 意图为 `query_holdings` 但钱包未连接
- **THEN** 卡片提示 "Connect wallet to view your holdings"，不报错

### Requirement: 买入意图组装为单一最优来源
系统 SHALL 以纯函数 `resolveBuy(tokenId, quantity)` 扫描一级发行与该资产所有活跃二级卖单，选出**最低单价且余量 ≥ quantity 的单一来源**并组装为一笔交易。当无任何单一来源可满额时，系统 SHALL 降级为"最多可买 M 份 @ 最优价"的确认卡，M 为最优价来源的可成交量；用户通过卡片按钮确认/调整，系统 MUST NOT 对确认进行自然语言二次解析。`quantity` 为显示份额（SHARE_SCALE=100，支持两位小数），提交前 MUST 转换为链上整数单位。

#### Scenario: 单一来源满额
- **WHEN** 存在最低单价且余量 ≥ quantity 的来源
- **THEN** 确认卡展示来源（Primary / Listing #id）、单价、数量、总价、0.5% 协议费提示，等待用户确认

#### Scenario: 无单源满额时降级
- **WHEN** 最优价来源余量 M 小于请求数量
- **THEN** 确认卡降级为 "最多可买 M 份"，用户可确认买 M 或调整数量，不触发 NL 二次解析

### Requirement: 买入签名复用现有交易流
用户在确认卡点击 Confirm 后，系统 SHALL 复用现有钱包交易流（wagmi `buyPrimary`/`buy`，`msg.value` 精确计算）与状态反馈（签名中 → pending → 确认 → explorer 链接）。签名前 MUST 校验钱包连接与 Arc testnet 网络守卫。拒签/余额不足/revert/重复点击 MUST 给出明确英文提示，且状态可从链上重建。LLM MUST NOT 接触私钥、地址或最终 tx 参数。

#### Scenario: 确认后成交
- **WHEN** 用户在确认卡点击 Confirm 并在钱包签名
- **THEN** 依次展示 pending 与确认成功状态，成功 Toast 含 explorer 交易链接

#### Scenario: 网络或钱包守卫
- **WHEN** 用户未连接钱包或处于非 Arc testnet 网络时点击 Confirm
- **THEN** 阻止交易并引导连接/切换网络

### Requirement: 助手滥用防护与无密钥降级
意图路由 MUST 复用 ai-insights 的安全基建：`DEEPSEEK_API_KEY` 仅服务端；进程内滑动窗口限流（每 IP 与全局配额，超限 429 且不调用上游）；JSON 解析前 raw byte 上限校验；输入字段级形状校验（非法 400）。未配置 key 时：开发环境 SHALL 以 mock 意图解析器（关键词 → canned intent，零网络）演示；生产环境 SHALL 返回 503 JSON。

#### Scenario: 高频请求被限流
- **WHEN** 单 IP 短时间内超过配额
- **THEN** 返回 429，DeepSeek 上游零调用

#### Scenario: 本地开发无 key
- **WHEN** 开发者未配置 key 并发送指令
- **THEN** mock 意图解析器正常返回意图，无外部请求

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

### Requirement: 命令菜单与输入引导
助手输入框 SHALL 支持 `/` 命令：当输入以 `/` 开头时，系统 SHALL 弹出可筛选的命令菜单，涵盖 price / depth / holdings / yield / buy / sell / cancel / claim 八个命令（各含简短说明与填入模板）。用户 SHALL 可用 ↑↓ 导航、Enter 或点击选择，选择后系统 SHALL 将对应模板（含 `<asset>` / `<qty>` / `<price>` 占位）填入输入框、关闭菜单并保持输入框焦点；Esc SHALL 关闭菜单。不以 `/` 开头的自然语言输入行为 MUST 保持不变，走同一提交管线。助手头部引导与 `unknown` 兜底话术 MUST 准确覆盖读查询与 buy / sell / cancel / claim，不得仅提及 buying。命令菜单 MUST NOT 改动意图 schema 或生成管线。

#### Scenario: 斜杠弹出并筛选命令
- **WHEN** 用户在输入框输入 `/` 或 `/se`
- **THEN** 弹出命令菜单，`/` 显示全部命令、`/se` 过滤到 `sell`

#### Scenario: 选择命令回填模板
- **WHEN** 用户用 ↑↓ 高亮某命令并按 Enter（或点击）
- **THEN** 对应模板（如 `sell <qty> <asset> at <price>`）填入输入框，菜单关闭，焦点留在输入框待补参数

#### Scenario: Esc 关闭菜单
- **WHEN** 命令菜单打开时用户按 Esc
- **THEN** 菜单关闭，输入内容保留

#### Scenario: 自然语言输入不受影响
- **WHEN** 用户输入不以 `/` 开头的自然语言（如 "buy 5 HADRON"）
- **THEN** 不弹命令菜单，按原有 NL 提交管线处理

