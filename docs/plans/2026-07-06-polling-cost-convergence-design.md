# 前端轮询成本收敛 · 设计文档

- **日期**：2026-07-06
- **模式**：Superpowers（brainstorming 定稿）
- **主实现**：codex（TDD） · **审查**：Claude
- **规模**：中任务（3-6 文件；无破坏性变更）
- **上游 session-state**：`.claude/session-state.md`（技术债 brainstorming 段）

---

## 1. 背景与动机（Why）

### 1.1 现状
Web 端所有链上读取通过 React Query（wagmi `useReadContract` / `useReadContracts`）实现，稳态每 8 秒无差别刷新：

| 文件 | Query 数 | 说明 |
| --- | --- | --- |
| `web/lib/hooks/useAssets.ts` | 4 | `ownedAssetIds` / `balance` / `depositPaid` / 相关 |
| `web/lib/hooks/useListings.ts` | 6 | `useListings` × 2 + `useAllListings` × 2 + `useMyListings` × 2 |
| `web/lib/hooks/useBids.ts` | 6 | 对称于 listings |
| `web/lib/hooks/useYield.ts` | 1 | `pendingYield` |
| `web/lib/hooks/useMarketEvents.ts` | 1 | 15s poll `getLogs` |

- 单 tab 前台稳态：`17 × (60/8) + 1 × (60/15) ≈ 128 + 4 = 132 RPC/min`
- 无 transport batch（`web/lib/wagmi.ts` 中 `http(ARC_RPC_URL)` 未传 `batch` 选项）
- 无可见性感知：后台标签一样在刷
- 无事件驱动 invalidate：只能等下一轮 8s 才能看到别人的挂单/成交

### 1.2 问题
- **成本无谓**：RWA 资产状态变化慢（分钟-天量级），8s 轮询绝大多数是原样返回
- **后台标签浪费**：用户切走后 tab 仍在打满 RPC
- **交易反馈延迟不稳定**：tx confirm 后要等到下一个 refetchInterval tick 才看到新值（最坏 8s）
- **技术债积累**：随着 hooks 数增长，稳态请求量线性上升

### 1.3 目标（Goals）
1. 前台稳态 RPC/min 相对基线至少 **6×** 收敛
2. 后台标签下 RPC/min 归零
3. 自己 tx confirm → UI 反映 ≤ 2s
4. 别人链上事件 → UI 反映 ≤ 20s
5. 无 UI 功能回归；无破坏性 API 变更

### 1.4 非目标（Non-Goals，本轮明确不做）
- 合约事件 WSS 订阅（方案 C，未来可能做）
- `pendingYield` 本地累加实时显示
- 后端 API 层聚合/缓存
- Escrow invariant fuzz 升级（下一轮技术债）

---

## 2. 方案选型回顾

Brainstorming 中比较了三方案（详见对话记录）：

- **A：极简延长 interval + tx invalidate** — 别人事件反馈慢，弃用
- **B：分层 interval + 可见性暂停 + 事件驱动 invalidate + transport batch** — 本文采纳 ✅
- **C：合约事件 WSS 订阅** — arc-testnet WSS 支持不明，冷启动/补偿逻辑复杂，暂缓

选 B 的理由：投入产出最佳、复用现有 `useMarketEvents` 基建、React Query 官方惯用法、风险可控（映射漏项时有兜底 interval）。

---

## 3. 验收标准（Acceptance Criteria）

**Clarify Gate 产出，所有条目必须可测量。**

### AC-1 前台稳态请求量
- **GIVEN** 用户打开 `/` 或 `/asset/[id]` 并停留在前台
- **WHEN** 无用户交互、无链上事件的 5 分钟窗口
- **THEN** 该 tab 的 **HTTP POST 请求**（`ARC_RPC_URL` endpoint）≤ **20/min**（devtools Network 采样计）
- 说明：transport batch 开启后一次 POST 内可含多个 `eth_call`；本 AC 计的是 HTTP 请求数，不是 JSON-RPC 方法数

### AC-2 后台标签暂停
- **GIVEN** 用户从任意 tab 切走（`document.visibilityState === 'hidden'`）
- **WHEN** 已过 10s
- **THEN** 该 tab 后续 30s 内 RPC 请求 = **0**

