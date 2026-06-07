# P4 本机端到端验证（本机 Postgres，无需 Docker）
param(
  [string]$IndexerUrl = "http://localhost:8800",
  [string]$AuditKeeperUrl = "http://localhost:8792"
)

$ErrorActionPreference = "Stop"
$root = Split-Path $PSScriptRoot -Parent
Set-Location $root
$failed = 0

function Fail($m) { Write-Host "[FAIL] $m" -ForegroundColor Red; $script:failed++ }
function Ok($m) { Write-Host "[OK] $m" -ForegroundColor Green }

Write-Host "=== P4 E2E (local Postgres) ===" -ForegroundColor Cyan

try {
  $h = Invoke-RestMethod "$IndexerUrl/health" -TimeoutSec 15
  if ($h.ok) { Ok "indexer health ($IndexerUrl)" } else { Fail "indexer unhealthy" }
} catch { Fail "indexer $IndexerUrl — $($_.Exception.Message)" }

try {
  $a = Invoke-RestMethod "$AuditKeeperUrl/health" -TimeoutSec 15
  if ($a.ok) { Ok "audit-keeper health dryRun=$($a.dryRun)" } else { Fail "audit-keeper unhealthy" }
} catch { Fail "audit-keeper $AuditKeeperUrl — $($_.Exception.Message)" }

foreach ($ep in @(
  "/v1/markets",
  "/v1/event-roots",
  "/v1/metrics/prophet-gmv?days=30",
  "/v1/prophecies?limit=5"
)) {
  try {
    Invoke-RestMethod "$IndexerUrl$ep" -TimeoutSec 15 | Out-Null
    Ok "GET $ep"
  } catch {
    Fail "GET $ep — $($_.Exception.Message)"
  }
}

try {
  $markets = (Invoke-RestMethod "$IndexerUrl/v1/markets").markets
  if ($markets.Count -ge 3) { Ok "markets seeded ($($markets.Count))" }
  else { Fail "markets count=$($markets.Count) expected >= 3" }
} catch { Fail "markets check" }

try {
  $roots = (Invoke-RestMethod "$IndexerUrl/v1/event-roots").eventRoots
  if ($roots.Count -ge 3) { Ok "event_roots seeded ($($roots.Count))" }
  else { Fail "event_roots count=$($roots.Count) expected >= 3" }
} catch { Fail "event_roots check" }

if ($failed -gt 0) {
  Write-Host "P4 E2E: $failed issue(s)" -ForegroundColor Red
  exit 1
}
Write-Host "P4 E2E local: pass" -ForegroundColor Green
Write-Host "Note: audit_prophecy needs resolved pool + on-chain prophecies; not_resolved in keeper log is expected until then." -ForegroundColor DarkGray
