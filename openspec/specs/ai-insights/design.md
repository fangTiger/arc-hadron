# HADRON AI 层设计 — DeepSeek Asset Insight + Market Brief

> 状态：设计已获用户口头批准（2026-07-03）；Codex 交叉验证意见（1 BLOCKER + 6 SHOULD-FIX + 1 NIT）已全部吸收，修订记录见文末。范围决策：Insight + Brief 本期一起做；按需生成 + 缓存；AI 输出英文。NL 交易助手不在本期（最后单独立项）。

## Context

HADRON MVP（M1-M5）已归档。本期为路线图新方向第一弹：给交易所加只读 AI 分析能力，复用 arc-lepton 已验证的 DeepSeek 基建（OpenAI 兼容客户端、mock 降级、SSE 流式）。arc-hadron web 无数据库、无服务端链上读取——全部链上数据在浏览器事件层（分块扫描 + localStorage 缓存）。

## Goals / Non-Goals

**Goals**
- 资产详情页 Asset Insight：单资产 AI 简报（Outlook / Liquidity / Risk flags）
- 市场页 Market Brief：全市场 AI 日报（Movers / New listings / Notable trades）
- 按需生成（Generate 按钮）+ localStorage 缓存 + 数据指纹失效提示
- SSE 流式渲染；无 key 时 mock 降级（开发/测试零成本）

**Non-Goals**
- NL 交易助手（涉及资金操作，单独立项）
- 服务端链上数据读取 / 数据库持久化
- AI 输出的多语言切换（英文单语）

## 架构决策（方案 A：客户端带数据 + 服务端流式转发）

浏览器 POST 紧凑链上快照 → Next.js API 路由（持有 DEEPSEEK_API_KEY，服务端专属）→ DeepSeek 流式 → SSE 回传 → 客户端流式渲染 + 缓存。

**信任边界（显式声明）**：快照由客户端提供，可被伪造；本功能为展示性 AI 简报而非风控/结算依据，可接受。路由仅校验形状与大小（防滥用），不校验数据真实性。

否决项：服务端自扫链（重复建设整套事件层，违背 YAGNI）；浏览器直调 DeepSeek（密钥泄漏，安全否决）。

## 组件清单

| 模块 | 职责 |
|------|------|
| `web/lib/llm/deepseek.ts` | 从 arc-lepton 移植：OpenAI 兼容 SDK、`DEEPSEEK_API_KEY/BASE_URL/MODEL` env、无 key 时 mock 流（生产无 key 则报错） |
| `web/lib/ai/snapshot.ts` | 纯函数：链上数据 → 紧凑 JSON 快照。bigint→字符串、价格换算每份显示价（SHARE_SCALE=100）、成交截断最近 20 条、挂单截断前 10 档，单快照 ≤ 8KB |
| `web/lib/ai/fingerprint.ts` | 纯函数：对**规范化后的完整快照**做稳定哈希（非仅关键字段——同数量不同内容的挂单/成交也要触发失效） |
| `web/lib/ai/rateLimit.ts` | 进程内滑动窗口限流：每 IP N 次/分钟 + 全局 M 次/分钟，超限返回 429 且**不调用上游**；文档化限制：多实例部署需换共享存储（本项目当前排除部署，单实例假设成立） |
| `web/lib/ai/prompts.ts` | 两个英文 prompt 模板；system 约束：结构化 markdown、testnet 演示数据、"not financial advice" 尾注、禁编造快照外数据 |
| `web/app/api/ai/insight/route.ts` | POST 单资产快照 → 限流 → **JSON parse 前 raw byte 上限（32KB）** → 手写形状校验（不引入 zod；含字符串/数组长度与 bigint 字符串格式约束）→ DeepSeek 流式 → SSE（`chunk`/`done`/`error` 三型报文）。`export const runtime = "nodejs"`、`maxDuration = 60`；上游用 AbortController 设 55s 超时并在客户端断开时中止；响应头 `Content-Type: text/event-stream` + `Cache-Control: no-cache, no-transform` |
| `web/app/api/ai/brief/route.ts` | 同上，市场级快照（最坏情况 14 资产快照大小需测试实证 ≤ 上限） |
| `web/lib/ai/useAiGeneration.ts` | 客户端 hook：**`fetch(POST)` + `response.body` ReadableStream + TextDecoder 手写 SSE 帧解析**（EventSource 不支持 POST，明确排除）；需处理分片帧/半包/多行 data:；状态机（idle→streaming→done\|error）+ AbortController（重复点击禁用 + 组件卸载中止）+ localStorage 缓存读写（storage 不可用时静默降级为不缓存） |
| `web/components/ai/InsightPanel.tsx` | 详情页面板（AssetProfile 与 SELL ORDERS 之间）：Generate / 流式渲染 / 缓存命中显示 "Generated Xh ago · Refresh" / 指纹变化提示 "Data changed · Regenerate" |
| `web/components/ai/MarketBrief.tsx` | 市场页面板（ACTIVITY 上方），同一交互模式 |
| `web/components/ai/AiMarkdown.tsx` | 受限 markdown 渲染（标题/列表/粗体/段落白名单，无 HTML 注入面） |

