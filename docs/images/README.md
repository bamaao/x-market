# X-Market Visual Explainers

[简体中文](./README.zh.md) | **English**

Visual assets to help others understand X-Market on Sui — suitable for README, decks, social posts, and docs.

## Image Index

| File | Purpose | Related docs |
| --- | --- | --- |
| [x-market-three-gaps.png](./x-market-three-gaps.png) | **Three structural gaps** — binary fragmentation, unaudited signals, split settlement | [problem-overview.md](../presentations/problem-overview.md) |
| [x-market-problem-vs-solution.png](./x-market-problem-vs-solution.png) | **Problem vs solution** — Yes/No betting → PDF probability derivatives | PRD §1, README |
| [x-market-architecture.png](./x-market-architecture.png) | **Three-layer architecture** — app / business modules / unified Oracle | [README.md](../../README.md) §Architecture |
| [x-market-event-root.png](./x-market-event-root.png) | **Unified EventRoot** — trading and SuiProphet share one event and settlement | PRD §1.4, §11 |
| [x-market-pdf-pricing.png](./x-market-pdf-pricing.png) | **PDF pricing** — parametric AMM, interval contracts, Position | PRD §2, math-spec |
| [x-market-app-icon.png](./x-market-app-icon.png) | App icon (optional for favicon / social avatar) | — |

## Suggested flows

- **30-second pitch**: `three-gaps` → `problem-vs-solution` → `event-root`
- **Technical intro**: `architecture` → `pdf-pricing` → `event-root`
- **Investors / partners**: `problem-vs-solution` + `architecture`

## Markdown embed

```markdown
![X-Market architecture](./docs/images/x-market-architecture.png)
```

## Visual spec

Colors match the web app (`app/src/app/globals.css`):

- Background: `#080a0f`
- Accent: `#5eead4` (teal)
- Text: `#eef1f6`
- Warning: `#f87171` · Highlight: `#fbbf24`
