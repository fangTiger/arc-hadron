## Context

### 现状
- Web 端 5 个链上 hooks（`useAssets` / `useListings` / `useBids` / `useYield` / `useMarketEvents`）合计 17+1 个 useQuery，均使用固定 8s 或 15s `refetchInterval`
- viem transport 未开 `batch`，同一 tick 内多个 `eth_call` 各发一次 HTTP POST
- 稳态每分钟约 128 个 HTTP POST 到 `ARC_RPC_URL`；后台标签下也不停
- 现有 `useMarketEvents` 每 15s poll `getLogs`，返回全量事件（未显式暴露"新增事件"增量）
- 现有 4 张交易 Confirm 卡各自零星调用 `queryClient.invalidateQueries` 或 hook 上的 `refetch()`

### 约束
- arc-testnet 是自建 fork，WSS 支持不确定，不宜依赖
- 网站当前活跃用户少，正是重构成本最低的窗口
- 无破坏性 API 变更；不影响合约层
- 需保留 `useMarketEvents` 现有 15s 轮询节奏作为事件真源

### 相关设计与决策记录
- 完整技术细节与代码骨架：`docs/plans/2026-07-06-polling-cost-convergence-design.md`
- Session 上下文：`.claude/session-state.md`

## Goals / Non-Goals

**Goals：**
- 前台稳态 HTTP POST/min 相对基线 ≥ 6× 收敛（128 → ≤ 20）
- 后台标签下 HTTP POST/min 归零
- 交易反馈延迟 ≤ 2s（最坏 8s → ≤ 2s）
- 事件反馈延迟 ≤ 20s（与现状相当）
- 无 UI 功能回归、无破坏性 API 变更
- 事件-invalidate 映射用 TypeScript exhaustive check 强制未来演进时被编译器捕获

**Non-Goals：**
- 合约事件 WSS 订阅（未来可评估的方案 C）
- `pendingYield` 本地累加实时显示
- 后端 API 层聚合/缓存
- `useMarketEvents` 自身 15s 节奏调整
- Escrow invariant fuzz 升级（后续技术债项目）
- 移动端/PWA 场景优化（本轮桌面浏览器为准）

## Decisions

### D1: 方案 B（分层 interval + 可见性 + 事件驱动）胜于 A、C
**选择**：本文档实现方案 B。

**替代方案考虑**：
- **方案 A（极简延长 interval + tx invalidate）**：改动最小，但别人挂单/成交要等 30-60s 才在盯盘用户界面出现，牺牲订单簿演示体验。
- **方案 C（合约事件 WSS 订阅驱动）**：稳态 RPC/min 可到 5-10，但 arc-testnet WSS 支持未验证；冷启动 seed、事件缺失补偿、reorg 处理复杂度高；出错难排查。

**理由**：
- 复用已有 `useMarketEvents` 基建（15s poll `getLogs`），做事件→invalidate 映射是自然扩展，不引入新技术栈
- 请求量 6-13× 收敛，与 C 的 20× 差距不大，但复杂度和风险差一个数量级
- 兜底 HOT 20s 保证事件映射漏项时不会永久陈旧
- React Query 官方惯用法，未来上手成本低

### D2: 保守数值 20/40/90s（而非首选 15/30/60s）
**选择**：`POLL_HOT_MS = 20_000`、`POLL_WARM_MS = 40_000`、`POLL_COLD_MS = 90_000`。

**理由**：
- 用户明确希望保守（网站活跃用户少，慢一点无所谓）
- 事件驱动 invalidate 承担"快速响应"职责，interval 只需兜底
- 保守数值下即使映射漏项，最长陈旧窗口 20s 是可接受的用户体验

**代价**：稳态请求算术更依赖 transport batch 生效；无 batch 时可能 40-50/min（仍好于 128，但不达 20 目标）。用 D6 补齐。

### D3: Tx invalidate 集中到 `useTxInvalidation` helper
**选择**：新建单一 helper 包装 `useWaitForTransactionReceipt`，intent-to-queryKey 映射表内聚。4 张 Confirm 卡改为调用 helper。

**替代方案**：卡片自管 invalidate。

**理由**：
- 只有 4 类 intent（buy/sell/cancel/claim），映射表小且不易变
- 新增交易类型只改一处
- 卡片 UI 层不需要理解 queryKey 结构
- 网站用户少 = 重构窗口小、bug 面暴露有限

### D4: 新增能力 `web-data-freshness` 而非 MODIFY 现有能力
**选择**：spec delta 新增一个 capability。

**替代方案**：在 `secondary-market` / `portfolio` / `yield-distribution` 各自 MODIFY 加需求。

**理由**：
- 轮询策略是横切关注点（cross-cutting），不属于任何一个业务能力
- 集中在一个 spec 里未来演进（比如 D1 提到的未来方案 C）方便追踪
- 现有业务能力的语义（能挂单/能持仓/能领收益）不变，只是"呈现层多快能看到最新"变了

### D5: `useMarketEvents` 暴露新增事件流（`newEvents`）
**选择**：`useMarketEvents` 返回接口新增 `newEvents: MarketEvent[]`，表示本次 poll 相对上次的增量。

**理由**：
- `useEventDrivenInvalidation` 只需要"新事件"来 dispatch invalidate，全量会导致每次 poll 触发一波不必要的 invalidate
- 增量语义清晰，可以按 `lastBlockNumber` 或事件唯一键 dedupe

**注意**：这是对 `useMarketEvents` 现有返回契约的扩展（不删原字段），不是破坏性变更。

