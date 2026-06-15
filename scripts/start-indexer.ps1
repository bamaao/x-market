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

# 启动 Indexer（需 Postgres 已运行）
param(
  [switch]$SkipInstall
)

$ErrorActionPreference = "Stop"
$root = Split-Path $PSScriptRoot -Parent
Set-Location $root
$runDir = Join-Path $root ".run"
New-Item -ItemType Directory -Force -Path $runDir | Out-Null

if (-not (Test-Path "services/indexer/.env.local")) {
  & "$PSScriptRoot\bootstrap-indexer-env.ps1"
}

if (-not $SkipInstall) {
  Push-Location services/indexer
  npm install --silent 2>&1 | Out-Null
  Pop-Location
}

$pidFile = Join-Path $runDir "indexer.pid"
$logFile = Join-Path $runDir "indexer.log"
if (Test-Path $pidFile) {
  $savedPid = Get-Content $pidFile -ErrorAction SilentlyContinue
  $existing = Get-Process -Id $savedPid -ErrorAction SilentlyContinue
  if ($existing) {
    Write-Host "Indexer already running (pid $savedPid)"
    exit 0
  }
}

$cmd = "npm start *> `"$logFile`""
$proc = Start-Process -FilePath "powershell.exe" `
  -ArgumentList @("-NoProfile", "-Command", $cmd) `
  -WorkingDirectory (Join-Path $root "services/indexer") -PassThru -WindowStyle Hidden
$proc.Id | Set-Content $pidFile
Write-Host "Started indexer pid=$($proc.Id) log=$logFile"

Start-Sleep -Seconds 5
& "$PSScriptRoot\verify-indexer-health.ps1"
