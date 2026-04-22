# 📚 KOReader Sync Dashboard

A polished, **Docker-free** fork of [Sudashiii/Sake](https://github.com/Sudashiii/Sake) optimized for Windows Server 2025. This project provides a clean web library, KOReader progress syncing, and book provider imports without the complexity of Docker.

## 🚀 One-Line Installation / Upgrade / Uninstall

Run the following command in PowerShell in the folder where you want to manage the dashboard:

```powershell
# Standard Install / Upgrade (Latest Release)
iwr -useb https://raw.githubusercontent.com/FoxWilder/KOReader-Sync-Dashboard/main/install.ps1 | iex

# Install Significant Version (Rollback/Forward)
$v = "v1.0.0"; iwr -useb https://raw.githubusercontent.com/FoxWilder/KOReader-Sync-Dashboard/main/install.ps1 | iex -Arguments "-Version $v"

# Uninstall and Cleanup (Deletes files and database)
iwr -useb https://raw.githubusercontent.com/FoxWilder/KOReader-Sync-Dashboard/main/install.ps1 | iex -Arguments "-Uninstall"
```

*The setup automatically handles data migration and backups during upgrades, and allows complete cleanup via the `-Uninstall` flag.*

## ✨ Features

- **Docker-Free**: Runs natively using Node.js and Python.
- **SQLite Database**: Replaces PostgreSQL for zero-config local storage.
- **Local Storage**: Replaces MinIO/S3 with standard filesystem storage.
- **Automated Workflow**: 
  - **Releases**: Every tag upload triggers a new GitHub Release with a bundled ZIP.
  - **Preview**: A web landing page is automatically deployed to GitHub Pages.
- **Windows Server Optimized**: Tailored for the Windows Server 2025 environment.

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

## 🤖 Automation

This project uses **GitHub Actions** to automate its lifecycle:
- **Build & Package**: On every push to `main`, the app is built and packaged.
- **GitHub Pages**: The project info page is hosted at [foxwilder.github.io/KOReader-Sync-Dashboard](https://foxwilder.github.io/KOReader-Sync-Dashboard).
- **Auto-Releases**: Tagged versions (e.g., `v1.0.0`) automatically create a GitHub Release with assets.

## 📄 License
This project inherits the license of the original [Sake](https://github.com/Sudashiii/Sake) project.
