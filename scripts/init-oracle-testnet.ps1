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

# Oracle + 仲裁委员会 Testnet 初始化（需已 publish 含 macro_oracle / oracle_arbitrator）
param(
  [string]$PackageId = $env:X_MARKET_PACKAGE_ID,
  [string]$GlobalConfig = $env:X_MARKET_GLOBAL_CONFIG,
  [string]$AdminCap = $env:X_MARKET_ADMIN_CAP,
  [int]$MinimumBond = 10000000,
  [int]$LivenessSecs = 86400,
  [string[]]$Committee = @(),
  [int]$Threshold = 0,
  [switch]$RegisterSeedFeeds,
  [string]$DeployJson = "deploy/testnet.json"
)

function Get-CreatedObjectId {
  param([string]$JsonText, [string]$TypeSuffix)
  $tx = $JsonText | ConvertFrom-Json
  foreach ($ch in $tx.objectChanges) {
    if ($ch.type -eq "created" -and $ch.objectType -like "*$TypeSuffix*") {
      return $ch.objectId
    }
  }
  return $null
}

if (-not $PackageId) {
  if (Test-Path $DeployJson) {
    $deploy = Get-Content $DeployJson -Raw | ConvertFrom-Json
    $PackageId = $deploy.packageId
    if (-not $GlobalConfig) { $GlobalConfig = $deploy.globalConfig }
    if (-not $AdminCap) { $AdminCap = $deploy.adminCap }
  }
}

if (-not $PackageId -or -not $GlobalConfig -or -not $AdminCap) {
  Write-Error "需要 PackageId、GlobalConfig、AdminCap（参数或 deploy/testnet.json / 环境变量）"
  exit 1
}

if ($Committee.Count -eq 0) {
  $active = (sui client active-address).Trim()
  $Committee = @($active)
}

if ($Threshold -le 0) {
  $Threshold = [Math]::Min(2, $Committee.Count)
  if ($Threshold -lt 1) { $Threshold = 1 }
}

$committeeJson = ($Committee | ForEach-Object { "`"$_`"" }) -join ","
$committeeArg = "[$committeeJson]"

Write-Host "Package:       $PackageId"
Write-Host "GlobalConfig:  $GlobalConfig"
Write-Host "Committee:     $committeeArg (threshold $Threshold)"
Write-Host "Bond/Liveness: $MinimumBond / $LivenessSecs"
Write-Host ""

Write-Host "[1/3] create_oracle_config..."
$cfgOut = sui client call --package $PackageId --module macro_oracle --function create_oracle_config `
  --args $GlobalConfig $AdminCap $MinimumBond $LivenessSecs --gas-budget 100000000 --json
if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }
$oracleConfigId = Get-CreatedObjectId -JsonText $cfgOut -TypeSuffix "macro_oracle::OracleConfig"
$registryId = Get-CreatedObjectId -JsonText $cfgOut -TypeSuffix "macro_oracle::FeedRegistry"
Write-Host "  OracleConfig: $oracleConfigId"
Write-Host "  FeedRegistry: $registryId"

Write-Host "`n[2/3] create_oracle_arbitrator..."
$arbOut = sui client call --package $PackageId --module oracle_arbitrator --function create_oracle_arbitrator `
  --args $GlobalConfig $AdminCap $committeeArg $Threshold --gas-budget 100000000 --json
if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }
$arbitratorId = Get-CreatedObjectId -JsonText $arbOut -TypeSuffix "oracle_arbitrator::OracleArbitrator"
Write-Host "  OracleArbitrator: $arbitratorId"

Write-Host "`n[3/3] set_oracle_arbitrator..."
sui client call --package $PackageId --module macro_oracle --function set_oracle_arbitrator `
  --args $GlobalConfig $AdminCap $oracleConfigId $arbitratorId --gas-budget 50000000
if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }

if ($RegisterSeedFeeds -and (Test-Path $DeployJson)) {
  $deploy = Get-Content $DeployJson -Raw | ConvertFrom-Json
  $maturity = $deploy.maturityTs
  $pools = @(
    @{ Name = "poisson"; Id = $deploy.seedMarkets.poisson_goals.poolId; Tag = "POISSON_FEED" },
    @{ Name = "dirichlet"; Id = $deploy.seedMarkets.dirichlet_wdl.poolId; Tag = "DIRICHLET_FEED" },
    @{ Name = "normal"; Id = $deploy.seedMarkets.normal_cpi.poolId; Tag = "CPI_FEED" }
  )
  Write-Host "`n[可选] 为种子池补登 Feed（需当前地址为 pool authority）..."
  foreach ($p in $pools) {
    if (-not $p.Id) { continue }
    Write-Host "  register_data_feed_for_pool: $($p.Name) $($p.Id)"
    sui client call --package $PackageId --module macro_oracle --function register_data_feed_for_pool `
      --args $oracleConfigId $registryId $p.Id "vector<u8>:$($p.Tag)" 0 0 0 "vector<u8>:seed feed" `
      --gas-budget 100000000
  }
}

Write-Host "`n=== 写入 app/.env.local ==="
Write-Host "NEXT_PUBLIC_GLOBAL_CONFIG=$GlobalConfig"
Write-Host "NEXT_PUBLIC_ORACLE_CONFIG_ID=$oracleConfigId"
Write-Host "NEXT_PUBLIC_ORACLE_ARBITRATOR_ID=$arbitratorId"
Write-Host "`n完成后重新 publish/upgrade 包并访问 /oracle 测试全流程。"
