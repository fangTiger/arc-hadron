# Change: HADRON — Arc RWA 交易市场 MVP

## Why

HADRON 旨在展示 Arc testnet 上 RWA 份额化交易的完整链上体验：真实合约结算（USDC 原生 gas）、每笔交易可在 explorer 查证、契合 Arc 的 RWA + USDC 结算叙事，并以机构级质感的界面呈现。当前仓库为空项目，一切从零构建。设计已经 brainstorming 澄清并经 Codex 交叉审查定稿（见 `docs/plans/2026-07-02-hadron-rwa-exchange-design.md`）。

## What Changes

- 新增 `contracts/` Foundry 工程：`HadronAssets`（ERC-1155 资产登记 + 份额铸造）与 `HadronMarket`（固定价一级发行 + 二级挂单市场，原生 USDC 结算，0.5% 协议费），部署至 Arc testnet 并发行 4 类种子资产（国债/黄金/房地产/碳信用）。
- 新增 `web/` Next.js 前端：市场首页、资产详情、持仓三个页面，A+ 视觉风格（霓虹终端 × 机构纪律），纯链上读取 + 静态元数据，无数据库、无登录。
- 新增链上实时动态流、图表走势可视化、微动效系统；3D 首屏英雄元素为末期可选增强。
- 从 arc-lepton 移植 Arc 链定义、wagmi/WalletConnect 配置、receipt 等待模式；不移植 JWT/x402/数据库。

## Capabilities

### New Capabilities

- `asset-registry`: ERC-1155 资产登记与份额铸造——owner 创建资产档案（名称/类别/份额总量/元数据 URI）、输入不变量、事件与前端可读接口。
- `primary-market`: 一级发行——owner 创建/关闭固定价发行（份额托管）、任何人原生 USDC 精确付款购买、协议费分账。
- `secondary-market`: 二级市场——持有人授权后挂单托管、自定价、部分成交、撤单退回、生命周期边界与对抗性安全约束。
- `market-browsing`: 市场浏览——首页目录（统计条/类别筛选/资产卡片）、资产详情（档案/挂单表/走势图/交易历史）、未连接钱包的只读模式。
- `trading-flow`: 钱包交易流程——连接钱包、授权引导两步流、购买/挂单/撤单交互、交易状态反馈（pending → 确认 → explorer 链接）、失败场景中文提示。
- `portfolio`: 持仓管理——我的份额（市值/成本）、挂单转售、我的在售挂单管理。
- `activity-feed`: 链上动态流——事件日志分块扫描、`txHash + logIndex` 去重、RPC 限流退避、每条记录可跳转 Arc explorer。

### Modified Capabilities

（无——全新项目，无现有规范。）

## Impact

- Affected specs: 上述 7 个全部为新增能力。
- Affected code: 全部为新增——`contracts/`（Foundry 工程）、`web/`（Next.js 工程）、`web/content/assets/`（静态元数据）。
- 外部依赖：Arc testnet RPC 与 explorer、测试网 USDC gas（部署账户与种子交易钱包需事先领水）、OpenZeppelin 合约库、wagmi/viem/WalletConnect、lightweight-charts、react-three-fiber（可选 M5）。
- 实现约束：全部代码由 codex MCP 实现（Claude 设计/调度/审查）；TDD 强制；Gemini 不可用，其审查职责由 Codex + Claude 自审代替。
