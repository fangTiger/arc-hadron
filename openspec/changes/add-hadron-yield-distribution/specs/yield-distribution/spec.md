## ADDED Requirements

### Requirement: 收益入金
任何地址 SHALL 可调用 `depositYield(tokenId)` 以原生 USDC 为指定资产入金收益：按入金时刻的流通份额（`totalShares - 排除账户份额`）以 1e18 精度累加每股收益；除不尽的余数 MUST 以 scaled 口径滚存入下次入金；流通份额为零或金额为零时 revert；发出 `YieldDeposited` 事件。

#### Scenario: 按流通份额比例记账
- **WHEN** 两地址分别持有 30%/70% 流通份额时入金 10 USDC
- **THEN** 两人待领分别为 3/7 USDC（scaled 记账精确）

#### Scenario: 无流通份额时入金被拒绝
- **WHEN** 某资产全部份额均在排除账户（托管/发行方库存）时入金
- **THEN** 交易 revert

### Requirement: 收益领取
份额持有人 SHALL 可调用 `claimYield(tokenId)` 或 `claimYieldBatch(tokenIds)` 领取累计收益：支付金额为 scaled 应计额向下取整到 wei，余数保留在账户 scaled 记账中；领取 MUST 遵循 CEI 与 `nonReentrant`；重复领取与批量中重复 tokenId MUST 幂等（第二次支付为零）；发出 `YieldClaimed` 事件。

#### Scenario: 领取后归零且幂等
- **WHEN** 有待领收益的持有人领取后立即再次领取
- **THEN** 首次到账精确，第二次无支付、不 revert

#### Scenario: 拒收领取只伤自己
- **WHEN** 合约持有人在收款时 revert 拒收
- **THEN** 仅该笔领取失败，其他账户记账与领取不受影响

### Requirement: 转账下的权益结算
`HadronAssets` 每次份额转移（含 mint、批量、市场托管进出、买单成交直转）MUST 通过 `_update` 头部钩子调用 `HadronYield.notifyTransfer`，以转账前余额结算转出/转入双方应计收益并重置 debt；自转账 MUST 为 no-op；`notifyTransfer` MUST 仅接受 `HadronAssets` 调用且不做任何外部调用。

#### Scenario: 转让后权益不串
- **WHEN** 持有人在一次入金后转让一半份额，随后再次入金
- **THEN** 第一次入金的计提全额归原持有人，第二次按转让后比例分配

#### Scenario: 批量转账逐资产结算
- **WHEN** `safeBatchTransferFrom` 一次转移多个 tokenId
- **THEN** 每个 tokenId 的双方权益独立精确结算

### Requirement: 排除账户
排除名单 MUST 在 `HadronYield` 构造器固定且不可变更（本部署为市场合约与发行方 deployer）：排除账户的份额不参与分配、不计提收益，其份额变动仅维护 `excludedBalance`；份额从排除账户转出给普通账户时，接收方 debt 自当前每股累积值起算（不吃历史收益）。

#### Scenario: 托管份额不计息
- **WHEN** 持有人挂单（份额托管进市场）后发生入金
- **THEN** 托管份额不参与该次分配；撤单取回后参与后续分配且不追溯托管期收益

#### Scenario: 发行方库存不参与
- **WHEN** 发行方保留库存期间入金
- **THEN** 收益全部归流通持有人，发行方无计提

### Requirement: 钩子设置与前端呈现
`HadronAssets.setYieldHook` MUST 仅 owner 可调且一次性锁定（已设置后再调 revert），设置发出可追溯事件；钩子未设置期间转账 MUST 正常。前端 SHALL 在资产页展示待领收益、Claim、累计已分配与入金入口，在持仓页展示每持仓待领与领取入口；`YieldDeposited`/`YieldClaimed` SHALL 进入活动流（英文、按 USDC 格式化）但 MUST NOT 进入成交口径（价格序列、24H 指标、AI 快照成交、交易历史表）。

#### Scenario: 钩子一次性锁定
- **WHEN** owner 尝试第二次调用 `setYieldHook`
- **THEN** 交易 revert

#### Scenario: 收益事件不污染成交口径
- **WHEN** 一笔收益入金上链
- **THEN** 活动流出现 YIELD 记录，但价格序列、24H 成交量与交易历史表均不变
