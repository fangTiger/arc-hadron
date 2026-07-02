# HADRON M1 — 合约与链上地基 实现计划

> **For agentic workers:** 本计划由 Claude 调度 **codex MCP** 逐 Task 执行（sandbox=workspace-write），每个 Task 完成后由 Claude 审查 diff 并运行验证命令确认（证据先于断言）。步骤使用 checkbox（`- [ ]`）跟踪。
> 对应 OpenSpec 变更：`openspec/changes/add-hadron-rwa-exchange/`（tasks.md 第 1 组 M1），规格见 `specs/asset-registry`、`specs/primary-market`、`specs/secondary-market`。

**Goal:** 在 Arc testnet 部署经完整 TDD 验证的 `HadronAssets`（ERC-1155 资产登记）与 `HadronMarket`（固定价一级发行 + 二级挂单市场，原生 USDC 结算），并发行 4 类种子资产。

**Architecture:** Foundry 独立工程 `contracts/`；两合约经构造注入衔接；全部交易函数 `nonReentrant` + CEI；状态经 getter 暴露（前端不依赖日志）；支付为原生 USDC push 直转（精确 `msg.value`，6 位小数）。

**Tech Stack:** Foundry（forge/cast）、Solidity ^0.8.24、OpenZeppelin Contracts v5（ERC1155、ERC1155Holder、Ownable2Step、ReentrancyGuard）。

---

## 冻结接口（所有 Task 以此为准，不得偏离）

### HadronAssets.sol

```solidity
contract HadronAssets is ERC1155, Ownable2Step {
    struct Asset { string name; string category; uint256 totalShares; string metadataURI; }

    uint256 public assetCount;                       // tokenId 从 1 起自增，0 为无效值

    event AssetIssued(uint256 indexed tokenId, string name, string category, uint256 totalShares);

    error EmptyName();
    error ZeroShares();
    error UnknownAsset();

    // 仅 owner；登记档案并把全部份额铸给 owner；返回新 tokenId
    function createAsset(string calldata name, string calldata category, uint256 totalShares, string calldata metadataURI) external onlyOwner returns (uint256);
    function getAsset(uint256 tokenId) external view returns (Asset memory);   // 不存在则 revert UnknownAsset
    function uri(uint256 tokenId) public view override returns (string memory); // 返回该资产 metadataURI
}
```

### HadronMarket.sol

```solidity
contract HadronMarket is ERC1155Holder, Ownable2Step, ReentrancyGuard {
    struct Offering { uint256 tokenId; uint256 pricePerShare; uint256 remaining; bool active; }
    struct Listing  { address seller; uint256 tokenId; uint256 pricePerShare; uint256 remaining; bool active; }

    uint16  public constant MAX_FEE_BPS = 500;
    HadronAssets public immutable assets;
    uint256 public immutable deployBlock;            // 部署区块，供前端日志扫描起点
    address public treasury;
    uint16  public feeBps;                           // 初始 50 (0.5%)
    uint256 public offeringCount;                    // offeringId 从 1 起自增
    uint256 public listingCount;                     // listingId 从 1 起自增

    event OfferingCreated(uint256 indexed offeringId, uint256 indexed tokenId, uint256 pricePerShare, uint256 amount);
    event OfferingClosed(uint256 indexed offeringId, uint256 returnedAmount);
    event PrimarySale(uint256 indexed offeringId, uint256 indexed tokenId, address indexed buyer, uint256 amount, uint256 totalPaid, uint256 fee);
    event Listed(uint256 indexed listingId, uint256 indexed tokenId, address indexed seller, uint256 pricePerShare, uint256 amount);
    event Cancelled(uint256 indexed listingId, uint256 returnedAmount);
    event Purchased(uint256 indexed listingId, uint256 indexed tokenId, address indexed buyer, address seller, uint256 amount, uint256 totalPaid, uint256 fee);
    event TreasuryUpdated(address newTreasury);

    error ZeroAddress();
    error FeeTooHigh();
    error ZeroAmount();
    error ZeroPrice();
    error InactiveOffering();
    error InactiveListing();
    error ExceedsRemaining();
    error WrongPayment();
    error NotSeller();
    error TransferFailed();

    constructor(HadronAssets assets_, address treasury_, uint16 feeBps_);      // 校验 treasury 非零、feeBps <= MAX_FEE_BPS

    // 一级发行
    function createPrimaryOffering(uint256 tokenId, uint256 pricePerShare, uint256 amount) external onlyOwner returns (uint256);
    function closePrimaryOffering(uint256 offeringId) external onlyOwner;      // 剩余份额退回 owner，置 inactive
    function buyPrimary(uint256 offeringId, uint256 amount) external payable nonReentrant; // msg.value == pricePerShare*amount；货款 99.5% 给 owner()、fee 给 treasury
    function getOffering(uint256 offeringId) external view returns (Offering memory);

    // 二级市场
    function list(uint256 tokenId, uint256 amount, uint256 pricePerShare) external nonReentrant returns (uint256); // 份额托管入合约
    function cancel(uint256 listingId) external nonReentrant;                  // 仅卖家；余量退回；售罄(remaining==0)或已取消则 revert InactiveListing
    function buy(uint256 listingId, uint256 amount) external payable nonReentrant; // 部分成交；货款 99.5% 给 seller、fee 给 treasury
    function getListing(uint256 listingId) external view returns (Listing memory);
    function listingsByToken(uint256 tokenId) external view returns (uint256[] memory); // 活跃(active 且 remaining>0)挂单 id 列表

    // 配置
    function setTreasury(address newTreasury) external onlyOwner;              // 零地址 revert；发 TreasuryUpdated
}
```

