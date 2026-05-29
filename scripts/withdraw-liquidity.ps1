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
