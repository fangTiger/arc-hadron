## MODIFIED Requirements

### Requirement: 钱包连接与网络守卫
系统 SHALL 通过 Reown AppKit + wagmi 连接钱包，顶栏展示网络指示灯与地址；当钱包处于非 Arc testnet 网络时 MUST 阻止交易并引导切换网络。资产详情页统一交易台中的 Buy、Sell、Bid 三个 mode 均 SHALL 复用同一钱包连接、网络守卫、余额读取、交易状态反馈和错误提示口径。

#### Scenario: 统一交易台中的未连接状态
- **WHEN** 未连接钱包的用户在详情页切换 Buy、Sell 或 Bid mode 并尝试交易
- **THEN** 对应操作引导连接钱包，不直接报错，也不改变链上或本地交易状态
