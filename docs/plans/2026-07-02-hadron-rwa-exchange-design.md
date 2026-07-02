# HADRON — Real-World Asset Exchange on Arc 设计文档

> 日期：2026-07-02
> 状态：待用户最终审阅（brainstorming 已完成，各项决策均经用户逐项确认）
> 流程位置：brainstorming（本文档）→ OpenSpec proposal → writing-plans → Codex 实现 → verification → 归档
> 分工：Claude 负责设计/调度/审查，**全部代码由 codex MCP 实现**；Gemini 当前不可用，其审查职责由 Codex + Claude 自审代替

---

## 1. 背景与目标

- 基于 **Arc testnet**（Circle 的稳定币金融链，USDC 为原生 gas）构建 RWA（现实资产）交易市场。
- **项目定位：Arc 生态的公开 showcase**，质量标准：
  1. 真实上链——每笔交易可在 Arc explorer 查证，拒绝纯前端 mock；
  2. 炫酷高质感 UI——访客第一印象；
  3. 契合 Arc 官方叙事——RWA + USDC 结算。
- 品牌：**HADRON**，副标题 "Real-World Asset Exchange on Arc"。与姊妹项目 arc-lepton（SIGNAL/LEDGER）呼应："lepton 记录轻量信号，hadron 承载真实资产"。
- 无截止日期，但按里程碑分批交付，保证任何时点都有可演示版本。

## 2. 已确认决策清单

| # | 决策点 | 结论 |
|---|--------|------|
| 1 | 资产种类 | 多类别策展目录：国债、黄金、房地产份额、碳信用（4 类起步，每类 2-4 个资产），仅官方发行，无用户自发行 |
| 2 | 代币标准 | ERC-1155 单合约，每资产一个 token ID，份额 = 同 ID 可互换数量 |
| 3 | 市场模型 | 固定价挂单市场：一级官方发行 + 二级用户自定价转售，USDC 结算 |
| 4 | 发行方与 KYC | 发行方 = 合约 owner（项目方），铸造/一级上架仅限管理员；购买无 KYC 门槛 |
| 5 | 合约工具链 | Foundry（forge test / fuzz / 部署脚本） |
| 6 | 前端技术栈 | Next.js App Router + wagmi + viem + Tailwind（沿用 arc-lepton 验证过的组合） |
| 7 | 数据层 | 纯链上读取 + 仓库内静态元数据，**无数据库、无 JWT 登录**，钱包即身份 |
| 8 | 视觉风格 | A+ 融合方案：霓虹终端基底 × 机构排版纪律 × 暗金收益色 |
| 9 | 亮眼模块 | 微动效系统、链上实时动态流、图表走势可视化（必做）；3D/WebGL 首屏英雄元素（末期可选） |
| 10 | MVP 范围 | 完整双市场闭环：浏览 → 连钱包 → 一级购买 → 链上确认 → 持仓 → 挂单转售 → 二级购买 |

## 3. 系统架构

```
┌─ Arc Testnet ─────────────────────────────────────┐
│   HadronAssets (ERC-1155)   ←──授权──   HadronMarket │
│   资产登记 + 份额铸造            一级发行 + 二级挂单 + 结算│
└─────────┬──────────────────────────────┬──────────┘
          │ viem 读状态 / getLogs 事件      │ wagmi 写交易
┌─────────┴──────────────────────────────┴──────────┐
│ web/ — Next.js App Router（纯前端，无服务端写操作）      │
│   · 静态资产元数据 content/assets/*.json + 图片        │
│   · react-query 轮询链上数据                          │
└───────────────────────────────────────────────────┘
```

- **仓库结构**：`contracts/`（Foundry 独立工程）+ `web/`（Next.js）+ `docs/` + `openspec/`。两个工程互不依赖，通过部署产物（地址 + ABI）衔接。
- **单元边界**：合约层只关心资产与资金安全；前端 hooks 层封装所有链上读写（`useAssets` / `useListings` / `useActivity` / `usePortfolio`），页面组件不直接触碰 viem；元数据模块独立成静态文件，改文案/图片不动代码。

## 4. 合约设计

### 4.1 HadronAssets（ERC-1155）

- 基于 OpenZeppelin ERC-1155 + Ownable。
- `createAsset(name, category, totalShares, metadataURI)`：仅 owner，登记资产档案并铸造全部份额给 owner；`tokenId` 自增。
- 资产档案结构：`Asset { name, category, totalShares, metadataURI, exists }`；`uri(id)` 返回逐资产 URI。
- 事件：`AssetIssued(tokenId, name, category, totalShares)`。

