# Change: 紧凑市场首页与交易优先详情页

## Why

当前首页筛选控件在首屏占用过高，搜索、类别、issuer、yield 分散，资产表格露出太晚。资产详情页将资产介绍、AI insight 等浏览内容放在卖单、买单、挂买单等高频操作之前，且交易入口与深度信息的可达性不符合成熟交易产品习惯，操作路径不够直接。

## What Changes

- 调整首页首屏信息架构：统计条后直接进入轻量 market command band，将搜索、类别、issuer、yield 与 reset 组织成同一过滤区域，并压缩筛选控件的卡片感与纵向占用。
- 调整资产详情页信息架构：价格头后进入三栏交易工作区；桌面呈现价格图、盘口/订单、右侧 sticky 深度图 + Buy/Sell/Bid 交易台；移动端让交易 rail 先于介绍、AI insight、收益与历史出现。
- 保留现有视觉基调、数据 hook、交易状态流、订单簿点击定位、高亮行为与只读浏览能力。
- 更新组件测试，覆盖首页过滤区的紧凑顺序、详情页交易优先顺序、统一交易台 tab。

## Impact

- Affected specs: `market-browsing`, `trading-flow`, `secondary-market`
- Affected code:
  - `web/app/HomeView.tsx`
  - `web/app/asset/[id]/AssetDetailView.tsx`
  - `web/components/asset/BuyPanel.tsx` 或新增同目录交易台组件
  - 相关组件测试
- Non-impact:
  - 不改 `HadronAssets` / `HadronMarket` 合约
  - 不改链上读取 hook 与订单簿聚合模型
  - 不新增营销式 hero 或落地页
  - 不改变交易函数语义、校验、toast 与 explorer 链接口径