**统一行为规则：**
- 费用：`fee = totalPaid * feeBps / 10_000`（向下取整，可为 0）；收款方所得 = `totalPaid - fee`。
- 派发：原生转账用 `call{value: ...}("")`，失败 revert `TransferFailed`；先改状态后转账（CEI）。
- 校验顺序：存在性/active → 参数不变量（ZeroAmount/ZeroPrice）→ 余量（ExceedsRemaining）→ 付款（WrongPayment）。
- 全量成交后（`remaining == 0`）：挂单置 `active = false`，不可 buy、不可 cancel。

## 文件结构

```
contracts/
├── foundry.toml                     # solc 0.8.24、optimizer、fs_permissions
├── remappings.txt                   # @openzeppelin/ 映射
├── src/
│   ├── HadronAssets.sol             # 资产登记（Task 2）
│   └── HadronMarket.sol             # 市场（Task 3-6）
├── test/
│   ├── HadronAssets.t.sol           # Task 2
│   ├── HadronMarket.config.t.sol    # Task 3（构造与配置不变量）
│   ├── HadronMarket.primary.t.sol   # Task 4
│   ├── HadronMarket.secondary.t.sol # Task 5
│   ├── HadronMarket.adversarial.t.sol # Task 6（重入/拒收/fuzz）
│   └── helpers/MaliciousReceiver.sol  # Task 6 辅助合约
├── script/
│   ├── Deploy.s.sol                 # Task 7
│   └── Seed.s.sol                   # Task 8（4 类种子资产 + 一级发行）
├── deployments/arc-testnet.json     # Task 7 产物（地址 + 部署区块）
└── .env.example                     # ARC_RPC_URL / DEPLOYER_PRIVATE_KEY / TREASURY_ADDRESS
```

---

## Task 1: Foundry 工程初始化

**Files:** Create `contracts/foundry.toml`、`contracts/remappings.txt`、目录骨架

