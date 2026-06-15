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

# 创建 UMA DVM 仲裁适配器并绑定 OracleConfig（需已 publish 含 oracle_arbitrator UMA 入口）
param(
  [string]$PackageId = $env:X_MARKET_PACKAGE_ID,
  [string]$GlobalConfig = $env:X_MARKET_GLOBAL_CONFIG,
  [string]$AdminCap = $env:X_MARKET_ADMIN_CAP,
  [string]$OracleConfigId = $env:X_MARKET_ORACLE_CONFIG_ID,
  [string[]]$RelayerAllowlist = @(),
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
  Write-Error "需要 PackageId、GlobalConfig、AdminCap"
  exit 1
}

if ($RelayerAllowlist.Count -eq 0) {
  $RelayerAllowlist = @((sui client active-address).Trim())
}

$allowJson = ($RelayerAllowlist | ForEach-Object { "`"$_`"" }) -join ","
$allowArg = "[$allowJson]"

Write-Host "Package:      $PackageId"
Write-Host "Relayers:     $allowArg"

Write-Host "`n[1/2] create_uma_dvm_arbitrator..."
$arbOut = sui client call --package $PackageId --module oracle_arbitrator --function create_uma_dvm_arbitrator `
  --args $GlobalConfig $AdminCap "vector<address>:$allowArg" --gas-budget 100000000 --json
if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }
$arbitratorId = Get-CreatedObjectId -JsonText $arbOut -TypeSuffix "oracle_arbitrator::OracleArbitrator"
Write-Host "  OracleArbitrator (UMA DVM): $arbitratorId"

if (-not $OracleConfigId) {
  $appEnv = "app/.env.local"
  if (Test-Path $appEnv) {
    $line = Get-Content $appEnv | Where-Object { $_ -match "^NEXT_PUBLIC_ORACLE_CONFIG_ID=" } | Select-Object -First 1
    if ($line) { $OracleConfigId = ($line -split "=", 2)[1].Trim() }
  }
}

if (-not $OracleConfigId) {
  Write-Warning "未设置 OracleConfigId，跳过 set_oracle_arbitrator。请手动绑定："
  Write-Host "sui client call --package $PackageId --module macro_oracle --function set_oracle_arbitrator --args $GlobalConfig $AdminCap <OracleConfigId> $arbitratorId"
} else {
  Write-Host "`n[2/2] set_oracle_arbitrator..."
  sui client call --package $PackageId --module macro_oracle --function set_oracle_arbitrator `
    --args $GlobalConfig $AdminCap $OracleConfigId $arbitratorId --gas-budget 50000000
  if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }
}

Write-Host "`n=== 写入环境变量 ==="
Write-Host "NEXT_PUBLIC_ORACLE_ARBITRATOR_ID=$arbitratorId"
Write-Host "ORACLE_ARBITRATOR_ID=$arbitratorId"
Write-Host "`n下一步："
Write-Host "  1. 更新 app/.env.local 与 services/uma-dvm-relayer/.env.local"
Write-Host "  2. cd services/uma-dvm-relayer && npm install && npm start"
