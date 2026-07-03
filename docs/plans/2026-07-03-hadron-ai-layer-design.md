# HADRON AI 层设计 — DeepSeek Asset Insight + Market Brief

> 状态：设计已获用户口头批准（2026-07-03）。范围决策：Insight + Brief 本期一起做；按需生成 + 缓存；AI 输出英文。NL 交易助手不在本期（最后单独立项）。

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
| `web/lib/ai/fingerprint.ts` | 纯函数：快照关键字段（最新价/挂单数/成交数/24H）→ 稳定哈希字符串 |
| `web/lib/ai/prompts.ts` | 两个英文 prompt 模板；system 约束：结构化 markdown、testnet 演示数据、"not financial advice" 尾注、禁编造快照外数据 |
| `web/app/api/ai/insight/route.ts` | POST 单资产快照 → 手写形状校验（不引入 zod，项目无此依赖）+ 大小上限 → DeepSeek 流式 → SSE（`chunk`/`done`/`error` 三型报文） |
| `web/app/api/ai/brief/route.ts` | 同上，市场级快照 |
| `web/lib/ai/useAiGeneration.ts` | 客户端 hook：POST + SSE 解析 + 状态机（idle→streaming→done\|error）+ localStorage 缓存读写 |
| `web/components/ai/InsightPanel.tsx` | 详情页面板（AssetProfile 与 SELL ORDERS 之间）：Generate / 流式渲染 / 缓存命中显示 "Generated Xh ago · Refresh" / 指纹变化提示 "Data changed · Regenerate" |
| `web/components/ai/MarketBrief.tsx` | 市场页面板（ACTIVITY 上方），同一交互模式 |
| `web/components/ai/AiMarkdown.tsx` | 受限 markdown 渲染（标题/列表/粗体/段落白名单，无 HTML 注入面） |

## 缓存与失效

- key：`hadron:ai:insight:v1:<tokenId>` / `hadron:ai:brief:v1`
- 值：`{ markdown, generatedAt, dataFingerprint }`
- 命中：直接渲染 + 时间戳；指纹不符：仍显示旧文 + "Data changed · Regenerate" 徽章；**不自动重生成**（成本控制）
- 缓存损坏/版本不符：静默丢弃回到 Generate 初始态

## 错误与降级

- 无 key：开发 mock 流（arc-lepton 语义）；生产返回 SSE error（"AI is not configured"）
- DeepSeek 超时（60s）/限流/5xx：SSE error 报文 → 面板 "Generation failed · Retry"，不影响页面其余部分
- SSE 中途断开：已收部分丢弃，不入缓存
- 快照超限/形状非法：路由 400

## 测试策略（TDD）

- 纯函数单测：snapshot（截断/换算/大小上限）、fingerprint（稳定性/变化敏感）、prompts（关键约束词存在）、SSE 帧解析
- 路由测试：mock DeepSeek 客户端 → 断言 SSE 帧序列（chunk×N → done）与错误路径（无 key/超限/上游错误）
- 组件测试：Generate 触发、流式中间态、缓存命中态、指纹过期徽章、错误重试态（沿用现有 mock hooks 模式）
- 全量回归：现有 151 用例不破坏

## 安全清单（宪章第 3 条）

- [x] 密钥仅服务端 env（无 NEXT_PUBLIC 前缀），复用 arc-lepton 的 key（用户已确认可复用，需人工复制到 `web/.env.local`）
- [x] 路由快照大小/形状校验（防 token 滥用与畸形输入）
- [x] AI 输出受限 markdown 渲染，无 dangerouslySetInnerHTML
- [x] 输出恒带 "AI-generated · testnet demo data · not financial advice" 尾注
- [x] 信任边界声明：快照客户端可伪造，功能定位为展示性简报

## 验收标准（Clarify Gate 产出）

1. **GIVEN** 详情页已加载链上数据 **WHEN** 点击 Generate **THEN** 面板流式输出英文简报（含 Outlook/Liquidity/Risk flags 三节与免责尾注），完成后刷新页面直接显示缓存及生成时间
2. **GIVEN** 已有缓存且链上数据变化（新成交/挂单）**WHEN** 回到页面 **THEN** 显示旧简报 + "Data changed · Regenerate" 徽章，不自动调用 API
3. **GIVEN** 未配置 DEEPSEEK_API_KEY 的本地开发 **WHEN** 点击 Generate **THEN** mock 流正常演示全交互，无网络调用
4. **GIVEN** DeepSeek 请求失败 **WHEN** 生成中断 **THEN** 面板显示 Retry，页面其余功能不受影响，损坏内容不入缓存
5. 市场页 Market Brief 同 1-4（快照为全市场聚合）
6. 全量测试/lint/build 通过，现有用例零回归