- [x] **Step 1.1** 在仓库根执行 `forge init contracts --no-git`（若 forge 不存在，先 `curl -L https://foundry.paradigm.xyz | bash && foundryup`），删除示例文件（`src/Counter.sol`、`test/Counter.t.sol`、`script/Counter.s.sol`）
- [x] **Step 1.2** `cd contracts && forge install OpenZeppelin/openzeppelin-contracts --no-git`；写 `remappings.txt`：`@openzeppelin/=lib/openzeppelin-contracts/`
- [x] **Step 1.3** 配置 `foundry.toml`：`solc = "0.8.24"`、`optimizer = true`、`optimizer_runs = 200`
- [x] **Step 1.4** 验证：`cd contracts && forge build` → 期望 `Compiler run successful`；`forge test` → 期望 0 个测试通过（无失败）
- [ ] **Step 1.5** 提交：`git add contracts && git commit -m "chore(contracts): 初始化 Foundry 工程与 OpenZeppelin 依赖"`（lib/ 若体积大改用 gitmodules 或在 .gitignore 保留，以 forge install 可重建为准）

## Task 2: HadronAssets（TDD，对应 asset-registry spec）

**Files:** Create `contracts/src/HadronAssets.sol`、`contracts/test/HadronAssets.t.sol`

- [x] **Step 2.1（RED）** 编写 `HadronAssets.t.sol`，测试用例与 spec 场景一一对应：

| 测试函数 | 断言（GIVEN/WHEN/THEN） | Spec 场景 |
|---|---|---|
| `test_CreateAsset_MintsAllSharesToOwner` | owner 创建后 `balanceOf(owner, 1) == totalShares`，`assetCount == 1`，返回 tokenId 为 1 | owner 成功创建资产 |
| `test_CreateAsset_EmitsAssetIssued` | `vm.expectEmit` 校验 `AssetIssued(1, name, category, totalShares)` | 同上 |
| `test_CreateAsset_RevertWhen_NotOwner` | 非 owner 调用 revert（OZ `OwnableUnauthorizedAccount`） | 非 owner 创建被拒绝 |
| `test_CreateAsset_RevertWhen_ZeroShares` | `totalShares == 0` revert `ZeroShares` | 无效参数被拒绝 |
| `test_CreateAsset_RevertWhen_EmptyName` | 空名称 revert `EmptyName` | 无效参数被拒绝 |
| `test_GetAsset_ReturnsProfile_And_RevertUnknown` | 档案字段与创建一致；未知 id revert `UnknownAsset` | 前端枚举全部资产 |
| `test_Uri_ReturnsMetadataURI` | `uri(1)` 返回创建时的 metadataURI | 前端枚举全部资产 |
| `test_AssetCount_IncrementsAcrossCreations` | 连续创建 3 个资产，tokenId 依次 1/2/3 | 前端枚举全部资产 |

- [x] **Step 2.2** 运行 `forge test --match-path test/HadronAssets.t.sol` → 期望：编译失败或全部 FAIL（合约未实现）
- [x] **Step 2.3（GREEN）** 按冻结接口实现 `HadronAssets.sol`（最小实现，不加接口之外的功能）
- [x] **Step 2.4** 运行 `forge test --match-path test/HadronAssets.t.sol -vv` → 期望：8 个测试全部 PASS
- [ ] **Step 2.5** 提交：`git commit -m "feat(contracts): HadronAssets ERC-1155 资产登记（TDD）"`

## Task 3: HadronMarket 骨架与配置不变量（TDD）

**Files:** Create `contracts/src/HadronMarket.sol`、`contracts/test/HadronMarket.config.t.sol`

- [x] **Step 3.1（RED）** 测试用例：

| 测试函数 | 断言 | Spec 场景 |
|---|---|---|
| `test_Constructor_SetsConfig` | `assets/treasury/feeBps/deployBlock` 正确，`deployBlock == block.number` | 市场配置不变量 |
| `test_Constructor_RevertWhen_ZeroTreasury` | treasury 为零地址 revert `ZeroAddress` | 非法构造参数被拒绝 |
| `test_Constructor_RevertWhen_FeeTooHigh` | `feeBps = 501` revert `FeeTooHigh` | 非法构造参数被拒绝 |
| `test_SetTreasury_EmitsEvent_And_RevertZero` | 变更发 `TreasuryUpdated`；零地址 revert | 金库地址变更可追溯 |
| `test_SupportsERC1155Receiver` | 合约可安全接收 ERC-1155（`onERC1155Received` selector） | 挂单托管前置 |

