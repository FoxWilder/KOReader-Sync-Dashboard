# Wilder Sync Dashboard - Universal Installer/Updater/Uninstaller
# Optimized for Windows Server 2025

param (
    [string]$Version = "latest",
    [switch]$Uninstall,
    [switch]$Force
)

$repo = "FoxWilder/KOReader-Sync-Dashboard"
$installDir = Get-Location
$setupScript = "setup.ps1"
$logFile = "$installDir\install_log.txt"

# --- LOGGING WRAPPER ---
function Write-Log([string]$message, [string]$color = "White") {
    $timestamp = Get-Date -Format "yyyy-MM-dd HH:mm:ss"
    $fullMessage = "[$timestamp] $message"
    Write-Host $message -ForegroundColor $color
    $fullMessage | Out-File -FilePath $logFile -Append
}

Write-Log "--- Wilder Sync Dashboard Manager ---" "Cyan"
Write-Log "Based on project Sake (Sudashiii/Sake)" "Gray"

# --- UNINSTALL LOGIC ---
if ($Uninstall) {
    $confirm = $true
    if (-not $Force) {
        $confirm = Read-Host "Are you sure you want to uninstall? (y/n)"
        $confirm = ($confirm -eq "y")
    }
    
    if ($confirm) {
        Write-Log "Uninstalling..." "Yellow"
        # Stop any running processes
        Get-Process | Where-Object { $_.CommandLine -like "*server.ts*" -or $_.CommandLine -like "*node*" } | Stop-Process -ErrorAction SilentlyContinue 
        
        Write-Log "Removing files..."
        $filesToRemove = "dist", "node_modules", "wilder.db", "sake.db", ".env", "package.json", "package-lock.json", "setup.ps1", "migrate.py", "server.ts", "service_log.txt", "sync_log.txt", "install_log.txt", "drizzle.config.ts"
        foreach ($f in $filesToRemove) {
            if (Test-Path "$installDir\$f") { Remove-Item -Recurse -Force "$installDir\$f" }
        }
        Write-Log "Uninstall complete." "Green"
    }
    exit
}

# --- INSTALL / UPGRADE LOGIC ---

# Ensure folder context
Write-Log "Installation Directory: $installDir"

# 1. Detection
if (Test-Path "$installDir\package.json") {
    Write-Log "Existing installation detected. mode: UPGRADE" "Yellow"
    $isUpdate = $true
} else {
    Write-Log "No existing installation found. mode: NEW INSTALL" "Green"
    $isUpdate = $false
}

# 2. Fetch Release Info
Write-Log "Fetching version information ($Version) from GitHub..."
try {
    $releaseUrl = ""
    if ($Version -eq "latest") {
        # Fetch all releases and pick top one (more reliable than /latest if only Drafts exist)
        $releaseUrl = "https://api.github.com/repos/$repo/releases"
        $releases = Invoke-RestMethod -Uri $releaseUrl
        if ($releases.Count -eq 0) {
            Write-Error "No releases found in repository $repo. Please wait for the GitHub Action to complete or create a tag."
            Write-Log "CRITICAL: No releases found." "Red"
            exit 1
        }
        $releaseInfo = $releases[0] # Take the most recent release
    } else {
        $releaseUrl = "https://api.github.com/repos/$repo/releases/tags/$Version"
        $releaseInfo = Invoke-RestMethod -Uri $releaseUrl
    }
    
    $asset = $releaseInfo.assets | Where-Object { $_.name -like "*.zip" } | Select-Object -First 1
    if (-not $asset) {
        Write-Error "No ZIP asset found in release $($releaseInfo.tag_name)"
        exit 1
    }
    $assetUrl = $asset.browser_download_url
    Write-Log "Target Version: $($releaseInfo.tag_name)" "Magenta"
} catch {
    Write-Log "ERROR: Failed to fetch version info. API may be rate limited or repo has no releases." "Red"
    Write-Error "Failed to fetch version '$Version'. Check if it exists at https://github.com/$repo/releases. Error: $($_.Exception.Message)"
    exit 1
}

# 3. Backup
if ($isUpdate) {
    Write-Log "Creating safety backups..."
    $backupDir = ".backup_$([DateTime]::Now.ToString('yyyyMMddHHmmss'))"
    New-Item -ItemType Directory -Path $backupDir | Out-Null
    if (Test-Path "wilder.db") { Copy-Item "wilder.db" "$backupDir/wilder.db" }
    if (Test-Path "sake.db") { Copy-Item "sake.db" "$backupDir/sake.db" }
    if (Test-Path ".env") { Copy-Item ".env" "$backupDir/.env" }
}

# 4. Download
$tempFile = "$env:TEMP\wilder-$($releaseInfo.tag_name).zip"
Write-Log "Downloading from $assetUrl..."
Invoke-WebRequest -Uri $assetUrl -OutFile $tempFile

# 5. Extract & Deploy
Write-Log "Deploying files to $installDir..."
Expand-Archive -Path $tempFile -DestinationPath $installDir -Force
Remove-Item $tempFile

# 6. Post-Install Setup
if (Test-Path $setupScript) {
    Write-Log "Running lifecycle scripts..."
    powershell -ExecutionPolicy Bypass -File $setupScript
}

Write-Log "--- Operation Successful ---" "Green"
if ($isUpdate) { Write-Log "Note: Previous database backup saved in $backupDir" "Gray" }

Write-Log "Starting Wilder Dashboard service..." "Cyan"
# Start the server using npm.cmd for Windows compatibility
$npmCmd = "npm"
if ($IsWindows) { $npmCmd = "npm.cmd" }

Start-Process -FilePath $npmCmd -ArgumentList "run dev" -WindowStyle Hidden -WorkingDirectory $installDir

Write-Log "Dashboard is active. It will run in the background."
Write-Log "Portable service started at http://localhost:3000"
