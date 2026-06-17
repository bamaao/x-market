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

# 本机 PostgreSQL 建库 + Indexer 迁移（Windows）
param(
  [ValidateSet("docker", "native", "migrate", "sql")]
  [string]$Mode = "docker",
  [switch]$SkipMigrate,
  [string]$DbUser = "xmarket",
  [string]$DbPassword = "xmarket",
  [string]$DbName = "xmarket_indexer"
)

$ErrorActionPreference = "Stop"
$root = Split-Path $PSScriptRoot -Parent
Set-Location $root

switch ($Mode) {
  "docker" {
    docker compose -f docker-compose.indexer.yml up -d postgres
    $deadline = (Get-Date).AddSeconds(90)
    while ((Get-Date) -lt $deadline) {
      $ok = docker compose -f docker-compose.indexer.yml exec -T postgres pg_isready -U $DbUser -d $DbName 2>$null
      if ($LASTEXITCODE -eq 0) { break }
      Start-Sleep -Seconds 2
    }
    if ($LASTEXITCODE -ne 0) { throw "Postgres did not become healthy" }
  }
  "native" {
    & "$PSScriptRoot\bootstrap-local-postgres.ps1" -DbUser $DbUser -DbPassword $DbPassword -DbName $DbName
  }
  "sql" {
    & "$PSScriptRoot\bootstrap-local-postgres.ps1" -DbUser $DbUser -DbPassword $DbPassword -DbName $DbName
    if ($SkipMigrate) { exit 0 }
  }
  "migrate" { }
}

if ($SkipMigrate -and $Mode -ne "sql") {
  Write-Host "Skip migrations (-SkipMigrate)"
  exit 0
}

if (-not (Test-Path "services/indexer/.env.local")) {
  & "$PSScriptRoot\bootstrap-indexer-env.ps1"
}

Push-Location services/indexer
npm install --silent
npm run migrate
Pop-Location

Write-Host ""
Write-Host "Postgres init complete (mode=$Mode)." -ForegroundColor Green
Write-Host "Next: .\scripts\start-indexer.ps1"
