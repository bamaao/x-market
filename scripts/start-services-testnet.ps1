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

# 启动 Testnet 链下服务（P0 + P1）
param(
  [switch]$SkipInstall,
  [switch]$P0Only,
  [switch]$IncludeP4,
  [switch]$IncludeZk
)

$ErrorActionPreference = "Stop"
$root = Split-Path $PSScriptRoot -Parent
Set-Location $root
$runDir = Join-Path $root ".run"
New-Item -ItemType Directory -Force -Path $runDir | Out-Null

$services = @("gas-station", "lp-guard-keeper")
if (-not $P0Only) {
  $services += @("chain-monitor", "oracle-relayer", "walrus-relay")
}
if ($IncludeP4) {
  $services += @("prophet-audit-keeper")
}
if ($IncludeZk) {
  $services += @("brevis-zk-prover")
}

foreach ($svc in $services) {
  $envFile = "services/$svc/.env.local"
  if (-not (Test-Path $envFile)) {
    throw "Missing $envFile — run .\scripts\bootstrap-services-env.ps1 first"
  }
}

if (-not $SkipInstall) {
  Write-Host "npm install: services/shared"
  Push-Location services/shared
  npm install --silent 2>&1 | Out-Null
  Pop-Location
  foreach ($svc in $services) {
    Write-Host "npm install: services/$svc"
    Push-Location "services/$svc"
    npm install --silent 2>&1 | Out-Null
    Pop-Location
  }
}

function Start-ServiceJob($name, $workDir, $logFile, $pidFile) {
  if (Test-Path $pidFile) {
    $savedPid = Get-Content $pidFile -ErrorAction SilentlyContinue
    $existing = Get-Process -Id $savedPid -ErrorAction SilentlyContinue
    if ($existing) {
      Write-Host "$name already running (pid $savedPid)"
      return
    }
  }

  $cmd = "npm start *> `"$logFile`""
  $proc = Start-Process -FilePath "powershell.exe" `
    -ArgumentList @("-NoProfile", "-Command", $cmd) `
    -WorkingDirectory $workDir -PassThru -WindowStyle Hidden
  $proc.Id | Set-Content $pidFile
  Write-Host "Started $name pid=$($proc.Id) log=$logFile"
}

foreach ($svc in $services) {
  Start-ServiceJob $svc (Join-Path $root "services/$svc") `
    (Join-Path $runDir "$svc.log") (Join-Path $runDir "$svc.pid")
}

Start-Sleep -Seconds 4
$healthArgs = @()
if (-not $P0Only) { $healthArgs += "-IncludeP1" }
if ($IncludeP4) { $healthArgs += "-IncludeP4" }
if ($IncludeZk) { $healthArgs += "-IncludeZk" }
& "$PSScriptRoot\verify-services-health.ps1" @healthArgs
