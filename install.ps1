# KOReader Sync Dashboard - Universal Installer/Updater
# This script installs or upgrades the Sake-based dashboard without Docker.

$repo = "FoxWilder/KOReader-Sync-Dashboard"
$installDir = Get-Location
$setupScript = "setup.ps1"

Write-Host "--- KOReader Sync Dashboard Setup ---" -ForegroundColor Cyan

# 1. Detection
if (Test-Path "$installDir\package.json") {
    Write-Host "Existing installation detected in $installDir. Switching to UPGRADE mode." -ForegroundColor Yellow
    $isUpdate = $true
} else {
    Write-Host "No existing installation found. Switching to NEW INSTALL mode." -ForegroundColor Green
    $isUpdate = $false
}

# 2. Fetch Latest Release Info
Write-Host "Fetching latest release from GitHub ($repo)..."
try {
    $releaseUrl = "https://api.github.com/repos/$repo/releases/latest"
    $releaseInfo = Invoke-RestMethod -Uri $releaseUrl
    $assetUrl = ($releaseInfo.assets | Where-Object { $_.name -like "*.zip" } | Select-Object -First 1).browser_download_url
    
    if (-not $assetUrl) {
        Write-Error "Could not find a ZIP asset in the latest release. Please check $repo releases."
        exit 1
    }
} catch {
    Write-Error "Failed to fetch release info. Error: $($_.Exception.Message)"
    exit 1
}

# 3. Upgrade Backup
if ($isUpdate) {
    Write-Host "Backing up database and configuration..."
    if (Test-Path "sake.db") { Copy-Item "sake.db" "sake.db.bak" -Force }
    if (Test-Path ".env") { Copy-Item ".env" ".env.bak" -Force }
}

# 4. Download and Extract
$tempFile = "$env:TEMP\sake-download.zip"
Write-Host "Downloading $assetUrl ..."
Invoke-WebRequest -Uri $assetUrl -OutFile $tempFile

Write-Host "Extracting files..."
Expand-Archive -Path $tempFile -DestinationPath $installDir -Force
Remove-Item $tempFile

# 5. Restore Backup (if update)
if ($isUpdate) {
    Write-Host "Restoring backup..."
    if (Test-Path "sake.db.bak") { Move-Item "sake.db.bak" "sake.db" -Force }
    if (Test-Path ".env.bak") { 
        # Optionally merge env files if needed, but for now just keep old one
        Move-Item ".env.bak" ".env" -Force 
    }
}

# 6. Execute Internal Setup
if (Test-Path $setupScript) {
    Write-Host "Running internal setup script..."
    powershell -ExecutionPolicy Bypass -File $setupScript
} else {
    Write-Error "Setup script ($setupScript) not found in the downloaded package."
    exit 1
}

Write-Host "--- Install/Upgrade Complete ---" -ForegroundColor Green
Write-Host "You can now run 'npm run dev' or 'npm start' to begin."
