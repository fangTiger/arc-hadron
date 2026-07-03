# HADRON 收益分配设计 — Yield Distribution

> 状态：设计草稿（Claude 独立分析），待 Codex 交叉验证。**用户已提前授权**（2026-07-04：设计/提案无需逐项确认，实现完成后统一看结果）。
> 路线依据：memory/roadmap-decision-2026-07（AI 层 → 买单深度 → **收益分配**，路线图最后一项）。

## Context

RWA 资产元数据带 apyBps（展示用），但持有份额没有任何实际收益路径。本期补上收益闭环：收益入金 → 份额持有人按持仓比例领取。份额是 ERC1155 可自由转让（且市场合约会托管挂单份额），分配正确性必须在转账下成立。

## Goals / Non-Goals

**Goals**
- 任何地址可对某资产入金收益（原生 USDC），按当时流通份额比例记账
- 持有人随时领取自己累计的收益（单资产/批量）；转账/买卖后各方权益精确不串
- 资产页 YIELD 面板（待领金额 + Claim + 累计已分配 + 入金入口）；持仓页每持仓待领 + 汇总
- 事件进活动流（英文文案）

**Non-Goals**
- 定期自动分配 / keeper（入金是显式交易）
- 按 apyBps 自动计算收益金额（apyBps 仍为展示元数据，入金金额由入金方决定）
- 多币种收益（仅原生 USDC）
- AI 快照纳入收益数据（schema 升版单独跟进）
- 收益的平台抽成（本期 0 费，与市场费分离）

## 方案对比

**方案 A（推荐）：每股累积器 + 转账钩子（dividend-per-share）**
独立 `HadronYield` 合约维护 `accPerShare[tokenId]`（1e18 精度）与每户 debt；`HadronAssets._update` 钩子在每次转账前结算转出/转入双方的应计收益。数学上是经过大量实践检验的 MasterChef/dividend token 模式。
- 优点：转账下精确；随时领取；O(1) 入金与领取
- 缺点：HadronAssets 需要加钩子（**BREAKING，重部署 V5**）；每次转账多几个 SSTORE

**方案 B：链下快照 + Merkle 领取**
无后端、无索引器的项目结构放不下。否决。

**方案 C：每户 checkpoint 快照（record-date 式）**
ERC1155 无现成 Snapshot 扩展，自实现每户每 token 的 checkpoint 历史，gas 与复杂度远超 A。否决。

**方案 D：简单资金池（无累积器）**
`claim = balance × pool / totalSupply` 在转账后无法防重复领取/漏领。数学不成立，否决。

## 合约设计（方案 A）

### HadronYield（新合约）

```solidity
// 核心状态
mapping(uint256 tokenId => uint256) accPerShare;          // 1e18 精度
mapping(uint256 tokenId => uint256) undistributedDust;    // 入金除不尽的余数，滚入下次
mapping(uint256 tokenId => uint256) excludedBalance;      // 被排除账户（市场托管）的份额合计
mapping(address => bool) excludedAccounts;                // owner 设置：HadronMarket
mapping(address account => mapping(uint256 tokenId => uint256)) rewardDebt;
mapping(address account => mapping(uint256 tokenId => uint256)) accrued;

// 接口
function depositYield(uint256 tokenId) external payable;                   // 任何地址可入金（便于演示与"发行方"语义并存）
function claimYield(uint256 tokenId) external nonReentrant;
function claimYieldBatch(uint256[] calldata tokenIds) external nonReentrant;
function pendingYield(address account, uint256 tokenId) external view returns (uint256);
function notifyTransfer(address from, address to, uint256 tokenId, uint256 amount) external; // 仅 HadronAssets 可调
function setExcludedAccount(address account, bool excluded) external onlyOwner;

event YieldDeposited(uint256 indexed tokenId, address indexed depositor, uint256 amount, uint256 accPerShareAfter);
event YieldClaimed(uint256 indexed tokenId, address indexed account, uint256 amount);
```

**记账规则：**
- 流通份额 `circulating = totalSupply(tokenId) - excludedBalance[tokenId]`；入金 `accPerShare += (amount + dust) * 1e18 / circulating`，除不尽的余数存回 dust；`circulating == 0` 时 revert（无人可分）
- `notifyTransfer` 在余额变动**之前**被调（钩子传入转账前余额可推导）：对 from/to 各自执行 settle——`accrued += balance × accPerShare / 1e18 - rewardDebt`，随后按转账后余额重置 rewardDebt；被排除账户不 settle、不计 debt，只维护 excludedBalance 增减
- **托管份额政策（关键决策）**：市场合约（挂单托管中的份额）被排除在收益分配之外——挂单期间不计息，收益全部归非托管持有人；无资金滞留（circulating 作分母）。类比现实市场的 record-date：托管中的份额不在册。发行/一级 offering 托管同理（offering 未售出份额也在市场合约，不参与分配——收益归已流通份额，语义正确）
- mint（发行）路径：from=0 时只 settle to；本项目份额发行即转入市场托管（被排除），首次真正 settle 发生在买家买入时，debt 从当时 accPerShare 起算，天然不吃历史收益

