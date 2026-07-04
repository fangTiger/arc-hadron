# Design: NL 交易助手 v1

> 完整设计见 `docs/plans/2026-07-04-nl-trading-assistant-design.md`。本文件为 OpenSpec 归档留存的技术决策摘要。

## 核心铁律

**LLM 只产出「规范化意图 JSON」，绝不产出最终交易参数或任何数字。** 所有价格/数量/地址/tokenId
由 App 从链上确定性解析；确认卡与结果卡是确定性渲染，不是 LLM 散文。

## 关键技术决策

1. **意图通道与洞察通道正交**：意图路由非流式、单次 JSON 响应（区别于 insight/brief 的 SSE 流式）。
2. **意图 Schema**（LLM 唯一产物）：
   ```ts
   type Intent =
     | { kind: "query_price";    asset: string }
     | { kind: "query_depth";    asset: string }
     | { kind: "query_holdings"; asset?: string }
     | { kind: "query_yield" }
     | { kind: "buy";            asset: string; quantity: number }
     | { kind: "unknown" };
   ```
   非白名单一律降级 `unknown`。采用 DeepSeek JSON mode + 严格 prompt（非 function-calling），依赖面最小。
3. **asset 解析**：LLM 出原始符号/名称字符串 → App 对 registry 确定性匹配（精确 → 大小写不敏感 → 模糊）；
   歧义/未命中给澄清卡，绝不发交易。
4. **买入组装（安全核心）**：`resolveBuy(tokenId, qty)` 纯函数选**最低单价且余量 ≥ qty 的单一来源**；
   无单源满额 → 降级"最多 M 份"确认卡（按钮调整/确认，不做 NL 二次解析）；同价默认取一级。
   Confirm → 现有 wagmi `buyPrimary`/`buy`，`msg.value` 精确计算，复用现有 tx 状态流。
5. **会话无状态**：每条消息独立解析；确认/调整走卡片按钮，不保留 NL 对话记忆（YAGNI）。
6. **安全**：复用 ai-insights 防护（服务端持 key、进程内限流、byte 上限、形状校验）；
   LLM 输出经严格 schema 校验；签名前钱包连接 + Arc testnet 网络守卫。
7. **降级**：无 key 时开发环境 mock 意图解析器（关键词 → canned intent，零网络）、生产 503。

## 验收标准

- **AC1**：面板全局可用；资产页打开时默认带入当前资产上下文。
- **AC2**：读查询（价/深度/持仓/收益）数字与链上一致，无 LLM 幻觉。
- **AC3**：`buy N` 解析单一最优来源；无单源满额时降级"最多 M 份"确认，确认后一笔 tx 成交。
- **AC4**：asset 歧义/未命中给澄清卡而非发交易；非白名单意图回引导话术。
- **AC5**：滥用防护（限流 429 / byte 400 / 形状 400）与无 key 降级（dev mock / prod 503）生效。
- **AC6**：买入复用现有 tx 状态流，拒签/余额不足/revert 均有英文提示且状态可从链上重建。
- **AC7**：TDD 全绿，web 现有 240 测试无回归。
