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

# X-Market Testnet 测试环境一键部署
# 用法: .\scripts\deploy-testnet.ps1 [-Profile p1|p0|p2|full|frontend] [-DryRunKeeper] [-SkipBootstrap]
param(
  [ValidateSet("frontend", "p0", "p1", "p2", "full")]
  [string]$Profile = "p1",
  [switch]$SkipBootstrap,
  [switch]$SkipInstall,
  [switch]$DryRunKeeper,
  [switch]$SkipPostgres,
  [string]$DeployJson = "deploy/testnet-v2.json"
)

$ErrorActionPreference = "Stop"
$root = Split-Path $PSScriptRoot -Parent
Set-Location $root

function Require-Command($name) {
  if (-not (Get-Command $name -ErrorAction SilentlyContinue)) {
    throw "Missing required command: $name"
  }
}

function Wait-PostgresHealthy {
  param([int]$MaxWaitSec = 90)
  $deadline = (Get-Date).AddSeconds($MaxWaitSec)
  while ((Get-Date) -lt $deadline) {
    try {
      $r = docker compose -f docker-compose.indexer.yml ps --format json 2>$null | ConvertFrom-Json
      $pg = $r | Where-Object { $_.Service -eq "postgres" -and $_.Health -eq "healthy" }
      if ($pg) { return }
    } catch { }
    Start-Sleep -Seconds 2
  }
  throw "Postgres did not become healthy within ${MaxWaitSec}s"
}

Write-Host "=== X-Market Testnet Deploy (profile=$Profile) ===" -ForegroundColor Cyan
Write-Host "Root: $root"
Write-Host ""

Require-Command node
Require-Command npm

if (-not (Test-Path $DeployJson)) {
  throw "Missing $DeployJson — chain config required"
}

# --- Frontend env ---
function Bootstrap-AppEnv {
  $appExample = "app/.env.example"
  $appLocal = "app/.env.local"
  if (-not (Test-Path $appExample)) {
    throw "Missing $appExample"
  }
  if (-not (Test-Path $appLocal)) {
    Copy-Item $appExample $appLocal
    Write-Host "Created $appLocal from example"
  }
  $deploy = Get-Content $DeployJson -Raw | ConvertFrom-Json
  $text = Get-Content $appLocal -Raw
  $text = $text -replace "NEXT_PUBLIC_PACKAGE_ID=.*", "NEXT_PUBLIC_PACKAGE_ID=$($deploy.packageId)"
  if ($Profile -ne "frontend") {
    if ($text -notmatch "NEXT_PUBLIC_GAS_STATION_URL") {
      $text += "`nNEXT_PUBLIC_GAS_STATION_URL=http://localhost:8787`n"
    } else {
      $text = $text -replace "NEXT_PUBLIC_GAS_STATION_URL=.*", "NEXT_PUBLIC_GAS_STATION_URL=http://localhost:8787"
    }
    if ($text -notmatch "NEXT_PUBLIC_WALRUS_PUBLISHER_URL") {
      $text += "NEXT_PUBLIC_WALRUS_PUBLISHER_URL=http://localhost:8791`n"
    } else {
      $text = $text -replace "NEXT_PUBLIC_WALRUS_PUBLISHER_URL=.*", "NEXT_PUBLIC_WALRUS_PUBLISHER_URL=http://localhost:8791"
    }
  }
  if ($Profile -in @("p2", "full")) {
    if ($text -notmatch "NEXT_PUBLIC_INDEXER_URL") {
      $text += "NEXT_PUBLIC_INDEXER_URL=http://localhost:8800`n"
    } else {
      $text = $text -replace "NEXT_PUBLIC_INDEXER_URL=.*", "NEXT_PUBLIC_INDEXER_URL=http://localhost:8800"
    }
  }
  if ($Profile -eq "full") {
    if ($text -notmatch "NEXT_PUBLIC_PRICING_ENGINE_URL") {
      $text += "NEXT_PUBLIC_PRICING_ENGINE_URL=http://localhost:8801`n"
    } else {
      $text = $text -replace "NEXT_PUBLIC_PRICING_ENGINE_URL=.*", "NEXT_PUBLIC_PRICING_ENGINE_URL=http://localhost:8801"
    }
  }
  Set-Content -Path $appLocal -Value $text.TrimEnd() -Encoding UTF8
  Write-Host "Updated $appLocal"
}

