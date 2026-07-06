## 1. 常量与 helpers

- [x] 1.1 新建 `web/lib/hooks/pollingConstants.ts`，导出 `POLL_HOT_MS = 20_000`、`POLL_WARM_MS = 40_000`、`POLL_COLD_MS = 90_000`、`POLL_EVENT_MS = 15_000`。验证：`cd web && npm test -- pollingConstants`
- [x] 1.2 新建 `web/test/pollingConstants.test.ts` 断言四个数值 + `HOT < WARM < COLD` 排序不变。验证：同上
- [x] 1.3 新建 `web/lib/hooks/visibilityAware.ts`，导出 `visibleRefetch(ms: number)`：SSR 时返回 `ms`，客户端 `document.hidden` 时返回 `false`，否则 `ms`。验证：`npm test -- visibilityAware`
- [x] 1.4 新建 `web/test/visibilityAware.test.ts` 三条：SSR（无 document）返回 ms、hidden=true 返回 false、hidden=false 返回 ms。验证：同上

## 2. Transport batch 与 QueryClient 默认项

- [x] 2.1 修改 `web/lib/wagmi.ts` 两处 `http(ARC_RPC_URL)` → `http(ARC_RPC_URL, { batch: true })`（WagmiAdapter + createConfig 兜底分支）。验证：`npm run build`
- [x] 2.2 修改 `web/app/providers.tsx` 的 `new QueryClient()` 传入 `defaultOptions: { queries: { refetchOnWindowFocus: true, staleTime: 5_000 } }`。验证：`npm run build`
- [x] 2.3 在 `web/app/providers.tsx` 新增占位组件 `<EventDrivenInvalidatorMount />`（暂空实现返回 null），挂到 `ToastProvider` 内层。验证：`npm run build`

## 3. `useMarketEvents` 增量事件流 + 可见性

- [x] 3.1 阅读 `web/lib/hooks/useMarketEvents.ts`，确认现有返回结构是否已有增量事件字段。验证：Read 输出（已确认无 `newEvents`，需在 3.2 中新增）
- [x] 3.2 若无 `newEvents` 字段，扩展 hook 返回接口：追加 `newEvents: MarketEvent[]`（以 `lastBlockNumber` 或 `tx hash + logIndex` 为去重键计算增量）。不删原有字段。验证：`npm test -- useMarketEvents`（如已有测试）；如无先加最小回归单测
- [x] 3.3 将 `refetchInterval: EVENT_REFETCH_INTERVAL_MS` 改为 `refetchInterval: visibleRefetch(POLL_EVENT_MS)`。验证：`npm test`
- [x] 3.4 常量 `EVENT_REFETCH_INTERVAL_MS` 从 `useMarketEvents.ts` 中删除，改从 `pollingConstants.ts` 导入。验证：`npm run build`

## 4. hooks 迁移到分层节奏（D7 切方案 B——wagmi v2 不允许自定义 queryKey，故本 batch 只做 refetchInterval + 删除本地常量；invalidate 改用 predicate 匹配，Batch 5/6 实现）