### 4.2 HadronMarket（固定价挂单市场）

**一级发行：**
- `createPrimaryOffering(tokenId, pricePerShare, amount)`：仅 owner，把份额转入市场合约托管并定价；
- `buyPrimary(offeringId, amount)`：任何人支付 USDC 购买，份额直转买家，货款转 owner（扣协议费）。

**二级市场：**
- `list(tokenId, amount, pricePerShare)`：持有人挂单，份额托管进合约；
- `cancel(listingId)`：仅卖家，份额退回；
- `buy(listingId, amount)`：支持部分成交，货款给卖家（扣协议费），份额给买家。

**通用规则：**
- 市场合约继承 `ERC1155Holder`（托管接收 1155 的必要条件）；
- **授权前置**：owner 上架与用户挂单前，须对市场合约 `setApprovalForAll`；前端把"授权 → 挂单"封装为引导式两步流程；
- **输入不变量**（写入 spec 并逐条测试）：`amount > 0`、`pricePerShare > 0`、`totalShares > 0`、`amount <= remaining`、`treasury != address(0)`、`feeBps <= 500`（上限 5%）、已取消/已售罄的发行与挂单不可购买；
- `closePrimaryOffering(offeringId)`：仅 owner，退回剩余份额，防止错价或滞销库存永久锁在合约；
- 协议费 50 bps 打入金库地址：整数除法向下取整，小额成交费可为 0（已知行为，非缺陷）；金库变更发 `TreasuryUpdated` 事件；
- 权限最小化：`Ownable2Step`；**不提供**任何可划走用户托管资产的管理员函数；
- 事件：`AssetIssued / PrimarySale / Listed / Cancelled / Purchased`，关键字段 `indexed`，驱动前端动态流与交易历史；
- 安全：全部交易函数 `nonReentrant` + checks-effects-interactions；挂单份额托管而非授权划转，杜绝"挂单后转走份额"的失效场景；
- **支付派发（决策记录）**：采用 push 直转（要求 `msg.value` 精确等于总价 + CEI + `nonReentrant`，并以恶意/拒收收款合约测试覆盖）。pull-payment 记账提现方案被否决——理由：demo 以交互步数最少为优先，其风险已被上述约束覆盖（Codex 建议 pull 更稳，Claude 裁决记录于第 11 节）；
- **前端可读接口**：`assetCount / offeringCount / listingCount`、按 ID 的 getter、按资产的活跃挂单查询、部署区块常量——**状态读取不依赖 getLogs**，日志仅用于动态流与交易历史。

### 4.3 结算方式（默认已冻结为原生 USDC）

**默认方案 A：原生 `msg.value` 结算**——`payable` 函数要求精确付款（`msg.value == pricePerShare × amount`），USDC 按 6 位小数计。依据（Codex 审查 arc-lepton 的实证）：

- `arc-lepton/lib/wagmi.ts` 将 Arc 的 `nativeCurrency` 配置为 `USDC, decimals: 6`，且其真实上链交易已按此验证通过；
- arc-lepton 未验证过任何 ERC-20 形态的 USDC 付款路径。

方案 B（ERC-20 `transferFrom` + `SafeERC20`）仅作为备用分支：只有当 M1 实证发现 Arc 官方另有 ERC-20 USDC 合约地址且原生方案不可行时才启用。支付收取/派发仍抽象为内部函数（`_collectPayment` / `_payout`），但 ABI、前端流程与测试均按方案 A 编写，不做双份。

## 5. 前端设计

### 5.1 页面结构（3 页 + 全局组件）

| 页面 | 路由 | 内容 |
|------|------|------|
| 市场首页 | `/` | 首屏英雄区（品牌 + 3D 预留位）、TVL/24H 成交量/平均收益率统计条（数字滚动）、类别筛选 Tab、资产卡片网格（迷你走势线 + 发光 BUY）、链上实时动态流（每条链接 explorer） |
| 资产详情 | `/asset/[id]` | 资产档案与"发行文件"展示、一级购买面板、二级挂单表（买入/撤单）、价格走势图、交易历史表 |
| 持仓 | `/portfolio` | 我的份额列表（市值/成本）、挂单转售弹窗、我的在售挂单管理（撤单） |

