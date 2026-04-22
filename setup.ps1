# Wilder Non-Docker Setup Script
# This script sets up the Wilder reading stack (forked from Sake) without Docker.

$repo = "FoxWilder/KOReader-Sync-Dashboard"
$installDir = Get-Location
$logFile = "$installDir\install_log.txt"

# --- LOGGING WRAPPER ---
function Write-Log([string]$message, [string]$color = "White") {
    $timestamp = Get-Date -Format "yyyy-MM-dd HH:mm:ss"
    $fullMessage = "[$timestamp] [SETUP] $message"
    if ($Host.Name -ne 'ConsoleHost') {
        Write-Host $message -ForegroundColor $color
    }
    $fullMessage | Out-File -FilePath $logFile -Append
}

Write-Host "--- Wilder Setup Starting ---" -ForegroundColor Cyan
Write-Log "Setup started"

# 1. Prerequisite Checks
Write-Host "Checking prerequisites..."
$node = Get-Command node -ErrorAction SilentlyContinue
$npm = Get-Command npm -ErrorAction SilentlyContinue
$python = Get-Command python -ErrorAction SilentlyContinue

if (-not $node) { Write-Error "Node.js not found. Please install it."; exit 1 }
if (-not $npm) { Write-Error "NPM not found."; exit 1 }
if (-not $python) { Write-Host "Python not found. Trying 'python3'..."; $python = Get-Command python3 -ErrorAction SilentlyContinue }
if (-not $python) { Write-Error "Python not found. Please install Python 3."; exit 1 }

Write-Host "Found Node $($node.Version) and Python."

# 2. Migration and Environment Check
Write-Host "Running environment check and migration logic..."
python check_environment.py
if ($LASTEXITCODE -ne 0) { Write-Error "Environment check failed."; exit 1 }

python migrate.py
if ($LASTEXITCODE -ne 0) { Write-Error "Migration failed."; exit 1 }

# 3. Install Dependencies
Write-Host "Installing Node.js dependencies..."
npm install
if ($LASTEXITCODE -ne 0) { Write-Error "NPM install failed."; exit 1 }

# 4. Database Setup (Drizzle)
Write-Host "Initializing database..."
# Corrected: Do not pass -ErrorAction SilentlyContinue to npm, as it is an external command
npm run db:push
if ($LASTEXITCODE -ne 0) { 
    Write-Host "Note: Database push failed. Ensure 'wilder.db' is accessible." -ForegroundColor Yellow
}

# 5. Done
Write-Host "--- Setup Complete ---" -ForegroundColor Green
Write-Host "To start the application, run: npm run dev"
Write-Host "Your library will be available at http://localhost:3000 (default)"