## 缓存与失效

- key：`hadron:ai:insight:v1:<chainId>:<market地址>:<tokenId>` / `hadron:ai:brief:v1:<chainId>:<market地址>`（含快照 schema 版本于 v1 段）
- 值：`{ markdown, generatedAt, dataFingerprint }`
- 命中：直接渲染 + 时间戳；指纹不符：仍显示旧文 + "Data changed · Regenerate" 徽章；**不自动重生成**（成本控制）
- 缓存损坏/版本不符：静默丢弃回到 Generate 初始态

## 错误与降级

- 无 key：开发 mock 流（arc-lepton 语义）；生产在开流前直接返回 **503 JSON**（便于监控，不伪装成 SSE）
- DeepSeek 超时（55s AbortController）/限流/5xx：SSE error 报文 → 面板 "Generation failed · Retry"，不影响页面其余部分
- 本服务限流触发：**429 JSON**（开流前），面板显示 "Too many requests · try later"
- SSE 中途断开 / 组件卸载：客户端 abort，已收部分丢弃不入缓存；服务端感知断开后中止上游请求
- 快照超限/形状非法：路由 400
- 并发防护：streaming 期间 Generate 按钮禁用；新请求前中止旧请求

## 测试策略（TDD）

- 纯函数单测：snapshot（截断/换算/**空市场与无成交资产**/最坏情况 14 资产大小实证）、fingerprint（稳定性/内容级变化敏感）、prompts（关键约束词存在）、**SSE 帧解析（分片/半包/多行 data:/error/done）**、rateLimit（窗口滑动/429 边界）
- 路由测试：mock DeepSeek 客户端 → SSE 帧序列（chunk×N → done）、无 key 503、限流 429、raw byte 超限 400、形状非法 400、上游错误 → SSE error
- 组件测试：Generate 触发、流式中间态、缓存命中态、指纹过期徽章、错误重试态、**并发点击禁用、卸载中止、storage 不可用降级**（沿用现有 mock hooks 模式）
- 全量回归：现有 151 用例不破坏

## 安全清单（宪章第 3 条）

- [x] 密钥仅服务端 env（无 NEXT_PUBLIC 前缀），复用 arc-lepton 的 key（用户已确认可复用，需人工复制到 `web/.env.local`）；`web/.env.example` 同步补 `DEEPSEEK_*` 变量名
- [x] 限流：每 IP + 全局滑动窗口配额，429 且不调上游；多实例部署前提（共享存储限流）文档化——当前项目排除部署，单实例假设成立（Claude 决策记录：进程内限流与实际运行形态匹配，避免为未立项的部署预建 Redis 依赖）
- [x] 路由 raw byte 上限（parse 前）+ 字段级形状校验（防 token 滥用与畸形输入）
- [x] AI 输出受限 markdown 渲染，无 dangerouslySetInnerHTML
- [x] 输出恒带 "AI-generated · testnet illustrative data · not financial advice" 尾注
- [x] 信任边界声明：快照客户端可伪造，功能定位为展示性简报

## 验收标准（Clarify Gate 产出）

