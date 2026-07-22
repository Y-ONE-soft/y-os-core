# Create a PR-unit work branch + worktree, then install dependencies.
# Branch name = work name in Korean (words joined with hyphens), one branch per PR.
#
# Usage:   .\scripts\new-work.ps1 <work-name> [base-branch]
# Example: .\scripts\new-work.ps1 my-feature-name
#          (Korean work names are expected, e.g. from CLAUDE.md branch strategy)
#
# NOTE: This file is intentionally ASCII-only. Windows PowerShell 5.1 misreads
# UTF-8 scripts without BOM, which would corrupt non-ASCII literals.

param(
    [Parameter(Mandatory = $true)][string]$Name,
    [string]$Base = "main"
)

$ErrorActionPreference = "Stop"

$repoRoot = git rev-parse --show-toplevel
if ($LASTEXITCODE -ne 0 -or -not $repoRoot) { throw "Run this inside the git repository." }
$repoRoot = $repoRoot.Trim()

$worktreePath = Join-Path $repoRoot ".claude\worktrees\$Name"
if (Test-Path $worktreePath) { throw "Worktree path already exists: $worktreePath" }

git worktree add $worktreePath -b $Name $Base
if ($LASTEXITCODE -ne 0) { throw "git worktree add failed (exit $LASTEXITCODE)." }

Push-Location $worktreePath
try {
    npm install
    if ($LASTEXITCODE -ne 0) { throw "npm install failed (exit $LASTEXITCODE)." }
}
finally {
    Pop-Location
}

Write-Host ""
Write-Host "Worktree ready."
Write-Host "  Path   : $worktreePath"
Write-Host "  Branch : $Name (base: $Base)"
Write-Host "  Dev    : cd `"$worktreePath`"; npm run dev -- -p 3001"
