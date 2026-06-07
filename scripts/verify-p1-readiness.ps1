# P1 上线当周就绪检查
param(
  [switch]$SkipServices
)

$ErrorActionPreference = "Stop"
$root = Split-Path $PSScriptRoot -Parent
Set-Location $root
$failed = 0

function Fail($msg) {
  Write-Host "[FAIL] $msg" -ForegroundColor Red
  $script:failed++
}

function Ok($msg) {
  Write-Host "[OK] $msg" -ForegroundColor Green
}

Write-Host "=== P1 Readiness ===" -ForegroundColor Cyan

$requiredDocs = @(
  "docs/oracle-oncall-schedule.md",
  "docs/p1-services-runbook.md",
  "app/.env.mainnet.example"
)
foreach ($d in $requiredDocs) {
  if (Test-Path $d) { Ok $d } else { Fail "missing $d" }
}

$requiredServices = @(
  "services/chain-monitor/src/monitor.ts",
  "services/oracle-relayer/src/relayer.ts",
  "services/walrus-relay/src/server.ts",
  "services/shared/rpc.ts"
)
foreach ($s in $requiredServices) {
  if (Test-Path $s) { Ok $s } else { Fail "missing $s" }
}

if (Test-Path "app/src/lib/rpc-urls.ts") { Ok "app RPC fallback" } else { Fail "app RPC fallback" }

foreach ($svc in @("gas-station", "lp-guard-keeper", "chain-monitor", "oracle-relayer", "walrus-relay")) {
  Push-Location "services/$svc"
  npm run typecheck 2>&1 | Out-Null
  if ($LASTEXITCODE -eq 0) { Ok "typecheck $svc" } else { Fail "typecheck $svc" }
  Pop-Location
}

if (-not $SkipServices) {
  if (Test-Path "services/gas-station/.env.local") {
    & "$PSScriptRoot\verify-services-health.ps1" -IncludeP1
    if ($LASTEXITCODE -ne 0) { $failed++ }
    & "$PSScriptRoot\check-gas-balances.ps1"
  } else {
    Write-Host "[SKIP] services not bootstrapped — run bootstrap-services-env.ps1" -ForegroundColor Yellow
  }
}

if ($failed -gt 0) {
  Write-Host "P1 readiness: $failed issue(s)" -ForegroundColor Red
  exit 1
}
Write-Host "P1 readiness: pass" -ForegroundColor Green
exit 0
