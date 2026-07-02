# HADRON M2 — 前端骨架与一级购买闭环 实现计划

> **For agentic workers:** 本计划由 Claude 调度 **codex MCP** 逐 Task 执行（sandbox=workspace-write），每 Task 完成后由 Claude 审查 diff 并运行验证命令（证据先于断言）。
> 对应 OpenSpec tasks.md 第 2 组（2.1–2.5），规格见 `specs/market-browsing`、`specs/trading-flow`、`specs/portfolio`（本期范围内条目）。
> 链上依赖（M1 产物，见 `contracts/deployments/arc-testnet.json`）：HadronAssets `0x4D82b6e528D3c2E1a3592e14863ec95EAeF4Ff85`、HadronMarket `0x962aba0A590981cf9c5B336aC34922c82f203165`、deployBlock `49771985`、chainId `5042002`。

**Goal:** 交付可真实交易的前端：浏览 4 类种子资产 → 连接钱包 → 原生 USDC 一级购买 → 链上确认 → 持仓展示，A+ 视觉风格落地。

**Architecture:** Next.js App Router 纯前端（无服务端写操作、无数据库）；wagmi v2 + viem 直读合约 getter（react-query 轮询 8s）；静态元数据 JSON 按 `metadataURI` slug 关联链上资产；交易经 wagmi `useWriteContract` + receipt 等待。

**Tech Stack:** Next.js（App Router, TS）、Tailwind CSS v4、wagmi v2 + viem + @tanstack/react-query、next/font（Inter + JetBrains Mono）、Vitest。

---

## 冻结约定（所有 Task 以此为准）

### 金额口径（M1 实证，不得偏离）
- 链上原生 USDC = **18 位小数 wei**，`1 USDC = 10^18 wei`；
- 全部金额用 `bigint`，禁止 float 运算；显示层经 `formatUsdc` 格式化，输入经 `parseUsdc` 转换。

### A+ 设计 token（globals.css 中定义为 CSS 变量 + Tailwind 主题）
```css
--bg: #05070d;            /* 页面底色（深空黑） */
--panel: #0a0e16;         /* 卡片/面板 */
--panel-glow: #0d1b2b;    /* 强调面板渐变端 */
--border: #1c2333;        /* 常规边框 */
--border-glow: #16324a;   /* 强调边框 */
--neon: #22d3ee;          /* 唯一霓虹青（主强调） */
--neon-dim: #67e8f9;      /* 霓虹次级 */
--gold: #e9c46a;          /* 暗金（收益率专用） */
--text: #eaf6ff;          /* 主文字 */
--text-dim: #9ca3af;      /* 次级文字 */
--muted: #6b7280;         /* 弱文字/未选中 */
--up: #34d399;            /* 涨/成功 */
--down: #f87171;          /* 跌/失败 */
```
- 排版纪律：小标签一律 `uppercase + tracking-[0.2em] + text-[10px~11px]`；数字用 JetBrains Mono；
- 发光纪律：`box-shadow` 光晕仅用于主 BUY 按钮与精选卡片 hover，禁止满屏发光；
- 类别色：treasuries=青 `#155e75`、gold=金 `#7c5c1e`、real-estate=蓝灰 `#1d2733`、carbon=绿 `#1e4d3a`（卡片头图为对应 radial-gradient，M2 不用图片素材）。

### 目录结构
```
web/
├── app/
│   ├── layout.tsx                 # 字体 + Providers + TopBar
│   ├── globals.css                # A+ token + 基础样式
│   ├── page.tsx                   # 市场首页
│   ├── asset/[id]/page.tsx        # 资产详情
│   └── portfolio/page.tsx         # 持仓
├── components/
│   ├── layout/TopBar.tsx          # 品牌 + 网络指示 + 钱包按钮
│   ├── layout/WalletButton.tsx
│   ├── market/StatsBar.tsx        # TVL / 24H VOL(M4 占位) / AVG YIELD
│   ├── market/CategoryTabs.tsx
│   ├── market/AssetCard.tsx
│   ├── market/AssetGrid.tsx
│   ├── market/ActivityFeedPlaceholder.tsx   # M4 实装
│   ├── asset/AssetProfile.tsx
│   ├── asset/BuyPanel.tsx         # 一级购买面板（核心交易组件）
│   ├── asset/ListingsPlaceholder.tsx        # M3 实装
│   ├── portfolio/HoldingsTable.tsx
│   └── ui/{AnimatedNumber,Skeleton,TxToast,GlowButton}.tsx
├── lib/
│   ├── chain.ts                   # Arc testnet 链定义（env 驱动，移植 arc-lepton）
│   ├── wagmi.ts                   # injected + WalletConnect(可选) + react-query
│   ├── contracts.ts               # 地址(env) + ABI 导出
│   ├── abi/{HadronAssets,HadronMarket}.json # forge inspect 产物
│   ├── format.ts                  # formatUsdc/parseUsdc/shortAddress/formatShares
│   ├── metadata.ts                # 静态元数据加载与校验
│   └── hooks/{useAssets,useOfferings,usePortfolio,useBuyPrimary,useNetworkGuard}.ts
├── content/assets/{t-bill-2026-q3,gold-ounce-4,marina-tower-12f,verra-carbon-9}.json
├── test/{format.test.ts,metadata.test.ts,mappers.test.ts}
└── .env.example / .env.local
```

