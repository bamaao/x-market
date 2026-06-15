# Copyright (c) 2026 zouyc zouyccq@gmail.com.
# All rights reserved.
#
# Licensed under the Business Source License 1.1 (BSL 1.1).
# You may not use this file except in compliance with the License.
#
# Change Date: 2031-01-01
# On the Change Date, or the fourth anniversary of the first publicly available
# distribution of the code under the BSL, whichever comes first, the code
# automatically becomes available under the Apache License 2.0.

# Phase 1: 创建 3 个 Testnet 种子市场（需已 publish）
param(
  [string]$PackageId = $env:X_MARKET_PACKAGE_ID,
  [int]$MaturityDays = 30
)

if (-not $PackageId) {
  Write-Error "设置环境变量 X_MARKET_PACKAGE_ID 或 -PackageId"
  exit 1
}

$maturity = [int64]([DateTimeOffset]::UtcNow.ToUnixTimeSeconds() + ($MaturityDays * 86400))
$fee = 30

Write-Host "Package: $PackageId"
Write-Host "Maturity unix: $maturity"

Write-Host "`n[1/3] Poisson pool..."
sui client call --package $PackageId --module pool --function create_poisson_pool `
  --args 25 $maturity $fee --gas-budget 50000000

Write-Host "`n[2/3] Dirichlet pool..."
sui client call --package $PackageId --module pool --function create_dirichlet_pool `
  --args 10 10 10 $maturity $fee --gas-budget 50000000

Write-Host "`n[3/3] Normal pool..."
sui client call --package $PackageId --module pool --function create_normal_pool `
  --args 25 4 $maturity $fee --gas-budget 50000000

Write-Host "`n将输出中的 MarketPool ObjectID 写入 deploy/testnet.json 与 app/.env.local"