### D6: viem transport `batch: true`
**选择**：`http(ARC_RPC_URL, { batch: true })`，两处 transport 声明都改（WagmiAdapter 与 createConfig）。

**理由**：
- 达成 AC-1 前台 ≤ 20/min 的关键杠杆——无 batch 时保守分层最多降到 40/min
- 一行改动，回退成本几乎为零
- viem 官方推荐；孤立作用于网络层

**验证**：手工用 devtools Network 检查一次 buy 交互，同 tick 多 read 是否合并成 1 个 POST。

### D7: queryKey 显式化 vs predicate 匹配 —— **切方案 B（在 Batch 4 定案）**
**背景**：原计划走方案 A（每个 `useReadContract` 传自定义 `queryKey`）。Batch 4 实施时经 codex 与 Claude 双向核实：wagmi v2 的 `QueryParameter` 类型显式 `UnionLooseOmit` 掉了 `'queryKey' | 'queryFn'`（`node_modules/@wagmi/core/dist/types/types/query.d.ts:7`），运行时 `readContractQueryOptions()` 会先展开用户传入的 `query`，再写死 `queryKey: readContractQueryKey(options)`。即：**用户无法覆盖 wagmi 内部生成的 queryKey**。

**方案 B（采纳）**：
- 保留 wagmi 自动生成的 queryKey（结构为 `['readContract', { address, chainId, functionName, args, ... }]`）
- `useEventDrivenInvalidation` / `useTxInvalidation` 用 `queryClient.invalidateQueries({ predicate })` 匹配 `functionName` 与合约地址
- Predicate helper 集中在 `web/lib/hooks/invalidationPredicates.ts`（新建），单测覆盖每类 predicate

**优点**：
- 顺应 wagmi 设计：内容寻址 queryKey 自动保证同参数查询共享缓存（原方案 A 想验证的 D 复用效果内建保证）
- 无需侵入 hooks 内部
- Predicate 表达力足够：既能按 functionName 匹配，也能按合约地址范围匹配

**缺点**：
- 依赖 wagmi 内部 queryKey 结构。若未来 wagmi 大版本升级改结构，predicate 需要同步——用 sanity 测试断言当前结构可发现
- 单测断言比方案 A 稍绕（要构造真实的 wagmi queryKey 或用 `queryClient.getQueryCache().findAll({ predicate })` 验证）

**记录**：Batch 4 的原始子任务"每个 read 加显式 queryKey"取消，只保留分层 `refetchInterval` + 删除本地常量。Batch 5 / 6 的 invalidation 实现改走 predicate。

## Risks / Trade-offs

| 风险 | 缓解 |
| --- | --- |
| 事件-invalidate 映射漏新增事件类型 | Dispatch 表用 TS `Record<MarketEventType, ...>`（exhaustive check）；`assertNever` 兜底；HOT 20s 保证不会永久陈旧 |
| arc-testnet RPC 与 viem `batch: true` 不兼容 | 实施 Task 3 手工验证一次 buy 交互；不兼容一行改回 `http(url)` |
| 自定义 queryKey 破坏 wagmi 缓存复用 | Task 5 迁移 `useAssets` 时先局部试；若观察到缓存复用失效，切方案 B（predicate 匹配） |
| Focus refetch 引发抖动 | `staleTime: 5_000` 缓冲；`refetchOnWindowFocus` 是可关的 fallback |
| `useMarketEvents` 增量流实现难度 | 用简单 `lastBlockNumber` 记忆；有已知边缘 case（reorg 导致同 blockNumber 不同 events）就退到"用 event tx hash + logIndex 去重" |
| `EventDrivenInvalidatorMount` 挂在 provider 层可能引起 provider re-render | Mount 组件返回 `null`，只调用 hook，不改状态；useEffect 依赖精确控制 |
| 4 张 Confirm 卡重构引入回归 | 每张卡改动后立刻跑对应 vitest；`useTxInvalidation` 有单测覆盖 4 类 intent |
| 稳态请求上限估算依赖 transport batch 与 tick 对齐 | AC-1 采样为准；不达标时先分析（batch 是否生效、tick 是否对齐），最后手段是进一步延长 HOT interval |

## Migration Plan

**部署**：前端小步单 PR / 单分支合入 main。无数据库迁移。

**回退**：
- **一键回退**：`git revert` 单一 commit（或改回 `REFETCH_INTERVAL_MS` 常量），系统立即回到 8s 全量轮询行为
- **部分回退**：
  - transport batch 出问题：单独改回 `http(url)`
  - 事件映射出问题：卸载 `<EventDrivenInvalidatorMount />`，退化为纯分层 interval（等价方案 A）
  - Tx invalidate helper 出问题：4 张卡改回旧的 refetch/invalidate 调用

**灰度**：本轮不做灰度（用户少），main 合入即上线。

## Open Questions

1. **`useMarketEvents` 现返回结构是否已有 `newEvents` 或类似字段？** —— 实施前先读一遍 `useMarketEvents.ts` 确认；若已有则复用，否则小改新增
2. **`useAssets` / `useListings` / `useBids` 的部分 read 是否需要更细粒度分层？** —— 例如 `listingCount` 是 COLD 还是 WARM？初步归 COLD，实施时如果出现事件-invalidate 触发不到 count 导致新挂单看不见，再调整
3. **Focus refetch 是否需要豁免某些昂贵 query？** —— 目前决定不豁免；若手工测试发现 focus 后有明显 UI 卡顿再限制
4. **是否需要为"帮别人调试"添加 dev-only 日志（当前轮询节奏、后台状态、事件 dispatch）？** —— 可选，非阻塞项；实施 Task 13 加个 debug flag 打点即可
