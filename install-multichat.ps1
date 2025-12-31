################################################################################
# MultiChat One-Tap Installer (Windows PowerShell)
#
# This script automatically sets up the MultiChat application on Windows
# - Checks prerequisites
# - Clones repository
# - Installs dependencies
# - Sets up database
# - Configures environment
# - Runs initial setup
################################################################################

# Configuration
$RepoUrl = "https://github.com/RachEma-ux/MultiChat.git"
$AppDir = "MultiChat"
$NodeMinVersion = "18.0.0"

################################################################################
# Helper Functions
################################################################################

function Print-Header {
    Write-Host ""
    Write-Host "╔═══════════════════════════════════════════════════════════╗" -ForegroundColor Cyan
    Write-Host "║          MultiChat One-Tap Installer v1.0                ║" -ForegroundColor Cyan
    Write-Host "╚═══════════════════════════════════════════════════════════╝" -ForegroundColor Cyan
    Write-Host ""
}

function Print-Step {
    param([string]$Message)
    Write-Host "➜ $Message" -ForegroundColor Green
}

function Print-Warning {
    param([string]$Message)
    Write-Host "⚠  $Message" -ForegroundColor Yellow
}

function Print-Error {
    param([string]$Message)
    Write-Host "✗ $Message" -ForegroundColor Red
}

function Print-Success {
    param([string]$Message)
    Write-Host "✓ $Message" -ForegroundColor Green
}

################################################################################
# Prerequisite Checks
################################################################################

function Test-Command {
    param([string]$Command)

    $exists = $null -ne (Get-Command $Command -ErrorAction SilentlyContinue)

    if ($exists) {
        Print-Success "$Command is installed"
        return $true
    } else {
        Print-Error "$Command is not installed"
        return $false
    }
}

function Test-NodeVersion {
    if (Get-Command node -ErrorAction SilentlyContinue) {
        $nodeVersion = (node -v).Substring(1)
        Print-Success "Node.js version: $nodeVersion"

        $major = [int]($nodeVersion.Split('.')[0])
        if ($major -ge 18) {
            return $true
        } else {
            Print-Warning "Node.js version should be >= 18.0.0"
            return $false
        }
    } else {
        Print-Error "Node.js is not installed"
        return $false
    }
}

function Test-Prerequisites {
    Print-Step "Checking prerequisites..."
    Write-Host ""

    $allOk = $true

    # Check Node.js
    if (-not (Test-NodeVersion)) {
        $allOk = $false
    }

    # Check npm
    if (-not (Test-Command "npm")) {
        $allOk = $false
    }

    # Check git
    if (-not (Test-Command "git")) {
        $allOk = $false
    }

    Write-Host ""

    if (-not $allOk) {
        Print-Error "Some prerequisites are missing. Please install them first."
        Write-Host ""
        Write-Host "Required:"
        Write-Host "  - Node.js >= 18.0.0: https://nodejs.org/"
        Write-Host "  - npm: (comes with Node.js)"
        Write-Host "  - git: https://git-scm.com/"
        exit 1
    }

    Print-Success "All prerequisites satisfied!"
    Write-Host ""
}

################################################################################
# Installation Steps
################################################################################

function Clone-Repository {
    Print-Step "Cloning MultiChat repository..."

    if (Test-Path $AppDir) {
        Print-Warning "Directory $AppDir already exists"
        $response = Read-Host "Do you want to remove it and clone fresh? (y/N)"

        if ($response -eq 'y' -or $response -eq 'Y') {
            Remove-Item -Recurse -Force $AppDir
            git clone $RepoUrl $AppDir
            Print-Success "Repository cloned successfully"
        } else {
            Print-Warning "Using existing directory"
        }
    } else {
        git clone $RepoUrl $AppDir
        Print-Success "Repository cloned successfully"
    }

    Set-Location $AppDir
    Write-Host ""
}

function Install-Dependencies {
    Print-Step "Installing dependencies..."

    # Detect package manager
    $pkgManager = "npm"
    if (Test-Path "yarn.lock") {
        $pkgManager = "yarn"
    } elseif (Test-Path "pnpm-lock.yaml") {
        $pkgManager = "pnpm"
    }

    Print-Step "Using package manager: $pkgManager"

    switch ($pkgManager) {
        "yarn" {
            if (-not (Get-Command yarn -ErrorAction SilentlyContinue)) {
                Print-Warning "yarn not found, installing..."
                npm install -g yarn
            }
            yarn install
        }
        "pnpm" {
            if (-not (Get-Command pnpm -ErrorAction SilentlyContinue)) {
                Print-Warning "pnpm not found, installing..."
                npm install -g pnpm
            }
            pnpm install
        }
        default {
            npm install
        }
    }

    Print-Success "Dependencies installed successfully"
    Write-Host ""

    return $pkgManager
}

