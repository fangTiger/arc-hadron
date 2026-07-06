## ADDED Requirements

### Requirement: 分层轮询节奏
Web 客户端 SHALL 按数据变化率将链上读取查询划分为三档 refetch interval：HOT `20_000ms`（公共盘口 listings/bids）、WARM `40_000ms`（用户相关：pendingYield、我的挂单/买单）、COLD `90_000ms`（静态：assetCount、offeringCount、getAsset、getOffering）。事件轮询 `useMarketEvents` MUST 保持 `15_000ms`。所有分层常量 MUST 集中在单一常量文件 `web/lib/hooks/pollingConstants.ts` 中管理。

#### Scenario: 常量集中管理
- **WHEN** 读取 `pollingConstants.ts`
- **THEN** 存在 `POLL_HOT_MS = 20_000`、`POLL_WARM_MS = 40_000`、`POLL_COLD_MS = 90_000`、`POLL_EVENT_MS = 15_000` 四个具名导出

#### Scenario: 分层归属
- **WHEN** 检查 hooks 的 `refetchInterval` 参数
- **THEN** `useAssets` 的所有 read 用 COLD；`useListings` / `useBids` 的公共盘口 read（`useListings(tokenId)` / `useAllListings` / `useBids(tokenId)` / `useAllBids`）用 HOT，用户相关 read（`useMyListings` / `useMyBids`）用 WARM；`useYield` 的 `pendingYield` 用 WARM；`useMarketEvents` 用 EVENT。散落在 `usePortfolio.ts` / `useFillBid.ts` / `useListForSale.ts` / `components/asset/*.tsx` 中的 useReadContract 本轮不迁移，走 QueryClient 默认（无 refetchInterval，但受 refetchOnWindowFocus + staleTime 兜底）

#### Scenario: 无裸常量
- **WHEN** 全局搜索 `REFETCH_INTERVAL_MS`
- **THEN** 在本变更迁移的 4 个 hooks 中命中项数为 0（`useAssets.ts` / `useListings.ts` / `useBids.ts` / `useYield.ts`）

### Requirement: 后台标签暂停轮询
当浏览器标签 `document.visibilityState === 'hidden'` 时，Web 客户端 MUST 暂停所有 refetchInterval（返回 `false`）。当标签重新变为 `visible` 时，MUST 恢复原本的分层间隔。此行为 MUST 通过一个共享 helper `visibleRefetch(ms)` 实现，所有 `refetchInterval` 属性 SHALL 使用该 helper 而非裸数字。

#### Scenario: 后台归零
- **GIVEN** 用户前台停留在 `/asset/[id]`
- **WHEN** 用户切走 tab，10 秒后
- **THEN** 该 tab 后续 30 秒内不发送任何 HTTP POST 到 `ARC_RPC_URL`

#### Scenario: 前台恢复
- **GIVEN** 后台状态下轮询已暂停
- **WHEN** 用户切回 tab，`document.visibilityState` 变为 `visible`
- **THEN** 各 hook 在其分层间隔内恢复轮询

#### Scenario: SSR 安全
- **WHEN** `visibleRefetch(ms)` 在 `typeof document === 'undefined'` 环境执行
- **THEN** 返回 `ms` 而非 `false`（不因 SSR 死锁）

### Requirement: 交易后精确失效
Web 客户端 SHALL 提供 `applyTxInvalidation(queryClient, intent)` 纯函数（同时导出 `TX_INVALIDATION_PREDICATES` 供单测），按 intent 类型对相关合约调用（`functionName`）精确 `queryClient.invalidateQueries`。intent 类型限定为 `"buy" | "sell" | "cancel" | "claim"`。因 wagmi v2 的 `useReadContract` / `useReadContracts` 由内部管理 queryKey（用户无法覆盖），失效方案采用 **predicate 匹配**（复用 `invalidationPredicates.ts`），识别 wagmi 内部 queryKey 中的合约地址与 `functionName`。

