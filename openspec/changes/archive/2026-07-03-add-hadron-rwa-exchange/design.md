# Design: HADRON — Arc RWA 交易市场 MVP

> 完整设计详见 `docs/plans/2026-07-02-hadron-rwa-exchange-design.md`（已经用户批准 + Codex 交叉审查）。
> 本文件是其技术决策摘要，实现期以两者为准；冲突时以本变更目录内文件为准。

## Context

- 全新空仓库，目标是在 Arc testnet（USDC 为原生 gas 的 Circle 稳定币链）上构建可查证的 RWA 交易市场，作为 Arc 生态的公开 showcase 项目。
- 姊妹项目 `/Users/captain/python/arc-lepton` 已验证 Arc 链配置与真实上链（`nativeCurrency = USDC, 6 decimals`），可移植钱包/链配置代码。
- 流程约束：TDD 强制；代码全部由 codex MCP 实现；Gemini 不可用，审查由 Codex + Claude 自审代替。

## Goals / Non-Goals

**Goals:**
- 完整双市场闭环：浏览 → 连钱包 → 一级购买 → 链上确认 → 持仓 → 挂单转售 → 二级购买。
- 每笔交易可在 Arc explorer 查证；所见数据即链上数据。
- A+ 视觉（霓虹终端 × 机构纪律）+ 微动效 + 动态流 + 图表；3D 首屏元素可选。

**Non-Goals:**
- KYC/合规层、用户自发行、订单簿、AMM、派息/赎回、后端数据库、JWT 登录、主网部署、移动端深度适配。

## Decisions

| # | 决策 | 选择 | 备选与否决理由 |
|---|------|------|--------------|
| 1 | 代币标准 | ERC-1155 单合约（每资产一个 token ID） | 每资产一个 ERC-20：部署/索引/前端工作量翻倍，含金量无增益 |
| 2 | 市场模型 | 固定价挂单（一级发行 + 二级托管挂单，支持部分成交） | 订单簿：复杂度高且测试网无对手盘；AMM：与 RWA 的 NAV 定价叙事冲突 |
| 3 | 结算 | 原生 USDC `msg.value` 精确付款（6 decimals），支付层抽象为 `_collectPayment/_payout` | ERC-20 `transferFrom` 仅作 M1 冒烟失败后的备用分支；arc-lepton 已实证原生形态 |
| 4 | 资金派发 | push 直转 + CEI + `nonReentrant` + 恶意收款合约对抗测试 | pull-payment 更稳但多一步提现 UX，demo 交互步数优先（Codex 分歧已记录） |
| 5 | 托管模型 | 挂单/一级发行份额均转入市场合约托管（继承 `ERC1155Holder`），前置 `setApprovalForAll` | 授权划转模式会出现"挂单后转走份额"的失效挂单 |
| 6 | 权限 | `Ownable2Step`、`feeBps <= 500`、`closePrimaryOffering` 回收库存、无管理员划走托管资产的后门 | `Pausable` 被否决（YAGNI，缩小 owner 权限面） |
| 7 | 数据层 | 状态走合约 getter（计数器 + 按 ID 查询 + 活跃挂单查询 + 部署区块常量），日志仅用于动态流/历史；react-query 轮询 5-10s | 纯 getLogs 全量扫描在测试网 RPC 限流下不可靠；数据库/索引器为 Non-Goal |
| 8 | 合约工具链 | Foundry（forge test/fuzz/script） | Hardhat 慢且与前端仓库耦合 |
| 9 | 前端栈 | Next.js App Router + wagmi + viem + Tailwind + lightweight-charts | 沿用 arc-lepton 验证过的组合，降低集成风险 |
| 10 | 仓库结构 | `contracts/` 与 `web/` 双工程，经部署产物（地址 + ABI）衔接 | monorepo 工具链（turbo 等）对双工程是过度设计 |

## Risks / Trade-offs

- [原生结算未在"合约收付款"场景实证] → M1 部署后先做小额冒烟交易；失败则切 ERC-20 备用分支（仅此时引入 approve 流）。
- [测试网 RPC 限流/不稳定] → getter 优先、日志分块增量扫描、`txHash+logIndex` 去重、指数退避。
- [测试网成交稀疏，图表空荡] → 种子脚本用多钱包制造真实链上交易，不伪造数据；走势以发行价基线兜底。
- [协议费向下取整，小额成交费为 0] → 记为已知行为，测试覆盖。
- [3D 元素性能] → 仅首屏一处、惰性加载、静态图降级、放 M5 可砍。
- [Codex 实现偏离设计] → 每任务附文件路径 + 验收命令下发，Claude 逐 diff 审查 + 运行测试。

## Migration Plan

全新项目，无迁移。部署顺序：`HadronAssets` → `HadronMarket`（构造注入 assets 地址、treasury、feeBps）→ 种子资产发行脚本 → 前端注入地址/ABI → Vercel 部署。回滚 = 重新部署新地址并更新前端配置（测试网无状态包袱）。

## Open Questions

- Arc testnet 领水渠道与额度（部署账户 + 种子交易多钱包）——M1 启动时确认。
- 资产元数据 `metadataURI` 指向仓库内静态 JSON 的最终 URL 形态（相对路径 vs 部署域名绝对路径）——M2 前端接入时冻结。
