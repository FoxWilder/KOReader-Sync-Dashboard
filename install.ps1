# Wilder Sync Dashboard - Universal Installer/Updater/Uninstaller
# Optimized for Windows Server 2025
# Structure: [ROOT] -> install.ps1, run.ps1, app/ (binaries, src, logs, storage)

param (
    [string]$Version = "latest",
    [switch]$Uninstall,
    [switch]$Force
)

$repo = "FoxWilder/KOReader-Sync-Dashboard"
$installDir = Get-Location
$appDir = "$installDir\app"
$logDir = "$appDir\logs"

# Ensure directories exist before logging
if (!(Test-Path $appDir)) { New-Item -ItemType Directory $appDir -Force | Out-Null }
if (!(Test-Path $logDir)) { New-Item -ItemType Directory $logDir -Force | Out-Null }

$logFile = "$logDir\install_log.txt"

# --- LOGGING WRAPPER ---
function Write-Log([string]$message, [string]$color = "White") {
    $timestamp = Get-Date -Format "yyyy-MM-dd HH:mm:ss"
    $fullMessage = "[$timestamp] $message"
    Write-Host $message -ForegroundColor $color
    if ($logFile) {
        $parentDir = Split-Path $logFile -Parent
        if (!(Test-Path $parentDir)) { New-Item -ItemType Directory $parentDir -Force | Out-Null }
        $fullMessage | Out-File -FilePath $logFile -Append -Encoding utf8
    }
}

Write-Log "--- Wilder Sync Dashboard Manager ---" "Cyan"
Write-Log "Based on project Sake (Sudashiii/Sake)" "Gray"

# --- UNINSTALL LOGIC ---
if ($Uninstall) {
    if (-not $Force) {
        $confirm = Read-Host "Are you sure you want to uninstall and DELETE ALL DATA? (y/n)"
        if ($confirm -ne "y") { exit }
    }
    
    Write-Log "Stopping processes..." "Yellow"
    $connections = Get-NetTCPConnection -LocalPort 3000 -ErrorAction SilentlyContinue
    if ($connections) {
        foreach ($conn in $connections) {
            if ($conn.OwningProcess) {
                Stop-Process -Id $conn.OwningProcess -Force -ErrorAction SilentlyContinue
            }
        }
    }
    
    Write-Log "Removing application files..."
    Remove-Item -Recurse -Force "$installDir\app" -ErrorAction SilentlyContinue
    Remove-Item -Force "$installDir\install.ps1", "$installDir\run.ps1" -ErrorAction SilentlyContinue
    
    Write-Log "Uninstall complete." "Green"
    exit
}

# --- INSTALL / UPGRADE LOGIC ---

# 1. Detection
if (Test-Path "$installDir\app\package.json") {
    Write-Log "Existing installation detected. mode: UPGRADE" "Yellow"
    $isUpdate = $true
} else {
    Write-Log "No existing installation found. mode: NEW INSTALL" "Green"
    $isUpdate = $false
}

# 2. Fetch Release Info
Write-Log "Fetching version information ($Version) from GitHub..."
try {
    # Try releases first
    $releaseUrl = "https://api.github.com/repos/$repo/releases/latest"
    if ($Version -ne "latest") {
        $releaseUrl = "https://api.github.com/repos/$repo/releases/tags/$Version"
    }
    
    $releaseInfo = $null
    try {
        $releaseInfo = Invoke-RestMethod -Uri $releaseUrl
    } catch {
        # Fallback to tags if releases 404
        Write-Log "Falling back to tags query..." "Gray"
        $tags = Invoke-RestMethod -Uri "https://api.github.com/repos/$repo/tags"
        if ($tags) {
            $tag = $tags[0]
            $releaseInfo = @{
                tag_name = $tag.name
                assets = @(@{
                    name = "source.zip"
                    browser_download_url = $tag.zipball_url
                })
            }
        }
    }

    if (!$releaseInfo) { throw "No release or tag found." }
    
    $asset = $releaseInfo.assets | Where-Object { $_.name -like "*.zip" -or $_.name -like "source.zip" } | Select-Object -First 1
    $assetUrl = $asset.browser_download_url
} catch {
    Write-Log "ERROR: Failed to fetch version info." "Red"
    exit 1
}

