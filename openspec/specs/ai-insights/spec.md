# ai-insights Specification

## Requirements

### Requirement: 资产 AI 洞察生成
系统 SHALL 在资产详情页提供按需的 AI 洞察生成：用户点击 Generate 后，前端将该资产的链上数据快照（元数据、每份显示价、价格序列、24H 变动、挂单深度前 10 档、最近 20 条成交）POST 至服务端路由，服务端调用 DeepSeek 以 SSE 流式返回英文 markdown 简报（含 Outlook / Liquidity / Risk flags 三节与 "AI-generated · testnet demo data · not financial advice" 尾注）。

#### Scenario: 成功生成并流式渲染
- **WHEN** 用户在已加载链上数据的详情页点击 Generate
- **THEN** 面板流式渲染简报，完成后写入 localStorage 缓存（含生成时间与数据指纹）

#### Scenario: 数据不足的资产
- **WHEN** 对无成交记录的新资产生成
- **THEN** 快照合法送出，AI 输出合理描述数据有限，不报错

### Requirement: 市场 AI 日报生成
系统 SHALL 在市场页提供按需的全市场 AI 日报：聚合快照（各资产最新价/24H/成交与挂单概况）经同一 SSE 通道生成英文 markdown（Movers / New listings / Notable trades），交互语义与资产洞察一致。

#### Scenario: 空市场
- **WHEN** 无任何活跃资产或成交时生成
- **THEN** 快照合法，AI 输出描述市场为空，不报错

### Requirement: 按需生成与缓存失效
AI 内容 MUST 仅在用户显式触发时生成；结果缓存于 localStorage（key 含 chainId/市场合约地址/schema 版本），命中时直接展示并显示生成时间。当前链上数据的规范化快照哈希与缓存指纹不符时，系统 SHALL 展示旧内容并提示 "Data changed" 徽章与 Regenerate 按钮，且 MUST NOT 自动重新生成。

#### Scenario: 缓存命中
- **WHEN** 用户回到已生成过洞察且数据未变的页面
- **THEN** 直接显示缓存内容、"Generated Xh ago" 时间戳与 Refresh 按钮，无 API 调用

#### Scenario: 数据变化提示
- **WHEN** 缓存存在但链上数据（成交/挂单/价格）已变化
- **THEN** 显示旧内容 + "Data changed" 徽章与 Regenerate 按钮，无自动调用

#### Scenario: 存储不可用
- **WHEN** localStorage 不可用（隐私模式/配额）
- **THEN** 功能正常但不缓存，静默降级

### Requirement: 密钥与滥用防护
DEEPSEEK_API_KEY MUST 仅存在于服务端环境变量（禁止 NEXT_PUBLIC 前缀与任何前端暴露）。生成路由 MUST：① 进程内滑动窗口限流（每 IP 12 次/分钟与全局 60 次/分钟，超限 429 且不调用上游）；② JSON 解析前执行 raw byte 上限校验（32KB）；③ 字段级形状校验（字符串/数组长度、bigint 字符串格式），非法请求 400。AI 输出 MUST 经受限 markdown 渲染（标题/列表/粗体/段落白名单），禁止 HTML 注入。

#### Scenario: 高频请求被限流
- **WHEN** 单 IP 短时间内超过配额
- **THEN** 返回 429（带 Retry-After），DeepSeek 上游零调用

#### Scenario: 畸形快照被拒绝
- **WHEN** POST 超过 raw byte 上限或形状非法的载荷
- **THEN** 返回 400，不调用上游

### Requirement: 流式传输与中断处理
服务端路由 SHALL 以 `text/event-stream`（`Cache-Control: no-cache, no-transform`，Node runtime，maxDuration 60，上游 55s AbortController 超时）返回 `chunk`/`done`/`error` 三型报文；客户端 SHALL 用 fetch(POST) + ReadableStream 手写解析 SSE 帧（处理分片/半包/多行 data:）。生成进行中 Generate 按钮 MUST 禁用；组件卸载或发起新请求时 MUST 中止旧请求；流在收到 `done` 帧前结束（截断）时客户端 MUST 视为错误且 MUST NOT 写入缓存；服务端感知客户端断开后 SHALL 中止上游请求。

#### Scenario: 生成中离开页面
- **WHEN** 流式进行中用户导航离开
- **THEN** 客户端与上游请求均中止，无缓存写入

#### Scenario: 流被截断
- **WHEN** SSE 连接在收到部分 chunk 后无 done/error 帧即关闭
- **THEN** 面板显示 "Generation interrupted" 错误态，残缺内容不入缓存

#### Scenario: 上游失败
- **WHEN** DeepSeek 超时/限流/5xx
- **THEN** SSE error 报文，面板显示错误信息与 Retry 按钮，页面其余功能不受影响

### Requirement: 无密钥降级
未配置 DEEPSEEK_API_KEY 时：开发环境 SHALL 以内置 mock 流完整演示交互（零网络调用，Insight/Brief 各有匹配的三节结构变体）；生产环境 SHALL 在开流前返回 503 JSON（"AI is not configured"）。

#### Scenario: 本地开发无 key
- **WHEN** 开发者未配置 key 并点击 Generate
- **THEN** mock 流正常渲染全流程，无外部请求
