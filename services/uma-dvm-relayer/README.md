# UMA DVM Relayer

链下服务：订阅 `UmaDvmArbitrationRequested` 事件，在 DVM 投票完成后调用 `execute_uma_dvm_arbitration` 回写链上终裁。

## 模式

| `UMA_DVM_MODE` | 行为 |
| --- | --- |
| `mock`（Testnet 默认） | 延迟 `UMA_DVM_MOCK_DELAY_MS` 后按 `UMA_DVM_MOCK_VERDICT` 自动终裁 |
| `live` | 轮询 `UMA_API_URL`（占位；需对接 UMA OO/DVM HTTP） |

## 前置

1. 发布含 `create_uma_dvm_arbitrator` 的 Move 包
2. `macro_oracle::set_oracle_arbitrator` 绑定 UMA 适配器对象
3. Relayer 地址在 `uma_relayer_allowlist` 内

```powershell
.\scripts\init-uma-dvm-arbitrator.ps1 -PackageId 0x... -RelayerAddress 0x...
```

## 启动

```powershell
.\scripts\bootstrap-services-env.ps1
cd services/uma-dvm-relayer
npm install
npm start
```

健康检查：`GET http://localhost:8793/health`
