# NL 交易助手 v1 — 设计文档

> 日期：2026-07-04
> 状态：设计已确认，待 OpenSpec 提案
> 类型：大任务（跨模块，多会话）
> 分工：Claude 设计/审查/取证，codex exec 实现（TDD）

## 1. 背景与目标

现有 AI 层（`add-hadron-ai-layer`，2026-07-03 归档）提供的是**流式散文洞察**通道：
资产/市场快照 → DeepSeek → SSE 流式 markdown。该设计当时显式预留了"NL 交易助手"作为单独立项。

本变更在此之上新增一条**结构化意图**通道：自然语言输入 → LLM 意图解析 → App 确定性执行
（读查询渲染卡片 / 买入组装交易 → 钱包签名）。

**范围（v1）**
- 读查询：最低卖价 / 最高买价 / 盘口深度、我的持仓、我的未领收益、资产元数据
- 写动作：买入（一级发行或单条二级卖单，单一最优来源满额成交）

**纯 web/AI 层工作，零合约改动**：读用现有 getter，买用现有 `buyPrimary` / `buy`。

## 2. 核心铁律

**LLM 只产出「规范化意图 JSON」，绝不产出最终交易参数或任何数字。**

所有价格 / 数量 / 地址 / tokenId 由 App 从链上确定性解析；确认卡与结果卡是确定性渲染，
不是 LLM 散文。这样把 LLM 的不可靠性严格隔离在签名与展示的数字之外。

## 3. 架构与数据流

```
用户输入（全局浮动面板）
  → POST /api/ai/intent  （非流式，单次 JSON 响应）
      LLM (DeepSeek JSON mode) → { kind, asset?, quantity? }
      服务端严格 schema 校验 → 归一化意图（非白名单 → unknown）
  → 客户端 intent 分派器
      ├─ query_*  → 拿链上数据 → 渲染确定性结果卡片
      └─ buy      → resolveBuy 确定性解析最优单一来源 → 确认卡（价/量/费/来源）
                    → 用户 Confirm → 现有 wagmi write（buyPrimary / buy）
                    → 复用现有 tx 状态流（pending → 确认 → explorer 链接）
```

**入口**：全局浮动面板（顶栏按钮 → 右侧/底部滞出），任何路由可用；
当前路由为资产页时，默认带入该资产作为上下文。

## 4. 模块划分（沿用现有命名与目录约定）

**新增**
- `web/app/api/ai/intent/route.ts` — 意图解析路由（非流式，单次 JSON）
- `web/lib/ai/intent.ts` — 意图 schema、类型、严格校验 guard、mock 解析器
- `web/lib/ai/intentPrompt.ts` — system prompt（约束 LLM 只输出白名单 intent 的 JSON）
- `web/lib/ai/resolveBuy.ts` — 确定性"最优单一来源"解析（纯函数，可单测）
- `web/components/assistant/AssistantPanel.tsx` 及配套结果卡 / 确认卡组件

**复用**
- `web/lib/ai/rateLimit.ts`、raw byte 上限、输入形状校验（从 `routeShared.ts` 提取共享部分）
- `web/lib/llm/deepseek.ts` 客户端工厂与 mock 模式（扩展 mock 以支持意图解析形态）
- 现有钱包 / 交易 hook 与 tx 状态流（trading-flow 能力）

## 5. 意图 Schema（LLM 唯一产物）

```ts
type Intent =
  | { kind: "query_price";    asset: string }   // 最低卖 / 最高买 / 最新价
  | { kind: "query_depth";    asset: string }   // 盘口深度前 N 档
  | { kind: "query_holdings"; asset?: string }  // 我的持仓（全仓或单资产）
  | { kind: "query_yield" }                     // 我的未领收益
  | { kind: "buy";            asset: string; quantity: number }
  | { kind: "unknown" };                        // 兜底 → 引导话术
```

- `asset` 是 LLM 提取的**原始符号 / 名称字符串**；App 用它对 asset registry 做确定性匹配
  （精确 → 大小写不敏感 → 模糊）。歧义 / 未命中 → 澄清卡（列候选或"未找到该资产"），**不**发交易。
- 任何不符 schema 的 LLM 输出一律降级为 `unknown`，回引导话术
  （"I can help with prices, depth, your holdings, yield, and buying."）。
- 采用 **DeepSeek JSON mode + 严格 prompt**（而非 function-calling）：与现有 DeepSeek 客户端
  一致、依赖面最小。`quantity` 为显示份额，支持两位小数（SHARE_SCALE=100），提交前转链上整数单位。

## 6. 读查询流程

