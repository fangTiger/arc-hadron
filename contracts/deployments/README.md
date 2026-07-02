# 部署产物目录

`Deploy.s.sol` 不写文件，避免引入 `fs_permissions`。Step 7.4 实际部署完成后，由调度方手工或命令行写入 `arc-testnet.json`。

建议记录字段：`chainId`、`rpcUrl`、`explorerUrl`、`deployBlock`、`HadronAssets`、`HadronMarket`、`deploymentTxHash`。