### AC-3 自己交易反馈
- **GIVEN** 用户提交 buy / sell / cancel / claim 交易
- **WHEN** `useWaitForTransactionReceipt` 得到 confirm 事件
- **THEN** 相关 UI 字段（余额 / 挂单簿 / 收益）在 **≤ 2s** 内更新

### AC-4 别人事件反馈
- **GIVEN** 链上产生 `Listed` / `Sold` / `Cancelled` / `BidPlaced` / `BidCancelled` / `BidFilled` / `Deposited` / `YieldClaimed` 事件
- **WHEN** `useMarketEvents` 的 15s poll 检测到
- **THEN** 相关 UI 字段在 **≤ 20s** 内更新（15s event poll + invalidate 到 refetch 完成 ≤ 5s）

### AC-5 Focus 回归
- **GIVEN** 用户从后台切回该 tab
- **WHEN** 触发 `visibilitychange → visible` 与 `focus`
- **THEN** 所有 HOT / WARM query 在 **≤ 5s** 内完成一轮 refetch

### AC-6 测试全绿 + 事件映射覆盖
- 现有 web 测试全部通过（当前基线 341+）
- 新增单测覆盖全部 8 类事件 → invalidate 映射
- 新增单测覆盖可见性感知 helper
- 新增单测覆盖 `useTxInvalidation` 4 类 intent（buy/sell/cancel/claim）

### AC-7 无 UI 功能回归
- Buy / Sell / Cancel / Claim 4 条交易流程可用
- 订单簿深度渲染无变化
- AI Assistant / Insights 面板无变化

---

## 4. 架构总览

```
┌─────────────────────────────────────────────────────────────┐
│ QueryClientProvider（app/providers.tsx）                    │
│  ├─ defaultOptions.queries                                  │
│  │    refetchOnWindowFocus: true                            │
│  │    staleTime: 5_000  // focus 抖动缓冲                    │
│  └─ <EventDrivenInvalidator />  ← 挂一次，订阅事件流         │
└──────────────────┬──────────────────────────────────────────┘
                   │
     ┌─────────────┼─────────────┐
     │             │             │
  useAssets    useListings    useBids ...
     │             │             │
     └──── refetchInterval: visibleRefetch(POLL_TIER_MS) ─────┘
                   │
                   ↓
        ┌──────────────────────────────┐
        │ visibilityAware helper       │
        │  document.hidden ? false : ms│
        └──────────────────────────────┘

┌─────────────────────────────────────────────────────────────┐
│ useMarketEvents（15s poll getLogs，本文不动）                │
│  └─→ 输出事件流 → useEventDrivenInvalidation                 │
│       按事件类型 dispatch queryClient.invalidateQueries      │
└─────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────┐
│ useTxInvalidation(intent)                                    │
│  包装 useWaitForTransactionReceipt                          │
│  onSuccess → queryClient.invalidateQueries(mapping[intent])  │
└─────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────┐
│ web/lib/wagmi.ts                                             │
│  http(ARC_RPC_URL, { batch: true })  ← 打开 JSON-RPC batch  │
└─────────────────────────────────────────────────────────────┘
```

---

## 5. 组件详细设计

### 5.1 `web/lib/hooks/pollingConstants.ts`（新建）

```ts
// 分层轮询间隔（毫秒）。采用保守数值：宁可稍慢，避免过频。
// 兜底承诺：即使事件-invalidate 映射漏项，HOT 20s 也会自然纠正。
export const POLL_HOT_MS = 20_000;   // 公共盘口：listings / bids
export const POLL_WARM_MS = 40_000;  // 用户相关：pendingYield / 我的挂单/买单
export const POLL_COLD_MS = 90_000;  // 静态：ownedAssetIds / balance / depositPaid
export const POLL_EVENT_MS = 15_000; // useMarketEvents（本轮不动）
```

**决策记录**：
- 20/40/90 而非首选 15/30/60 —— 用户拍板保守
- HOT 20s 是"兜底节奏"：事件映射漏项时的最大陈旧窗口
- COLD 90s 极限：只自己 tx 才会变的数据，nothing to poll

### 5.2 `web/lib/hooks/visibilityAware.ts`（新建）

