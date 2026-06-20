# X-Market 项目说明图

**简体中文** | [English](./README.md)

本目录包含帮助他人快速理解 X-Market on Sui 的可视化说明图，适用于 README、演示文稿、社媒与文档嵌入。

## 图片索引

| 文件 | 用途 | 对应文档 |
| --- | --- | --- |
| [x-market-three-gaps.png](./x-market-three-gaps.png) | **三大结构性缺口** — 二元碎片化、带单无审计、结算割裂 | [problem-overview.zh.md](../presentations/problem-overview.zh.md) |
| [x-market-problem-vs-solution.png](./x-market-problem-vs-solution.png) | **问题 vs 方案** — Yes/No 博彩 → PDF 概率衍生品 | PRD §1、README |
| [x-market-architecture.png](./x-market-architecture.png) | **三层架构** — 应用层 / 业务模块 / 统一 Oracle | [README.zh.md](../../README.zh.md) §架构概览 |
| [x-market-event-root.png](./x-market-event-root.png) | **EventRoot 统一根** — 博弈与 SuiProphet 共用同一事件与结算 | PRD §1.4、§11 |
| [x-market-pdf-pricing.png](./x-market-pdf-pricing.png) | **PDF 定价机制** — 参数化 AMM、区间合约、Position | PRD §2、math-spec |
| [x-market-app-icon.png](./x-market-app-icon.png) | 应用图标（可选用于 favicon / 社媒头像） | — |

## 使用建议

- **30 秒电梯演讲**：`three-gaps` → `problem-vs-solution` → `event-root`
- **技术介绍**：`architecture` → `pdf-pricing` → `event-root`
- **投资人 / 合作方**：`problem-vs-solution` + `architecture`

## Markdown 嵌入示例

```markdown
![X-Market 三层架构](./docs/images/x-market-architecture.png)
```

## 视觉规范

配色与 Web 前端一致（见 `app/src/app/globals.css`）：

- 背景：`#080a0f`
- 强调色：`#5eead4`（teal）
- 文字：`#eef1f6`
- 警示：`#f87171` · 高亮：`#fbbf24`
