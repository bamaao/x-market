# 检查链下服务健康端点（P0 + 可选 P1）
param(
  [string]$GasStationUrl = "http://localhost:8787",
  [string]$KeeperUrl = "http://localhost:8788",
  [string]$MonitorUrl = "http://localhost:8789",
  [string]$RelayerUrl = "http://localhost:8790",
  [string]$WalrusRelayUrl = "http://localhost:8791",
  [string]$AuditKeeperUrl = "http://localhost:8792",
  [switch]$IncludeP1,
  [switch]$IncludeP4
)

$ErrorActionPreference = "Stop"
$failed = @()

function Check-Health($name, $url) {
  try {
    $r = Invoke-RestMethod -Uri "$url/health" -TimeoutSec 10
    if ($r.ok) {
      Write-Host "[OK] $name $url" -ForegroundColor Green
      Write-Host "     $($r | ConvertTo-Json -Compress)"
      return $true
    }
    Write-Host "[WARN] $name unhealthy: $($r.errors -join '; ')" -ForegroundColor Yellow
    Write-Host "     $($r | ConvertTo-Json -Compress)"
    return $false
  } catch {
    Write-Host "[FAIL] $name $url — $($_.Exception.Message)" -ForegroundColor Red
    return $false
  }
}

if (-not (Check-Health "gas-station" $GasStationUrl)) { $failed += "gas-station" }
if (-not (Check-Health "lp-guard-keeper" $KeeperUrl)) { $failed += "lp-guard-keeper" }

if ($IncludeP1) {
  if (-not (Check-Health "chain-monitor" $MonitorUrl)) { $failed += "chain-monitor" }
  if (-not (Check-Health "oracle-relayer" $RelayerUrl)) { $failed += "oracle-relayer" }
  if (-not (Check-Health "walrus-relay" $WalrusRelayUrl)) { $failed += "walrus-relay" }
}

if ($IncludeP4) {
  if (-not (Check-Health "prophet-audit-keeper" $AuditKeeperUrl)) { $failed += "prophet-audit-keeper" }
}

if ($failed.Count -gt 0) {
  Write-Host "Unhealthy: $($failed -join ', '). Logs: .run/*.log"
  exit 1
}
Write-Host "All services healthy."
exit 0