1. **GIVEN** 详情页已加载链上数据 **WHEN** 点击 Generate **THEN** 面板流式输出英文简报（含 Outlook/Liquidity/Risk flags 三节与免责尾注），完成后刷新页面直接显示缓存及生成时间
2. **GIVEN** 已有缓存且链上数据变化（新成交/挂单）**WHEN** 回到页面 **THEN** 显示旧简报 + "Data changed · Regenerate" 徽章，不自动调用 API
3. **GIVEN** 未配置 DEEPSEEK_API_KEY 的本地开发 **WHEN** 点击 Generate **THEN** mock 流正常演示全交互，无网络调用
4. **GIVEN** DeepSeek 请求失败 **WHEN** 生成中断 **THEN** 面板显示 Retry，页面其余功能不受影响，损坏内容不入缓存
5. 市场页 Market Brief 同 1-4（快照为全市场聚合）
6. **GIVEN** 无成交的新资产或空市场 **WHEN** 生成 **THEN** 快照合法、AI 输出合理描述数据不足，不报错
7. **GIVEN** 生成进行中 **WHEN** 再次点击 Generate 或离开页面 **THEN** 按钮禁用 / 请求中止，无重复计费调用
8. **GIVEN** 单 IP 短时间高频请求 **WHEN** 超过配额 **THEN** 429 且上游零调用
9. 全量测试/lint/build 通过，现有用例零回归

## 修订记录（Codex 交叉验证吸收，2026-07-03）

- [BLOCKER→已解] 公开路由防刷：新增 lib/ai/rateLimit.ts（每 IP + 全局滑动窗口，429 不调上游）；多实例限制文档化（部署已排除，Claude 决策理由见安全清单）
- [SHOULD-FIX→已解] 客户端传输写死 fetch(POST)+ReadableStream 手写 SSE 解析（EventSource 不支持 POST）；补分片/半包测试
- [SHOULD-FIX→已解] 路由声明 runtime=nodejs / maxDuration=60 / 55s AbortController / 断开中止上游 / SSE 响应头固定
- [SHOULD-FIX→已解] 指纹改为规范化完整快照哈希；缓存 key 纳入 chainId/合约地址/schema 版本
- [SHOULD-FIX→已解] raw byte 上限前置 + 字段级校验 + Brief 最坏情况大小实证测试
- [SHOULD-FIX→已解] 边界条件进验收标准（6/7/8）与测试策略（空数据/并发/中止/storage 降级）
- [SHOULD-FIX→已解] `openai` 依赖显式列入实现任务（Claude 预装）+ .env.example 更新
- [NIT→已解] 生产无 key 改为开流前 503 JSON

## 实现期决策附录（2026-07-03，实现与 5.2 交叉检查产出）

- **限流阈值定值**：设计原为 N/M 占位，实现定为每 IP 12 次/分钟、全局 60 次/分钟（`web/lib/ai/routeShared.ts` 常量导出，测试可注入/重置）
- **XFF 信任边界**：Next.js 路由处理器拿不到 socket 地址，`x-forwarded-for` 为唯一来源信号（取首段，缺省 "unknown"）。直接暴露公网时该头可伪造以绕过每 IP 配额，全局配额兜底；仅应部署在可信代理之后。本项目为 testnet 演示，不做公网直连部署（Claude 决策记录）
- **共享路由管线**：insight/brief 两路由为薄封装，校验/限流/流式逻辑集中于 `routeShared.ts`（参数化 prompt 构建器 + 形状校验器）
- **SSE 服务端幂等守卫**：`streamClosed` 标志 + safeEnqueue/safeClose，客户端断开/55s 超时/上游异常交叠时不依赖流机制吞异常
- **客户端 done 门禁**：流 EOF 未见 `done` 帧视为截断（"Generation interrupted"），残缺内容不入缓存
- **priceSeries 截断**：快照构建端限最新 300 点（路由形状校验上限 500、请求体 32KB，留余量）
- **mock 双形态**：无 key mock 依据 system 提示含 "Movers" 输出 Brief 三节变体，否则输出 Insight 变体
- **面板布局**：时间戳 "Generated Xh ago" 为按钮左侧 meta 文本（按钮仅短动词，防窄栏溢出）；markdown 正文限宽 70ch
- **useAllListings 轮询成本**：沿用现有 useMyListings multicall 惯例；listing 规模增长后的分块/缓存优化留待买单深度里程碑