# --- Bootstrap ---
if (-not $SkipBootstrap) {
  if ($Profile -eq "frontend") {
    Bootstrap-AppEnv
  } else {
    Require-Command sui
    Write-Host "Bootstrapping service env from $DeployJson ..."
    & "$PSScriptRoot\bootstrap-services-env.ps1" -DeployJson $DeployJson -DryRunKeeper:$DryRunKeeper
    if ($Profile -in @("p2", "full")) {
      & "$PSScriptRoot\bootstrap-indexer-env.ps1" -DeployJson $DeployJson
    }
  }
} elseif ($Profile -eq "frontend") {
  if (-not (Test-Path "app/.env.local")) { Bootstrap-AppEnv }
}

# --- Frontend deps ---
if (-not $SkipInstall) {
  Write-Host "npm install: app/"
  Push-Location app
  npm install --silent 2>&1 | Out-Null
  Pop-Location
}

if ($Profile -eq "frontend") {
  Write-Host ""
  Write-Host "Frontend ready. Start with:" -ForegroundColor Green
  Write-Host "  cd app && npm run dev"
  Write-Host "  → http://localhost:3000"
  exit 0
}

# --- Postgres (P2+) ---
if ($Profile -in @("p2", "full") -and -not $SkipPostgres) {
  Require-Command docker
  Write-Host "Starting Postgres (docker compose) ..."
  docker compose -f docker-compose.indexer.yml up -d postgres
  Wait-PostgresHealthy
  Write-Host "Postgres is healthy"
}

# --- Services ---
$includeP4 = $Profile -eq "full"
$p0Only = $Profile -eq "p0"

Write-Host "Starting chain services ..."
$startArgs = @()
if ($SkipInstall) { $startArgs += "-SkipInstall" }
if ($p0Only) { $startArgs += "-P0Only" }
if ($includeP4) { $startArgs += "-IncludeP4" }
& "$PSScriptRoot\start-services-testnet.ps1" @startArgs

# --- Indexer (P2+) ---
if ($Profile -in @("p2", "full")) {
  $idxArgs = @()
  if ($SkipInstall) { $idxArgs += "-SkipInstall" }
  & "$PSScriptRoot\start-indexer.ps1" @idxArgs
}

# --- Pricing Engine (full) ---
if ($Profile -eq "full") {
  $peArgs = @()
  if ($SkipInstall) { $peArgs += "-SkipInstall" }
  & "$PSScriptRoot\start-pricing-engine.ps1" @peArgs
}

# --- Verify ---
Write-Host ""
Write-Host "Running verification ..."
$verifyArgs = @("-Profile", $Profile)
& "$PSScriptRoot\verify-testnet-deployment.ps1" @verifyArgs
if ($LASTEXITCODE -ne 0) {
  Write-Host "Verification reported issues — check logs in .run/" -ForegroundColor Yellow
}

# --- Summary ---
Write-Host ""
Write-Host "=== Deploy complete (profile=$Profile) ===" -ForegroundColor Green
Write-Host ""
Write-Host "Endpoints:"
if ($Profile -ne "frontend") {
  Write-Host "  Gas Station      http://localhost:8787/health"
  Write-Host "  LP Guard Keeper  http://localhost:8788/health"
}
if ($Profile -in @("p1", "p2", "full")) {
  Write-Host "  Chain Monitor    http://localhost:8789/health"
  Write-Host "  Oracle Relayer   http://localhost:8790/health"
  Write-Host "  Walrus Relay     http://localhost:8791/health"
}
if ($Profile -in @("p2", "full")) {
  Write-Host "  Indexer API      http://localhost:8800/health"
}
if ($Profile -eq "full") {
  Write-Host "  Pricing Engine   http://localhost:8801/health"
  Write-Host "  Audit Keeper     http://localhost:8792/health"
}
Write-Host ""
Write-Host "Start frontend (separate terminal):"
Write-Host "  cd app && npm run dev"
Write-Host "  → http://localhost:3000"
Write-Host ""
Write-Host "Stop all: .\scripts\stop-testnet.ps1 -Profile $Profile"
Write-Host "Docs:     docs/testnet-deployment.md"
