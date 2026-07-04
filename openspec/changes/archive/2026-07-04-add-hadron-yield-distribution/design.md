# HADRON 收益分配设计 — Yield Distribution

> 状态：Codex 交叉验证 4 阻塞 + 3 建议已全部吸收（修订记录见文末）。**用户已提前授权**（2026-07-04：设计/提案无需逐项确认，实现完成后统一看结果）。
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
// 核心状态（scaled 记账：debt/accrued 均以 1e18 放大存储，消除逐次取整损耗）
mapping(uint256 tokenId => uint256) accPerShare;          // 1e18 精度
mapping(uint256 tokenId => uint256) dustScaled;           // 入金除不尽的 scaled 余数，滚入下次入金
mapping(uint256 tokenId => uint256) excludedBalance;      // 排除账户的份额合计（构造器固定名单）
mapping(address account => mapping(uint256 tokenId => uint256)) rewardDebtScaled;
mapping(address account => mapping(uint256 tokenId => uint256)) accruedScaled;

// 排除名单：构造器传入后不可变（本部署为 HadronMarket + 发行方 deployer），无运行中切换
// —— 消灭 exclude/unexclude 的结转边界整类问题（YAGNI）
address public immutable assets;               // HadronAssets，钩子 caller 校验 + 余额读取
// excludedAccounts: constructor(address[] memory excluded_)

// 接口
function depositYield(uint256 tokenId) external payable;                   // 任何地址可入金
function claimYield(uint256 tokenId) external nonReentrant;
function claimYieldBatch(uint256[] calldata tokenIds) external nonReentrant; // 重复 tokenId 幂等（第二次 pending=0）
function pendingYield(address account, uint256 tokenId) external view returns (uint256); // 向下取整到 wei
function notifyTransfer(address from, address to, uint256 tokenId, uint256 amount) external; // 仅 assets 可调
function isExcluded(address account) external view returns (bool);