### 关键接口签名（冻结）
```ts
// lib/format.ts
export function formatUsdc(wei: bigint, opts?: { compact?: boolean; digits?: number }): string; // 1234567...n → "1,234.56"
export function parseUsdc(input: string): bigint;            // "1.85" → 1850000000000000000n；非法输入 throw
export function shortAddress(addr: string): string;          // 0x8f…3a2b
export function formatShares(n: bigint): string;             // 千分位整数

// lib/metadata.ts
export interface AssetMeta { slug: string; nameZh: string; description: string; issuer: string;
  apyBps: number | null;  // 收益率（bp），无则 null
  docs: { label: string; note: string }[]; }
export function metaBySlug(slug: string): AssetMeta;          // metadataURI "hadron://assets/<slug>" → meta；未知 slug 返回兜底 meta

// lib/hooks/useAssets.ts —— 目录聚合（链上档案 + 元数据 + 发行）
export interface AssetView { tokenId: bigint; name: string; category: string; totalShares: bigint;
  meta: AssetMeta; offering: { id: bigint; pricePerShare: bigint; remaining: bigint; active: boolean } | null; }
export function useAssets(): { assets: AssetView[]; isLoading: boolean };

// lib/hooks/usePortfolio.ts
export interface Holding { asset: AssetView; balance: bigint; marketValue: bigint; costBasis: bigint | null; avgCost: bigint | null; }
export function usePortfolio(): { holdings: Holding[]; isLoading: boolean };

// lib/hooks/useBuyPrimary.ts —— 状态机：idle → signing → pending → success | error
export function useBuyPrimary(): { buy: (offeringId: bigint, amount: bigint, totalValue: bigint) => void;
  status: "idle" | "signing" | "pending" | "success" | "error"; txHash?: `0x${string}`; errorZh?: string; reset: () => void; };
```

### 环境变量（web/.env.example）
```
NEXT_PUBLIC_ARC_CHAIN_ID=5042002
NEXT_PUBLIC_ARC_RPC_URL=https://rpc.testnet.arc.network
NEXT_PUBLIC_ARC_EXPLORER_URL=https://testnet.arcscan.app
NEXT_PUBLIC_HADRON_ASSETS=0x4D82b6e528D3c2E1a3592e14863ec95EAeF4Ff85
NEXT_PUBLIC_HADRON_MARKET=0x962aba0A590981cf9c5B336aC34922c82f203165
NEXT_PUBLIC_DEPLOY_BLOCK=49771985
NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID=   # 可选；无则仅 injected 连接器（可从 arc-lepton/.env.local 复制）
```

### M2 明确留占位（不实装，防止范围膨胀）
- 链上动态流、24H 成交量、迷你走势线、交易历史表 → M4（activity-feed）；
- 二级挂单表、挂单转售弹窗、我的挂单 → M3；
- 持仓市值以**发行价**计（"最新成交价"待 M4 事件层）；成本按目标钱包的 `PrimarySale` 事件单次 getLogs 推导（分块/去重基建 M4 再做）。

---

## Task 1: Next.js 工程初始化与 A+ 主题

- [x] **Step 1.1** 仓库根执行 `npx create-next-app@latest web --ts --app --tailwind --eslint --no-src-dir --import-alias "@/*" --use-npm`，清理样板（默认 page 内容、vercel 图标等）
- [x] **Step 1.2** `globals.css` 写入 A+ token（上方冻结值）与基础样式（背景、选区、滚动条）；`layout.tsx` 接入 next/font（Inter + JetBrains Mono，`--font-sans/--font-mono`）
- [x] **Step 1.3** 安装依赖：`npm i wagmi viem @tanstack/react-query && npm i -D vitest @vitest/coverage-v8`；package.json 加 `"test": "vitest run"`
- [x] **Step 1.4** 验证：`npm run build` 成功；`npm run test` 报 "no test files"（可接受）
- [ ] **Step 1.5** 提交：`git commit -m "chore(web): 初始化 Next.js 工程与 A+ 主题 token"`

