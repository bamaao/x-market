# Prophet Audit Keeper

PRD §11.3.4 · P4.1 — Oracle 结算后自动提交 `audit_prophecy`。

## 流程

```
池已 resolved + now >= lock_time + prophecy.status == OPEN
  → Indexer 明文缓存（优先）或 Seal 条件 B 解密 Walrus
  → audit_prophecy（Hash 校验 → 战绩 → 分账）
```

## 环境

```powershell
.\scripts\bootstrap-services-env.ps1   # 生成 .env.local
# 或单独：services/prophet-audit-keeper/.env.example
```

| 变量 | 说明 |
|------|------|
| `PROPHET_AUDIT_POOL_IDS` | 种子池 ID 列表 |
| `PROPHET_REGISTRY_ID` | ProphetRegistry |
| `PROPHET_AUDIT_DRY_RUN` | 默认 `true` |
| `INDEXER_URL` | 可选，优先读 `/v1/prophecies/:id/plaintext` |

## 运行

```powershell
cd services/prophet-audit-keeper
npm install
npm run dev
# GET http://localhost:8792/health
```

Gas Station 白名单已包含 `audit_prophecy`；Keeper 也可自付 SUI。
