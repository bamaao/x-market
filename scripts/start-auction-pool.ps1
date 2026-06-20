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

<#
.SYNOPSIS
  创建 Opening Auction 池（Poisson / Dirichlet / Normal），链上 status = Auction (0)。

.DESCRIPTION
  本脚本调用 `start_*_auction`（不含 Oracle Feed 注册）。

  **推荐方式（含 Feed + Indexer 元数据）：**
  前端 `/markets/create` → 启动方式选「Opening Auction」→ 一次签名完成
  `start_*_auction_with_feed` + Oracle Feed + Indexer 注册（需已发布含 Phase 1.5+ 新入口的包）。

  **本脚本适用场景：**
  - 本地/演示快速创建裸 Auction 池（仅链上对象）
  - CI / 手工测试 finalize 流程
  - 已有 Oracle，稍后单独 `register_data_feed_for_pool`

  创建后：
  1. 记录交易输出中的 MarketPool Object ID
  2. 市场页 AuctionPanel → auction_bid → finalize_auction
  3. 可选：Indexer POST /v1/markets/register（launch_mode=auction, auction_end_ts=...）

.PARAMETER Kind
  poisson | dirichlet | normal

.PARAMETER AuctionHours
  竞价窗口长度（小时）。设为 0 表示创建后立即可 finalize（演示用）。

.PARAMETER WithFeed
  若指定，且配置了 OracleConfig / FeedRegistry，调用 `start_*_auction_with_feed`。
  需环境变量 NEXT_PUBLIC_ORACLE_CONFIG_ID、X_MARKET_FEED_REGISTRY_ID，
  或 deploy/testnet-v2.json 中的 oracle 字段（脚本会自动读取）。

.EXAMPLE
  .\scripts\start-auction-pool.ps1 -Kind dirichlet -AuctionHours 24

.EXAMPLE
  # 演示：立即可 finalize
  .\scripts\start-auction-pool.ps1 -Kind poisson -AuctionHours 0 -MaturityDays 30

.EXAMPLE
  # 含 Oracle Feed（需新包）
  .\scripts\start-auction-pool.ps1 -Kind normal -WithFeed -FeedIdentifier "CPI_MAR_2026"
#>
param(
  [ValidateSet("poisson", "dirichlet", "normal")]
  [string]$Kind = "poisson",
  [string]$PackageId = $env:X_MARKET_PACKAGE_ID,
  [string]$ClockId = "0x6",
  [int]$AuctionHours = 24,
  [int]$MaturityDays = 30,
  [int]$FeeBps = 30,
  [switch]$WithFeed,
  [string]$OracleConfigId = $env:NEXT_PUBLIC_ORACLE_CONFIG_ID,
  [string]$FeedRegistryId = $env:X_MARKET_FEED_REGISTRY_ID,
  [string]$FeedIdentifier = "AUCTION_FEED",
  [string]$Ancillary = "Opening Auction seed pool"
)

if ($WithFeed -and (-not $OracleConfigId -or -not $FeedRegistryId)) {
  $deployPath = Join-Path $PSScriptRoot "..\deploy\testnet-v2.json"
  if (Test-Path $deployPath) {
    $deploy = Get-Content $deployPath -Raw | ConvertFrom-Json
    if (-not $OracleConfigId) { $OracleConfigId = $deploy.oracle.oracleConfigId }
    if (-not $FeedRegistryId) { $FeedRegistryId = $deploy.oracle.feedRegistryId }
  }
}

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
Write-Host "WithFeed: $WithFeed"

if ($WithFeed) {
  if (-not $OracleConfigId -or -not $FeedRegistryId) {
    Write-Error "WithFeed 需要 OracleConfigId 与 FeedRegistryId（环境变量或参数）"
    exit 1
  }
  $fn = switch ($Kind) {
    "poisson" { "start_poisson_auction_with_feed" }
    "dirichlet" { "start_dirichlet_auction_with_feed" }
    "normal" { "start_normal_auction_with_feed" }
  }
  sui client call --package $PackageId --module pool --function $fn `
    --args $OracleConfigId $FeedRegistryId $auctionEnd $maturity $FeeBps `
    "vector<u8>:$FeedIdentifier" "vector<u8>:$Ancillary" $ClockId `
    --gas-budget 100000000
} else {
  $fn = switch ($Kind) {
    "poisson" { "start_poisson_auction" }
    "dirichlet" { "start_dirichlet_auction" }
    "normal" { "start_normal_auction" }
  }
  sui client call --package $PackageId --module pool --function $fn `
    --args $auctionEnd $maturity $FeeBps $ClockId --gas-budget 100000000
}

Write-Host ""
Write-Host "下一步："
Write-Host "  1. 从交易 objectChanges 复制 MarketPool ID"
Write-Host "  2. 前端 /markets/[slug] → AuctionPanel 竞价"
Write-Host "  3. 到 auction_end_ts 后 finalize_auction"
Write-Host "  4. 或通过 /markets/create 创建（推荐，含 Indexer 元数据 launch_mode=auction）"
