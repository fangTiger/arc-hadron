# HADRON M3 — 二级市场闭环 实现计划

> **For agentic workers:** 由 Claude（总架构师）经 `codex exec` CLI + Bash 后台逐 Task 调度（**不要用 codex MCP 同步调用**，会挂死；调度命令一律绝对路径）。每 Task 后 Claude 审查 diff + 运行验证 + 提交。
> 对应 OpenSpec tasks.md 第 3 组（3.1–3.3）；规格 `specs/secondary-market`（合约已在 M1 实现并测试）、`specs/trading-flow`（授权两步流）、`specs/portfolio`（挂单转售/我的挂单）。
> 合约地址/ABI 已接线（`web/lib/contracts.ts`）；`list/cancel/buy/getListing/listingsByToken/listingCount` 全部可用。

**Goal:** 打通挂单转售 → 二级购买闭环：持仓页自定价挂单（授权两步流）、详情页 SELL ORDERS 表（部分成交购买）、我的挂单管理（撤单）；并用变价的二级种子成交让走势/24H 真正波动。

**Architecture:** 纯前端增量——新增二级市场 hooks（复用 useBuyPrimary 的状态机模式）+ 持仓页弹窗 + 详情页挂单表；事件层已就绪（Listed/Cancelled/Purchased 已在解析范围）。

## 冻结接口（新增 hooks）

```ts
// lib/hooks/useListings.ts —— 某资产的活跃卖单
export interface ListingView { id: bigint; seller: `0x${string}`; tokenId: bigint; pricePerShare: bigint; remaining: bigint; isMine: boolean; }
export function useListings(tokenId: bigint | null): { listings: ListingView[]; isLoading: boolean };   // listingsByToken + getListing 批量（multicall），按价升序
export function useMyListings(): { listings: ListingView[]; isLoading: boolean };                        // 遍历 1..listingCount 批量 getListing，过滤 seller==me 且 active

// lib/hooks/useListForSale.ts —— 授权两步流状态机
// idle → checking → (needs-approval → approving[签名] → approve-pending[上链]) → signing → pending → success | error
export function useListForSale(): { listForSale: (tokenId: bigint, amount: bigint, pricePerShare: bigint) => void;
  status: "idle"|"checking"|"approving"|"approve-pending"|"signing"|"pending"|"success"|"error";
  txHash?: `0x${string}`; approveTxHash?: `0x${string}`; errorText?: string; reset: () => void; };

// lib/hooks/useCancelListing.ts / useBuyListing.ts —— 与 useBuyPrimary 同构状态机（idle→signing→pending→success|error）
export function useCancelListing(): { cancel: (listingId: bigint) => void; /* 同构字段 */ };
export function useBuyListing(): { buy: (listingId: bigint, amount: bigint, totalValue: bigint) => void; /* 同构字段 */ };

// lib/listing.ts —— 纯函数（TDD）
export function validateListing({ amountInput, priceInput, balance }: { amountInput: string; priceInput: string; balance: bigint })
  : { ok: true; amount: bigint; pricePerShare: bigint } | { ok: false; errorText: string };
// 规则：数量正整数且 <= balance（"Enter a valid amount"/"Exceeds your balance"）；价格经 parseUsdc 且 > 0（"Enter a valid price"）
export function validateListingPurchase(/* 同 validatePurchase 但 remaining 为挂单余量 */): PurchaseValidationResult;
```

UI 文案英文、注释中文、bigint 全链路（1 USDC = 1e18）不变。

## Task S1: 二级市场 hooks 与校验逻辑（TDD）
- RED：test/listing-logic.test.ts（validateListing/validateListingPurchase ≥8 用例）+ test/listing-mappers.test.ts（getListing 批量结果 → ListingView[] 排序/过滤 isMine/剔除 inactive）；
- GREEN：lib/listing.ts、lib/hooks/{useListings,useMyListings,useListForSale,useCancelListing,useBuyListing}.ts；
- useListForSale 细节：先读 isApprovedForAll（checking）→ 未授权则 writeContract setApprovalForAll（approving→approve-pending，等 receipt）→ 再 writeContract list（signing→pending→success）；已授权直接跳到 list；任一步用户拒签/失败 → error + mapWagmiError；
- 验证：npm run test 全绿 + build。

## Task S2: 持仓页——挂单弹窗 + 我的挂单
- components/portfolio/ListForSaleModal.tsx：数量 + 价格（USDC）输入、实时校验、预估所得（总价 × 99.5%，注明 "0.5% protocol fee"）；步骤指示（Approve → List 两步可视化，各自 tx 链接）；success 后关闭并 toast；
- components/portfolio/MyListings.tsx：我的活跃挂单表（资产/价格/剩余/已成交 = 原量-剩余不可得则省略/Cancel 按钮带确认）；空态 "No active listings"；
- HoldingsTable 的 "List for sale" 按钮启用（去掉 M3 禁用态）→ 打开弹窗；持仓页加 MyListings 区块；
- 验证：test/lint/build + dev server 页面 200。

## Task S3: 详情页——SELL ORDERS 表与二级购买
- components/asset/ListingsTable.tsx 替换 ListingsPlaceholder：价升序列出活跃卖单（Price/Amount/Seller shortAddress，自己的单标 "You" 徽章 + Cancel）；每行 Buy 按钮 → 行内展开数量选择（默认全量、可改部分）+ 确认（useBuyListing，状态流转与 BuyPanel 同款）；
- BuyPanel 顶部加 "BEST ASK"（最低卖单价，无卖单不显示）；
- 事件驱动的走势/24H 自动吃到 Purchased 变价成交（事件层已支持，无需改）；
- 验证：test/lint/build + 页面 200。

## Task S4: 二级种子成交（变价，让市场"活"）
- contracts/script/SeedSecondary.s.sol：deployer 对 4-6 个资产 `list` 少量份额（价格 = 发行价 × 0.97~1.06 不等的固定档位）；再对其中一部分自行 `buy`（真实链上自成交，测试网种子数据，脚本注释中说明）；每资产留 1-2 个未成交挂单供演示购买；
- Claude 上链执行 + cast 核对 listingCount 与成交事件；前端此后应出现非零 24H 变动与波动走势。

## Task S5: 交叉检查 + 用户验收
- Codex 复查（新 hooks 竞态/两步流中断恢复/挂单表刷新闭环/中文残留）；阻塞项修复；
- 用户浏览器验收：① 持仓挂单（观察 Approve→List 两步）② 撤单退回 ③ 买他人挂单（部分成交）④ 走势/24H 出现波动 ⑤ 协议费入账（我用 cast 核对金库增量）；
- 验收哈希与 M2/M2R/M3 证据一并记入 deployments json；勾选 openspec 2.4/2.5/3.1/3.2/3.3。

## 执行顺序
S1 → S2、S3 可并行（不同文件域）→ S4（Claude 上链）→ S5。
