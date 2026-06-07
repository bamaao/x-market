# 延期功能清单（Beta · UMA DVM · Normal 竞价）

> **版本：** v1.0 · **日期：** 2026-06-08  
> **状态：** 跟踪中（主网前不阻断）  
> **关联：** [tier2-decision.md](./tier2-decision.md) · [math-spec/SPEC.md](../math-spec/SPEC.md) §7 · [p2-indexer-runbook.md](./p2-indexer-runbook.md) §P2.6 · [phase1.5-playbook.md](./phase1.5-playbook.md)

---

## 摘要

以下三项在 PRD / math-spec 中有规划，但**尚未完整实现**。当前 Testnet 均有可运行的替代路径，**不阻断主网上线**。

| 能力 | 完整实现？ | 已有替代 | 主网前必做？ |
| --- | --- | --- | --- |
| **Beta 分布** | ❌ | Dirichlet 二/三分类近似 | 否 |
| **UMA DVM** | ✅ | `OracleArbitrator` 内置多签委员会（`adapter_type=0`） | 可选（双适配器并存） |
| **Normal Opening Auction** | ✅ | `create_normal_pool` 仍可用于直连 Trading | 否 |

**建议立项优先级（主网后）：** Beta CDF（UMA DVM 与 Normal 竞价已于 2026-06-08 实现）

---

## 1. Beta 分布

### 1.1 规划 vs 实现

| 项 | 状态 | 位置 |
| --- | --- | --- |
| 独立 `beta.move` / Beta CDF | ❌ 无 | `sources/math/` 仅 poisson / dirichlet / normal |
| math-spec 定义 | ✅ | [SPEC.md](../math-spec/SPEC.md) §7 |
| MVP 简化路径 | ✅ 文档已定 | Dirichlet(α, β) 二分类近似，或 LUT 子集 |
| 链上 `dirichlet.move` | ✅ | K=3（胜平负等）；可二元素近似 Beta |

math-spec 原文：

> **MVP 简化：** 用 Dirichlet(α, β) 二分类近似……  
> 完整 Beta CDF 链上实现标记为 **Phase 1.5**，不阻塞 Poisson/Dirichlet/Normal 上线。

市场类型映射表中「得票率」列为 `Beta / Dirichlet`，实现侧仅走 Dirichlet。

### 1.2 缺口说明

- 无连续支持域 [0, 1] 上的 **Beta CDF 积分**与专用 `update_beta_buy`。
- 二元素 Dirichlet 在数学上可近似 Beta，但缺少：
  - 独立 `MarketKind: beta` 池类型
  - 前端 / 移动端 Beta 专用交易面板
  - Beta 专项测试向量

### 1.3 何时需要补

- 产品需要 **连续得票率区间**（如「35%–40%」）且 Dirichlet 分桶精度不足。
- 机构要求 PDF 类型与金融文献一致（显式 Beta 而非「近似」）。

### 1.4 若立项：实现要点

1. `sources/math/beta.move`：定点 Beta CDF（或 LUT + 插值）。
2. `pool::create_beta_pool` / `buy_beta_interval` / `update_beta_buy`。
3. `math-spec` 测试向量 + `sui move test`。
4. 前端 `MarketKind` 扩展；Mobile `buy_transaction_service` 对齐。

**工期粗估：** 1–2 周（含压测）。

---

## 2. UMA DVM 适配器 — 已实现（2026-06-08）

### 2.1 实现摘要

| 项 | 状态 | 位置 |
| --- | --- | --- |
| `adapter_type`（builtin / uma_dvm） | ✅ | `OracleArbitrator` |
| `create_uma_dvm_arbitrator` | ✅ | `oracle_arbitrator.move` |
| 出站 `UmaDvmArbitrationRequested` | ✅ | 争议同 PTB 发射 |
| 入站 `execute_uma_dvm_arbitration` | ✅ | allowlisted Relayer |
| 链下 Relayer（mock / live 占位） | ✅ | `services/uma-dvm-relayer/` |
| Indexer `arbitration_adapter` | ✅ | `migrations/004_uma_dvm.sql` |
| 前端 Oracle / 案件面板 | ✅ | adapter 徽章 + UMA 流程提示 |

