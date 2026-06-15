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

# P0.7 应急演练前置：运行自动化检查并打印演练清单
param(
  [switch]$SkipMoveTest,
  [switch]$CheckServices
)

$ErrorActionPreference = "Stop"
$root = Split-Path $PSScriptRoot -Parent

Write-Host "=== P0 Drill Pre-flight ===" -ForegroundColor Cyan
Write-Host ""

& "$PSScriptRoot\verify-p0-readiness.ps1" @PSBoundParameters
if ($LASTEXITCODE -ne 0) {
  Write-Host "Fix failures before running drills." -ForegroundColor Red
  exit 1
}

Write-Host ""
Write-Host "=== Manual Drill Checklist (record in docs/mainnet-drill-*.md) ===" -ForegroundColor Cyan
Write-Host ""
Write-Host "A. 正常买入 -> Oracle 结算 -> claim_position"
Write-Host "   Ref: docs/oracle-playbook.md, docs/phase2-playbook.md"
Write-Host ""
Write-Host "B. slash_pool -> timelock (1800s) -> 恢复交易"
Write-Host "   Ref: docs/phase3-playbook.md"
Write-Host ""
Write-Host "C. SlashGovernance: propose -> approve -> execute"
Write-Host "   Ref: docs/phase3-playbook.md"
Write-Host ""
Write-Host "D. ZkVerification: challenge -> delayed finalization"
Write-Host "   Ref: docs/phase3-playbook.md"
Write-Host ""
Write-Host "E. Prophet: free commit (unlock_price=0) -> unlock -> audit -> leaderboard"
Write-Host "   Ref: docs/prophet-playbook.md"
Write-Host ""
Write-Host "F. Gas Station sponsor flow (/prophet)"
Write-Host "   Ref: services/gas-station/README.md"
Write-Host ""
Write-Host "G. LP Guard Keeper tick + set_lp_guard_params"
Write-Host "   Ref: services/lp-guard-keeper/README.md"
Write-Host ""
Write-Host "Template: docs/mainnet-drill-record-template.md"
Write-Host "Governance params: docs/mainnet-governance-params.md"
Write-Host ""
Write-Host "Automated Testnet run:"
Write-Host "  .\scripts\run-p0-drills-testnet.ps1"
Write-Host ""
Write-Host "Output: docs/mainnet-drill-2026-06-06.md"
