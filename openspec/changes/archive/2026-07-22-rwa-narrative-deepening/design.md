# Design: RWA 叙事深化

> 完整设计见 `docs/plans/2026-07-06-rwa-narrative-deepening-design.md`（brainstorming 产出，用户批准）。
> 本文件是技术决策摘要；冲突时以本变更目录内文件为准。

## Context

HADRON MVP（M1-M5 + AI 层 + 买单深度 + 收益分配）已归档。本期为 RWA 叙事深化：把 `issuer` 从元数据字符串升级为结构化实体、补 fixed-income 两类（sovereign / corporate bonds）、Explore 加两维过滤。**不动合约**；只在元数据 + 前端 + Foundry 种子脚本层展开。

## Goals / Non-Goals

**Goals:**
- Issuer 结构化（off-chain JSON），构建期 fail-fast 校验。
- `/issuers/[slug]` profile 页，KPI 全链上派生。
- 新增 `sovereign-bonds` + `corporate-bonds` 两类，并追加 `money-market-funds` / `mortgages` / `equipment-finance` / `music-royalties` 四类；合计 +12 资产 +7 新 issuer。
- Explore：+ Issuer filter（下拉）+ Yield bucket（4 chip 互斥单选）。
- 资产详情页 header 加 issuer 跳转入口。

**Non-Goals:**
- 不动 `HadronAssets` / `HadronMarket` 合约。
- 不做 issuance timeline chart / maturity / risk tier filter / 表格 issuer 列。
- 不上真 PDF，不引真实企业域名。

## Decisions（摘要，详见 docs/plans/）

| # | 决策 | 选择 |
|---|------|------|
| 1 | Issuer 数据层 | off-chain JSON，构建期 fail-fast |
| 2 | 新增类别 | sovereign-bonds + corporate-bonds + money-market-funds + mortgages + equipment-finance + music-royalties |
| 3 | Explore 新维度 | Issuer filter + Yield bucket |
| 4 | Yield bucket 交互 | 4 chip 互斥单选 |
| 5 | Issuer profile 内容 | Header + KPI + Assets table + Docs + Recent activity |
| 6 | Weighted APY 权重 | 按 `totalShares` |
| 7 | Recent activity 数据源 | 复用 activity-feed，前端 filter |
| 8 | Docs 深度 | 三条固定 stub，`demo.hadron.local` 占位链接 |
| 9 | 表格 issuer 列 | 不加，改在资产详情页 header + Explore filter 双通道入口 |
| 10 | 归并结果 | 现有 14 资产 → 9 issuer；新增 12 资产 → 7 新 issuer；共 16 issuer |
| 11 | 统计条口径 | 保持全局，不随 Explore 过滤重算 |

## Risks / Trade-offs

- **Codex 迁移遗漏**：14 个资产 JSON 迁移 `issuerSlug`，靠 `metadata.ts` 构建期 fail-fast 兜底；Claude 审 diff 逐字段对照。
- **Codex 乱改配色/字体**（memory: [[codex-sandbox-workarounds-review]]）：明确要求只加 2 条新映射，不动现有 8 类；审 diff 时对照 base 分支。
- **KPI 首屏 loading**：Cumulative Volume 需要 event scan，用 activity-feed 现有 skeleton 组件保持一致体验。
- **arc-testnet 广播**：追加 12 笔 createAsset，按 memory [[arc-testnet-broadcast-practice]] 用 `--slow` + seed owner key；广播前后用 `assetCount` 防重复与复核。

## Migration Plan

无破坏性合约变更；前端侧：
1. 建 issuer JSON + `issuers.ts` loader（含 fail-fast）
2. 迁移 14 资产 JSON（加 `issuerSlug`，删 `issuer`）
3. 建 Explore 过滤组件 + wire URL 状态
4. 建 Issuer profile 页 + 资产详情页 header patch
5. 新增 12 资产 JSON + 7 issuer JSON + Foundry 种子脚本
6. 执行 arc-testnet 广播（`--slow` + seed owner key），记录 tokenId 与 tx hash

回滚：前端纯代码 git revert；链上多出的测试网 asset id 不可删除但无害。

## Open Questions

- Sovereign issuer 已拆为 `germany-treasury-desk` + `japan-treasury-desk`。