```ts
import type { Query } from "@tanstack/react-query";

/**
 * 生成一个 refetchInterval 函数：
 * - document.hidden 时返回 false（暂停轮询）
 * - 否则返回给定的毫秒数
 * SSR 期间 document 未定义，退化为返回毫秒数（保守：让 SSR 拿最新值）。
 */
export function visibleRefetch(ms: number): (query: Query) => number | false {
  return () => {
    if (typeof document === "undefined") return ms;
    return document.hidden ? false : ms;
  };
}
```

**契约**：
- 输入：期望的轮询间隔（毫秒）
- 输出：可直接传给 React Query `refetchInterval` 的函数
- 依赖：只依赖 `document.hidden`（浏览器原生 API）

### 5.3 `web/lib/hooks/useEventDrivenInvalidation.ts`（新建）

```ts
import { useEffect } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useMarketEvents } from "./useMarketEvents";

// 事件类型 → 需要 invalidate 的 queryKey 前缀
type EventDispatch = (
  event: MarketEvent,
  ctx: { me?: `0x${string}` },
) => Array<Array<unknown>>;

const DISPATCH: Record<MarketEventType, EventDispatch> = {
  Listed: (e) => [["listings", "byToken", e.assetId], ["listings", "all"]],
  Sold: (e, { me }) => {
    const keys = [["listings", "byToken", e.assetId], ["listings", "all"]];
    if (me && (e.seller === me || e.buyer === me)) {
      keys.push(["assets", "balance", me], ["assets", "ownedIds", me]);
    }
    return keys;
  },
  Cancelled: (e) => [["listings", "byToken", e.assetId], ["listings", "all"]],
  BidPlaced: (e) => [["bids", "byToken", e.assetId], ["bids", "all"]],
  BidCancelled: (e) => [["bids", "byToken", e.assetId], ["bids", "all"]],
  BidFilled: (e, { me }) => {
    const keys = [["bids", "byToken", e.assetId], ["bids", "all"]];
    if (me && (e.bidder === me || e.seller === me)) {
      keys.push(["assets", "balance", me], ["assets", "ownedIds", me]);
    }
    return keys;
  },
  Deposited: (e) => [["yield", "asset", e.assetId]],
  YieldClaimed: (e, { me }) => {
    if (me && e.holder === me) return [["yield", "asset", e.assetId], ["assets", "depositPaid", me]];
    return [["yield", "asset", e.assetId]];
  },
};

export function useEventDrivenInvalidation({ me }: { me?: `0x${string}` }) {
  const queryClient = useQueryClient();
  const { newEvents } = useMarketEvents(); // 假设该 hook 输出增量事件流

  useEffect(() => {
    for (const event of newEvents) {
      const keys = DISPATCH[event.type](event, { me });
      for (const key of keys) {
        queryClient.invalidateQueries({ queryKey: key });
      }
    }
  }, [newEvents, me, queryClient]);
}
```

**注意**：
- `useMarketEvents` 现有返回接口需确认——若不暴露增量事件流，需要小改一下（在实现阶段处理）
- 映射表必须**外部导出**以便单测断言
- QueryKey 命名与现有 hooks 保持一致（实施时校准）

### 5.4 `web/lib/hooks/useTxInvalidation.ts`（新建）

```ts
import { useEffect } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useWaitForTransactionReceipt } from "wagmi";

type TxIntent = "buy" | "sell" | "cancel" | "claim";

const TX_KEYS: Record<TxIntent, (ctx: { me?: `0x${string}`; assetId?: bigint }) => Array<Array<unknown>>> = {
  buy: ({ me, assetId }) => [
    ["listings", "byToken", assetId],
    ["listings", "all"],
    ["assets", "balance", me],
    ["assets", "ownedIds", me],
  ],
  sell: ({ me, assetId }) => [
    ["listings", "byToken", assetId],
    ["listings", "all"],
    ["assets", "balance", me],
  ],
  cancel: ({ assetId }) => [
    ["listings", "byToken", assetId],
    ["listings", "all"],
    ["bids", "byToken", assetId],
    ["bids", "all"],
  ],
  claim: ({ me, assetId }) => [
    ["yield", "asset", assetId],
    ["assets", "depositPaid", me],
  ],
};

export function useTxInvalidation(
  hash: `0x${string}` | undefined,
  intent: TxIntent,
  ctx: { me?: `0x${string}`; assetId?: bigint },
) {
  const queryClient = useQueryClient();
  const receipt = useWaitForTransactionReceipt({ hash });

  useEffect(() => {
    if (receipt.isSuccess) {
      for (const key of TX_KEYS[intent](ctx)) {
        queryClient.invalidateQueries({ queryKey: key });
      }
    }
  }, [receipt.isSuccess, intent, ctx.me, ctx.assetId, queryClient]);

  return receipt;
}
```

