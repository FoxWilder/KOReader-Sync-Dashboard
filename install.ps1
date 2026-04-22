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
        Get-Process | Where-Object { $_.Name -like "*node*" -or $_.CommandLine -like "*server.ts*" } | Stop-Process -ErrorAction SilentlyContinue 
        
        Write-Log "Removing files..."
        $filesToRemove = "dist", "node_modules", "wilder.db", "sake.db", ".env", "package.json", "package-lock.json", "setup.ps1", "migrate.py", "server.ts", "service_log.txt", "sync_log.txt", "install_log.txt", "drizzle.config.ts", "tsconfig.json", "vite.config.ts", "index.html", "src", "drizzle"
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
        # Fetch all releases and sort by published_at DESC to find the true latest
        $releaseUrl = "https://api.github.com/repos/$repo/releases"
        $allReleases = Invoke-RestMethod -Uri $releaseUrl
        if ($allReleases.Count -eq 0) {
            Write-Error "No releases found in repository $repo."
            exit 1
        }
        $releaseInfo = $allReleases | Sort-Object published_at -Descending | Select-Object -First 1
    } else {
        # Fetch specific tag
        $releaseUrl = "https://api.github.com/repos/$repo/releases/tags/$Version"
        $releaseInfo = Invoke-RestMethod -Uri $releaseUrl
    }
    
    $asset = $releaseInfo.assets | Where-Object { $_.name -like "wilder-sync-*.zip" -or $_.name -like "koreader-sync-dashboard-*.zip" } | Select-Object -First 1
    if (-not $asset) {
        Write-Error "No ZIP asset found in release $($releaseInfo.tag_name)"
        exit 1
    }
    $assetUrl = $asset.browser_download_url
    Write-Log "**************************************************" "Magenta"
    Write-Log "   TARGET VERSION: $($releaseInfo.tag_name)" "Cyan"
    Write-Log "   RELEASE DATE  : $($releaseInfo.published_at)" "Gray"
    Write-Log "**************************************************" "Magenta"
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

Write-Log "Stopping any existing Wilder processes..." "Yellow"
# Kill processes using port 3000
try {
    $portProcess = Get-NetTCPConnection -LocalPort 3000 -ErrorAction SilentlyContinue
    if ($portProcess) {
        $pids = $portProcess.OwningProcess | Select-Object -Unique
        foreach ($p in $pids) {
            Write-Log "Closing process $p using port 3000..."
            Stop-Process -Id $p -Force -ErrorAction SilentlyContinue
        }
        Start-Sleep -Seconds 2
    }
} catch {}

# General cleanup of node processes started by us
Get-Process | Where-Object { $_.Name -like "*node*" -and ($_.CommandLine -like "*server.ts*" -or $_.Path -like "*$installDir*") } | Stop-Process -Force -ErrorAction SilentlyContinue

Write-Log "Starting Wilder Dashboard service (Production Mode)..." "Cyan"
$npmCmd = "npm"
if ($IsWindows) { $npmCmd = "npm.cmd" }

# Set environment variable at the session level to be safe
$env:NODE_ENV = "production"

# Use 'npm start' which forces production mode
$process = Start-Process -FilePath $npmCmd -ArgumentList "start" -WindowStyle Hidden -PassThru -WorkingDirectory $installDir

if ($process) {
    Write-Log "Dashboard is starting (PID: $($process.Id))." "Green"
    Write-Log "Waiting for listening state (max 60s)..." "Yellow"
    
    $retry = 0
    $found = $false
    while ($retry -lt 60 -and -not $found) {
        if (Test-Path "service_log.txt") {
            $content = Get-Content -Path "service_log.txt" -Raw
            if ($content -like "*Server successfully listening*") {
                $found = $true
            }
        }
        Start-Sleep -Seconds 1
        $retry++
    }
    
    if ($found) {
        Write-Log "Server is listening. Performing health check..." "Yellow"
        $healthOk = $false
        $hRetry = 0
        while ($hRetry -lt 10 -and -not $healthOk) {
            try {
                $response = Invoke-RestMethod -Uri "http://localhost:3000/api/health" -TimeoutSec 2
                if ($response.status -eq "ok") { $healthOk = $true }
            } catch {
                Start-Sleep -Seconds 2
            }
            $hRetry++
        }

        if ($healthOk) {
            Write-Log "--- SUCCESS: Wilder is online at http://localhost:3000 ---" "Green"
            Write-Log "Logs (Press Ctrl+C to exit manager):" "Gray"
            Get-Content -Path "service_log.txt" -Wait -Tail 20
        } else {
            Write-Log "WARNING: Server is listening but health check failed." "Yellow"
            Write-Log "Check service_log.txt for potential routing or database issues."
            Get-Content -Path "service_log.txt" -Wait -Tail 20
        }
    } else {
        Write-Log "CRITICAL: Service failed to respond within 60s." "Red"
        if (Test-Path "service_log.txt") {
            Get-Content -Path "service_log.txt" -Tail 10
        }
    }
}
