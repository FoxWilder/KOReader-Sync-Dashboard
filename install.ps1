# KOReader Sync Dashboard - Universal Installer/Updater/Uninstaller
# Optimized for Windows Server 2025

param (
    [string]$Version = "latest",
    [switch]$Uninstall,
    [switch]$Force
)

$repo = "FoxWilder/KOReader-Sync-Dashboard"
$installDir = Get-Location
$setupScript = "setup.ps1"

Write-Host "--- KOReader Sync Dashboard Manager ---" -ForegroundColor Cyan

# --- UNINSTALL LOGIC ---
if ($Uninstall) {
    $confirm = $true
    if (-not $Force) {
        $confirm = Read-Host "Are you sure you want to uninstall and DELETE ALL DATA (including database)? (y/n)"
        $confirm = ($confirm -eq "y")
    }
    
    if ($confirm) {
        Write-Host "Uninstalling..." -ForegroundColor Yellow
        # Stop any running processes? (Optional but recommended)
        Get-Process | Where-Object { $_.CommandLine -like "*vite*" -or $_.CommandLine -like "*node*" } | Stop-Process -ErrorAction SilentlyContinue
        
        Write-Host "Removing files..."
        $filesToRemove = "dist", "node_modules", "sake.db", ".env", "package.json", "package-lock.json", "setup.ps1", "migrate.py"
        foreach ($f in $filesToRemove) {
            if (Test-Path "$installDir\$f") { Remove-Item -Recurse -Force "$installDir\$f" }
        }
        Write-Host "Uninstall complete." -ForegroundColor Green
    }
    exit
}

# --- INSTALL / UPGRADE LOGIC ---

# 1. Detection
if (Test-Path "$installDir\package.json") {
    Write-Host "Existing installation detected. mode: UPGRADE" -ForegroundColor Yellow
    $isUpdate = $true
} else {
    Write-Host "No existing installation found. mode: NEW INSTALL" -ForegroundColor Green
    $isUpdate = $false
}

# 2. Fetch Release Info
Write-Host "Fetching version information ($Version)..."
try {
    if ($Version -eq "latest") {
        $releaseUrl = "https://api.github.com/repos/$repo/releases/latest"
    } else {
        $releaseUrl = "https://api.github.com/repos/$repo/releases/tags/$Version"
    }
    $releaseInfo = Invoke-RestMethod -Uri $releaseUrl
    $assetUrl = ($releaseInfo.assets | Where-Object { $_.name -like "*.zip" } | Select-Object -First 1).browser_download_url
    Write-Host "Target Version: $($releaseInfo.tag_name)" -ForegroundColor Magenta
} catch {
    Write-Error "Failed to fetch version '$Version'. Check if it exists at https://github.com/$repo/releases"
    exit 1
}

# 3. Backup
if ($isUpdate) {
    Write-Host "Creating safety backups..."
    $backupDir = ".backup_$([DateTime]::Now.ToString('yyyyMMddHHmmss'))"
    New-Item -ItemType Directory -Path $backupDir | Out-Null
    if (Test-Path "sake.db") { Copy-Item "sake.db" "$backupDir/sake.db" }
    if (Test-Path ".env") { Copy-Item ".env" "$backupDir/.env" }
}

# 4. Download
$tempFile = "$env:TEMP\sake-$($releaseInfo.tag_name).zip"
Write-Host "Downloading..."
Invoke-WebRequest -Uri $assetUrl -OutFile $tempFile

# 5. Extract & Deploy
Write-Host "Deploying files..."
Expand-Archive -Path $tempFile -DestinationPath $installDir -Force
Remove-Item $tempFile

# 6. Post-Install Setup
if (Test-Path $setupScript) {
    Write-Host "Running lifecycle scripts..."
    powershell -ExecutionPolicy Bypass -File $setupScript
}

Write-Host "--- Operation Successful ---" -ForegroundColor Green
if ($isUpdate) { Write-Host "Note: Previous database backup saved in $backupDir" -ForegroundColor Gray }
Write-Host "Start the dashboard with: npm run dev"
