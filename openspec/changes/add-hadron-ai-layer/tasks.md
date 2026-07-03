# Tasks: HADRON AI 层（DeepSeek Asset Insight + Market Brief）

> 中任务：bite-sized 步骤，每步含文件路径与验证命令。Claude 调度 codex exec 实现（TDD），Claude 审查取证提交。
> 验证基线：每组完成后 `cd web && npm run test && npm run lint`；组 5 前不跑 build（Claude 统一跑）。

## 1. 基建（Claude 亲自执行）

- [x] 1.1 `cd web && npm i openai`；从 arc-lepton/.env.local 复制 `DEEPSEEK_API_KEY/BASE_URL/MODEL` 到 `web/.env.local`（服务端专属段）；`web/.env.example` 补三个变量名（无值）
- [x] 1.2 移植 `web/lib/llm/deepseek.ts`（自 /Users/captain/python/arc-lepton/lib/llm/deepseek.ts，保留 mock 客户端语义，mock 内容换成 HADRON 洞察示例）+ `web/test/deepseek-client.test.ts`（无 key 返回 mock、有 key 返回真实客户端构造）

## 2. 纯函数层（codex，TDD：每步先 RED）

- [x] 2.1 `web/lib/ai/snapshot.ts` + `web/test/ai-snapshot.test.ts`：buildAssetSnapshot / buildMarketSnapshot（bigint→string、SHARE_SCALE 换算、成交截断 20/挂单截断 10、空市场/无成交合法输出、14 资产最坏情况 ≤ 24KB 实证用例）
- [x] 2.2 `web/lib/ai/fingerprint.ts` + `web/test/ai-fingerprint.test.ts`：规范化完整快照稳定哈希（键序无关、内容级变化敏感）
- [x] 2.3 `web/lib/ai/prompts.ts` + `web/test/ai-prompts.test.ts`：insight/brief 两模板（英文、三节结构指令、免责尾注指令、禁编造指令均可断言存在）
- [x] 2.4 `web/lib/ai/sse.ts` + `web/test/ai-sse.test.ts`：encodeSseEvent / createSseFrameParser（chunk/done/error 三型；分片、半包、多行 data: 用例）
- [x] 2.5 `web/lib/ai/rateLimit.ts` + `web/test/ai-rate-limit.test.ts`：滑动窗口（每 IP + 全局），窗口滑出恢复、超限判定边界；注释注明多实例部署需换共享存储

## 3. API 路由（codex，TDD）

- [x] 3.1 `web/app/api/ai/insight/route.ts` + `web/test/ai-insight-route.test.ts`：runtime=nodejs / maxDuration=60；顺序：限流(429) → raw byte 上限 32KB(400) → 形状校验(400) → 无 key（开发 mock 流 / 生产 503）→ DeepSeek 流式（55s AbortController，客户端断开中止上游）→ SSE 帧；mock 客户端断言帧序列与全部错误路径
- [x] 3.2 `web/app/api/ai/brief/route.ts` + `web/test/ai-brief-route.test.ts`：同 3.1，市场快照形状；与 3.1 共享的校验/流式逻辑提取 `web/lib/ai/routeShared.ts` 避免复制

## 4. 客户端（codex，TDD）

- [x] 4.1 `web/lib/ai/useAiGeneration.ts` + `web/test/ai-generation-hook.test.ts`：fetch(POST)+ReadableStream 手写 SSE 解析（复用 2.4）；状态机 idle→streaming→done|error；AbortController（重复触发防护/卸载中止）；localStorage 读写（key 含 chainId/market 地址/schema 版本；storage 异常静默降级）
- [x] 4.2 `web/components/ai/AiMarkdown.tsx` + `web/test/ai-markdown.test.tsx`：受限 markdown 渲染（h2/h3/ul/li/strong/p 白名单，无 dangerouslySetInnerHTML；恶意输入渲染为纯文本用例）
- [x] 4.3 `web/components/ai/InsightPanel.tsx` + 挂入 `web/app/asset/[id]/page.tsx`（AssetProfile 与 SELL ORDERS 之间）+ `web/test/ai-insight-panel.test.tsx`：Generate/streaming 禁用态/缓存命中 "Generated Xh ago · Refresh"/指纹变化徽章/错误 Retry/免责尾注恒显
- [x] 4.4 `web/components/ai/MarketBrief.tsx` + 挂入市场页（ACTIVITY 上方）+ `web/test/ai-market-brief.test.tsx`：同 4.3 交互语义

## 5. 验证 · 交叉检查 · 验收 · 归档

- [x] 5.1 Claude：全量 `npm run test` + `npm run lint` + `npm run build` + dev 三页 200 取证
- [x] 5.2 Codex 只读交叉检查（SSE 竞态/限流绕过/密钥暴露面/中文残留/spec 符合性）；阻塞项修复后重验
- [ ] 5.3 用户验收：真实 key 各生成一次 Insight 与 Brief（观察流式/缓存/Refresh/数据变化徽章），mock 态一次（临时移除 key）
- [ ] 5.4 归档：delta 合并 `openspec/specs/ai-insights/`、design.md 同步、完整性 6 项检查
