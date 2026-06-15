<!--
  Copyright (c) 2026 zouyc zouyccq@gmail.com.
  All rights reserved.

  Licensed under the Business Source License 1.1 (BSL 1.1).
  You may not use this file except in compliance with the License.

  Change Date: 2031-01-01
  On the Change Date, or the fourth anniversary of the first publicly available
  distribution of the code under the BSL, whichever comes first, the code
  automatically becomes available under the Apache License 2.0.
-->

# X-Market 对外 FAQ（精简版）

> 面向官网、社媒、路演的短版问答。  
> 如需工程细节，请查看 `PRD.md`、`docs/qa.md` 与各阶段 playbook。

---

## 1) 你们和传统 Yes/No 预测市场有什么区别？

我们不是把每个结果拆成大量碎片盘口，而是用参数化 AMM 直接对概率分布做市。  
简单说：交易员在交易“概率曲线”，不是在抢单一二元代币。

---

## 2) 足球总进球这种离散事件，怎么定价？

用 Poisson 模型（核心参数 `lambda`）。  
例如买区间 `[2,6]`，系统会计算 `P(2<=X<=6)` 作为理论价格，再叠加滑点得到实际成交价。

---

## 3) 买了 `[2,6]`，最终进球是 5，收益怎么算？

结算规则很直接：

- 命中区间：每份头寸兑付 1 USDC
- 未命中区间：头寸归零

举例：

- 投入 1000 USDC
- 含滑点平均成本 0.70
- 持仓 = `1000 / 0.70 = 1428.57` 份
- 若赛果 `X=5`（命中），总兑付 `1428.57 USDC`
- 净利润 `+428.57 USDC`，ROI 约 `42.86%`

---

## 4) 那买超宽区间（比如 `[1,7]`）不是几乎稳赢吗？

宽区间通常“更容易中”，但也“更贵”。  
所以常见结构不是暴利，而是：

- 高胜率
- 低赔率
- 尾部一次性大回撤

典型表现：平时小赚，偶发一次直接回吐甚至血亏。

---

## 5) 这样 LP 会不会长期亏？

LP 的收益结构是交易者的镜像：

- 高频小赔（命中时兑付）
- 低频大赚（尾部未命中时留存本金）

长期是否为正，取决于四件事：

1. 交易换手率是否足够高  
2. 滑点/费率溢价是否覆盖尾部赔付  
3. 尾部事件出现频率  
4. 风控参数是否有效（动态费率、虚拟流动性、时间锁）

---

## 6) 你们做了哪些风险防守？

- Max-Loss 边界检查（避免资不抵债）
- LP Guard（动态费率、虚拟流动性、时间窗口约束）
- Cross-Margin 风险聚合
- Phase 3 新增：ZK 协处理接口与 Slash 风控处置

---

## 7) Phase 3 现在有哪些新产品？

Normal 市场已支持：

- Variance Swap
- Structured Note（封顶看涨）
- Range Note（区间票息）
- Barrier Note（障碍票息）

---

## 8) 一句话总结 X-Market

X-Market 是一个把“预测市场”升级为“概率分布衍生品市场”的协议：  
交易的不只是方向，还有区间、波动率与结构化风险。