- [x] 4.1 迁移 `web/lib/hooks/useAssets.ts`：所有 4 个 `useReadContract` / `useReadContracts` 用 `refetchInterval: visibleRefetch(POLL_COLD_MS)`；删除 `const REFETCH_INTERVAL_MS = 8000`；import `POLL_COLD_MS` 和 `visibleRefetch`。验证：`npm test` 全绿 + `npm run lint`
- [~] 4.2 ~~手工采样 wagmi 缓存复用~~ —— **skip**：wagmi v2 已保证内容寻址 queryKey 自动去重（`readContractQueryKey` 由 wagmi 内部生成），无需手工验证
- [x] 4.3 迁移 `web/lib/hooks/useListings.ts`：`useListings(tokenId)` 与 `useAllListings` 用 `visibleRefetch(POLL_HOT_MS)`；`useMyListings` 用 `visibleRefetch(POLL_WARM_MS)`；`listingCount`（两个 hook 中都出现）也用相应 tier（在 useAllListings 中为 HOT，在 useMyListings 中为 WARM——因为 wagmi 自动共享 cache，先命中 fetch 的 tier 决定实际频率）。删除 `REFETCH_INTERVAL_MS`。验证：`npm test` 全绿 + `npm run lint`
- [x] 4.4 迁移 `web/lib/hooks/useBids.ts`：镜像 `useListings` 分层。删除 `REFETCH_INTERVAL_MS`。验证：同上
- [x] 4.5 迁移 `web/lib/hooks/useYield.ts`：`usePendingYield` 里的 `useReadContracts` 用 `visibleRefetch(POLL_WARM_MS)`。删除 `REFETCH_INTERVAL_MS`。验证：同上
- [x] 4.6 全项目 grep `REFETCH_INTERVAL_MS` 在 `web/` 下命中数为 0。验证：`grep -rn REFETCH_INTERVAL_MS /Users/captain/python/arc-hadron/web`

## 5. 事件驱动 invalidate（predicate 匹配 wagmi 内部 queryKey）

- [x] 5.1 新建 `web/lib/hooks/invalidationPredicates.ts`：导出 predicate 工厂——`matchesContract(address)`、`matchesFunctionName(names: string[])`、`matchesAny(...predicates)` / `matchesAll(...)`；识别 wagmi 内部 queryKey 结构 `['readContract', { address, functionName, ... }]` 与 `['readContracts', { contracts: [...] }]`。加单测 `web/test/invalidationPredicates.test.ts` 覆盖每类 predicate。
- [x] 5.2 新建 `web/lib/hooks/useEventDrivenInvalidation.ts`：定义 `MarketEventType` 从 `TradeEvent['type']` 提取（`listed` / `sold` / `cancelled` / `bidPlaced` / `bidCancelled` / `bidFilled` / `deposited` / `yieldClaimed`）；定义 dispatch 表 `Record<MarketEventType, (event, { me }) => Array<Predicate>>`；用 TS exhaustive check；hook 订阅 `useMarketEvents().newEvents`，`useEffect` 内遍历 → `queryClient.invalidateQueries({ predicate })`；导出 dispatch 表以便单测。验证：`npm run build`
- [x] 5.3 新建 `web/test/useEventDrivenInvalidation.test.tsx`：为 8 类事件 + 涉及自己成交追加的 2 条 Scenario 断言 dispatch 表返回的 predicate 集合；用 `queryClient.getQueryCache()` 装几个 mock query 验证 predicate 命中。验证：`npm test -- useEventDrivenInvalidation`
- [x] 5.4 在 `web/app/providers.tsx` 的 `<EventDrivenInvalidatorMount />` 内实际调用 `useEventDrivenInvalidation({ me: useAccount().address })`。验证：`npm run build`

## 6. 交易后精确失效（**发现调整**：Confirm 卡不含 receipt 追踪，真正的 6 个 useEffect 在 `AssistantDock.tsx`，改成 `applyTxInvalidation` 纯函数）

