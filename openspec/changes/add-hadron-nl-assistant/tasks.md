# Tasks: NL 交易助手 v1

> TDD 强制（RED-GREEN-REFACTOR）。web 测试命令：`cd web && npm test`；lint：`npm run lint`；build：`npm run build`。
> 每个实现步骤先写失败测试（RED），再实现至通过（GREEN）。全程保持现有 240 测试无回归。

## 1. 意图 Schema 与校验（纯逻辑，先行）

- [ ] 1.1 RED：`web/test/ai-intent-schema.test.ts` — 断言 `parseIntent`/`isValidIntent` 对合法白名单意图通过、对非白名单/畸形输出降级为 `{ kind: "unknown" }`、对 `buy` 校验 `quantity>0` 且最多两位小数
- [ ] 1.2 GREEN：`web/lib/ai/intent.ts` — 定义 `Intent` 联合类型（query_price/query_depth/query_holdings/query_yield/buy/unknown）、严格 schema 校验 guard，非白名单一律 `unknown`
- [ ] 1.3 验证：`cd web && npm test -- ai-intent-schema`

## 2. 资产确定性匹配（纯函数）

- [ ] 2.1 RED：`web/test/ai-asset-match.test.ts` — 精确匹配、大小写不敏感、模糊匹配、歧义（多候选）、未命中，各返回预期结果（命中 tokenId / 候选列表 / null）
- [ ] 2.2 GREEN：在 `web/lib/ai/intent.ts` 或 `web/lib/ai/assetMatch.ts` 实现 `matchAsset(query, registry)` 纯函数（精确 → 大小写 → 模糊）
- [ ] 2.3 验证：`cd web && npm test -- ai-asset-match`

## 3. resolveBuy 最优单一来源（安全核心纯函数）

- [ ] 3.1 RED：`web/test/ai-resolve-buy.test.ts` — 覆盖：单一来源满额（返回来源+价+量）、无单源满额→降级返回最优价的可成交量 M、多来源选最低价、售罄来源排除、一二级同价默认取一级
- [ ] 3.2 GREEN：`web/lib/ai/resolveBuy.ts` — `resolveBuy(tokenId, quantity, { primaryOffering, listings })` 纯函数，返回 `{ source, pricePerShare, fillable }`；显示份额 → 链上单位转换（SHARE_SCALE=100）在此明确
- [ ] 3.3 验证：`cd web && npm test -- ai-resolve-buy`

## 4. 意图 prompt 与 DeepSeek mock 扩展

- [ ] 4.1 `web/lib/ai/intentPrompt.ts` — system prompt：约束 LLM 只输出白名单 intent 的严格 JSON（DeepSeek JSON mode），给出 few-shot 示例
- [ ] 4.2 RED：`web/test/ai-intent-mock.test.ts` — 断言无 key 时 mock 意图解析器按关键词返回对应 canned intent（price/depth/holdings/yield/buy/unknown）
- [ ] 4.3 GREEN：扩展 `web/lib/llm/deepseek.ts` mock 模式以支持意图解析形态（关键词 → canned intent），保持现有 insight/brief mock 不回归
- [ ] 4.4 验证：`cd web && npm test -- ai-intent-mock`

## 5. 意图路由（复用安全基建）

- [ ] 5.1 从 `web/lib/ai/routeShared.ts` 提取可复用的 rate limit / byte 上限 / 形状校验为共享工具（不破坏现有 insight/brief 路由）
- [ ] 5.2 RED：`web/test/ai-intent-route.test.ts` — 断言：合法请求返回归一化意图 JSON；超配额 429 且上游零调用；超 byte 上限 400；形状非法 400；无 key dev 走 mock、prod 返回 503
- [ ] 5.3 GREEN：`web/app/api/ai/intent/route.ts` — 非流式单次 JSON 响应，串接限流→byte→形状→LLM(JSON mode)→schema 校验→归一化意图
- [ ] 5.4 验证：`cd web && npm test -- ai-intent-route`

## 6. 助手面板 UI 与卡片

- [ ] 6.1 RED：`web/test/assistant-panel.test.tsx` — 渲染面板；输入分派后渲染对应结果卡（price/depth/holdings/yield）；unknown → 引导话术；asset 歧义/未命中 → 澄清卡
- [ ] 6.2 GREEN：`web/components/assistant/AssistantPanel.tsx` + 结果卡组件（数字取自链上 hook，非 LLM）
- [ ] 6.3 RED：`web/test/assistant-buy-card.test.tsx` — buy 确认卡展示来源/单价/数量/总价/0.5% 费；Confirm 触发 wagmi write（mock）；无单源满额降级"最多 M 份"；未连钱包/错网络守卫
- [ ] 6.4 GREEN：`web/components/assistant/BuyConfirmCard.tsx` — 复用现有钱包/交易 hook 与 tx 状态流
- [ ] 6.5 验证：`cd web && npm test -- assistant`

## 7. 全局挂载与上下文

- [ ] 7.1 顶栏入口 + 全局挂载面板（任意路由可用）；资产详情页打开时默认带入当前资产上下文
- [ ] 7.2 RED/GREEN：`web/test/assistant-context.test.tsx` — 资产页省略资产名的 "buy 5" 解析为当前资产
- [ ] 7.3 验证：`cd web && npm test -- assistant-context`

## 8. 终审验证

- [ ] 8.1 全量测试：`cd web && npm test`（现有 240 + 新增全绿，无回归）
- [ ] 8.2 lint：`cd web && npm run lint`（干净）
- [ ] 8.3 build：`cd web && npm run build`（通过）
- [ ] 8.4 逐条核对 design.md AC1-AC7，取证记录
