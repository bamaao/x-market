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

# 赎回 LP 份额（Phase 2）
param(
  [Parameter(Mandatory = $true)][string]$PoolId,
  [Parameter(Mandatory = $true)][string]$LpShareObjectId,
  [string]$PackageId = $env:X_MARKET_PACKAGE_ID,
  [string]$ClockId = "0x6"
)

if (-not $PackageId) {
  Write-Error "请通过 -PackageId 或环境变量 X_MARKET_PACKAGE_ID 指定包 ID"
  exit 1
}

sui client call --package $PackageId --module pool --function withdraw_liquidity `
  --args $PoolId $LpShareObjectId $ClockId --gas-budget 50000000
