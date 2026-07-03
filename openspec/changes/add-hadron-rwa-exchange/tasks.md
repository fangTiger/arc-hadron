# Tasks: HADRON — Arc RWA 交易市场 MVP

> 大任务：本清单为**高层任务**，实现前由 `superpowers:writing-plans` 细化为 bite-sized 步骤
> （产出 `docs/plans/YYYY-MM-DD-hadron-*.md`）。全部代码由 codex MCP 实现，TDD 强制。

## 1. M1 — 合约与链上地基

- [x] 1.1 初始化 `contracts/` Foundry 工程（OpenZeppelin 依赖、目录规范、CI 可用的 forge test）
- [x] 1.2 TDD 实现 `HadronAssets`（asset-registry spec：登记/铸造/getter/不变量/事件）
- [x] 1.3 TDD 实现 `HadronMarket` 一级发行（primary-market spec：创建/购买/关闭/协议费/精确付款）
- [x] 1.4 TDD 实现 `HadronMarket` 二级市场（secondary-market spec：挂单/部分成交/撤单/对抗性安全）
- [x] 1.5 fuzz 与对抗性测试补全（输入不变量、恶意收款合约、费用取整）
- [x] 1.6 部署脚本 + Arc testnet 部署（含领水确认），小额冒烟交易实证原生 USDC 结算（失败则切 ERC-20 备用分支并回改 spec）
- [x] 1.7 种子资产发行脚本：4 类资产（国债/黄金/房地产/碳信用）上架一级发行；Codex 交叉检查合约代码

## 2. M2 — 前端骨架与一级购买闭环

- [x] 2.1 初始化 `web/` Next.js 工程（Tailwind + A+ 主题 token、wagmi/viem/WalletConnect 从 arc-lepton 移植、地址/ABI 注入）
- [x] 2.2 静态资产元数据（`web/content/assets/*.json` + 图片）与合约读取 hooks（`useAssets` 等，getter 优先）
- [x] 2.3 市场首页 v1（market-browsing spec 的目录部分：统计条/类别筛选/资产卡片/只读模式；动态流与迷你走势线留占位，由 M4 的 4.1/4.2 实装）
- [x] 2.4 资产详情页 v1 + 一级购买面板（trading-flow spec：连接钱包/网络守卫/状态反馈/失败场景）
- [x] 2.5 持仓页 v1（portfolio spec：持仓展示）；端到端验证一级购买闭环并留存交易哈希证据（用户真实钱包 0.01 份额购买 0xf3b7cc…39e7，块 49914376，费用 50bps 精确核对，见 deployments/arc-testnet.json userAcceptance）

## 3. M3 — 二级市场闭环

- [x] 3.1 挂单转售流程（授权引导两步流 + 持仓弹窗 + 我的挂单管理）（9a7f8d0/65ecd90 + M3R 修复，Codex 交叉检查通过）
- [x] 3.2 详情页二级挂单表与购买（含部分成交）（256bb70 + 小数份额层 df5cd0a）
- [x] 3.3 双钱包端到端验证：用户钱包挂单（listing 41/42/43，SELL tab 两步流）→ 购买 deployer 挂单（listing 17）→ 撤单退回（listing 43）；协议费精确 50bps cast 核对；Codex 交叉检查通过（1 BLOCKER + 1 SHOULD-FIX 已修 e389143）；全部哈希见 deployments/arc-testnet.json userAcceptance

## 4. M4 — 视觉与数据打磨

- [x] 4.1 链上动态流（activity-feed spec：分块扫描/去重/localStorage 缓存/explorer 链接；M2R/M3R 提前实装，25e4518）
- [x] 4.2 图表接入（lightweight-charts v5 走势图 + 发行价 ISSUE 基线 + 空态兜底，cd38996；表格迷你走势线沿用轻量 SVG）
- [x] 4.3 微动效系统（shimmer/toast 进出场/页面淡入/hover 统一 + prefers-reduced-motion 降级）与 A+ 视觉终审（71d6eb6）
- [x] 4.4 种子交易脚本（SeedV3 重发行 + SeedTrades/SeedSecondary 多轮：14 发行全覆盖、listingCount=40、变价自成交，1026783；另用户真实钱包成交 6 笔）

## 5. M5 — 可选增强与收尾

- [x] 5.1 （可选）3D 首屏英雄元素 — **决策：跳过**（可选项；性能与交易所审美风险大于收益，用户未要求）
- [x] 5.2 Vercel 部署 + README — **范围变更：部署排除**（2026-07-03 用户明确指示"排除 vercel 部署"）；README 已完成（530ef2a，品牌叙事 + explorer 可查证清单）
- [x] 5.3 verification-before-completion：最终取证（2026-07-03）——forge 42 用例全绿、vitest 27 文件/151 用例全绿、eslint 0 问题、next build 通过、//portfolio//asset/15//asset/19 均 200；用户真实钱包 6 笔验收交易（一级/二级购买、挂单×3、撤单）cast 事件解码核对，哈希见 deployments/arc-testnet.json
- [ ] 5.4 归档：delta specs 合并至 `openspec/specs/`、design.md 同步、完整性 6 项检查
