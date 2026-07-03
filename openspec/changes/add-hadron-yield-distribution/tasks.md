# Tasks: 收益分配（Yield Distribution）

> 大任务：高层清单，细化见 docs/plans/2026-07-04-yield-distribution-plan.md。用户提前授权（2026-07-04）：提案免逐项确认，直接实现，用户次日看结果。
> 分工：Claude 设计/审查/取证/部署广播，codex exec 实现（TDD）。

## 1. 合约（forge TDD）

- [x] 1.1 `HadronYield.sol`（scaled 累积器 + 构造器固定排除名单 + deposit/claim/claimBatch/pending/notifyTransfer）+ `HadronYield.t.sol` 全场景（比例/转账结算/自转账/batch/多 token/dust/微额/幂等/排除四组合）
- [x] 1.2 `HadronAssets.sol` 增 `setYieldHook` 一次性锁定 + `_update` 头部钩子；hook 未设置转账正常 + 二次设置 revert 用例
- [x] 1.3 对抗与不变量：claim 重入/拒收领取/非 assets 调 notifyTransfer；等式口径 invariant/fuzz（累计入金 == 已支付 + Σpending + 可解释余数）
- [x] 1.4 forge test 全绿取证（Claude 亲自跑）——86/86 通过（HadronYield 19 用例，零回归）

## 2. 前端事件层与数据（web TDD，无需链上）

- [x] 2.1 HadronYield ABI + `events.ts` 解码 `yield-deposited`/`yield-claimed`（独立 yieldAmount/account 字段）；`useMarketEvents`/`marketEventCache` 扫描地址集与缓存 key 加入 Yield 地址
- [x] 2.2 口径隔离：yield 事件不进 TRADE_TYPES（四处均不）；TradeHistoryTable 过滤 yield；活动流英文文案（USDC 格式化）+ 一致性测试
- [x] 2.3 `useYield.ts`：`usePendingYield(tokenIds[])` multicall + `useDepositYield`/`useClaimYield` 交易 hooks

## 3. 前端 UI（web TDD）

- [x] 3.1 资产页 `YieldPanel`（待领 + Claim + 累计已分配 + 最近分配记录 + Distribute 入口）+ 挂载
- [x] 3.2 持仓页：持仓行待领列 + 行内 Claim + 顶部汇总 + 挂载

## 4. 部署与播种（V5，一次性完成）

- [ ] 4.1 `DeployV5.s.sol`（Assets → Market → Yield(assets,[market,deployer]) → setYieldHook 锁定）+ `SeedV5.s.sol`（SeedV4 全职责 + 入金/领取样本，样本在流通份额形成后执行）
- [ ] 4.2 Claude 部署广播（遵循 arc-testnet-broadcast-practice：一次性 SEED5 密钥 + --slow + FOUNDRY_OFFLINE）+ `contracts/deployments/arc-testnet.json` v5 记录 + web env 切换（三地址 + DEPLOY_BLOCK + NEXT_PUBLIC_HADRON_YIELD）
- [ ] 4.3 E2E：生产构建三页 200 + 新地址进构建产物 + RPC 实证收益数据；买单深度 tasks 5.3 标注切换 V5 验收

## 5. 验证 · 交叉检查 · 验收 · 归档

- [ ] 5.1 Claude：forge + web 全量 test/lint/build 取证（零回归）
- [ ] 5.2 Codex 只读交叉检查（记账数学/钩子安全/口径隔离/中文残留/spec 符合性）；阻塞项修复后重验
- [ ] 5.3 用户合并验收（V5）：买单深度全流程（挂买单/Fill/撤单）+ 收益全流程（入金 → 两账户按比例领取 → 转让后再入金验证权益不串）
- [ ] 5.4 归档：delta 合并 `openspec/specs/{yield-distribution,activity-feed}/`、design.md 同步、完整性 6 项检查（与买单深度归档一并处理）
