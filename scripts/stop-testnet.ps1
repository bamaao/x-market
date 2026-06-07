# 停止 Testnet 测试环境（链下服务 + Indexer + Pricing Engine）
param(
  [ValidateSet("frontend", "p0", "p1", "p2", "full")]
  [string]$Profile = "full",
  [switch]$KeepPostgres
)

$ErrorActionPreference = "Stop"
$root = Split-Path $PSScriptRoot -Parent
Set-Location $root
$runDir = Join-Path $root ".run"

function Stop-ByPidFile($name) {
  $pidFile = Join-Path $runDir "$name.pid"
  if (-not (Test-Path $pidFile)) { return }
  $procId = [int](Get-Content $pidFile)
  $proc = Get-Process -Id $procId -ErrorAction SilentlyContinue
  if ($proc) {
    Stop-Process -Id $procId -Force
    Write-Host "Stopped $name (pid $procId)"
  }
  Remove-Item $pidFile -Force -ErrorAction SilentlyContinue
}

function Free-Port($port) {
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

Write-Host "=== Stopping Testnet environment (profile=$Profile) ===" -ForegroundColor Cyan

if ($Profile -ne "frontend") {
  & "$PSScriptRoot\stop-services-testnet.ps1"
  if ($Profile -eq "full") {
    Stop-ByPidFile "prophet-audit-keeper"
    Free-Port 8792
  }
}

if ($Profile -in @("p2", "full")) {
  Stop-ByPidFile "indexer"
  Free-Port 8800
  if (-not $KeepPostgres) {
    if (Get-Command docker -ErrorAction SilentlyContinue) {
      docker compose -f docker-compose.indexer.yml stop postgres 2>$null
      Write-Host "Stopped Docker Postgres"
    }
  } else {
    Write-Host "Keeping Postgres running (-KeepPostgres)"
  }
}

if ($Profile -eq "full") {
  Stop-ByPidFile "pricing-engine"
  Free-Port 8801
}

Write-Host "Done."
