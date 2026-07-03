# Change: 收益分配（Yield Distribution）

## Why

RWA 资产的 apyBps 只是展示元数据，持有份额没有任何真实收益路径，产品叙事缺最后一环。路线图（2026-07 决策）第三项即收益分配。用户已提前授权本提案（2026-07-04：免逐项确认，实现后统一看结果）。

## What Changes

- **BREAKING（合约重部署 V5）**：新 `HadronYield` 合约（每股累积器 scaled 记账：`depositYield` 任何地址可入金 / `claimYield`+`claimYieldBatch` / `pendingYield` / `notifyTransfer` 仅 HadronAssets 可调；排除名单构造器固定 = 市场合约 + 发行方 deployer，托管份额与发行方库存不计息）；`HadronAssets` 增 `setYieldHook` 一次性锁定 + `_update` 头部钩子
- 部署：新 `DeployV5.s.sol`（三合约 + 钩子锁定）+ `SeedV5.s.sol`（SeedV4 全职责 + 收益入金/领取样本）+ env 切换（新增 `NEXT_PUBLIC_HADRON_YIELD`）
- 前端事件层：`yield-deposited`/`yield-claimed` 解码（独立 `yieldAmount`/`account` 字段，不进成交口径）；`useMarketEvents`/`marketEventCache` 扫描与缓存 key 加入 Yield 地址；TradeHistoryTable 过滤 yield 事件；活动流英文文案
- 前端功能：`useYield` hooks（pending multicall + deposit + claim）；资产页 `YieldPanel`（待领/Claim/累计分配/最近记录/Distribute 入口）；持仓页待领列 + 行内 Claim + 汇总

## Impact

- Affected specs: `yield-distribution`（新能力，ADDED 5 需求）、`activity-feed`（MODIFIED：两合约→三合约事件源）
- Affected code: `contracts/src/{HadronYield(新),HadronAssets}.sol`、`contracts/test/*`、`contracts/script/{DeployV5,SeedV5}.s.sol`、`web/lib/{events,contracts}.ts`、`web/lib/hooks/{useMarketEvents,useYield(新)}.ts`、`web/lib/marketEventCache.ts`、`web/components/asset/YieldPanel.tsx(新)`、持仓页组件、两页挂载、env 文件
- 规模：大任务；tasks.md 高层清单 + docs/plans/2026-07-04-yield-distribution-plan.md 细化
- **验收合并**：买单深度（add-hadron-buy-depth，停在 5.3）与本变更一并在 V5 验收

## Acceptance Criteria（Clarify Gate，授权模式下由设计固化）

1. **GIVEN** 两地址分别持有同资产 30%/70% 流通份额 **WHEN** 入金 10 USDC **THEN** 两人 pending 为 3/7（scaled 记账精确）
2. **GIVEN** 持有人转让一半份额后再次入金 **THEN** 新旧持有人按新比例计提，此前计提保留给原持有人
3. **GIVEN** 份额挂单托管中 **WHEN** 入金 **THEN** 托管份额不参与；撤单后恢复参与（不吃托管期历史）
4. **GIVEN** 有 pending 的持有人 **WHEN** Claim **THEN** 到账精确、pending 归零、重复 Claim 无支付
5. 资产页/持仓页收益数据与链上一致；活动流出现 YIELD/CLAIM 英文记录；交易历史表不混入收益事件
6. forge + web 全量测试/lint/build 通过；invariant 等式口径成立（累计入金 == 已支付 + pending + 可解释余数）

## Out of Scope

- 定期自动分配（keeper）；按 apyBps 自动计算金额；多币种收益；AI 快照纳入收益；收益平台抽成；hook 可升级性（一次性锁定）

## 关键决策记录（用户回看）

1. 入金开放任何地址（便于钱包演示，无安全害处）
2. 排除名单构造器固定（市场 + 发行方），托管与发行方库存不计息
3. setYieldHook 一次性锁定（消灭管理员攻击面，逃生 = 测试网重部署）
4. V5 合并验收买单深度