### HadronAssets 修改（BREAKING → V5 重部署）

- 增 `address yieldHook` + `setYieldHook(address) onlyOwner`（可更新，事件可溯）+ `_update` override：hook 非零时调用 `notifyTransfer`（逐 id/amount）
- 钩子约束：HadronYield.notifyTransfer 只做记账、无外部调用、不 revert（除 caller 校验），转账 gas 增量有界
- 安全：claim 走 CEI + nonReentrant，`_sendValue` 语义与市场合约一致（拒收只伤自己）；**不存在可划走已计提收益的管理员函数**；setExcludedAccount 变更时结转该账户 excludedBalance（先 settle 后切换，防口径跳变）

## 前端设计

| 模块 | 变更 |
|------|------|
| `web/lib/contracts.ts` | HadronYield ABI + 地址 env（`NEXT_PUBLIC_HADRON_YIELD`） |
| `web/lib/events.ts` | `yield-deposited` / `yield-claimed` 解码（不进成交口径 TRADE_TYPES——收益不是交易） |
| 活动流 | 两类事件英文文案（如 "YIELD +12.00 TBILL" / "CLAIM 3.20 TBILL"），色调沿现有语义 |
| `web/lib/hooks/useYield.ts` | `usePendingYield(tokenIds[])`（multicall pendingYield）+ `useDepositYield` + `useClaimYield`（对称既有交易 hooks） |
| 资产页 | `YieldPanel`：待领金额（连接钱包时）+ Claim；累计已分配（YieldDeposited 事件聚合）；"Distribute" 二级入口（金额输入 + Deposit，任何钱包可入金） |
| 持仓页 | 持仓行待领列 + 行内 Claim；顶部 pending 汇总 |

- 金额展示沿 formatUsdc；事件读取沿分块扫描 + 缓存惯例

## 部署与数据（V5）

- HadronAssets 变更 → 三合约全新部署（Assets/Market/Yield）+ `SeedV5.s.sol`（SeedV4 全部职责 + setYieldHook + 排除市场地址 + 2-3 个资产的收益入金样本 + 1 笔领取样本）
- 广播实操遵循 memory/arc-testnet-broadcast-practice：`--slow` + `FOUNDRY_OFFLINE=true` + 一次性播种密钥（新 SEED5 key）
- env 切换同 V4 惯例（地址 ×3 / DEPLOY_BLOCK / FIRST_ACTIVE_TOKEN_ID=1 不变）
- **验收合并**：买单深度 5.3 尚未验收，V5 包含其全部功能——用户明天在 V5 上一并验收买单深度与收益分配

## 测试策略（TDD）

- 合约单测 `HadronYield.t.sol`：单人入金领取；两人不同持仓比例；转账后双方权益精确（转出方保留已计提、转入方不吃历史）；多次入金穿插转账；dust 滚存；circulating==0 入金 revert；重复领取为 0；批量领取
- 排除账户：挂单托管后收益归余下持有人；撤单回来恢复计息；offering 托管不参与
- 对抗：claim 重入被拒；拒收领取只伤自己；非 HadronAssets 调 notifyTransfer 被拒；hook 未设置时转账正常
- invariant/fuzz：随机入金/转账/领取序列后 `Σ accrued + Σ pending + dust ≤ 合约余额`（无超发）
- 前端：事件解码、活动流文案、useYield hooks（mock wagmi）、YieldPanel/持仓列组件态
- 全量回归：forge 67 + web 224 零回归

## 验收标准（Clarify Gate，用户提前授权模式下由设计固化）

1. GIVEN 两个地址分别持有同资产 30%/70% 流通份额 WHEN 入金 10 USDC THEN 两人 pending 分别为 3/7（±dust）
2. GIVEN 持有人转让一半份额 WHEN 再次入金 THEN 新旧持有人按转让后比例计提，转让前的计提保留给原持有人
3. GIVEN 份额挂单托管中 WHEN 入金 THEN 托管份额不参与分配；撤单后恢复参与
4. GIVEN 有 pending 的持有人 WHEN Claim THEN 到账金额精确、pending 归零、重复 Claim 无支付
5. 资产页/持仓页 YIELD 数据与链上一致；活动流出现 YIELD/CLAIM 记录
6. forge + web 全量测试/lint/build 通过，三页 200

## 开放决策（授权模式下 Claude 定案，供用户回看）

1. **入金权限**：开放给任何地址（而非 onlyOwner）——便于用户明天用自己钱包演示入金，且"捐赠式收益"无安全害处。
2. **托管份额不计息**：排除市场合约（见记账规则），语义类比 record-date，避免资金滞留托管方。
3. **V5 重部署合并验收**：买单深度与收益分配一并在 V5 验收，避免两次重置。