# 3. Stop running processes
Write-Log "Ensuring workspace is unlocked..." "Yellow"
$connections = Get-NetTCPConnection -LocalPort 3000 -ErrorAction SilentlyContinue
if ($connections) {
    foreach ($conn in $connections) {
        if ($conn.OwningProcess) {
            Stop-Process -Id $conn.OwningProcess -Force -ErrorAction SilentlyContinue
        }
    }
}
Start-Sleep -Seconds 2

# 4. Download
$tempFile = "$env:TEMP\wilder-update.zip"
Write-Log "Downloading version $($releaseInfo.tag_name)..."
Invoke-WebRequest -Uri $assetUrl -OutFile $tempFile

# 5. Backup & Prep
$tempDir = New-Item -ItemType Directory -Path "$env:TEMP\wilder_prep_$([Guid]::NewGuid())"
if ($isUpdate) {
    Write-Log "Staging existing data..."
    if (Test-Path "$installDir\app\storage") { Copy-Item -Recurse "$installDir\app\storage" "$tempDir\storage" }
    if (Test-Path "$installDir\app\logs") { Copy-Item -Recurse "$installDir\app\logs" "$tempDir\logs" }
    # Legacy check
    if (Test-Path "$installDir\wilder.db") { Copy-Item "$installDir\wilder.db" "$tempDir\storage\wilder.db" -ErrorAction SilentlyContinue }
}

# 6. Deploy
Write-Log "Deploying core files..."
# Clean app folder but KEEP root scripts for now
if (Test-Path "$installDir\app") { Remove-Item -Recurse -Force "$installDir\app" }
New-Item -ItemType Directory -Path "$installDir\app" -Force | Out-Null

# Re-ensure log directory exists immediately after app folder is recreated
if (!(Test-Path "$appDir\logs")) { New-Item -ItemType Directory "$appDir\logs" -Force | Out-Null }

Expand-Archive -Path $tempFile -DestinationPath "$installDir\app" -Force
Remove-Item $tempFile

# Restore data
if (Test-Path "$tempDir\storage") { Move-Item "$tempDir\storage" "$installDir\app\storage" -Force }
if (Test-Path "$tempDir\logs") { Move-Item "$tempDir\logs" "$installDir\app\logs" -Force }
Remove-Item -Recurse $tempDir

# 7. Setup
Write-Log "Running infrastructure setup..."
Set-Location "$installDir\app"

# Ensure dependencies are installed
if (!(Test-Path "node_modules")) {
    Write-Log "Installing Node.js dependencies (this may take a minute)..." "Yellow"
    npm install --omit=dev
}

if (Test-Path "setup.ps1") { powershell -ExecutionPolicy Bypass -File "setup.ps1" }

# 8. Finalize Root
Write-Log "Finalizing root pointers..."
Set-Location $installDir

# Move run.ps1 and install.ps1 to root if they were inside the app folder
if (Test-Path "app\run.ps1") { Move-Item "app\run.ps1" "run.ps1" -Force }
if (Test-Path "app\install.ps1") { Move-Item "app\install.ps1" "install.ps1" -Force }

# Ensure run.ps1 exists and is correct
$runContent = @"
# Wilder Sync Dashboard Launcher
Set-Location "`$PSScriptRoot\app"
if (!(Test-Path "node_modules")) {
    Write-Host "Dependencies missing. Orchestrating installation..." -ForegroundColor Yellow
    npm install --omit=dev
}
# Execute server using path-safe invocation
& "node_modules/.bin/tsx" server.ts --prod
"@
Set-Content -Path "run.ps1" -Value $runContent

Write-Log "--- SUCCESS: Wilder Sync v$($releaseInfo.tag_name) is ready ---" "Green"
Write-Log "Launch 'run.ps1' to start the service." "Cyan"

# Automatically start it
./run.ps1
