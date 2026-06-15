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

# GeoBlock 与合规说明（P3.4）

X-Market 为非托管链上协议；前端 GeoBlock 仅限制 **Web 应用访问**，不阻止直接与链交互。

## 配置

| 变量 | 说明 |
|------|------|
| `GEO_BLOCK_ENABLED` | `true` 启用 |
| `GEO_BLOCKED_COUNTRIES` | ISO 3166-1 alpha-2，逗号分隔，如 `US,CN,IR` |

## 部署建议

- **Vercel：** 自动提供 `x-vercel-ip-country`
- **Cloudflare：** 使用 `cf-ipcountry`
- **自建：** 反向代理注入 `x-geo-country`

## 免责声明模板

被拦截页面（`/blocked`）应链接至运营方合规政策。主网上线前须由法务确认禁止名单司法辖区。

## 非目标

- 不替代 KYC/AML 流程
- 不阻止 RPC / 合约直接调用
- 移动端需单独在应用商店层面处理地域分发
