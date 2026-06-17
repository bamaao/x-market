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

# 全新发布 v2 包 + Oracle/Prophet 初始化 + 带 Feed 种子市场
param(
  [int]$MaturityDays = 30,
  [int]$FeeBps = 30,
  [int]$ProtocolFeeBps = 500
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

function Get-PublishedPackageId {
  param([string]$JsonText)
  $tx = $JsonText | ConvertFrom-Json
  foreach ($ch in $tx.objectChanges) {
    if ($ch.type -eq "published") { return $ch.packageId }
  }
  return $null
}

$publishedBackup = Join-Path $root "Published.toml"
$publishedV1 = Join-Path $root "Published.v1.toml.bak"
if ((Test-Path $publishedBackup) -and -not (Test-Path $publishedV1)) {
  Copy-Item $publishedBackup $publishedV1
}
# Fresh publish: remove Published.toml so Move does not treat this as an upgrade.
if (Test-Path $publishedBackup) {
  Remove-Item $publishedBackup -Force
}

$prevDeployPath = Join-Path $root "deploy/testnet-v2.json"
$prevPackageId = $null
if (Test-Path $prevDeployPath) {
  try {
    $prevPackageId = (Get-Content $prevDeployPath -Raw | ConvertFrom-Json).packageId
  } catch {
    $prevPackageId = $null
  }
}

$maturity = [int64]([DateTimeOffset]::UtcNow.ToUnixTimeSeconds() + ($MaturityDays * 86400))
$deployer = (sui client active-address).Trim()
Write-Host "Deployer: $deployer"
Write-Host "Maturity: $maturity"
Write-Host ""

Write-Host "[1/6] sui client publish (Circle USDC dep, skip dep verify)..."
$pubOut = sui client publish --skip-dependency-verification --gas-budget 1200000000 --json
if ($LASTEXITCODE -ne 0) { throw "publish failed" }

$packageId = Get-PublishedPackageId $pubOut
$globalConfig = Get-ObjectIdFromTx $pubOut "config::GlobalConfig"
$adminCap = Get-ObjectIdFromTx $pubOut "config::AdminCap"
$upgradeCap = Get-ObjectIdFromTx $pubOut "package::UpgradeCap"
$publishDigest = ($pubOut | ConvertFrom-Json).digest
$circleUsdc = "0xa1ec7fc00a6f40db9693ad1415d0c193ad3906494428cf252621037bd7117e29::usdc::USDC"

Write-Host "  Package:     $packageId"
Write-Host "  GlobalConfig:$globalConfig"
Write-Host "  AdminCap:    $adminCap"
Write-Host "  USDC:        $circleUsdc (Circle native, no TreasuryCap)"
Write-Host "  UpgradeCap:  $upgradeCap"

Write-Host "`n[2/6] create_oracle_config..."
$cfgOut = sui client call --package $packageId --module macro_oracle --function create_oracle_config `
  --args $globalConfig $adminCap 10000000 86400 --gas-budget 100000000 --json
if ($LASTEXITCODE -ne 0) { throw "oracle config failed" }
$oracleConfigId = Get-ObjectIdFromTx $cfgOut "macro_oracle::OracleConfig"
$feedRegistryId = Get-ObjectIdFromTx $cfgOut "macro_oracle::FeedRegistry"
Write-Host "  OracleConfig: $oracleConfigId"
Write-Host "  FeedRegistry: $feedRegistryId"

Write-Host "`n[3/6] create_oracle_arbitrator + bind..."
$committee = "[`"$deployer`"]"
$arbOut = sui client call --package $packageId --module oracle_arbitrator --function create_oracle_arbitrator `
  --args $globalConfig $adminCap $committee 1 --gas-budget 100000000 --json
if ($LASTEXITCODE -ne 0) { throw "arbitrator failed" }
$arbitratorId = Get-ObjectIdFromTx $arbOut "oracle_arbitrator::OracleArbitrator"
sui client call --package $packageId --module macro_oracle --function set_oracle_arbitrator `
  --args $globalConfig $adminCap $oracleConfigId $arbitratorId --gas-budget 50000000 --json 2>$null | Out-Null
if ($LASTEXITCODE -ne 0) { throw "bind arbitrator failed" }
Write-Host "  OracleArbitrator: $arbitratorId"

Write-Host "`n[4/6] create_prophet_registry..."
$prophetOut = sui client call --package $packageId --module prophet_registry --function create_prophet_registry `
  --args $globalConfig $adminCap $ProtocolFeeBps --gas-budget 50000000 --json
if ($LASTEXITCODE -ne 0) { throw "prophet registry failed" }
$prophetRegistryId = Get-ObjectIdFromTx $prophetOut "prophet_registry::ProphetRegistry"
Write-Host "  ProphetRegistry: $prophetRegistryId"

Write-Host "`n[5/6] create seed pools with feed..."
$poissonOut = sui client call --package $packageId --module pool --function create_poisson_pool_with_feed `
  --args $oracleConfigId $feedRegistryId 25 $maturity $FeeBps "vector<u8>:POISSON_FEED" "vector<u8>:seed poisson" `
  --gas-budget 150000000 --json 2>$null
$poissonPool = Get-ObjectIdFromTx $poissonOut "market_pool::MarketPool"

$dirichletOut = sui client call --package $packageId --module pool --function create_dirichlet_pool_with_feed `
  --args $oracleConfigId $feedRegistryId 10 10 10 $maturity $FeeBps "vector<u8>:DIRICHLET_FEED" "vector<u8>:seed dirichlet" `
  --gas-budget 150000000 --json 2>$null
$dirichletPool = Get-ObjectIdFromTx $dirichletOut "market_pool::MarketPool"

$normalOut = sui client call --package $packageId --module pool --function create_normal_pool_with_feed `
  --args $oracleConfigId $feedRegistryId 25 4 $maturity $FeeBps "vector<u8>:CPI_FEED" "vector<u8>:seed cpi" `
  --gas-budget 150000000 --json 2>$null
$normalPool = Get-ObjectIdFromTx $normalOut "market_pool::MarketPool"

Write-Host "  Poisson:   $poissonPool"
Write-Host "  Dirichlet: $dirichletPool"
Write-Host "  Normal:    $normalPool"

$deployV2 = @{
  network = "testnet"
  publishedAt = (Get-Date -Format "yyyy-MM-dd")
  deployer = $deployer
  packageId = $packageId
  publishTx = $publishDigest
  globalConfig = $globalConfig
  adminCap = $adminCap
  upgradeCap = $upgradeCap
  maturityTs = $maturity
  oracle = @{
    oracleConfigId = $oracleConfigId
    feedRegistryId = $feedRegistryId
    oracleArbitratorId = $arbitratorId
  }
  prophet = @{
    registryId = $prophetRegistryId
  }
  seedMarkets = @{
    poisson_goals = @{ poolId = $poissonPool; lambdaTenths = 25 }
    dirichlet_wdl = @{ poolId = $dirichletPool; alphas = @(10, 10, 10) }
    normal_cpi = @{ poolId = $normalPool; muTenths = 25; sigmaTenths = 4 }
  }
  usdc = @{
    coinType = $circleUsdc
    source = "circle-native"
  }
  superseded = @{
    packageId = $(if ($prevPackageId) { $prevPackageId } else { "0x1a175ee8ba5ae34cedc2f09e5cde8da1bff2fd11cfda7ade4fc369e84e5602a0" })
    note = "previous testnet-v2 package superseded by fresh publish"
  }
  features = @{
    emergencyVoid = $true
    note = "emergency_cancel::emergency_void_market + claim_position_refund"
  }
  explorer = @{
    package = "https://testnet.suivision.xyz/package/$packageId"
  }
}
$deployPath = Join-Path $root "deploy/testnet-v2.json"
$deployV2 | ConvertTo-Json -Depth 6 | Set-Content $deployPath -Encoding utf8

Write-Host "`n[6/6] 写入 app/.env.local ..."
$envLocal = @"
NEXT_PUBLIC_PACKAGE_ID=$packageId
NEXT_PUBLIC_SUI_NETWORK=testnet
NEXT_PUBLIC_POOL_POISSON=$poissonPool
NEXT_PUBLIC_POOL_DIRICHLET=$dirichletPool
NEXT_PUBLIC_POOL_NORMAL=$normalPool
NEXT_PUBLIC_SUI_CLOCK=0x6
NEXT_PUBLIC_GLOBAL_CONFIG=$globalConfig
NEXT_PUBLIC_ADMIN_CAP=$adminCap
NEXT_PUBLIC_ORACLE_CONFIG_ID=$oracleConfigId
NEXT_PUBLIC_ORACLE_ARBITRATOR_ID=$arbitratorId
NEXT_PUBLIC_PROPHET_REGISTRY_ID=$prophetRegistryId
NEXT_PUBLIC_SEAL_THRESHOLD=1
NEXT_PUBLIC_USDC_COIN_TYPE=$circleUsdc
NEXT_PUBLIC_GAS_STATION_URL=http://localhost:8787
NEXT_PUBLIC_INDEXER_URL=http://localhost:8800
"@
$envLocal | Set-Content (Join-Path $root "app/.env.local") -Encoding utf8

Write-Host "`n=== 完成 ==="
Write-Host "deploy/testnet-v2.json"
Write-Host "app/.env.local"
Write-Host "Package: $packageId"
