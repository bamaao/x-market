# Testnet 部署后统一验证
param(
  [ValidateSet("frontend", "p0", "p1", "p2", "full")]
  [string]$Profile = "p1"
)

$ErrorActionPreference = "Continue"
$failed = @()

Write-Host "=== Verify Testnet deployment (profile=$Profile) ===" -ForegroundColor Cyan

if ($Profile -eq "frontend") {
  if (-not (Test-Path "app/.env.local")) {
    Write-Host "[FAIL] missing app/.env.local" -ForegroundColor Red
    exit 1
  }
  Write-Host "[OK] app/.env.local exists" -ForegroundColor Green
  exit 0
}

$svcArgs = @()
if ($Profile -in @("p1", "p2", "full")) { $svcArgs += "-IncludeP1" }
if ($Profile -eq "full") { $svcArgs += "-IncludeP4" }
if ($Profile -eq "p0") {
  & "$PSScriptRoot\verify-services-health.ps1"
} else {
  & "$PSScriptRoot\verify-services-health.ps1" @svcArgs
}
if ($LASTEXITCODE -ne 0) { $failed += "services" }

if ($Profile -in @("p2", "full")) {
  & "$PSScriptRoot\verify-indexer-health.ps1"
  if ($LASTEXITCODE -ne 0) { $failed += "indexer" }
}

if ($Profile -eq "full") {
  try {
    $r = Invoke-RestMethod -Uri "http://localhost:8801/health" -TimeoutSec 10
    if ($r.ok) {
      Write-Host "[OK] pricing-engine http://localhost:8801/health" -ForegroundColor Green
    } else {
      $failed += "pricing-engine"
    }
  } catch {
    Write-Host "[FAIL] pricing-engine — $($_.Exception.Message)" -ForegroundColor Red
    $failed += "pricing-engine"
  }
}

if (-not (Test-Path "app/.env.local")) {
  Write-Host "[WARN] app/.env.local missing — run bootstrap or deploy-testnet.ps1" -ForegroundColor Yellow
} else {
  Write-Host "[OK] app/.env.local exists" -ForegroundColor Green
}

if ($failed.Count -gt 0) {
  Write-Host ""
  Write-Host "Failed checks: $($failed -join ', ')" -ForegroundColor Red
  Write-Host "Logs: .run/*.log"
  exit 1
}

Write-Host ""
Write-Host "All checks passed for profile=$Profile" -ForegroundColor Green
exit 0
