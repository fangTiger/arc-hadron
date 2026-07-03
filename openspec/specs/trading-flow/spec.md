# trading-flow Specification

## Requirements

### Requirement: 钱包连接与网络守卫
系统 SHALL 通过 **Reown AppKit**（复用 arc-lepton 的 WalletConnect/Reown project ID）+ wagmi 连接钱包，顶栏展示网络指示灯与地址；当钱包处于非 Arc testnet 网络时 MUST 阻止交易并引导切换网络。

#### Scenario: 成功连接钱包
- **WHEN** 用户点击连接并在钱包中确认
- **THEN** 顶栏展示缩略地址与 Arc testnet 指示灯，交易功能解锁

#### Scenario: 错误网络被拦截
- **WHEN** 已连接钱包但当前网络不是 Arc testnet
- **THEN** 交易按钮禁用并提示一键切换网络

### Requirement: 授权引导两步流
当用户首次挂单且未授权市场合约时，前端 SHALL 将流程拆为"① `setApprovalForAll` → ② 提交挂单"两步引导，两笔交易均可在 explorer 查证。owner 的一级上架授权由部署/种子脚本处理，MUST NOT 依赖前端交易流。

#### Scenario: 首次挂单的两步引导
- **WHEN** 未授权的持有人发起挂单
- **THEN** 前端先请求授权交易，确认后自动引导提交挂单交易，两步状态分别可见

### Requirement: 交易状态反馈
每笔交易 SHALL 呈现完整状态流转：签名中 → pending → 链上确认 → 成功（附 Arc explorer 链接）；确认等待逻辑参考 arc-lepton 的 receipt 等待模式。

#### Scenario: 购买后的状态反馈
- **WHEN** 用户提交购买并在钱包签名
- **THEN** 界面依次展示 pending 与确认成功状态，成功 Toast 含可点击的 explorer 交易链接

### Requirement: 失败场景处理
对余额不足、付款金额不符、用户拒签、交易 revert、重复点击等失败场景，前端 SHALL 给出明确的**英文**提示（产品界面语言为英文，2026-07-02 修订）且不产生错误的本地状态；交易 revert 后 MUST 可通过刷新从链上完整重建页面状态。

#### Scenario: 用户拒签
- **WHEN** 用户在钱包中拒绝签名
- **THEN** 界面提示 "Signature cancelled" 类英文信息，页面状态与交易前一致

#### Scenario: 余额不足
- **WHEN** 用户 USDC 余额低于购买总价
- **THEN** 提交前即提示余额不足并禁用确认按钮

#### Scenario: 重复点击防抖
- **WHEN** 用户在交易 pending 期间重复点击提交
- **THEN** 不发起第二笔交易，按钮处于禁用/加载状态

#### Scenario: 交易 revert 后状态重建
- **WHEN** 一笔交易 revert 后用户刷新页面
- **THEN** 全部页面状态从链上重新读取，与链上实际一致，无残留的乐观更新

### Requirement: 份额显示与输入粒度（M3R 演进）
前端 SHALL 以 1 显示份额 = 100 链上单位（SHARE_SCALE=100）呈现所有份额数量与每份价格（链上单位价 ×100），数量输入 SHALL 支持最多两位小数（最小 0.01 份），提交前转换为链上整数单位；活跃资产目录自 FIRST_ACTIVE_TOKEN_ID（V3 重发行，tokenId 15 起）。

#### Scenario: 小数份额购买
- **WHEN** 用户输入 0.01 份并确认购买
- **THEN** 合约收到 1 链上单位，支付 = 单位价 × 1，UI 全程按份额显示

#### Scenario: 超过两位小数被拒绝
- **WHEN** 用户输入 0.001 份
- **THEN** 校验失败，提示 "Enter a valid amount"，不发起交易