调用方（`web/components/assistant/AssistantDock.tsx` 中现有的 6 个交易成功 useEffect 分支）MUST 用 `applyTxInvalidation(queryClient, intent)` 替换无参数的 `queryClient.invalidateQueries()`——避免全库失效造成的不必要 RPC 风暴。

#### Scenario: buy 后失效
- **WHEN** intent = "buy"、交易 confirm 成功
- **THEN** invalidate 命中以下 wagmi 查询：market 合约的 `listingCount` / `listingsByToken` / `getListing`；assets 合约的 `balanceOf` / `getAsset` / `assetCount` / `offeringCount`；yield 合约的 `pendingYield`

#### Scenario: sell 后失效
- **WHEN** intent = "sell"、交易 confirm 成功
- **THEN** invalidate 命中：market 合约的 `listingCount` / `listingsByToken` / `getListing`；assets 合约的 `balanceOf` / `getAsset`

#### Scenario: cancel 后失效
- **WHEN** intent = "cancel"、交易 confirm 成功
- **THEN** invalidate 命中：market 合约的 `listingCount` / `listingsByToken` / `getListing` / `bidCount` / `bidsByToken` / `getBid`

#### Scenario: claim 后失效
- **WHEN** intent = "claim"、交易 confirm 成功
- **THEN** invalidate 命中：yield 合约的 `pendingYield`

#### Scenario: 交易反馈延迟
- **GIVEN** 用户提交任意 buy/sell/cancel/claim 交易
- **WHEN** 上层交易 hook（`useBuyPrimary` / `useBuyListing` / `useListForSale` / `useCancelListing` / `useCancelBid` / `useClaimYield`）报 `status === "success"`
- **THEN** 相关 UI 字段在 2 秒内更新为最新链上值

#### Scenario: 无全库失效
- **WHEN** grep `web/components/assistant/AssistantDock.tsx` 查找 `queryClient.invalidateQueries()` 无参数调用
- **THEN** 命中数为 0（全部替换为 `applyTxInvalidation(queryClient, intent)`）

### Requirement: 事件驱动失效
Web 客户端 SHALL 提供 `useEventDrivenInvalidation({ me })` hook，订阅 `useMarketEvents` 的新事件增量流，按事件类型 dispatch 对相关合约调用的 `queryClient.invalidateQueries`。此 hook MUST 在 QueryClientProvider 之下、全局唯一挂载一次。事件类型枚举 MUST 覆盖 `TradeEvent['type']` 的全部 12 类 kebab-case 字面量：`listed` / `purchased` / `cancelled` / `bid-placed` / `bid-filled` / `bid-cancelled` / `primary-sale` / `asset-issued` / `offering-created` / `offering-closed` / `yield-deposited` / `yield-claimed`。dispatch 表 MUST 外部导出以便单测枚举，且用 TypeScript exhaustive check 保证未来新增事件类型时编译报错。失效方案与 §Requirement:交易后精确失效 一致，采用 predicate 匹配 wagmi 内部 queryKey 中的合约地址与 `functionName`。

#### Scenario: listed / purchased / cancelled 触发 listings 失效
- **WHEN** 事件类型 ∈ {`listed`, `purchased`, `cancelled`}
- **THEN** invalidate 命中 market 合约的 `listingCount` / `listingsByToken` / `getListing`

#### Scenario: bid-placed / bid-cancelled / bid-filled 触发 bids 失效
- **WHEN** 事件类型 ∈ {`bid-placed`, `bid-cancelled`, `bid-filled`}
- **THEN** invalidate 命中 market 合约的 `bidCount` / `bidsByToken` / `getBid`

#### Scenario: 涉及自己的成交追加 assets 失效
- **WHEN** 事件为 `purchased` 且 `seller` 或 `buyer` 中含 me；或事件为 `bid-filled` 且 `seller` 或 `buyer` 中含 me（注意 `parseMarketLogs` 将合约层 `bidder` 映射为 `buyer`）
- **THEN** 除相应 listings/bids 失效外，追加 invalidate 命中 assets 合约的 `balanceOf` / `getAsset` / `assetCount` / `offeringCount`