- [x] **Step 3.2** `forge test --match-path test/HadronMarket.config.t.sol` → 期望 FAIL/编译失败
- [x] **Step 3.3（GREEN）** 实现构造器、`setTreasury`、继承 `ERC1155Holder/Ownable2Step/ReentrancyGuard`（交易函数留空实现或 revert，后续 Task 补齐）
- [x] **Step 3.4** `forge test --match-path test/HadronMarket.config.t.sol -vv` → 期望 5 个 PASS
- [ ] **Step 3.5** 提交：`git commit -m "feat(contracts): HadronMarket 骨架与配置不变量（TDD）"`

## Task 4: 一级发行（TDD，对应 primary-market spec）

**Files:** Modify `contracts/src/HadronMarket.sol`；Create `contracts/test/HadronMarket.primary.t.sol`

- [x] **Step 4.1（RED）** 测试用例（setUp：部署两合约，owner 创建资产 1000 份并 `setApprovalForAll(market, true)`）：

| 测试函数 | 断言 | Spec 场景 |
|---|---|---|
| `test_CreateOffering_EscrowsShares_EmitsEvent` | 份额入市场合约、getter 可读、`OfferingCreated` 事件字段正确 | 成功创建发行 |
| `test_CreateOffering_RevertWhen_NotOwner` | revert Ownable 错误 | 非 owner 创建被拒绝 |
| `test_CreateOffering_RevertWhen_NotApproved` | 未授权 revert（ERC1155 missing approval） | 未授权时创建被拒绝 |
| `test_CreateOffering_RevertWhen_ZeroPriceOrAmount` | 分别 revert `ZeroPrice` / `ZeroAmount` | 市场配置不变量 |
| `test_BuyPrimary_TransfersShares_SplitsFee` | 买家份额 +N、余量 -N、owner 收 99.5%、treasury 收 0.5%、`PrimarySale` 事件 | 成功购买 N 份 |
| `test_BuyPrimary_RevertWhen_WrongPayment` | 少付/多付均 revert `WrongPayment` | 付款金额不符被拒绝 |
| `test_BuyPrimary_RevertWhen_ExceedsRemaining_OrZero` | 超余量 revert `ExceedsRemaining`；0 revert `ZeroAmount` | 超出余量被拒绝 |
| `test_BuyPrimary_FeeRoundsDownToZero` | 总价 199 wei-USDC × 50bps → fee 0，交易成功 | 小额成交协议费为零 |
| `test_CloseOffering_ReturnsRemaining_BlocksBuy` | 剩余退回 owner、`OfferingClosed` 事件、再购买 revert `InactiveOffering` | 关闭发行并退回库存 |
| `test_GetOffering_EnumerableViaCount` | `offeringCount` + `getOffering` 枚举与实际一致 | 前端枚举全部发行 |

- [x] **Step 4.2** `forge test --match-path test/HadronMarket.primary.t.sol` → 期望 FAIL
- [x] **Step 4.3（GREEN）** 实现 `createPrimaryOffering / closePrimaryOffering / buyPrimary / getOffering`（遵循统一行为规则的校验顺序与 CEI）
- [x] **Step 4.4** `forge test --match-path test/HadronMarket.primary.t.sol -vv` → 期望 10 个 PASS；`forge test` 全量回归 PASS
- [ ] **Step 4.5** 提交：`git commit -m "feat(contracts): 一级发行（创建/购买/关闭/协议费，TDD）"`

## Task 5: 二级市场（TDD，对应 secondary-market spec）

**Files:** Modify `contracts/src/HadronMarket.sol`；Create `contracts/test/HadronMarket.secondary.t.sol`

- [ ] **Step 5.1（RED）** 测试用例（setUp：owner 发行资产并一级卖给 seller 100 份，seller 已授权 market）：

