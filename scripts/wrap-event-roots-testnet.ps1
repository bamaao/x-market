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

# Phase 4: 为现有种子市场创建 EventRoot 并链接 AMM + ProphetRegistry
param(
  [string]$DeployJson = (Join-Path (Split-Path $PSScriptRoot -Parent) "deploy/testnet-v2.json")
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

function Get-PoolMaturity {
  param([string]$PoolId)
  $obj = sui client object $PoolId --json | ConvertFrom-Json
  if ($obj.content.maturity_ts) {
    return [int64]$obj.content.maturity_ts
  }
  if ($obj.data.content.fields.maturity_ts) {
    return [int64]$obj.data.content.fields.maturity_ts
  }
  if ($deploy.maturityTs) {
    return [int64]$deploy.maturityTs
  }
  return 0
}

function Get-FeedForPool {
  param(
    [string]$FeedRegistryId,
    [string]$PoolId
  )
  $page = sui client dynamic-field $FeedRegistryId --json | ConvertFrom-Json
  foreach ($field in $page.dynamicFields) {
    $json = $field.fieldObject.json
    if ($json.name -eq $PoolId) {
      return $json.value
    }
  }
  return $null
}

if (-not (Test-Path $DeployJson)) {
  throw "Deploy file not found: $DeployJson — run deploy-oracle-prophet-testnet.ps1 first"
}

$deploy = Get-Content $DeployJson -Raw | ConvertFrom-Json
# Prefer upgraded package id from Published.toml (new modules like event_root)
$publishedToml = Join-Path $root "Published.toml"
$packageId = $deploy.packageId
if (Test-Path $publishedToml) {
  $pubMatch = Select-String -Path $publishedToml -Pattern 'published-at = "(0x[a-f0-9]+)"'
  if ($pubMatch) { $packageId = $pubMatch.Matches[0].Groups[1].Value }
}
$feedRegistryId = $deploy.oracle.feedRegistryId
$prophetRegistryId = $deploy.prophet.registryId

Write-Host "Package:          $packageId"
Write-Host "FeedRegistry:     $feedRegistryId"
Write-Host "ProphetRegistry:  $prophetRegistryId"
Write-Host ""

$eventRoots = @{}
foreach ($key in $deploy.seedMarkets.PSObject.Properties.Name) {
  $market = $deploy.seedMarkets.$key
  $poolId = $market.poolId
  $eventId = switch ($key) {
    "poisson_goals" { "POISSON_FEED" }
    "dirichlet_wdl" { "DIRICHLET_FEED" }
    "normal_cpi" { "CPI_FEED" }
    default { $key.ToUpper() }
  }
  Write-Host "[$key] pool=$poolId event_id=$eventId"

  $maturity = Get-PoolMaturity $poolId
  $feedId = Get-FeedForPool $feedRegistryId $poolId
  if (-not $feedId) {
    Write-Warning "  No DataFeed for pool $poolId — skip"
    continue
  }
  Write-Host "  feed=$feedId maturity=$maturity"

  $wrapOut = sui client call --package $packageId --module event_root --function create_and_link `
    --args "vector<u8>:$eventId" $maturity $feedId $poolId $prophetRegistryId `
    --gas-budget 100000000 --json
  if ($LASTEXITCODE -ne 0) { throw "create_and_link failed for $key" }

  $rootId = Get-ObjectIdFromTx $wrapOut "event_root::EventRoot"
  Write-Host "  EventRoot: $rootId"
  $eventRoots[$key] = @{
    eventRootId = $rootId
    poolId = $poolId
    feedId = $feedId
    eventId = $eventId
    lockTime = $maturity
  }
}

$deploy | Add-Member -NotePropertyName eventRoots -NotePropertyValue $eventRoots -Force
$deploy | ConvertTo-Json -Depth 8 | Set-Content $DeployJson -Encoding utf8

$envPath = Join-Path $root "app/.env.local"
if (Test-Path $envPath) {
  $lines = Get-Content $envPath
  $newLines = @()
  foreach ($line in $lines) {
    if ($line -notmatch "^NEXT_PUBLIC_EVENT_ROOT_") { $newLines += $line }
  }
  if ($eventRoots.poisson_goals) {
    $newLines += "NEXT_PUBLIC_EVENT_ROOT_POISSON=$($eventRoots.poisson_goals.eventRootId)"
  }
  if ($eventRoots.dirichlet_wdl) {
    $newLines += "NEXT_PUBLIC_EVENT_ROOT_DIRICHLET=$($eventRoots.dirichlet_wdl.eventRootId)"
  }
  if ($eventRoots.normal_cpi) {
    $newLines += "NEXT_PUBLIC_EVENT_ROOT_NORMAL=$($eventRoots.normal_cpi.eventRootId)"
  }
  $newLines | Set-Content $envPath -Encoding utf8
  Write-Host "`nUpdated app/.env.local with EVENT_ROOT_* ids"
}

Write-Host "`n=== EventRoot 迁移完成 ==="
Write-Host "Updated: $DeployJson"
