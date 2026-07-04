# Tasks: NL 交易助手 v2 — 写动作扩展

> TDD 强制（RED-GREEN-REFACTOR）。web 测试：`cd web && npm test`；lint：`npm run lint`；build：`npm run build`。
> 纯前端，复用现有 hook 与 v1 意图框架，零合约改动。保持现有 295 测试无回归。

## 1. 意图 Schema 扩展

- [ ] 1.1 RED：`web/test/ai-intent-schema.test.ts` 增补 — sell（asset+quantity，price 可选，>0 两位小数）、cancel（asset）、claim（asset 可选）白名单通过；deposit/transfer 仍降级 unknown
- [ ] 1.2 GREEN：扩展 `web/lib/ai/intent.ts` 的 `Intent` 联合类型与 `isValidIntent`（新增 sell/cancel/claim 分支）
- [ ] 1.3 验证：`cd web && npm test -- ai-intent-schema`

## 2. 意图 prompt 与 mock 扩展

- [ ] 2.1 `web/lib/ai/intentPrompt.ts` — few-shot 覆盖 sell/cancel/claim；明确 deposit/transfer → unknown
- [ ] 2.2 RED：`web/test/ai-intent-mock.test.ts` 增补 — sell/cancel/claim 关键词返回对应 intent；deposit 仍 unknown
- [ ] 2.3 GREEN：扩展 `web/lib/llm/deepseek.ts` mock 意图解析器（sell 提取 quantity+price+asset；cancel 提取 asset；claim 提取可选 asset）
- [ ] 2.4 验证：`cd web && npm test -- ai-intent-mock`

## 3. resolveCancelableOrders（纯函数）

- [ ] 3.1 RED：`web/test/ai-resolve-cancelable.test.ts` — 按地址过滤该 token 的活跃挂卖 + 买单；多单列举（含侧/价/量/id）；仅一侧；空返回空；已成交/已撤排除
- [ ] 3.2 GREEN：`web/lib/ai/resolveCancelable.ts` — `resolveCancelableOrders(tokenId, address, { listings, bids })` 返回 `Array<{ side, id, price, size }>`
- [ ] 3.3 验证：`cd web && npm test -- ai-resolve-cancelable`

## 4. resolveClaimable（纯函数）

- [ ] 4.1 RED：`web/test/ai-resolve-claimable.test.ts` — 无资产汇总所有 pendingYield>0 的 tokenId 与金额；单资产返回该 token 可领；无可领返回空；金额取自 pending 入参
- [ ] 4.2 GREEN：`web/lib/ai/resolveClaimable.ts` — `resolveClaimable(address, { pending, asset? })` 返回 `{ entries: Array<{ tokenId, amount }>, total }`
- [ ] 4.3 验证：`cd web && npm test -- ai-resolve-claimable`

## 5. 确认卡组件

- [ ] 5.1 RED：`web/test/assistant-sell-card.test.tsx` — 展示数量/单价/预计所得/两步授权；持仓不足拦截；缺价追问态；未连钱包/错网络守卫；Confirm 触发 useListForSale（mock）
- [ ] 5.2 GREEN：`web/components/assistant/SellConfirmCard.tsx`
- [ ] 5.3 RED：`web/test/assistant-cancel-card.test.tsx` — 列出可撤挂卖+买单，选一触发对应 cancel/cancelBid（mock）；无可撤降级提示；未连钱包守卫
- [ ] 5.4 GREEN：`web/components/assistant/CancelDisambiguationCard.tsx`
- [ ] 5.5 RED：`web/test/assistant-claim-card.test.tsx` — 单资产展示可领并触发 claimYield；无资产汇总触发 claimYieldBatch；无可领降级提示；未连钱包守卫
- [ ] 5.6 GREEN：`web/components/assistant/ClaimConfirmCard.tsx`
- [ ] 5.7 验证：`cd web && npm test -- assistant-sell-card assistant-cancel-card assistant-claim-card`

## 6. 面板分派器接线

- [ ] 6.1 `web/components/assistant/AssistantPanel.tsx` 新增 sell/cancel/claim 分支，接入对应确认卡与解析函数
- [ ] 6.2 RED/GREEN：`web/test/assistant-panel.test.tsx` 增补 — sell/cancel/claim 意图渲染对应卡
- [ ] 6.3 验证：`cd web && npm test -- assistant-panel`

## 7. 终审验证

- [ ] 7.1 全量测试：`cd web && npm test`（现有 295 + 新增全绿，无回归）
- [ ] 7.2 lint：`cd web && npm run lint`（干净）
- [ ] 7.3 build：`cd web && npm run build`（通过；若沙箱字体网络失败，仅说明不做 workaround）
- [ ] 7.4 逐条核对 design.md AC1-AC7，取证记录