| 测试函数 | 断言 | Spec 场景 |
|---|---|---|
| `test_List_EscrowsShares_EmitsEvent` | 份额托管、getter 可读、`Listed` 事件 | 成功挂单 |
| `test_List_RevertWhen_NotApproved` | 未授权 revert | 未授权挂单被拒绝 |
| `test_List_RevertWhen_ZeroPriceOrAmount` | revert `ZeroPrice` / `ZeroAmount` | 零价或零量挂单被拒绝 |
| `test_Buy_PartialFill_SplitsFee` | 买 40/100：买家 +40、卖家收 99.5%、treasury 0.5%、余量 60、`Purchased` 事件 | 部分成交 |
| `test_Buy_RevertWhen_SoldOutOrCancelled` | 售罄/已取消 revert `InactiveListing` | 售罄挂单不可购买 |
| `test_Buy_RevertWhen_WrongPayment` | revert `WrongPayment` | 付款金额不符被拒绝 |
| `test_Buy_RevertWhen_ZeroOrExceedsRemaining` | revert `ZeroAmount` / `ExceedsRemaining` | 零数量或超余量购买被拒绝 |
| `test_Cancel_AfterPartialFill_ReturnsExactRemainder` | 部分成交后撤单退回 60、`Cancelled` 事件、再购买 revert | 部分成交后撤单 |
| `test_Cancel_RevertWhen_NotSeller` | revert `NotSeller` | 非卖家撤单被拒绝 |
| `test_Cancel_RevertWhen_FullyFilled` | 全量成交后 cancel revert `InactiveListing` | 全量成交后不可撤单 |
| `test_ListingsByToken_ReturnsOnlyActive` | 混合活跃/取消/售罄挂单，仅返回活跃 id | 详情页枚举活跃挂单 |

- [ ] **Step 5.2** `forge test --match-path test/HadronMarket.secondary.t.sol` → 期望 FAIL
- [ ] **Step 5.3（GREEN）** 实现 `list / cancel / buy / getListing / listingsByToken`
- [ ] **Step 5.4** `forge test -vv` 全量 → 期望全部 PASS（含前序回归）
- [ ] **Step 5.5** 提交：`git commit -m "feat(contracts): 二级挂单市场（挂单/部分成交/撤单，TDD）"`

## Task 6: 对抗性与 Fuzz 测试

**Files:** Create `contracts/test/HadronMarket.adversarial.t.sol`、`contracts/test/helpers/MaliciousReceiver.sol`

- [ ] **Step 6.1（RED）** 测试用例：

| 测试函数 | 断言 | Spec 场景 |
|---|---|---|
| `test_Reentrancy_MaliciousSellerOnBuy` | 收款回调中重入 `buy/cancel` → revert（ReentrancyGuard），原交易整体 revert，状态一致 | 恶意收款合约重入被阻止 |
| `test_RevertingReceiver_CannotLockOthers` | 拒收货款的卖家挂单：buy revert `TransferFailed`，但该卖家仍可 cancel 取回份额，其他挂单不受影响 | 恶意收款方不锁死他人资产 |
| `testFuzz_BuyPrimary_ExactPaymentInvariant(uint96 price, uint64 amount)` | 任意合法价格×数量：仅精确付款成功；owner+treasury 所得 == totalPaid | 输入不变量 |
| `testFuzz_SecondaryLifecycle(uint64 listAmt, uint64 buyAmt)` | 任意部分成交序列后：托管余额 == Σ活跃挂单余量（守恒） | 生命周期边界 |
| `testFuzz_FeeNeverExceedsCap(uint96 price, uint64 amount)` | fee <= totalPaid * MAX_FEE_BPS / 10000 | 配置不变量 |

- [ ] **Step 6.2** `forge test --match-path test/HadronMarket.adversarial.t.sol` → 期望 FAIL（helper 未建）
- [ ] **Step 6.3（GREEN）** 实现 `MaliciousReceiver.sol`（receive 中重入 / 直接 revert 两种模式），修复暴露的问题（若有）
- [ ] **Step 6.4** `forge test -vv` 全量 → 全部 PASS；记录 fuzz runs（默认 256）输出为证据
- [ ] **Step 6.5** 提交：`git commit -m "test(contracts): 对抗性重入/拒收与 fuzz 不变量测试"`

