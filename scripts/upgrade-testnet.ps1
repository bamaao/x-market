# Upgrade x_market on Testnet (fixes prophet_registry free commit unlock_price==0 bug).
# Requires deployer wallet with ~2+ SUI. Faucet: https://faucet.sui.io/?address=<deployer>
param(
  [string]$DeployJson = "deploy/testnet-v2.json",
  [string]$UpgradeCap = "",
  [uint64]$GasBudget = 1500000000
)

$ErrorActionPreference = "Stop"
$root = Split-Path $PSScriptRoot -Parent
Set-Location $root

$deployPath = Join-Path $root $DeployJson
if (Test-Path $deployPath) {
  $deploy = Get-Content $deployPath -Raw | ConvertFrom-Json
  if (-not $UpgradeCap -and $deploy.upgradeCap) {
    $UpgradeCap = $deploy.upgradeCap
  }
}

if (-not $UpgradeCap) {
  throw "UpgradeCap required (pass -UpgradeCap or set in $DeployJson)"
}

Write-Host "Tip: upgrade needs a single gas coin >= gas budget. Merge coins first:"
Write-Host "  sui client merge-coin --primary-coin <largest> --coin-to-merge <other> --gas-budget 10000000"
Write-Host ""
Write-Host "Building and upgrading package (UpgradeCap=$UpgradeCap, GasBudget=$GasBudget)..."
$out = sui client upgrade --upgrade-capability $UpgradeCap --gas-budget $GasBudget --json
if ($LASTEXITCODE -ne 0) { throw "upgrade failed" }

$result = $out | ConvertFrom-Json
$digest = $result.digest
Write-Host "Upgrade digest: $digest"

$newPackageId = $null
if ($result.objectChanges) {
  foreach ($ch in $result.objectChanges) {
    if ($ch.type -eq "published" -and $ch.packageId) {
      $newPackageId = $ch.packageId
      break
    }
  }
}

if ($newPackageId) {
  Write-Host "New package ID: $newPackageId"
  if (Test-Path $deployPath) {
    $deploy.packageId = $newPackageId
    if (-not $deploy.PSObject.Properties["upgradeHistory"]) {
      $deploy | Add-Member -NotePropertyName upgradeHistory -NotePropertyValue @()
    }
    $deploy.upgradeHistory += @{
      digest = $digest
      packageId = $newPackageId
      at = (Get-Date -Format "yyyy-MM-ddTHH:mm:ssZ")
    }
    $deploy | ConvertTo-Json -Depth 10 | Set-Content $deployPath -Encoding UTF8
    Write-Host "Updated $DeployJson with new packageId"
  }
} else {
  Write-Host "WARN: could not parse new packageId from upgrade output; update deploy json manually"
}

Write-Host ""
Write-Host "Post-upgrade:"
Write-Host "  1. Update app/.env.local NEXT_PUBLIC_PACKAGE_ID=$newPackageId"
Write-Host "  2. Update services/* PACKAGE_ID / X_MARKET_PACKAGE_ID"
Write-Host "  3. Re-run: .\scripts\verify-p0-readiness.ps1"
