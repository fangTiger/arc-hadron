# Change: 前端轮询成本收敛

## Why

Web 端所有链上读取都以固定 8s interval 无差别轮询（`useAssets` / `useListings` / `useBids` / `useYield` 合计 17 个 useQuery + `useMarketEvents` 15s poll），稳态 ~128 HTTP POST/min，且后台标签仍在打满 RPC。资产状态实际变化慢（分钟-天量级），大量请求原样返回，RPC 成本和技术债都在无谓累积。此外 wagmi transport 未开 batch，同 tick 多个 `eth_call` 各发一次 HTTP。

## What Changes

- 新增分层轮询节奏：HOT 20s（公共盘口）/ WARM 40s（用户相关）/ COLD 90s（静态）
- 新增可见性感知：`document.hidden` 时暂停所有 refetchInterval（后台标签归零 RPC）
- 新增事件驱动 invalidate：`useMarketEvents` 检测到 8 类新事件时，按事件类型精确 `queryClient.invalidateQueries`
- 新增交易后 invalidate：wagmi `useWaitForTransactionReceipt` 成功后按 intent（buy/sell/cancel/claim）invalidate 对应 queryKey
- 新增 focus 校准：`refetchOnWindowFocus: true` + `staleTime: 5s`
- 修改 `web/lib/wagmi.ts` 打开 viem transport `batch: true`
- 修改 `useMarketEvents` 接入可见性感知 + 暴露新事件增量流
- 修改 `useAssets` / `useListings` / `useBids` / `useYield` 替换裸 `REFETCH_INTERVAL_MS = 8000` 为分层 `visibleRefetch(POLL_TIER_MS)`
- 迁移 4 张交易 Confirm 卡（Buy/Sell/Cancel/Claim）使用集中的 `useTxInvalidation` helper

无破坏性变更；无 UI 功能变化；仅呈现层数据新鲜度策略变更。

## Capabilities

### New Capabilities
- `web-data-freshness`: Web 端链上数据的新鲜度与轮询效率契约（分层节奏 / 后台暂停 / 事件与交易驱动的失效策略 / focus 校准 / transport batch）

### Modified Capabilities
无。呈现层轮询是 cross-cutting 关注点，不改变 `secondary-market` / `portfolio` / `yield-distribution` / `activity-feed` / `market-browsing` 的业务需求，仅约束前端何时/多快看到数据。

## Impact

**受影响代码**：
- 新建：`web/lib/hooks/pollingConstants.ts`、`web/lib/hooks/visibilityAware.ts`、`web/lib/hooks/useEventDrivenInvalidation.ts`、`web/lib/hooks/useTxInvalidation.ts`
- 修改：`web/lib/wagmi.ts`、`web/app/providers.tsx`、`web/lib/hooks/useAssets.ts`、`web/lib/hooks/useListings.ts`、`web/lib/hooks/useBids.ts`、`web/lib/hooks/useYield.ts`、`web/lib/hooks/useMarketEvents.ts`
- 迁移：`web/components/assistant/{BuyConfirmCard,SellConfirmCard,CancelDisambiguationCard,ClaimConfirmCard}.tsx` 中散落的手动 invalidate/refetch
- 测试：新增 4-5 个测试文件覆盖 helpers 与 dispatch 表

**受影响 API/依赖**：
- 无外部 API 变更
- viem transport 配置变化（`http(url, { batch: true })`）
- React Query `QueryClient` defaultOptions 变化（`refetchOnWindowFocus` / `staleTime`）
- `useMarketEvents` 返回接口增加 `newEvents` 字段

**性能影响**：
- 前台稳态 HTTP POST：~128/min → ≤ 20/min（6× 收敛）
- 后台标签 HTTP POST：全量 → 0
- 交易反馈延迟：最坏 8s → ≤ 2s
- 事件反馈延迟：8-15s → ≤ 20s（与现状相当或略优）

**风险**：
- 事件-invalidate 映射漏项 → HOT 20s 兜底
- arc-testnet RPC 与 transport batch 兼容性 → 手工验证；不兼容一行改回
- QueryKey 显式化可能影响 wagmi 缓存复用 → 实施阶段验证