## Task 2: 链配置、wagmi 与合约接线

- [x] **Step 2.1** 参考 `/Users/captain/python/arc-lepton/lib/wagmi.ts` 移植：`lib/chain.ts`（`defineChain` 读 env：chainId/RPC/explorer/nativeCurrency USDC **18 decimals**——注意与 arc-lepton 的 6 不同，以 M1 实证为准）
- [x] **Step 2.2** `lib/wagmi.ts`：`createConfig`（injected 连接器；`NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID` 存在时追加 walletConnect）；`app/providers.tsx`（WagmiProvider + QueryClientProvider，"use client"）挂入 layout
- [x] **Step 2.3** ABI 同步：在 contracts/ 执行 `forge inspect HadronAssets abi --json > ../web/lib/abi/HadronAssets.json`（HadronMarket 同理）；`lib/contracts.ts` 导出地址（env）与 ABI；写 `web/.env.example` 与 `.env.local`（按冻结值）
- [x] **Step 2.4** 验证：`npm run build` 成功（env 缺失时给出清晰报错）
- [ ] **Step 2.5** 提交：`git commit -m "feat(web): Arc 链配置、wagmi Provider 与合约 ABI 接线"`

## Task 3: 金额格式化与静态元数据（TDD）

- [x] **Step 3.1（RED）** 写 `test/format.test.ts`（≥10 用例：整数/小数/千分位/compact "2.4M"/0/parse 往返/非法输入 throw/负数 throw）与 `test/metadata.test.ts`（4 个 slug 齐全、字段完整、未知 slug 返回兜底），跑 `npm run test` 记录 FAIL
- [x] **Step 3.2（GREEN）** 实现 `lib/format.ts`（纯 bigint 运算）与 `lib/metadata.ts` + 4 个 `content/assets/*.json`（中文描述、发行方叙事、apyBps：t-bill 510 / gold null / marina 620（租金收益）/ carbon null、docs 列表）
- [ ] **Step 3.3** `npm run test` 全绿；提交：`git commit -m "feat(web): USDC 18 位小数格式化与资产静态元数据（TDD）"`

## Task 4: 链上读取 hooks（目录/发行/持仓）

- [x] **Step 4.1（RED）** 写 `test/mappers.test.ts`：纯函数 `joinAssetsWithOfferings(assets, offerings, metaResolver)`、`computeStats(assetViews)`（TVL=Σ totalShares×发行价；avgApyBps 忽略 null）、`toHoldings(assetViews, balances, primarySaleLogs)`（移动平均成本）——用桩数据断言
- [x] **Step 4.2（GREEN）** 实现 `lib/hooks/useAssets.ts`（`useReadContract` 读 `assetCount/offeringCount` + `useReadContracts` 批量 `getAsset/getOffering`，`refetchInterval: 8000`，经 mappers 聚合）、`usePortfolio.ts`（`balanceOfBatch` + 目标钱包 `PrimarySale` getLogs 单次查询算成本）、`useNetworkGuard.ts`（`useChainId` + `useSwitchChain`）
- [ ] **Step 4.3** `npm run test` 全绿 + `npm run build` 成功；提交：`git commit -m "feat(web): 链上目录/发行/持仓读取 hooks（TDD mappers）"`

## Task 5: 全局布局与钱包连接

- [x] **Step 5.1** `TopBar.tsx`：左侧 `HADRON<span class=neon>.</span>` + 副标题 "REAL-WORLD ASSET EXCHANGE ON ARC"（宽字距小标签）；右侧网络徽章（连接且 chainId 正确→绿点 "● ARC TESTNET"，错误网络→红点 + "切换网络" 按钮调 `useNetworkGuard`）与 `WalletButton`（未连接→"CONNECT WALLET" GlowButton；已连接→`shortAddress` 胶囊 + 断开菜单）
- [x] **Step 5.2** `ui/GlowButton.tsx`（唯一允许发光的按钮）、`ui/Skeleton.tsx`（骨架微光）、导航（MARKET / PORTFOLIO 链接）
- [x] **Step 5.3** 验证：`npm run dev` 后 `curl -s localhost:3000 | grep -o "HADRON"` 命中；`npm run build` 成功
- [ ] **Step 5.4** 提交：`git commit -m "feat(web): 全局布局、TopBar 与钱包连接"`

## Task 6: 市场首页