## Task 7: 部署脚本与 Arc testnet 部署 + 结算冒烟实证

**Files:** Create `contracts/script/Deploy.s.sol`、`contracts/.env.example`、`contracts/deployments/arc-testnet.json`

- [ ] **Step 7.1** 从 arc-lepton 读取 Arc testnet 链参数（`/Users/captain/python/arc-lepton/lib/wagmi.ts`：chainId、RPC URL），写入 `.env.example`（`ARC_RPC_URL`、`DEPLOYER_PRIVATE_KEY`、`TREASURY_ADDRESS`）
- [ ] **Step 7.2** 编写 `Deploy.s.sol`：部署 `HadronAssets` → `HadronMarket(assets, treasury, 50)`，`console2.log` 输出地址与部署区块
- [ ] **Step 7.3** 本地演练：`forge script script/Deploy.s.sol --fork-url $ARC_RPC_URL` → 期望模拟成功（**需要用户提供已领水的部署私钥**，此步为用户检查点）
- [ ] **Step 7.4** 实际部署：`forge script script/Deploy.s.sol --rpc-url $ARC_RPC_URL --broadcast`，把地址/区块写入 `deployments/arc-testnet.json`
- [ ] **Step 7.5（结算冒烟实证）** 用 `cast send` 走一遍：createAsset → approve → createPrimaryOffering → `buyPrimary`（带 `--value` 精确原生 USDC）→ `cast balance` 核对 owner/treasury 分账。**若原生结算失败：停止，回改 spec 启用 ERC-20 备用分支（设计文档 4.3）**
- [ ] **Step 7.6** 在 explorer 确认交易可查证，记录交易哈希于 `deployments/arc-testnet.json` 的 `smokeTest` 字段
- [ ] **Step 7.7** 提交：`git commit -m "feat(contracts): Arc testnet 部署脚本与部署记录（含结算冒烟实证）"`

## Task 8: 种子资产发行脚本

**Files:** Create `contracts/script/Seed.s.sol`

- [ ] **Step 8.1** 编写 `Seed.s.sol`：创建 4 类资产并各建一级发行（价格单位 6 位小数 USDC）：
  - `US T-BILL 2026-Q3`（treasuries，10,000 份，100.000000/份）
  - `GOLD OUNCE VAULT #4`（gold，500 份，23.800000/份）
  - `MARINA TOWER UNIT 12F`（real-estate，2,000 份，55.500000/份）
  - `VERRA CARBON LOT-9`（carbon，8,000 份，1.850000/份）
- [ ] **Step 8.2** 执行：`forge script script/Seed.s.sol --rpc-url $ARC_RPC_URL --broadcast` → 期望 4 个 `AssetIssued` + 4 个 `OfferingCreated`
- [ ] **Step 8.3** 用 `cast call` 验证 `assetCount() == 4`、`offeringCount() == 4`，逐个 `getOffering` 核对价格
- [ ] **Step 8.4** 提交：`git commit -m "feat(contracts): 4 类种子资产发行脚本与链上执行记录"`

## Task 9: M1 收口——Codex 交叉检查与任务勾选

- [ ] **Step 9.1** 调度 Codex（read-only）对 `contracts/src` 做安全专项复查（重入、CEI、权限、精度），修复发现的问题（修复亦走 TDD）
- [ ] **Step 9.2** `forge test -vv` 全量输出留档（证据）；核对 asset-registry / primary-market / secondary-market 三个 spec 的每个 Scenario 均有对应 PASS 测试
- [ ] **Step 9.3** 更新 `openspec/changes/add-hadron-rwa-exchange/tasks.md`：勾选 1.1–1.7；提交

---

## 用户检查点（需要你介入的时刻）

1. **Task 7.3 前**：提供 Arc testnet 部署私钥（领水后的测试账户，写入 `contracts/.env`，绝不入库）与金库地址。
2. **Task 7.5**：若原生结算实证失败，需确认切换 ERC-20 备用分支（会新增 approve 流程并回改 spec）。