**Testnet 初始化：**

```powershell
.\scripts\init-uma-dvm-arbitrator.ps1 -PackageId 0x... -RelayerAddress 0x...
.\scripts\bootstrap-services-env.ps1
cd services/uma-dvm-relayer && npm install && npm start
```

**`UMA_DVM_MODE=mock`：** Relayer 在延迟后自动调用 `execute_uma_dvm_arbitration`（无需真实以太坊 UMA 合约）。

**`UMA_DVM_MODE=live`：** 预留 `UMA_API_URL` 轮询；需对接 UMA Optimistic Oracle / DVM HTTP（生产未完成）。

内置委员会路径（`create_oracle_arbitrator`）保持不变，治理可二选一绑定 `OracleConfig`。

---

## 3. Normal Opening Auction — 已实现（2026-06-08）

### 3.1 实现摘要

| 项 | 状态 | 位置 |
| --- | --- | --- |
| `start_normal_auction` | ✅ | `pool.move` |
| `finalize_normal_auction` | ✅ | `pool.move` + `market_pool.move` |
| 桶 → (μ, σ) 定标 | ✅ | `math_normal::mu_sigma_tenths_from_auction_buckets` |
| `auction_bid`（共用） | ✅ | 三分布通用 |
| 脚本 `-Kind normal` | ✅ | `scripts/start-auction-pool.ps1` |
| Web / Mobile 拍卖 UI | ✅ | `AuctionPanel` · `auction.ts` · Flutter |

**三桶锚点（tenths）：** μ = 20 / 25 / 30（2.0% / 2.5% / 3.0%）；σ = 3 / 4 / 6（0.3% / 0.4% / 0.6%）。按各桶 USDC 加权平均定标。

**仍可用快捷路径：** `create_normal_pool` 直接 Trading（种子 CPI 市场未改）。

详见 [phase1.5-playbook.md](./phase1.5-playbook.md) §3.3。

---

## 4. 与 Tier 2 决策的关系

[tier2-decision.md](./tier2-decision.md) 决议主网前不上 **Tier 2 联合 PDF**。本文三项均属 **Tier 1 扩展或 Oracle 治理增强**，与 Tier 2 无依赖关系，可独立排期。

```
主网发布
  └── 不依赖本文任一项

主网后增强（建议顺序）
  1. Beta CDF                — 长尾得票率 / 合规命名
  2. UMA `live` 模式对接真实 DVM API（当前 mock 已可用）
```

---

## 5. 验证清单（立项时勾选）

### Beta

- [ ] `sui move test` 含 `beta_tests`
- [ ] `math-spec` 向量与 `dirichlet` 近似误差边界文档化
- [ ] 前端 / Mobile 可创建并交易 Beta 池

### UMA DVM

- [x] Move 适配器 + `execute_uma_dvm_arbitration` + `UmaDvmArbitrationRequested`
- [x] `services/uma-dvm-relayer` mock 模式
- [x] Indexer `arbitration_adapter=uma_dvm` 案件可查询
- [ ] Testnet 完整争议 → mock Relayer → callback 闭环（需 publish 新包后演练）
- [ ] `UMA_DVM_MODE=live` 对接真实 UMA API
- [ ] 治理签字：委员会 vs UMA 终裁路径

### Normal 竞价

- [x] `start_normal_auction` → `auction_bid` → `finalize_normal_auction` → `buy_*` 全链脚本
- [x] Web / Mobile Auction 面板 Normal 可用
- [x] `start-auction-pool.ps1 -Kind normal` 文档化

---

## 变更记录

| 日期 | 版本 | 说明 |
| --- | --- | --- |
| 2026-06-08 | v1.0 | 初版：Beta / UMA DVM / Normal 竞价缺口、替代方案与立项优先级 |
| 2026-06-08 | v1.1 | Normal Opening Auction 已实现；更新 §3 与优先级 |
| 2026-06-08 | v1.2 | UMA DVM 适配器 + Relayer 已实现；更新 §2 |