全局：顶栏（品牌 + 网络指示灯 + 钱包连接）、交易确认 Toast（pending → 上链成功 → explorer 链接）。

### 5.2 A+ 视觉规范

- **色板**：背景 `#05070d`、面板 `#0a0e16`、边框 `#1c2333`、主霓虹青 `#22d3ee`（唯一霓虹色）、暗金收益色 `#e9c46a`、正文 `#eaf6ff`、次级 `#9ca3af`、涨 `#34d399`。
- **排版纪律**（吸收自"暗夜私行"）：全大写 + 宽字距小标签、严格卡片网格、克制的直线条。
- **发光纪律**：光晕仅用于 BUY 按钮与精选卡片，禁止满屏发光——与 meme DEX 划清界限。
- **微动效系统**（基础设施，全局复用）：数字滚动跳变、卡片悬停光晕、页面过渡、骨架屏微光。

### 5.3 数据层实现

- 读取：viem `readContract`（资产/发行/挂单状态）+ `getLogs`（成交与挂单事件，从部署区块起扫描、内存缓存增量拉取）；react-query 轮询 5-10s，注意测试网 RPC 限速节流。
- 走势图数据：由链上真实成交事件生成；测试网数据稀疏时以发行价为基线绘制，**不伪造成交**（保住"所见即链上"的叙事底线）。
- 图表：资产卡片用自绘 SVG 迷你走势线；详情页用 lightweight-charts（TradingView 开源库，金融终端风格与 A+ 视觉最契合）。
- 3D 英雄元素：react-three-fiber，仅首屏一处，惰性加载 + 降级为静态图，排在 M5。

### 5.4 从 arc-lepton 移植清单

| 资产 | 来源 | 处理方式 |
|------|------|---------|
| Arc 链定义与 RPC 配置 | `lib/wagmi.ts`、`lib/chain/` | 直接移植 |
| 钱包连接（wagmi + WalletConnect） | `lib/wagmi.ts` | 直接移植 |
| Arc 交易 receipt 等待/重试逻辑 | `lib/chain/arc-receipt.ts` | 参考其等待与幂等模式，改写为前端 hook |
| JWT/nonce 登录、x402 计费、Drizzle/Postgres | `lib/auth/`、`lib/x402/` | **不移植**（本项目无服务端写操作）；x402 代码仅作 USDC 结算方式的实证参考 |

## 6. 测试策略（TDD 强制）

- **合约**（含金量核心，测试优先级最高）：
  - forge 单元测试：发行、一级购买、挂单、部分成交、撤单、关闭发行、权限、协议费分账（含向下取整为 0 的小额场景）、未授权时挂单/上架 revert、付款不足/超付 revert；
  - 对抗性测试：恶意收款合约（重入、revert 拒收）不能破坏市场状态；
  - fuzz：价格 × 数量溢出、任意金额部分成交、非法 offeringId/listingId、第 4.2 节全部输入不变量；
  - 每条验收标准（第 8 节）至少对应一个测试。
- **前端**：Vitest 覆盖 hooks 与工具函数（事件解析、金额格式化、轮询合并逻辑）；页面交互以手动验证 + 截图为证（verification-before-completion）。
- **证据先于断言**：每个里程碑完成必须附 forge test / vitest 实际输出与链上交易哈希。

## 7. 交付里程碑

| 阶段 | 内容 | 完成标志 |
|------|------|---------|
| M1 | 结算方式实证 → 合约 TDD 开发 → 部署 Arc testnet | forge test 全绿；两合约地址可在 explorer 查证；脚本化发行 4 类种子资产 |
| M2 | 前端骨架 + A+ 主题 + 一级购买闭环 | 浏览 → 连钱包 → 买 → 链上确认 → 持仓，全流程真实交易哈希 |
| M3 | 二级市场（挂单/撤单/购买）+ 持仓管理 | 双钱包互相买卖成功，协议费入账 |
| M4 | 视觉打磨：动态流、图表、微动效系统 | 首页动态流展示真实链上事件并可跳转 explorer |
| M5（可选） | 3D 首屏英雄元素 | 加载性能不劣化（Lighthouse 不低于 M4 基线） |

每阶段按项目 CLAUDE.md 执行交叉检查（Codex 审查后端/合约，Claude 自审代替 Gemini 职责）。

## 8. 验收标准（Clarify Gate 产出）