**决策**：集中到 helper 而非散在 4 张 Confirm 卡里。理由：
1. 新增交易类型只改一处
2. 网站用户少 = 重构成本最低窗口
3. 卡片只管 UI，不需要理解 queryKey 结构

**迁移**：`BuyConfirmCard` / `SellConfirmCard` / `CancelDisambiguationCard` / `ClaimConfirmCard` 里把手动 `queryClient.invalidateQueries` 或 `refetch()` 调用替换为 `useTxInvalidation(hash, intent, { me, assetId })`。

### 5.5 `web/lib/wagmi.ts`（修改）

```diff
- transports: { [arcTestnet.id]: http(ARC_RPC_URL) },
+ transports: { [arcTestnet.id]: http(ARC_RPC_URL, { batch: true }) },
```

两处（WagmiAdapter + createConfig）都要改。开启 viem transport batch 后，同一微任务内的 `eth_call` 会自动合并成 JSON-RPC batch 请求。

### 5.6 `web/app/providers.tsx`（修改）

```diff
- const [queryClient] = useState(() => new QueryClient());
+ const [queryClient] = useState(() => new QueryClient({
+   defaultOptions: {
+     queries: {
+       refetchOnWindowFocus: true,
+       staleTime: 5_000,
+     },
+   },
+ }));
...
+ <EventDrivenInvalidatorMount />  // 内部调用 useEventDrivenInvalidation
```

新建一个 `<EventDrivenInvalidatorMount />` 组件（只调用 hook 不渲染任何东西），挂在 `ToastProvider` 内层。

### 5.7 hooks 迁移（`useAssets` / `useListings` / `useBids` / `useYield`）

统一 diff 模式：
```diff
- const REFETCH_INTERVAL_MS = 8000;
+ import { POLL_HOT_MS, POLL_WARM_MS, POLL_COLD_MS } from "./pollingConstants";
+ import { visibleRefetch } from "./visibilityAware";
...
-   refetchInterval: REFETCH_INTERVAL_MS,
+   refetchInterval: visibleRefetch(POLL_HOT_MS),  // 或 WARM / COLD 按数据类
```

**分层归属**（依据本文件表 §1.1）：
- `useAssets.ts` 全部 4 个 query → **COLD**（除非自己 tx，否则不变）
- `useListings.ts`：
  - `listingCount` → **COLD**（新挂单事件会 invalidate）
  - `listingsByToken` / `listingContracts`（读单条挂单详情）→ **HOT**（公共盘口）
  - `useMyListings` 的读取 → **WARM**
- `useBids.ts`：镜像 listings
- `useYield.ts` 的 `pendingYield` → **WARM**（每块累加，UI 上无意义精确到秒）

**QueryKey 显式化**：wagmi v2 `useReadContract` 默认 queryKey 结构复杂（含 hook 名 + 合约参数 hash + chainId + blockNumber 等），事件-invalidate 用前缀匹配不稳定。方案二选一，实施阶段确定：

- **方案 A（推荐）**：给每个 `useReadContract` 显式传 `query: { queryKey: [...] }`，用与 §5.3 / §5.4 相同的语义 key
- **方案 B**：不改 queryKey，改用 `queryClient.refetchQueries({ predicate })`，通过匹配 `queryKey[0]` 是 `readContract` 且 `queryKey[1].functionName` 等条件筛选

若走方案 A，需要确认自定义 queryKey 不会破坏 wagmi 的缓存复用（预期不会，因为 wagmi 内部按 hook instance 管理）。

### 5.8 `useMarketEvents` 最小调整

本轮不改事件轮询节奏（保持 15s），但需要两处小改：