event YieldDeposited(uint256 indexed tokenId, address indexed depositor, uint256 amount, uint256 accPerShareAfter);
event YieldClaimed(uint256 indexed tokenId, address indexed account, uint256 amount);
```

**记账规则（吸收交叉验证修订）：**
- 供给来源：HadronAssets 无 ERC1155Supply，用 `getAsset(tokenId).totalShares`（发行后固定、无 burn）；`circulating = totalShares - excludedBalance[tokenId]`
- 入金（scaled dust 口径）：`numerator = amount * 1e18 + dustScaled[tokenId]`；`accPerShare += numerator / circulating`；`dustScaled = numerator % circulating`；`circulating == 0` 或 `amount == 0` revert
- `notifyTransfer` 挂在 OZ v5 `_update` **头部**（该处余额尚未变动，可读转账前余额——已对照 OZ ERC1155 `_updateWithAcceptanceCheck → _update` 核实）；**`from == to` 显式 no-op**；batch 转账逐 (id, amount) 调用
- settle（普通账户）：`accruedScaled += balance * accPerShare - rewardDebtScaled`；转账后 `rewardDebtScaled = newBalance * accPerShare`；claim 支付 `accruedScaled / 1e18`，余数留在 accruedScaled（精确无损耗）
- **转账四组合表**：
  | from | to | 处理 |
  |---|---|---|
  | normal | normal | settle from + settle to（各自 debt 重置） |
  | normal | excluded | settle from；`excludedBalance += amount` |
  | excluded | normal | settle to（debt 自当前 acc 起算，不吃历史）；`excludedBalance -= amount` |
  | excluded | excluded | 仅 excludedBalance 净额不变，no-op |
  | mint (from=0) | any | 按 to 一侧规则处理（normal 则 settle to；excluded 则 excludedBalance += amount） |
- **排除政策（关键决策）**：排除名单 = 市场合约（挂单托管份额不计息，类比 record-date）+ 发行方 deployer（保留库存不分红——treasury shares 语义，同时避免演示收益大头回流发行方）。买单深度交互确认：`placeBid` 托管的是 USDC 非份额，与 excludedBalance 无关；`fillBid` 份额卖家直转 bidder，按 normal→normal 结算

### HadronAssets 修改（BREAKING → V5 重部署）

- 增 `address public yieldHook` + `setYieldHook(address) onlyOwner`——**一次性锁定**（已设置后再调 revert `HookAlreadySet`），设置发 `YieldHookSet` 事件；消灭 owner 换恶意 hook 的管理员攻击面
- `_update` override 头部：`yieldHook != 0` 时逐 (id, amount) 调 `notifyTransfer`；hook 为零地址期间转账正常（部署间隙的转账不产生收益记账——SeedV5 在任何入金前设置 hook，无历史缺账）
- 钩子失效面（文档化接受）：hook 一次性锁定 + notifyTransfer 纯记账（无外部调用、除 caller 校验外不 revert 的实现约束 + 测试覆盖），若仍有极端 bug 锁死转账则测试网重部署（演示项目逃生策略）
- 部署顺序：Assets（hook 空）→ Market(assets) → Yield(assets, [market, deployer]) → `assets.setYieldHook(yield)` 锁定
- 安全：claim 走 CEI + nonReentrant，付款语义与市场合约 `_sendValue` 一致（拒收只伤自己）；**不存在可划走已计提收益的管理员函数**（合约无 owner 提款；排除名单 immutable）

## 前端设计

| 模块 | 变更 |
|------|------|
| `web/lib/contracts.ts` | HadronYield ABI + 地址 env（`NEXT_PUBLIC_HADRON_YIELD`） |
| `web/lib/events.ts` | `yield-deposited` / `yield-claimed` 解码；**独立字段 `yieldAmount`（USDC wei）与 `account`，不复用份额语义的 `amount`**；不进成交口径 TRADE_TYPES |
| `useMarketEvents` + `marketEventCache` | **事件扫描地址集与缓存 key 加入 HadronYield 地址**（现只扫 Assets/Market 两合约） |
| 资产页交易历史 | TradeHistoryTable **过滤掉 yield 事件**（收益不是成交，份额/价格列语义不适用）；收益活动展示在 YieldPanel 内 |
| 活动流 | 两类事件英文文案（"YIELD +12.00 TBILL" / "CLAIM 3.20 TBILL"，用 yieldAmount 按 USDC 格式化），色调沿现有语义 |
| `web/lib/hooks/useYield.ts` | `usePendingYield(tokenIds[])`（multicall pendingYield）+ `useDepositYield` + `useClaimYield`（对称既有交易 hooks） |
| 资产页 | `YieldPanel`：待领金额（连接钱包时）+ Claim；累计已分配（YieldDeposited 聚合）+ 最近分配记录；"Distribute" 二级入口（金额输入 + Deposit，任何钱包可入金） |
| 持仓页 | 持仓行待领列 + 行内 Claim；顶部 pending 汇总 |

- 金额展示沿 formatUsdc；事件读取沿分块扫描 + 缓存惯例

## 部署与数据（V5）

- HadronAssets 变更 → 三合约全新部署，新 `DeployV5.s.sol`（Assets → Market → Yield(assets, [market, deployer]) → setYieldHook 锁定；旧 Deploy.s.sol 保留不动）
- `SeedV5.s.sol`：SeedV4 全部职责 + 2-3 个资产的收益入金样本 + 1 笔领取样本（注意：seed deployer 被排除分配，入金样本的受益人是二级买家/bidder 等流通持有人——SeedV5 需保证入金前已有流通份额）
- 广播实操遵循 memory/arc-testnet-broadcast-practice：`--slow` + `FOUNDRY_OFFLINE=true` + 一次性播种密钥（新 SEED5 key，注资额覆盖买单托管 + 收益入金）
- env 切换同 V4 惯例 + 新增 `NEXT_PUBLIC_HADRON_YIELD`（地址 ×3 / DEPLOY_BLOCK / FIRST_ACTIVE_TOKEN_ID=1 不变）
- **验收合并**：买单深度 5.3 尚未验收，V5 包含其全部功能——用户在 V5 上一并验收；买单深度 tasks.md 5.3 显式标注"验收环境切换至 V5"；V4 的验证/交叉检查结论已随提交固化（a458788 前的证据不因重部署失效——代码未变，仅地址变）

## 测试策略（TDD）

- 合约单测 `HadronYield.t.sol`：单人入金领取；两人 30/70 比例；转账后双方权益精确（转出方保留已计提、转入方不吃历史）；多次入金穿插转账；**自转账 no-op**；**batch transfer 逐 id 结算**；**多 token 混合**；scaled dust 滚存与微额入金（1 wei 级）取整；circulating==0 入金 revert；重复领取为 0；**claimYieldBatch 重复 tokenId 幂等**
- 排除账户：挂单托管后收益归余下持有人；撤单回来恢复计息（debt 自当前 acc 起算）；offering 托管不参与；**发行方保留库存不参与**；excluded↔excluded 转移不变量
- 对抗：claim 重入被拒；拒收领取只伤自己；非 HadronAssets 调 notifyTransfer 被拒；**hook 未设置时转账正常**；**setYieldHook 二次调用 revert**
- invariant/fuzz：随机入金/转账/领取序列后**等式口径**——`累计入金 == 已支付 + Σ pendingYield + (Σ accruedScaled 余数 + dustScaled + Σ debt 沉淀) / 1e18 误差项`，并保留 `合约余额 >= Σ pending` 的不超发下界（scaled 记账后误差项可解释、有界）
- 前端：事件解码（含第三合约地址扫描）、活动流文案（USDC 格式化）、TradeHistoryTable 过滤 yield、useYield hooks（mock wagmi）、YieldPanel/持仓列组件态
- 全量回归：forge 67 + web 224 零回归

## 验收标准（Clarify Gate，用户提前授权模式下由设计固化）

1. GIVEN 两个地址分别持有同资产 30%/70% 流通份额 WHEN 入金 10 USDC THEN 两人 pending 分别为 3/7（±dust）
2. GIVEN 持有人转让一半份额 WHEN 再次入金 THEN 新旧持有人按转让后比例计提，转让前的计提保留给原持有人
3. GIVEN 份额挂单托管中 WHEN 入金 THEN 托管份额不参与分配；撤单后恢复参与
4. GIVEN 有 pending 的持有人 WHEN Claim THEN 到账金额精确、pending 归零、重复 Claim 无支付
5. 资产页/持仓页 YIELD 数据与链上一致；活动流出现 YIELD/CLAIM 记录
6. forge + web 全量测试/lint/build 通过，三页 200

## 开放决策（授权模式下 Claude 定案，供用户回看）

1. **入金权限**：开放给任何地址（而非 onlyOwner）——便于用户用自己钱包演示入金，"捐赠式收益"无安全害处。
2. **托管份额与发行方库存不计息**：排除名单 = 市场合约 + 发行方 deployer，构造器固定不可变——语义类比 record-date 与 treasury shares，无资金滞留、无运行中切换边界，且演示收益归真实流通持有人。
3. **V5 重部署合并验收**：买单深度与收益分配一并在 V5 验收，避免两次重置。
4. **setYieldHook 一次性锁定**：以放弃"可升级 hook"换取消灭管理员攻击面；极端 bug 逃生 = 测试网重部署。

## 修订记录（Codex 交叉验证吸收，2026-07-04）

- [阻塞→已解] 记账数学：改 scaled 记账（debt/accrued ×1e18 存储，claim 取整余数保留）消 dust 歧义；自转账显式 no-op；供给读 `getAsset().totalShares`（HadronAssets 无 ERC1155Supply）；hook 挂 OZ v5 `_update` 头部（转账前余额，已核实调用链）
- [阻塞→已解] 排除机制：发行路径事实修正（mint 给 owner，offering 才转市场）→ 排除名单加发行方 deployer 且改构造器固定不可变，消灭运行中切换整类边界；转账四组合 + mint/self/batch 成表
- [阻塞→已解] 钩子安全：setYieldHook 一次性锁定（HookAlreadySet）；notifyTransfer 纯记账约束 + 失效面文档化（测试网重部署逃生）
- [阻塞→已解] 前端事件接入：useMarketEvents/marketEventCache 扫描与缓存 key 加 Yield 地址；yield 事件独立 yieldAmount/account 字段（不复用份额 amount）；TradeHistoryTable 过滤 yield 事件
- [建议→已解] DeployV5 三合约新脚本；买单深度 5.3 显式标注切换 V5 验收；activity-feed spec MODIFIED（两合约→三合约）进 delta；测试盲区（自转账/batch/混合/发行方库存/微额/重复 batch claim/等式 invariant）全部进测试策略