function Setup-Environment {
    Print-Step "Setting up environment configuration..."

    if (Test-Path ".env.example") {
        if (-not (Test-Path ".env")) {
            Copy-Item ".env.example" ".env"
            Print-Success "Created .env file from .env.example"
            Print-Warning "Please edit .env file with your configuration"
        } else {
            Print-Warning ".env file already exists, skipping..."
        }
    } else {
        # Create a basic .env file
        $envContent = @"
# MultiChat Environment Configuration

# Database
DATABASE_URL="postgresql://localhost:5432/multichat"

# Server
PORT=3000
NODE_ENV=development

# Client
VITE_API_URL=http://localhost:3000

# Security
JWT_SECRET=change-this-to-a-random-secret-key
SESSION_SECRET=change-this-to-a-random-secret-key

# Optional: External Services
# OPENAI_API_KEY=
# ANTHROPIC_API_KEY=
"@
        $envContent | Out-File -FilePath ".env" -Encoding UTF8
        Print-Success "Created default .env file"
        Print-Warning "Please edit .env file with your configuration"
    }

    Write-Host ""
}

function Setup-Database {
    param([string]$PkgManager)

    Print-Step "Setting up database..."

    if ((Test-Path "drizzle") -or (Test-Path "drizzle.config.ts")) {
        Print-Step "Found Drizzle ORM configuration"

        $response = Read-Host "Do you want to run database migrations? (y/N)"

        if ($response -eq 'y' -or $response -eq 'Y') {
            switch ($PkgManager) {
                "yarn" {
                    & yarn db:push
                    if ($LASTEXITCODE -ne 0) {
                        & yarn drizzle-kit push
                    }
                }
                "pnpm" {
                    & pnpm db:push
                    if ($LASTEXITCODE -ne 0) {
                        & pnpm drizzle-kit push
                    }
                }
                default {
                    & npm run db:push
                    if ($LASTEXITCODE -ne 0) {
                        & npm run drizzle-kit push
                    }
                }
            }
            Print-Success "Database migrations completed"
        } else {
            Print-Warning "Skipping database migrations"
            Print-Warning "You can run them later with: $PkgManager run db:push"
        }
    } else {
        Print-Warning "No database configuration found, skipping..."
    }

    Write-Host ""
}

function Build-Application {
    param([string]$PkgManager)

    Print-Step "Building application..."

    $response = Read-Host "Do you want to build the application now? (y/N)"

    if ($response -eq 'y' -or $response -eq 'Y') {
        switch ($PkgManager) {
            "yarn" { & yarn build }
            "pnpm" { & pnpm build }
            default { & npm run build }
        }
        Print-Success "Application built successfully"
    } else {
        Print-Warning "Skipping build step"
        Print-Warning "You can build later with: $PkgManager run build"
    }

    Write-Host ""
}

function Print-CompletionMessage {
    param([string]$PkgManager)

    Write-Host ""
    Write-Host "╔═══════════════════════════════════════════════════════════╗" -ForegroundColor Green
    Write-Host "║          🎉 Installation Complete! 🎉                     ║" -ForegroundColor Green
    Write-Host "╚═══════════════════════════════════════════════════════════╝" -ForegroundColor Green
    Write-Host ""
    Write-Host "📁 MultiChat is installed in: $(Get-Location)"
    Write-Host ""
    Write-Host "📝 Next Steps:"
    Write-Host ""
    Write-Host "1. Configure your environment:"
    Write-Host "   cd $AppDir" -ForegroundColor Cyan
    Write-Host "   notepad .env" -ForegroundColor Cyan
    Write-Host ""
    Write-Host "2. Set up your database (if not done already):"
    Write-Host "   $PkgManager run db:push" -ForegroundColor Cyan
    Write-Host ""
    Write-Host "3. Start the development server:"
    Write-Host "   $PkgManager run dev" -ForegroundColor Cyan
    Write-Host ""
    Write-Host "4. Or start both client and server:"
    Write-Host "   $PkgManager run dev:client  # In one terminal" -ForegroundColor Cyan
    Write-Host "   $PkgManager run dev:server  # In another terminal" -ForegroundColor Cyan
    Write-Host ""
    Write-Host "📚 Documentation:"
    Write-Host "   - Repository: $RepoUrl"
    Write-Host "   - Issues: https://github.com/RachEma-ux/MultiChat/issues"
    Write-Host ""
    Write-Host "💡 Tips:"
    Write-Host "   - Check package.json for all available scripts"
    Write-Host "   - Review the .env file for configuration options"
    Write-Host "   - Run tests with: $PkgManager test"
    Write-Host ""
    Print-Success "Happy coding! 🚀"
    Write-Host ""
}

################################################################################
# Main Installation Flow
################################################################################

function Main {
    Print-Header

    # Check prerequisites
    Test-Prerequisites

    # Clone repository
    Clone-Repository

    # Install dependencies
    $pkgManager = Install-Dependencies

    # Setup environment
    Setup-Environment

    # Setup database
    Setup-Database -PkgManager $pkgManager

    # Build application (optional)
    Build-Application -PkgManager $pkgManager

    # Print completion message
    Print-CompletionMessage -PkgManager $pkgManager
}

# Run main installation
try {
    Main
} catch {
    Print-Error "Installation failed! Error: $_"
    exit 1
}

exit 0
