# 📚 Wilder Sync Dashboard
*(Forked from [Sudashiii/Sake](https://github.com/Sudashiii/Sake))*

**Wilder Sync** is a premium, **Docker-free** self-hosted ecosystem for your ebook library and reading progress. It transforms your Windows Server into a centralized hub for all your reading devices, specifically optimized for **Native Windows Server 2025** execution without Docker, WSL, or Containers.

## 🏛️ 100% Native Windows Solution
This project is built from the ground up to run directly on Windows:
*   **No Docker Required**: Skip the storage/networking overhead of containers.
*   **Native SQLite**: Zero-config, high-performance local database.
*   **PowerShell Managed**: Every aspect of the lifecycle—install, backup, upgrade, and service management—is handled by native PowerShell scripts.
*   **Portable Service**: All data, logs, and binaries stay inside the directory you choose.

## 📖 Key Functionality

### 🏛️ Centralized Ebook Library
*   **Visual Management**: browse your collection with a responsive, high-performance web dashboard.
*   **Reading Pipeline**: Manage books through different states: *Library*, *Currently Reading*, *Queue*, *Archived*, and *Trash*.
*   **Advanced search**: Instantly find any book across your entire database.

### 🔄 KOReader Synchronization
*   **Zero-Config Sync**: Seamlessly sync reading positions, highlights, and document status between multiple KOReader devices.
*   **Standard Protocol**: Implements the official KOReader Sync v1 protocol for maximum compatibility.
*   **Auth Privacy**: Secure tokens for private synchronization without third-party cloud dependency.

## 🚀 One-Line Installation

**IMPORTANT**: Open PowerShell and `cd` into the folder where you want the installation files to be placed (e.g. `C:\Wilder`). **The manager will install all files into the current working directory.**

```powershell
# Standard Install / Upgrade (Latest Release)
iwr -useb https://raw.githubusercontent.com/FoxWilder/KOReader-Sync-Dashboard/main/install.ps1 | iex
```

### 💎 Switching Between Versions

You can easily roll forward or backward by specifying the version tag (e.g., `v1.0.1`) or a rolling commit hash (e.g., `rolling-20260422-b1d75cf`):

```powershell
# Install a specific tagged version
$v = "v1.0.0"; iwr -useb https://raw.githubusercontent.com/FoxWilder/KOReader-Sync-Dashboard/main/install.ps1 | iex -Arguments "-Version $v"

# Install a specific rolling release (from CI/CD)
$v = "rolling-20260422-b1d75cf"; iwr -useb https://raw.githubusercontent.com/FoxWilder/KOReader-Sync-Dashboard/main/install.ps1 | iex -Arguments "-Version $v"
```

## ✨ Tech Stack (Non-Docker)
*   **Backend**: Node.js (Express) with `better-sqlite3`.
*   **Database**: SQLite (`wilder.db`) replaces PostgreSQL.
*   **Storage**: Standard local filesystem replaces S3/MinIO.
*   **Dev Ops**: Native PowerShell automation for Lifecycle Management.

## 🛠️ Manual Instructions

If you prefer manual setup, follow these steps:

1. **Clone the repo**:
   ```bash
   git clone https://github.com/FoxWilder/KOReader-Sync-Dashboard.git
   cd KOReader-Sync-Dashboard
   ```
2. **Run Setup**:
   ```powershell
   ./setup.ps1
   ```
3. **Start the App**:
   ```bash
   npm run dev
   ```

## 📊 Logging & Troubleshooting

All activities are logged to the local directory for easy auditing and troubleshooting:

- **`install_log.txt`**: Verbose output from the PowerShell installer/manager.
- **`service_log.txt`**: General web server requests, authorization events, and library access logs.
- **`sync_log.txt`**: Detailed logs of every KOReader progress sync event (handshakes, pushes, and pulls).

## 🤖 Automation

This project uses **GitHub Actions** to automate its lifecycle:
- **Build & Package**: On every push to `main`, the app is built and packaged.
- **GitHub Pages**: The project info page is hosted at [foxwilder.github.io/KOReader-Sync-Dashboard](https://foxwilder.github.io/KOReader-Sync-Dashboard).
- **Auto-Releases**: Tagged versions (e.g., `v1.0.0`) automatically create a GitHub Release with assets.

## 📄 License
This project inherits the license of the original [Sake](https://github.com/Sudashiii/Sake) project.
