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

# 本机 PostgreSQL 初始化（无需 Docker）
# 前提：已安装 psql，且能以超级用户 postgres 连接 localhost:5432
param(
  [string]$DbName = "xmarket_indexer",
  [string]$DbUser = "xmarket",
  [string]$DbPassword = "xmarket"
)

$ErrorActionPreference = "Stop"
$root = Split-Path $PSScriptRoot -Parent
Set-Location $root

Write-Host "Creating role/database (idempotent)..." -ForegroundColor Cyan
psql -U postgres -h localhost -v ON_ERROR_STOP=1 -c @"
DO `$`$ BEGIN
  CREATE ROLE $DbUser WITH LOGIN PASSWORD '$DbPassword';
EXCEPTION WHEN duplicate_object THEN NULL;
END `$`$;
"@ 2>&1 | Out-Null

$exists = psql -U postgres -h localhost -tAc "SELECT 1 FROM pg_database WHERE datname='$DbName';"
if (-not ($exists -match "1")) {
  psql -U postgres -h localhost -c "CREATE DATABASE $DbName OWNER $DbUser;"
  Write-Host "Created database $DbName"
} else {
  Write-Host "Database $DbName already exists"
}

& "$PSScriptRoot\bootstrap-indexer-env.ps1"
Write-Host ""
Write-Host "Next:" -ForegroundColor Green
Write-Host "  .\scripts\start-indexer.ps1"
Write-Host "  .\scripts\start-services-testnet.ps1 -IncludeP4"
