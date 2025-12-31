#!/bin/bash

################################################################################
# MultiChat One-Tap Installer
#
# This script automatically sets up the MultiChat application
# - Checks prerequisites
# - Clones repository
# - Installs dependencies
# - Sets up database
# - Configures environment
# - Runs initial setup
################################################################################

set -e  # Exit on error

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configuration
REPO_URL="https://github.com/RachEma-ux/MultiChat.git"
APP_DIR="MultiChat"
NODE_MIN_VERSION="18.0.0"

################################################################################
# Helper Functions
################################################################################

print_header() {
    echo -e "${BLUE}"
    echo "╔═══════════════════════════════════════════════════════════╗"
    echo "║          MultiChat One-Tap Installer v1.0                ║"
    echo "╚═══════════════════════════════════════════════════════════╝"
    echo -e "${NC}"
}

print_step() {
    echo -e "${GREEN}➜${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}⚠${NC}  $1"
}

print_error() {
    echo -e "${RED}✗${NC} $1"
}

print_success() {
    echo -e "${GREEN}✓${NC} $1"
}

################################################################################
# Prerequisite Checks
################################################################################

check_command() {
    if command -v "$1" &> /dev/null; then
        print_success "$1 is installed"
        return 0
    else
        print_error "$1 is not installed"
        return 1
    fi
}

check_node_version() {
    if command -v node &> /dev/null; then
        NODE_VERSION=$(node -v | cut -d'v' -f2)
        print_success "Node.js version: $NODE_VERSION"

        # Simple version check (you might want to make this more robust)
        MAJOR_VERSION=$(echo "$NODE_VERSION" | cut -d'.' -f1)
        if [ "$MAJOR_VERSION" -ge 18 ]; then
            return 0
        else
            print_warning "Node.js version should be >= 18.0.0"
            return 1
        fi
    else
        print_error "Node.js is not installed"
        return 1
    fi
}

check_prerequisites() {
    print_step "Checking prerequisites..."
    echo

    local all_ok=true

    # Check Node.js
    if ! check_node_version; then
        all_ok=false
    fi

    # Check npm or yarn
    if check_command "npm" || check_command "yarn"; then
        : # Success
    else
        all_ok=false
    fi

    # Check git
    if ! check_command "git"; then
        all_ok=false
    fi

    echo

    if [ "$all_ok" = false ]; then
        print_error "Some prerequisites are missing. Please install them first."
        echo
        echo "Required:"
        echo "  - Node.js >= 18.0.0: https://nodejs.org/"
        echo "  - npm or yarn: (comes with Node.js)"
        echo "  - git: https://git-scm.com/"
        exit 1
    fi

    print_success "All prerequisites satisfied!"
    echo
}

################################################################################
# Installation Steps
################################################################################

clone_repository() {
    print_step "Cloning MultiChat repository..."

    if [ -d "$APP_DIR" ]; then
        print_warning "Directory $APP_DIR already exists"
        read -p "Do you want to remove it and clone fresh? (y/N): " -n 1 -r
        echo
        if [[ $REPLY =~ ^[Yy]$ ]]; then
            rm -rf "$APP_DIR"
            git clone "$REPO_URL" "$APP_DIR"
            print_success "Repository cloned successfully"
        else
            print_warning "Using existing directory"
        fi
    else
        git clone "$REPO_URL" "$APP_DIR"
        print_success "Repository cloned successfully"
    fi

    cd "$APP_DIR"
    echo
}

install_dependencies() {
    print_step "Installing dependencies..."

    # Detect package manager
    if [ -f "yarn.lock" ]; then
        PKG_MANAGER="yarn"
    elif [ -f "pnpm-lock.yaml" ]; then
        PKG_MANAGER="pnpm"
    else
        PKG_MANAGER="npm"
    fi

    print_step "Using package manager: $PKG_MANAGER"

    case $PKG_MANAGER in
        yarn)
            if ! command -v yarn &> /dev/null; then
                print_warning "yarn not found, installing..."
                npm install -g yarn
            fi
            yarn install
            ;;
        pnpm)
            if ! command -v pnpm &> /dev/null; then
                print_warning "pnpm not found, installing..."
                npm install -g pnpm
            fi
            pnpm install
            ;;
        *)
            npm install
            ;;
    esac

    print_success "Dependencies installed successfully"
    echo
}