- [ ] **Step 6.1** `StatsBar.tsx`：三格——TVL（`computeStats`，`AnimatedNumber` 数字滚动）、24H VOLUME（占位 "—" + "M4 接入" 注释）、AVG YIELD（金色）；`AnimatedNumber` 用 rAF 缓动，mono 字体
- [ ] **Step 6.2** `CategoryTabs.tsx`（ALL/TREASURIES/GOLD/REAL ESTATE/CARBON，胶囊高亮当前）+ `AssetCard.tsx`（类别渐变头图 + 名称 + 单价 + 金色 APY + 余量进度条 + BUY 按钮 → `/asset/[tokenId]`）+ `AssetGrid.tsx`（3 列网格、加载骨架、hover 光晕仅精选第一张卡）
- [ ] **Step 6.3** `page.tsx` 组装（首屏品牌区留 3D 占位 div + ActivityFeedPlaceholder 区块）；未连接钱包全部内容可浏览（只读模式）
- [ ] **Step 6.4** 验证：dev server 渲染 4 资产卡片与真实链上价格（curl 抓 SSR/CSR 由 Claude 浏览器人工核验清单记录）；`npm run build` 成功
- [ ] **Step 6.5** 提交：`git commit -m "feat(web): 市场首页（统计条/类别筛选/资产卡片/只读模式）"`

## Task 7: 资产详情与一级购买面板（trading-flow 核心）

- [ ] **Step 7.1（RED）** `test/buy-panel-logic.test.ts`：纯函数 `validatePurchase({ amount, remaining, balance, pricePerShare })` → `{ ok } | { errorZh }`（未连接/错误网络在组件层拦截；本函数覆盖：零数量、超余量、余额不足含 gas 缓冲 0.01 USDC、非法输入）；`mapWagmiError(err)` → 中文（UserRejected→"已取消签名"、insufficient funds→"余额不足"、其余→"交易失败，请重试"）
- [ ] **Step 7.2（GREEN）** 实现两个纯函数 + `useBuyPrimary.ts`（`useWriteContract` + `useWaitForTransactionReceipt`；状态机 idle/signing/pending/success/error；pending 期间 `buy` 幂等忽略——防重复点击）
- [ ] **Step 7.3** `asset/[id]/page.tsx` + `AssetProfile.tsx`（档案/发行方/docs）+ `BuyPanel.tsx`：数量输入（整数）、实时总价（mono 大字）、余额展示、状态按钮（未连接→CONNECT / 错误网络→SWITCH / 可买→BUY 发光 / signing→"钱包确认中…" / pending→spinner+txHash / success→绿色 + explorer 链接）+ `TxToast.tsx` 全局挂载；`ListingsPlaceholder` 与交易历史占位
- [ ] **Step 7.4** 验证：`npm run test` 全绿、`npm run build` 成功、dev server 详情页渲染链上余量
- [ ] **Step 7.5** 提交：`git commit -m "feat(web): 资产详情与一级购买面板（状态机/失败场景中文提示，TDD）"`

## Task 8: 持仓页 v1

- [ ] **Step 8.1** `portfolio/page.tsx` + `HoldingsTable.tsx`：每行——资产名/类别徽章、份额（mono）、市值（发行价×份额）、平均成本与成本额（无购买事件→"—"）、操作列"挂单转售"禁用按钮（tooltip "M3 开放"）；未连接→引导连接；空持仓→引导去市场
- [ ] **Step 8.2** 验证：`npm run test` + `npm run build` 全绿
- [ ] **Step 8.3** 提交：`git commit -m "feat(web): 持仓页 v1（份额/市值/移动平均成本）"`

## Task 9: M2 收口（用户人工验收 + 交叉检查）

- [ ] **Step 9.1** Codex（read-only 新会话）前端交叉检查：hooks 依赖数组/竞态、bigint 运算、错误处理完整性、A+ 视觉纪律偏离；修复发现的问题
- [ ] **Step 9.2** **用户检查点（人工验收清单）**：浏览器打开 dev server → ① 未连接浏览目录与详情 ② 连接钱包（Arc testnet）③ 错误网络提示切换 ④ 买 1 份 VERRA CARBON（≈1.85 USDC）⑤ toast 出现 explorer 链接且链上可查 ⑥ 持仓页出现份额与成本 ⑦ 刷新后状态一致
- [ ] **Step 9.3** 留证：vitest/build 输出 + 用户验收的交易哈希记入 `deployments/arc-testnet.json` 的 `m2Acceptance` 字段；勾选 openspec tasks.md 2.1–2.5；提交

---

## 用户检查点

1. **Task 9.2**：需要你在浏览器里完成一次真实购买（钱包在手上只有你能签名）；
2. 若 arc-lepton 的 WalletConnect projectId 需要复用，Task 2 时告知（否则默认仅 injected/MetaMask 连接）。