1. **接入 visibleRefetch**：`refetchInterval: visibleRefetch(POLL_EVENT_MS)`，满足 AC-2（后台归零）
2. **暴露增量事件流**：现返回接口需能让下游拿到"本次 poll 新增的事件"（不是全量），供 `useEventDrivenInvalidation` 消费。若现在只暴露全量，加一个 `newEvents` 字段（用上次 lastBlockNumber 或 event.id 做去重）

---

## 6. 数据流

### 6.1 稳态（无事件、前台）

**前提**：transport batch 开启后，同一微任务内触发的多个 `eth_call` 会被 viem 合并成 1 个 HTTP POST（内含 JSON-RPC batch）。React Query 在每个 tick 会同步触发所有该 tier 到期的 refetch，因此同 tier 的 N 个 useQuery 收敛为 **1 个 HTTP POST**。

```
每 20s: 所有 HOT queries → 1 HTTP POST（batch 内多条 eth_call）
每 40s: 所有 WARM queries → 1 HTTP POST
每 90s: 所有 COLD queries → 1 HTTP POST
每 15s: useMarketEvents getLogs → 1 HTTP POST
──────────────────────────
理论稳态：(60/20) + (60/40) + (60/90) + (60/15) ≈ 3 + 1.5 + 0.7 + 4 ≈ 9.2 HTTP POST/min ✅ 满足 AC-1（≤ 20）
```

**注意事项**：
- 若 tier 内不同 hooks 的 refetch tick 不完全对齐（React Query 每个 useQuery 独立计时），可能出现 2-3 个 HTTP POST/tier/tick。真实上限估计 **12-15 POST/min**，仍满足 AC-1
- Multicall 合约层聚合（`useReadContracts`）已在 `useAllListings` / `useMyListings` 里生效，与 transport batch 叠加

### 6.2 后台切换（visibility hidden）

```
document.visibilityState=hidden
  → visibleRefetch fn 返回 false
  → 所有 refetchInterval 停止
  → useMarketEvents 也用 visibleRefetch → 停止
  → 10s 内所有 in-flight 完成 → 归零 ✅ 达 AC-2
```

### 6.3 交易成功

```
用户提交 tx → wagmi useWaitForTransactionReceipt(hash)
  → confirmed
  → useTxInvalidation.onSuccess → queryClient.invalidateQueries(TX_KEYS[intent])
  → 对应 hooks 立即 refetch
  → UI 更新 ≤ 2s（RPC 往返）✅ 达 AC-3
```

### 6.4 别人链上事件

```
链上事件产生
  → 最迟 15s 后 useMarketEvents 拉到
  → useEventDrivenInvalidation dispatch → invalidateQueries(DISPATCH[type])
  → 相关 hooks refetch
  → UI 更新 ≤ 20s（15s poll + 5s refetch）✅ 达 AC-4
```

### 6.5 Focus 回归

```
document.visibilityState=visible
  → visibleRefetch fn 恢复返回 ms
  → refetchOnWindowFocus: true 触发一次 refetch
  → staleTime: 5s 保证 focus 抖动不会连发
  → 5s 内所有 HOT/WARM 完成 refetch ✅ 达 AC-5
```

---

## 7. 错误处理

| 场景 | 处理 |
| --- | --- |
| 事件轮询失败（RPC 挂） | 无副作用；下次 15s 重试；HOT 20s 兜底不至于永久陈旧 |
| 映射表未覆盖新事件类型 | TypeScript exhaustive check（`assertNever`）编译期报错 |
| Focus refetch 失败 | React Query 自动重试；staleTime 缓冲 |
| Transport batch 失败 | viem 会 fallback 到单请求，不影响功能 |
| 组件 unmount 时 pending refetch | React Query 自动 cancel；无泄漏 |

---

## 8. 测试策略

### 8.1 单元测试
- `visibilityAware.test.ts`：模拟 `document.hidden = true/false`，断言返回值
- `useEventDrivenInvalidation.test.tsx`：mock QueryClient，feed 8 类事件，断言 `invalidateQueries` 调用参数
- `useTxInvalidation.test.tsx`：mock `useWaitForTransactionReceipt`，4 类 intent 分别断言 invalidate keys
- `pollingConstants.test.ts`：sanity——确保数值符合分层原则（HOT < WARM < COLD）

