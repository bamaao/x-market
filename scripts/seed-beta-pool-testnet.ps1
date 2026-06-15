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

# 为现有 v4 Testnet 部署补建 Beta 种子池 + EventRoot，并更新 deploy/testnet-v2.json
param(
  [string]$DeployJson = "deploy/testnet-v2.json",
  [int]$Alpha = 10,
  [int]$Beta = 10,
  [int]$FeeBps = 30
)

$ErrorActionPreference = "Stop"
$root = Split-Path $PSScriptRoot -Parent
Set-Location $root

function Get-ObjectIdFromTx {
  param([string]$JsonText, [string]$TypeSuffix)
  $tx = $JsonText | ConvertFrom-Json
  foreach ($ch in $tx.objectChanges) {
    if ($ch.type -eq "created" -and $ch.objectType -like "*$TypeSuffix*") {
      return $ch.objectId
    }
  }
  return $null
}

function Get-FeedForPool {
  param(
    [string]$FeedRegistryId,
    [string]$PoolId
  )
  $page = sui client dynamic-field $FeedRegistryId --json | ConvertFrom-Json
  foreach ($field in $page.data) {
    $name = $field.name.value
    if ($name -eq $PoolId) {
      return $field.objectId
    }
  }
  foreach ($field in $page.dynamicFields) {
    $json = $field.fieldObject.json
    if ($json.name -eq $PoolId) {
      return $json.value
    }
  }
  return $null
}

$deployPath = Join-Path $root $DeployJson
if (-not (Test-Path $deployPath)) {
  throw "Deploy file not found: $DeployJson"
}

$deploy = Get-Content $deployPath -Raw | ConvertFrom-Json
if ($deploy.seedMarkets.beta_vote) {
  Write-Host "Beta pool already exists: $($deploy.seedMarkets.beta_vote.poolId)"
  exit 0
}

$packageId = $deploy.packageId
$oracleConfigId = $deploy.oracle.oracleConfigId
$feedRegistryId = $deploy.oracle.feedRegistryId
$prophetRegistryId = $deploy.prophet.registryId
$maturity = [int64]$deploy.maturityTs

Write-Host "Package:     $packageId"
Write-Host "Maturity:    $maturity"
Write-Host "Alpha/Beta:  $Alpha / $Beta"
Write-Host ""

Write-Host "[1/2] create_beta_pool_with_feed..."
$betaOut = sui client call --package $packageId --module pool --function create_beta_pool_with_feed `
  --args $oracleConfigId $feedRegistryId $Alpha $Beta $maturity $FeeBps "vector<u8>:BETA_FEED" "vector<u8>:seed beta vote" `
  --gas-budget 150000000 --json
if ($LASTEXITCODE -ne 0) { throw "create_beta_pool_with_feed failed" }

$betaPool = Get-ObjectIdFromTx $betaOut "market_pool::MarketPool"
Write-Host "  Beta pool: $betaPool"

$feedId = Get-FeedForPool $feedRegistryId $betaPool
if (-not $feedId) { throw "No DataFeed registered for beta pool $betaPool" }
Write-Host "  DataFeed:  $feedId"

Write-Host "`n[2/2] create_and_link EventRoot..."
$wrapOut = sui client call --package $packageId --module event_root --function create_and_link `
  --args "vector<u8>:BETA_FEED" $maturity $feedId $betaPool $prophetRegistryId `
  --gas-budget 100000000 --json
if ($LASTEXITCODE -ne 0) { throw "create_and_link failed" }

$eventRootId = Get-ObjectIdFromTx $wrapOut "event_root::EventRoot"
Write-Host "  EventRoot: $eventRootId"

$deploy.seedMarkets | Add-Member -NotePropertyName beta_vote -NotePropertyValue @{
  poolId = $betaPool
  alpha = $Alpha
  beta = $Beta
} -Force

if (-not $deploy.eventRoots) {
  $deploy | Add-Member -NotePropertyName eventRoots -NotePropertyValue @{} -Force
}
$deploy.eventRoots | Add-Member -NotePropertyName beta_vote -NotePropertyValue @{
  eventRootId = $eventRootId
  poolId = $betaPool
  feedId = $feedId
  eventId = "BETA_FEED"
  lockTime = $maturity
} -Force

$deploy | ConvertTo-Json -Depth 8 | Set-Content $deployPath -Encoding utf8
Write-Host "`nUpdated $deployPath"
Write-Host "Run: .\scripts\bootstrap-mobile-env.ps1"