意图分派 → 确定性取链上数据 → 渲染结构化卡片。数字全部来自链上 getter，无第二次 LLM 调用、零幻觉。

- `query_price` → 该 token 一级发行价 + 二级最低卖 / 最高买
- `query_depth` → 盘口前 N 档（复用订单簿深度数据源）
- `query_holdings` → 需钱包连接；读当前地址持仓（可全仓或单资产）
- `query_yield` → 需钱包连接；读未领收益

未连接钱包的持仓 / 收益查询 → 卡片提示"Connect wallet to view your holdings"。

## 7. 买入流程（安全核心）

1. 意图 `{buy, asset, quantity}` → 解析 asset → tokenId。
2. `resolveBuy(tokenId, qty)` 纯函数扫描一级发行 + 该 token 所有活跃二级卖单，
   选**最低单价且余量 ≥ qty 的单一来源**（一级与二级同价时的优先级在实现时定，默认价优先、同价取一级）。
3. 若无单一来源可满额 → 确认卡降级为"最多可买 M 份 @ 最优价，是否买 M？"
   （用户在卡上调整 / 确认，**不**做 NL 二次解析）。
4. 确认卡确定性展示：来源类型（Primary / Listing #id）、单价、数量、总价、0.5% 协议费提示、
   钱包连接与 Arc testnet 网络守卫。
5. 用户 Confirm → 现有 wagmi `buyPrimary(offeringId, qty)` 或 `buy(listingId, qty)`，
   `msg.value` 精确计算 → 复用现有交易状态流与失败处理（拒签 / 余额不足 / revert / 重复点击防抖）。

**会话无状态**：每条消息独立解析意图；仅"确认 / 调整"通过卡片按钮完成，不保留 NL 对话记忆（YAGNI）。

## 8. 安全与滥用防护

复用 ai-insights 已有防护：
- `DEEPSEEK_API_KEY` 仅服务端环境变量（禁 `NEXT_PUBLIC` 前缀）。
- 意图路由：进程内滑动窗口限流（每 IP / 全局配额，超限 429 且不调用上游）、
  raw byte 上限（JSON 解析前）、输入形状校验（非法 400）。
- LLM 输出经严格 JSON schema 校验，非白名单 intent 一律 `unknown`。
- 签名前钱包连接 + Arc testnet 网络守卫。
- **LLM 从不接触私钥、地址或最终 tx 参数。**

## 9. 无密钥降级

- 无 key：开发环境 mock 意图解析器（关键词 → canned intent，零网络调用）；生产环境开流前 503 JSON。
- 与现有 `deepseek.ts` 的 mock 模式一致，扩展以覆盖意图解析形态。

## 10. 测试策略（TDD）

- `resolveBuy` 纯函数单测：满额 / 降级 / 多来源选优 / 售罄 / 一级二级同价优先级。
- 意图 schema 校验单测：白名单通过、非法降级 unknown、asset 匹配（精确 / 模糊 / 歧义 / 未命中）。
- 意图路由测试：限流 429、byte 上限 400、形状非法 400、无 key mock。
- 面板组件测试：渲染各类结果卡、buy 确认卡触发 wagmi write、未连钱包降级提示。
- 目标：web 测试栈（vitest）保持全绿，不回归现有 240 测试。

## 11. 不在 v1 范围（Out of Scope）

- 写动作：挂卖（list）/ 撤单（cancel）/ 入金（deposit yield）/ 领取（claim）。
- 跨档扫单（多 tx 凑单）。
- NL 多轮对话记忆 / 上下文指代（"改成 3 份"这类需历史的表达）。
- LLM 措辞的回答（数字一律确定性卡片）。
- 语音输入、订单簿 v2 视觉升级、任何合约改动。

## 12. 验收标准（Acceptance Criteria）

- **AC1**：面板全局可用；资产页打开时默认带入当前资产上下文。
- **AC2**：读查询（价 / 深度 / 持仓 / 收益）返回的数字与链上一致，无 LLM 幻觉。
- **AC3**：`buy N` 解析为单一最优来源；无单源满额时降级为"最多 M 份"确认，用户确认后一笔 tx 成交。
- **AC4**：asset 歧义 / 未命中给澄清卡而非发交易；非白名单意图回引导话术。
- **AC5**：滥用防护（限流 429 / byte 400 / 形状 400）与无 key 降级（dev mock / prod 503）生效。
- **AC6**：买入复用现有 tx 状态流，拒签 / 余额不足 / revert 均有英文提示且状态可从链上重建。
- **AC7**：TDD 全绿，web 现有 240 测试无回归。
