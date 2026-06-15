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

# 创建 Opening Auction 池（Poisson / Dirichlet / Normal）
param(
  [ValidateSet("poisson", "dirichlet", "normal")]
  [string]$Kind = "poisson",
  [string]$PackageId = $env:X_MARKET_PACKAGE_ID,
  [string]$ClockId = "0x6",
  [int]$AuctionHours = 24,
  [int]$MaturityDays = 30,
  [int]$FeeBps = 30
)

$now = [int][double]::Parse((Get-Date -UFormat %s))
$auctionEnd = $now + ($AuctionHours * 3600)
$maturity = $now + ($MaturityDays * 86400)

if (-not $PackageId) {
  Write-Error "请通过 -PackageId 或环境变量 X_MARKET_PACKAGE_ID 指定包 ID"
  exit 1
}

Write-Host "Package: $PackageId"
Write-Host "Kind: $Kind"
Write-Host "AuctionEnd: $auctionEnd"
Write-Host "Maturity: $maturity"

if ($Kind -eq "poisson") {
  sui client call --package $PackageId --module pool --function start_poisson_auction `
    --args $auctionEnd $maturity $FeeBps $ClockId --gas-budget 100000000
} elseif ($Kind -eq "dirichlet") {
  sui client call --package $PackageId --module pool --function start_dirichlet_auction `
    --args $auctionEnd $maturity $FeeBps $ClockId --gas-budget 100000000
} else {
  sui client call --package $PackageId --module pool --function start_normal_auction `
    --args $auctionEnd $maturity $FeeBps $ClockId --gas-budget 100000000
}