#### Scenario: yield-deposited / yield-claimed 触发 yield 失效
- **WHEN** 事件类型 ∈ {`yield-deposited`, `yield-claimed`}
- **THEN** invalidate 命中 yield 合约的 `pendingYield`

#### Scenario: primary-sale / asset-issued / offering-created / offering-closed 触发 assets 失效
- **WHEN** 事件类型为 primary market 类（`primary-sale` / `asset-issued` / `offering-created` / `offering-closed`）
- **THEN** invalidate 命中 assets 合约的 `balanceOf` / `getAsset` / `assetCount` / `offeringCount`

#### Scenario: 事件反馈延迟
- **GIVEN** 链上产生上述任一事件
- **WHEN** `useMarketEvents` 的 15s poll 拉到该事件
- **THEN** 相关 UI 字段在 20 秒内更新为最新链上值

#### Scenario: 未覆盖事件类型的编译期防护
- **WHEN** 未来向 `useMarketEvents` 添加新的事件类型且 dispatch 表未同步
- **THEN** TypeScript 编译报错（使用 exhaustive check / `assertNever`）

### Requirement: Focus 校准
全局 `QueryClient` MUST 配置 `refetchOnWindowFocus: true` 与 `staleTime: 5_000`。当浏览器窗口重新获得焦点时，所有非 fresh 状态的 query 应触发一次 refetch。`staleTime` MUST 存在以避免频繁 focus 抖动引起 refetch 风暴。

#### Scenario: 焦点恢复
- **GIVEN** 用户 tab 已切走 60 秒后切回
- **WHEN** 触发 `visibilitychange → visible` 与 `window focus`
- **THEN** 5 秒内所有 HOT / WARM tier 的 query 完成一轮 refetch

#### Scenario: staleTime 抑制抖动
- **WHEN** 用户在 5 秒内多次快速切走并切回同一 tab
- **THEN** 每个 queryKey 至多触发一次 refetch

### Requirement: JSON-RPC 请求 batch
Web 客户端的 viem transport MUST 通过 `http(ARC_RPC_URL, { batch: true })` 启用 JSON-RPC batch，使同一微任务内触发的多个 `eth_call` 合并为单个 HTTP POST。此配置 MUST 同时应用于 `WagmiAdapter` 分支与 `createConfig` 兜底分支（两处 transport 声明）。

#### Scenario: 两处 transport 一致
- **WHEN** 检查 `web/lib/wagmi.ts`
- **THEN** `WagmiAdapter` 的 transports 与 `createConfig` 的 transports 都传入 `{ batch: true }`

#### Scenario: 同 tick 请求合并
- **GIVEN** 一次 HOT tick 触发多个 useReadContract 同时 refetch
- **WHEN** 观察 devtools Network
- **THEN** 该 tick 内到 `ARC_RPC_URL` 的 HTTP POST 数 ≤ 2（相对 tier 数量线性下降）

### Requirement: 前台稳态请求预算
在无用户交互、无链上新事件的前台稳态下，Web 客户端向 `ARC_RPC_URL` 发出的 HTTP POST 请求 MUST 满足 5 分钟窗口内平均 ≤ 20 次/分钟。此预算计的是 HTTP POST 数（transport batch 后一次 POST 内可含多条 `eth_call`），不是 JSON-RPC 方法数。

#### Scenario: 稳态采样
- **GIVEN** 用户前台打开 `/` 或 `/asset/[id]`、未做任何交互、链上无新事件
- **WHEN** devtools Network 采样 5 分钟
- **THEN** 到 `ARC_RPC_URL` 的 HTTP POST 数 ≤ 100（即 ≤ 20/min）

#### Scenario: 无功能回归
- **WHEN** 用户执行 buy / sell / cancel / claim 任一交易流程
- **THEN** 与本变更前的行为一致，不出现新的错误或视觉退化
