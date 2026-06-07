# 停止 Testnet 链下服务
$ErrorActionPreference = "Stop"
$root = Split-Path $PSScriptRoot -Parent
$runDir = Join-Path $root ".run"

foreach ($name in @("gas-station", "lp-guard-keeper", "chain-monitor", "oracle-relayer", "walrus-relay", "prophet-audit-keeper")) {
  $pidFile = Join-Path $runDir "$name.pid"
  if (-not (Test-Path $pidFile)) { continue }
  $procId = [int](Get-Content $pidFile)
  $proc = Get-Process -Id $procId -ErrorAction SilentlyContinue
  if ($proc) {
    Stop-Process -Id $procId -Force
    Write-Host "Stopped $name (pid $procId)"
  }
  Remove-Item $pidFile -Force -ErrorAction SilentlyContinue
}

foreach ($port in @(8787, 8788, 8789, 8790, 8791, 8792)) {
  $lines = netstat -ano | Select-String "LISTENING\s+$port\s"
  foreach ($line in $lines) {
    if ($line -match "\s+(\d+)\s*$") {
      $pid = [int]$Matches[1]
      if ($pid -gt 0) {
        Stop-Process -Id $pid -Force -ErrorAction SilentlyContinue
        Write-Host "Freed port $port (pid $pid)"
      }
    }
  }
}