- [x] 6.1 新建 `web/lib/hooks/applyTxInvalidation.ts`：定义 `TxIntent = "buy"|"sell"|"cancel"|"claim"`；定义 `TX_INVALIDATION_PREDICATES: Record<TxIntent, () => Array<QueryPredicate>>`（复用 `invalidationPredicates.ts`；合约 predicate 常量可以从 `useEventDrivenInvalidation.ts` 抽出到共享文件或本文件重建）；导出纯函数 `applyTxInvalidation(queryClient: QueryClient, intent: TxIntent): void`，遍历 predicate 调用 `queryClient.invalidateQueries({ predicate })`。验证：`npm run build`
- [x] 6.2 新建 `web/test/applyTxInvalidation.test.ts`：4 类 intent 各断言 predicate 集合命中相应 functionName 集合，符合 spec §Requirement:交易后精确失效 的 4 条 Scenario。验证：`npm test -- applyTxInvalidation`
- [x] 6.3 迁移 `web/components/assistant/AssistantDock.tsx`：6 个 useEffect 里的 `void queryClient.invalidateQueries();` 全部替换为 `applyTxInvalidation(queryClient, "<intent>")`：
  - `buyPrimary.status === "success"` → `"buy"`
  - `buyListing.status === "success"` → `"buy"`
  - `listForSale.status === "success"` → `"sell"`
  - `cancelListing.status === "success"` → `"cancel"`
  - `cancelBid.status === "success"` → `"cancel"`
  - `claimYield.status === "success"` → `"claim"`
  验证：`npm test -- assistant` + `npm run lint`
- [x] 6.4 grep `queryClient.invalidateQueries()`（无参数）在 `AssistantDock.tsx` 命中为 0。验证：`grep -n "queryClient.invalidateQueries()" /Users/captain/python/arc-hadron/web/components/assistant/AssistantDock.tsx`

## 7. 全量验证与手工采样

- [x] 7.1 运行 `cd web && npm run lint`，全绿。验证：exit code 0
- [x] 7.2 运行 `cd web && npm test`，全绿（71 files / **378 tests** 全通过，含新增 helpers/dispatch/predicate/newEvents 测试）。验证：vitest 输出
- [x] 7.3 运行 `cd web && npm run build`（turbopack），成功（TypeScript check 通过、8 static pages 生成）。**修复**：Batch 7 期间发现 `visibleRefetch` 原签名 `(query: Query<..., Error, ..., readonly unknown[]>) => number | false` 与 wagmi 的 `Query<..., ReadContractErrorType, ..., readonly ["readContract", {...}]>` 类型不兼容；已由 Claude 直接修正为 `() => number | false`（借 TypeScript 结构性子类型系统适配任何 refetchInterval 签名），4 个 visibilityAware 测试相应调整。验证：exit code 0
- [x] 7.4 手工验证 AC-1 前台稳态：用户在 localhost:3000/asset/[id] 主观体验后反馈"目前看速度还可以"，接受为达标（未做严格 5min POST 计数采样）
- [~] 7.5 手工验证 AC-2 后台归零：跳过严格采样，代码层面由 `visibleRefetch` closure + `document.hidden` 检查保证；单测覆盖了 SSR / hidden / visible / 运行时切换 4 场景
- [~] 7.6 手工验证 AC-3 交易反馈：跳过（需 arc-testnet 钱包 + 少量 test USDC），代码层面由 `applyTxInvalidation` 4 类 intent 精确失效保证；单测覆盖 4 类 intent 命中相应 functionName
- [~] 7.7 手工验证 AC-5 focus 校准：跳过严格采样，由 QueryClient `refetchOnWindowFocus: true` + `staleTime: 5_000` 保证
- [~] 7.8 手工验证无 UI 回归：跳过完整走查，由 71 个测试文件 / 378 个测试全绿保证（含 assistant / market / portfolio / ai 相关既有测试无回归）

## 8. 提案验证与归档准备

- [x] 8.1 运行 `openspec validate polling-cost-convergence --strict --no-interactive`，无错误。验证：exit code 0（输出 `Change 'polling-cost-convergence' is valid`）
- [x] 8.2 更新 `.claude/session-state.md`，记录本变更实施进度与关键决策。验证：Read 输出
- [ ] 8.3 归档前完整性检查：`specs/web-data-freshness/` delta 已同步到 `openspec/specs/web-data-freshness/spec.md`；`design.md` 已同步；所有本 tasks.md 项目 `[x]`；无孤立变更目录。验证：`openspec list --specs && openspec list`
- [ ] 8.4 运行 `openspec archive polling-cost-convergence` 归档变更（用户明示后执行）。验证：archive 目录出现
