# Upgrade x_market on Testnet (fixes prophet_registry free commit unlock_price==0 bug).
# Requires deployer wallet with ~2+ SUI. Faucet: https://faucet.sui.io/?address=<deployer>
param(
  [string]$UpgradeCap = "0xdaacf4be93d3fe7ecadabef38233f7ffeddc26bb47d6a824ed3904de999631a7",
  [uint64]$GasBudget = 500000000
)

$ErrorActionPreference = "Stop"
$root = Split-Path $PSScriptRoot -Parent
Set-Location $root

Write-Host "Building and upgrading package (UpgradeCap=$UpgradeCap)..."
$out = sui client upgrade --upgrade-capability $UpgradeCap --gas-budget $GasBudget --json
if ($LASTEXITCODE -ne 0) { throw "upgrade failed" }

$digest = ($out | ConvertFrom-Json).digest
Write-Host "Upgrade digest: $digest"
Write-Host "After upgrade, FREE_COMMIT_UNLOCK_PRICE workaround in app can be removed."