1. **一级购买**：GIVEN 已连接钱包且持有测试网 USDC，WHEN 在资产详情购买 N 份，THEN 交易上链、买家份额 +N、发行库存 -N、动态流出现该笔记录且可跳转 Arc explorer。
2. **二级挂单**：GIVEN 持有某资产份额，WHEN 以自定价挂单 M 份，THEN 份额托管进市场合约、挂单出现在该资产挂单表与"我的挂单"。
3. **二级购买（部分成交）**：GIVEN 存在他人挂单，WHEN 购买其中一部分，THEN 买家得份额、卖家得货款 ×99.5%、金库得 0.5%、挂单余量正确递减。
4. **撤单**：GIVEN 自己有在售挂单，WHEN 撤单，THEN 剩余份额全额退回钱包，挂单从列表消失。
5. **权限**：WHEN 非 owner 调用 `createAsset` / `createPrimaryOffering`，THEN 交易 revert。
6. **只读浏览**：GIVEN 未连接钱包，WHEN 访问首页与资产详情，THEN 目录、行情、动态流正常展示，交易按钮引导连接钱包。
7. **授权流程**：GIVEN 首次挂单且未授权，WHEN 发起挂单，THEN 前端先引导 `setApprovalForAll` 再提交挂单，两步均上链可查；未授权直接调用合约则 revert。
8. **失败场景**：WHEN 余额不足 / 付款金额与总价不符 / 错误网络 / 用户拒签 / 重复点击，THEN 前端给出明确中文提示、不产生错误状态；交易 revert 后页面状态可通过刷新从链上完整重建。
9. **挂单生命周期边界**：部分成交后撤单退回准确余量；全量成交后挂单不可撤、不可再购买。
10. **数据层健壮性**：动态流按区块分块扫描、以 `txHash + logIndex` 去重、RPC 限流时指数退避，不重复渲染、不丢事件。

## 9. 风险与开放问题

| 风险 | 应对 |
|------|------|
| 原生 USDC 结算虽有 arc-lepton 实证，但未在"合约收付款"场景验证过 | M1 部署后先做小额冒烟交易实证；若失败启用备用方案 B（ERC-20 + SafeERC20） |
| 测试网 RPC 限速/不稳定 | react-query 节流与退避；getLogs 增量扫描；关键读兜底重试 |
| 测试网成交稀疏导致图表空荡 | 种子脚本用多个测试钱包制造真实链上交易（非伪造数据）；走势以发行价基线兜底 |
| 3D 元素性能风险 | 限定首屏一处、惰性加载、静态图降级、放最后可砍 |
| Codex 实现偏离设计 | 每任务附文件路径 + 验收命令下发；Claude 逐 diff 审查 + 运行测试 |

## 10. Out of Scope（明确排除）

- KYC/合规层（ERC-3643 风格白名单）——已在选型时否决；
- 用户自发行资产、订单簿、AMM；
- 后端数据库、索引器、JWT 登录；
- 收益分配/派息/赎回等资产生命周期管理；
- 主网部署与真实资产法律结构；
- 移动端深度适配（保证基础响应式即可）。

## 11. 交叉审查记录（2026-07-02）

Gemini 不可用，设计阶段交叉验证由 **Codex（只读审查）+ Claude 自审**完成，已达成共识：

**采纳的 Codex 意见**：市场合约继承 `ERC1155Holder`；`setApprovalForAll` 授权前置（含前端引导与验收标准 7）；输入不变量显式入 spec；合约暴露计数器/getter/部署区块，状态读取不依赖 getLogs；结算默认冻结为原生 `msg.value`（arc-lepton 实证 `nativeCurrency = USDC, 6 decimals`）；`closePrimaryOffering`；`Ownable2Step` + 费率上限 + 无管理员后门；协议费向下取整记为已知行为；验收补充失败场景、数据层健壮性、挂单生命周期边界。

**Claude 裁决（与 Codex 建议不同，理由记录）**：
1. **push 直转 vs pull-payment**：Codex 建议 pull 记账提现更稳；裁决采用 push 直转——demo 以交互步数最少为优先，风险由精确付款、CEI、`nonReentrant`、恶意收款合约对抗测试覆盖。
2. **Pausable**：Codex 指出测试策略与合约设计不一致；裁决**删除**"暂停边界"而非引入 `Pausable`（YAGNI，减少 owner 权限面）。

---

*批准本设计后进入 OpenSpec proposal 阶段（大任务流程：proposal → writing-plans → Codex 实现 → verification → 归档）。*