### 8.2 集成测试
- 一个 hook（如 `useListings`）：mock RPC，模拟一个 `Listed` 事件通过 event dispatch 触发时，`useListings` 的 query 会被 invalidate 并重发 read

### 8.3 手工验证
- **前台稳态**：Chrome devtools Network → filter `wallet_` 或 `POST /`；采样 5 分钟；期望 ≤ 20/min
- **后台**：切走 tab 10s，观察 Network 应停；切回观察 5s 内恢复
- **交易反馈**：手动买入一份，秒表计时 confirm → UI balance 更新，期望 ≤ 2s
- **别人事件**：用另一个钱包（或脚本）挂个单，观察本 tab 上的订单簿更新时间，期望 ≤ 20s

---

## 9. 风险与回退

| 风险 | 概率 | 缓解 | 回退 |
| --- | --- | --- | --- |
| 事件映射漏项 | 中 | TS exhaustive + 单测枚举 | HOT 20s 兜底 |
| Transport batch 与 arc-testnet RPC 不兼容 | 低 | 手工验证一次 buy 交互 | 单行改回 `http(url)` |
| Focus refetch 抖动 | 低 | staleTime: 5s | 关掉 refetchOnWindowFocus |
| Provider 挂点 `<EventDrivenInvalidatorMount />` 失败 | 低 | 组件 catch，仅日志 | 移除该组件，退化为纯 interval + tx invalidate（等价方案 A） |
| useMarketEvents 增量事件流接口不存在 | 中 | 实现阶段先小改 useMarketEvents 暴露 delta | 用完整事件列表 dedupe |
| QueryKey 与现有 hooks 不一致 | 中 | 实施时全局搜索校准 | 明确表格文档化 |

---

## 10. 实施步骤（预告）

按 CLAUDE.md 中任务流程，本 design 定稿后：
1. 走 `/openspec:proposal` 创建变更提案（`polling-cost-convergence`）
2. proposal.md / spec deltas / tasks.md（bite-sized）
3. 请用户批准后进入 `/openspec:apply`
4. codex TDD 实现 → Claude 审查 → verification → 归档

**预计 tasks.md 分组**（bite-sized，每步含验证命令）：
1. 加 `pollingConstants.ts` + 单测
2. 加 `visibilityAware.ts` + 单测
3. 修改 `wagmi.ts` 加 `batch: true`
4. 修改 `providers.tsx`（defaultOptions.queries + `<EventDrivenInvalidatorMount />` 挂载点占位）
5. `useAssets` 迁移到分层 + 显式 queryKey（或选定方案 B predicate）
6. `useListings` 迁移
7. `useBids` 迁移
8. `useYield` 迁移
9. `useMarketEvents` 加 visibleRefetch + 暴露 `newEvents` 增量
10. 加 `useEventDrivenInvalidation` + 单测（枚举 8 类事件）
11. 加 `useTxInvalidation` + 单测（4 类 intent）
12. 迁移 4 张 Confirm 卡使用 `useTxInvalidation`（删除散落的手动 invalidate/refetch）
13. 全量 `npm test` / `npm run lint` / `npm run build` + 手工采样验证 AC-1/AC-2

预估 codex 20-30 分钟一批（10-13 批），全程可能 4-6 小时。

---

## 11. 不在范围内

- **合约事件 WSS 订阅（方案 C）**：arc-testnet WSS 未验证；本轮完成后可评估
- **`pendingYield` 本地累加**：视觉上无意义（1 wei 变化用户无感）
- **后端 API 层缓存**：前端够用
- **Escrow invariant fuzz 升级**：session-state 明确，下一轮技术债
- **wallet_/RPC 层的请求聚合/去重**：viem 已经做了
- **useMarketEvents 15s poll 自身优化**：本轮不动，避免影响事件基线

---

## 12. 参考

- `web/lib/hooks/useAssets.ts` / `useListings.ts` / `useBids.ts` / `useYield.ts` / `useMarketEvents.ts`
- `web/lib/wagmi.ts` / `web/app/providers.tsx`
- viem transport batch: `node_modules/viem/dist/types/clients/transports/http.d.ts`
- React Query refetchInterval callable: TanStack Query v5 官方文档
- 上一轮设计参照：`docs/plans/2026-07-06-assistant-command-ux-design.md`
