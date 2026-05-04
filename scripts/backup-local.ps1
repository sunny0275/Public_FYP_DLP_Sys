# DLP FYP - Local Backup Script
# Excludes large/generated folders to keep backup lean

$projectRoot = Split-Path -Parent $PSScriptRoot
$backupDir = Join-Path $projectRoot "_local_backup_$(Get-Date -Format 'yyyyMMdd_HHmmss')"

# Folders and files to exclude
$excludePatterns = @(
    "node_modules",
    "dist",
    "dist-electron",
    ".vite",
    "target",
    "bin",
    "obj",
    ".gradle",
    "build",
    "*.class",
    ".next",
    ".nuxt",
    ".cache",
    ".tmp",
    ".temp",
    "__pycache__",
    "*.pyc",
    ".pytest_cache",
    ".venv",
    "venv",
    ".idea",
    ".vs",
    "*.suo",
    "*.user",
    "*.rs",
    "Cargo.lock",
    ".git",
    "docker-compose.override.yml",
    "docker-desktop-data",
    "volumes",
    "logs",
    "*.log",
    ".env.local",
    ".env.*.local",
    "*.env.bak",
    "frontend_backup",
    "frontend_backup_*",
    "agent-transcripts",
    ".cursor",
    "terminals"
)

# Files to exclude by exact name or pattern
$excludeNames = @(
    "package-lock.json",
    "pnpm-lock.yaml",
    "yarn.lock",
    "npm-shrinkwrap.json",
    "bun.lockb"
)

Write-Host "=== DLP FYP Local Backup ===" -ForegroundColor Cyan
Write-Host "Source: $projectRoot"
Write-Host "Destination: $backupDir"
Write-Host ""

# Create backup directory
New-Item -ItemType Directory -Path $backupDir -Force | Out-Null

$totalFiles = 0
$skippedFiles = 0
$totalSize = 0

# Get all files recursively
$allFiles = Get-ChildItem -Path $projectRoot -Recurse -File -ErrorAction SilentlyContinue

foreach ($file in $allFiles) {
    $relativePath = $file.FullName.Substring($projectRoot.Length + 1)
    $destPath = Join-Path $backupDir $relativePath

    # Skip excluded folders
    $skip = $false
    foreach ($pattern in $excludePatterns) {
        if ($relativePath -match "\\$pattern\\" -or $relativePath -match "^$pattern\\" -or $relativePath -eq $pattern) {
            $skip = $true
            $skippedFiles++
            break
        }
    }

    # Skip excluded names
    if (-not $skip) {
        foreach ($name in $excludeNames) {
            if ($file.Name -eq $name) {
                $skip = $true
                $skippedFiles++
                break
            }
        }
    }

    if ($skip) { continue }

    # Create parent directory
    $parentDir = Split-Path -Parent $destPath
    if (-not (Test-Path $parentDir)) {
        New-Item -ItemType Directory -Path $parentDir -Force | Out-Null
    }

    # Copy file
    Copy-Item -Path $file.FullName -Destination $destPath -Force
    $totalFiles++
    $totalSize += $file.Length
}

Write-Host "Backup complete!" -ForegroundColor Green
Write-Host ""
Write-Host "Files copied  : $totalFiles"
Write-Host "Files skipped : $skippedFiles"
Write-Host "Total size   : $([math]::Round($totalSize / 1MB, 2)) MB"
Write-Host ""
Write-Host "Backup location: $backupDir" -ForegroundColor Cyan
