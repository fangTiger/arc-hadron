# HADRON M2R — 市场改版（交易所密度 + 全英文 + Reown + 扩容）实现计划

> **For agentic workers:** 由 Claude 经 `codex exec`（后台）逐 Task 调度，Claude 审查 + 取证 + 提交。
> 依据：2026-07-02 用户 M2 验收反馈（选项 B）——表格式市场页还要更"交易所"（行内走势 + 右侧常驻活动面板）。
> spec 修订已完成：market-browsing（表格布局/8 类别/排序/搜索/LIVE 条/活动面板）、trading-flow（英文 UI/Reown）。

**Goal:** 市场页改造成真实交易所密度的英文界面，资产扩至 8 类别 14 个，钱包连接换 Reown AppKit，事件层轻量版提前（LIVE 条/活动面板/迷你走势吃真实链上事件）。

## 冻结：资产扩容清单（10 个新资产，链上类别串如下）

| # | 名称 | Ticker | 链上 category | 总份额 | 上架 60% | 价格(×1e18) | apyBps |
|---|------|--------|---------------|--------|----------|-------------|--------|
| 5 | US T-Note 2028 | TNOTE | treasuries | 10000 | 6000 | 98.4 | 460 |
| 6 | Meridian SME Credit Pool A | PCRD-A | private-credit | 5000 | 3000 | 50 | 875 |
| 7 | Atlas Trade Receivables B | PCRD-B | private-credit | 6000 | 3600 | 25 | 920 |
| 8 | Dockside Logistics Park | DOCK | real-estate | 3000 | 1800 | 42.75 | 710 |
| 9 | Silver Bullion Vault #2 | SLVR | commodities | 2000 | 1200 | 29.4 | null |
| 10 | Gold Standard Offset Bundle | GSOB | carbon | 6000 | 3600 | 2.4 | null |
| 11 | Solar Farm Basin-2 Notes | SOLR | infrastructure | 5000 | 3000 | 78.2 | 740 |
| 12 | Fiber Grid Metro Loop | FIBR | infrastructure | 2500 | 1500 | 64 | 680 |
| 13 | Blue-Chip Art Fraction #7 | ART-7 | art-collectibles | 800 | 480 | 120 | null |
| 14 | Nexus Invoice Pool 2026-07 | NVIP | invoice-financing | 12000 | 7200 | 10 | 1050 |

既有 4 个（TBILL/GOLD/RES…原 tokenId 1-4）保留；**展示类别映射**：链上 `gold` 与 `commodities` 合并显示为 COMMODITIES，其余一一对应，共 8 个展示类别：TREASURIES / PRIVATE CREDIT / REAL ESTATE / COMMODITIES / CARBON / INFRASTRUCTURE / ART & COLLECTIBLES / INVOICE FINANCING。既有 4 资产的 Ticker：TBILL / GOLD / RES-12F / CARB-9。

## 冻结：轻量事件层（M4 完整版的前置）

- `lib/hooks/useMarketEvents.ts`：viem `getLogs` 单次范围查询（fromBlock = DEPLOY_BLOCK，两合约、全部事件），react-query 15s 轮询 + `txHash:logIndex` 去重；**分块扫描/退避等健壮性仍归 M4**；
- 派生：每资产成交序列（PrimarySale + Purchased，含价格/数量/时间）→ 迷你走势数据（不足 2 点时以发行价画平线）、24H 变动（24h 前后成交价对比，无成交 → 0.00%）、24H VOL（真实口径替换占位）、LIVE 条与活动面板条目（英文短句 + explorer 链接）。

## Task R1（contracts，Codex）: SeedV2 + 种子成交脚本
- `script/SeedV2.s.sol`：按上表创建 10 资产 + 一级发行（幂等：按名称查重跳过）；
- `script/SeedTrades.s.sol`：对 6-8 个发行做小额 `buyPrimary`（1-3 份，owner 自购——真实交易，成本仅协议费+gas），制造真实 PrimarySale 事件供 24H VOL/走势/LIVE 条展示；
- forge build 通过；**上链执行由 Claude 完成**。

## Task R2（web，Codex）: 全英文 + 元数据扩容 + 类别模块
- 全部 UI 文案英文化（TopBar/空态/错误/toast/占位/持仓表/BuyPanel；`purchase.ts` 的 errorZh 重命名 errorText 并改英文文案，测试同步）；
- `lib/metadata.ts`：AssetMeta.nameZh → displayName（英文），新增 ticker 字段；14 个 `content/assets/*.json` 全英文（description/issuer/docs），slug 与链上 metadataURI 一致（新资产 URI 规则 `hadron://assets/<kebab-name>`，由 R1 脚本采用同规则）；
- `lib/categories.ts`：8 展示类别（含 gold→COMMODITIES 合并映射、ticker 徽章色）；
- 测试全部更新为英文断言。

## Task R3（web，Codex）: Reown AppKit 接入
- `@reown/appkit` + `@reown/appkit-adapter-wagmi`；projectId 复用 arc-lepton（写入 .env.local/.env.example）；
- 自定义 Arc testnet 网络定义传入 AppKit；WalletButton 改为触发 AppKit modal（保留地址胶囊/断开）；
- wagmi config 由 WagmiAdapter 生成，hooks 无需改动。

## Task R4（web，Codex）: 市场页与详情页改版
- 首页：删 hero/卡片网格 → 统计条（内联小字，24H VOL 接真实事件）+ 类别 chips + 搜索框 + **可排序表格**（列按 spec；行内迷你走势 SVG；Trade 按钮）+ 右侧常驻 ACTIVITY 面板 + 底部 LIVE 滚动条；
- 详情页：交易所式重排——价格头（大 mono 价 + 24H + 关键指标行）+ 成交走势区（SVG 折线，事件数据，lightweight-charts 仍归 M4）+ 右侧 BuyPanel 保留；
- 移动端降级：右侧面板折叠到表格下方。

## Task R5: 交叉检查 + 用户验收
- Codex 全码复查（英文残留扫描 grep 中文字符、排序/过滤正确性、事件去重）；
- 用户浏览器验收（Reown 连接 + 新表格 + 购买回归）。

## 执行顺序
R1、R2 并行（不同目录）→ Claude 上链执行 SeedV2/SeedTrades → R3 → R4 → R5。
