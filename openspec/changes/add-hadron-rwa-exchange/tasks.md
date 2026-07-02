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
- [ ] 2.2 静态资产元数据（`web/content/assets/*.json` + 图片）与合约读取 hooks（`useAssets` 等，getter 优先）
- [ ] 2.3 市场首页 v1（market-browsing spec 的目录部分：统计条/类别筛选/资产卡片/只读模式；动态流与迷你走势线留占位，由 M4 的 4.1/4.2 实装）
- [x] 2.4 资产详情页 v1 + 一级购买面板（trading-flow spec：连接钱包/网络守卫/状态反馈/失败场景）
- [ ] 2.5 持仓页 v1（portfolio spec：持仓展示）；端到端验证一级购买闭环并留存交易哈希证据

## 3. M3 — 二级市场闭环

- [ ] 3.1 挂单转售流程（授权引导两步流 + 持仓弹窗 + 我的挂单管理）
- [ ] 3.2 详情页二级挂单表与购买（含部分成交）
- [ ] 3.3 双钱包端到端验证：挂单 → 他人部分购买 → 撤单退回，协议费入账核对；Codex 交叉检查前端交易层

## 4. M4 — 视觉与数据打磨

- [ ] 4.1 链上动态流（activity-feed spec：分块扫描/去重/退避/explorer 链接）
- [ ] 4.2 图表接入（lightweight-charts 走势图 + 卡片迷你走势线，真实成交数据 + 发行价基线兜底）
- [ ] 4.3 微动效系统（数字滚动/悬停光晕/页面过渡/骨架屏微光）与 A+ 视觉终审
- [ ] 4.4 种子交易脚本（多钱包制造真实链上成交，喂饱动态流与图表）

## 5. M5 — 可选增强与收尾

- [ ] 5.1 （可选）3D 首屏英雄元素（react-three-fiber，惰性加载 + 静态降级，性能不劣化）
- [ ] 5.2 Vercel 部署 + README（品牌叙事 + explorer 可查证清单）
- [ ] 5.3 verification-before-completion：全部验收标准逐条取证（forge/vitest 输出 + 交易哈希）
- [ ] 5.4 归档：delta specs 合并至 `openspec/specs/`、design.md 同步、完整性 6 项检查