setup_environment() {
    print_step "Setting up environment configuration..."

    # Check if .env.example exists
    if [ -f ".env.example" ]; then
        if [ ! -f ".env" ]; then
            cp .env.example .env
            print_success "Created .env file from .env.example"
            print_warning "Please edit .env file with your configuration"
        else
            print_warning ".env file already exists, skipping..."
        fi
    else
        # Create a basic .env file
        cat > .env << 'EOF'
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
EOF
        print_success "Created default .env file"
        print_warning "Please edit .env file with your configuration"
    fi

    echo
}

setup_database() {
    print_step "Setting up database..."

    # Check if drizzle is configured
    if [ -d "drizzle" ] || [ -f "drizzle.config.ts" ]; then
        print_step "Found Drizzle ORM configuration"

        # Ask user if they want to run migrations
        read -p "Do you want to run database migrations? (y/N): " -n 1 -r
        echo
        if [[ $REPLY =~ ^[Yy]$ ]]; then
            if command -v $PKG_MANAGER &> /dev/null; then
                case $PKG_MANAGER in
                    yarn)
                        yarn db:push || yarn drizzle-kit push || print_warning "Migration command not found"
                        ;;
                    pnpm)
                        pnpm db:push || pnpm drizzle-kit push || print_warning "Migration command not found"
                        ;;
                    *)
                        npm run db:push || npm run drizzle-kit push || print_warning "Migration command not found"
                        ;;
                esac
                print_success "Database migrations completed"
            fi
        else
            print_warning "Skipping database migrations"
            print_warning "You can run them later with: $PKG_MANAGER run db:push"
        fi
    else
        print_warning "No database configuration found, skipping..."
    fi

    echo
}

build_application() {
    print_step "Building application..."

    read -p "Do you want to build the application now? (y/N): " -n 1 -r
    echo
    if [[ $REPLY =~ ^[Yy]$ ]]; then
        case $PKG_MANAGER in
            yarn)
                yarn build
                ;;
            pnpm)
                pnpm build
                ;;
            *)
                npm run build
                ;;
        esac
        print_success "Application built successfully"
    else
        print_warning "Skipping build step"
        print_warning "You can build later with: $PKG_MANAGER run build"
    fi

    echo
}

print_completion_message() {
    echo
    echo -e "${GREEN}"
    echo "╔═══════════════════════════════════════════════════════════╗"
    echo "║          🎉 Installation Complete! 🎉                     ║"
    echo "╚═══════════════════════════════════════════════════════════╝"
    echo -e "${NC}"
    echo
    echo "📁 MultiChat is installed in: $(pwd)"
    echo
    echo "📝 Next Steps:"
    echo
    echo "1. Configure your environment:"
    echo -e "   ${BLUE}cd $APP_DIR${NC}"
    echo -e "   ${BLUE}nano .env${NC} (or use your favorite editor)"
    echo
    echo "2. Set up your database (if not done already):"
    echo -e "   ${BLUE}$PKG_MANAGER run db:push${NC}"
    echo
    echo "3. Start the development server:"
    echo -e "   ${BLUE}$PKG_MANAGER run dev${NC}"
    echo
    echo "4. Or start both client and server:"
    echo -e "   ${BLUE}$PKG_MANAGER run dev:client${NC}  # In one terminal"
    echo -e "   ${BLUE}$PKG_MANAGER run dev:server${NC}  # In another terminal"
    echo
    echo "📚 Documentation:"
    echo "   - Repository: $REPO_URL"
    echo "   - Issues: https://github.com/RachEma-ux/MultiChat/issues"
    echo
    echo "💡 Tips:"
    echo "   - Check package.json for all available scripts"
    echo "   - Review the .env file for configuration options"
    echo "   - Run tests with: $PKG_MANAGER test"
    echo
    print_success "Happy coding! 🚀"
    echo
}

################################################################################
# Main Installation Flow
################################################################################

main() {
    print_header

    # Check prerequisites
    check_prerequisites

    # Clone repository
    clone_repository

    # Install dependencies
    install_dependencies

    # Setup environment
    setup_environment

    # Setup database
    setup_database

    # Build application (optional)
    build_application

    # Print completion message
    print_completion_message
}

# Error handler
trap 'print_error "Installation failed! Check the error messages above."; exit 1' ERR

# Run main installation
main

exit 0
