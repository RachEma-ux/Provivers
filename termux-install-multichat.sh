#!/data/data/com.termux/files/usr/bin/bash
################################################################################
# MultiChat Termux One-Command Installer
#
# Quick installation for Android/Termux
# Run: bash termux-install-multichat.sh
################################################################################

set -e

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

clear

echo -e "${BLUE}"
echo "╔═══════════════════════════════════════════════════════════╗"
echo "║       MultiChat Termux Installer for Android             ║"
echo "╚═══════════════════════════════════════════════════════════╝"
echo -e "${NC}"
echo

# Step 1: Update Termux
echo -e "${GREEN}[1/7]${NC} Updating Termux packages..."
pkg update -y
pkg upgrade -y
echo

# Step 2: Install Node.js and Git
echo -e "${GREEN}[2/7]${NC} Installing Node.js and Git..."
pkg install -y nodejs git
echo

# Verify installations
NODE_VERSION=$(node -v)
GIT_VERSION=$(git --version | cut -d' ' -f3)
echo -e "${GREEN}✓${NC} Node.js $NODE_VERSION installed"
echo -e "${GREEN}✓${NC} Git $GIT_VERSION installed"
echo

# Step 3: Clone Repository
echo -e "${GREEN}[3/7]${NC} Cloning MultiChat repository..."

if [ -d "$HOME/MultiChat" ]; then
    echo -e "${YELLOW}⚠${NC}  MultiChat directory already exists"
    read -p "Remove and clone fresh? (y/N): " -n 1 -r
    echo
    if [[ $REPLY =~ ^[Yy]$ ]]; then
        rm -rf "$HOME/MultiChat"
        git clone https://github.com/RachEma-ux/MultiChat.git "$HOME/MultiChat"
        echo -e "${GREEN}✓${NC} Repository cloned"
    else
        echo -e "${YELLOW}⚠${NC}  Using existing directory"
    fi
else
    git clone https://github.com/RachEma-ux/MultiChat.git "$HOME/MultiChat"
    echo -e "${GREEN}✓${NC} Repository cloned"
fi

cd "$HOME/MultiChat"
echo

# Step 4: Install Dependencies
echo -e "${GREEN}[4/7]${NC} Installing dependencies (this may take a few minutes)..."
npm install
echo -e "${GREEN}✓${NC} Dependencies installed"
echo

# Step 5: Create Environment File
echo -e "${GREEN}[5/7]${NC} Creating environment configuration..."

cat > .env << 'EOF'
# MultiChat Termux Configuration
PORT=3000
NODE_ENV=development
VITE_API_URL=http://localhost:3000

# Security Keys
JWT_SECRET=multichat-mobile-secret-key-$(date +%s)
SESSION_SECRET=multichat-mobile-session-secret-$(date +%s)

# Optional: Add your API keys here
# OPENAI_API_KEY=
# ANTHROPIC_API_KEY=
EOF

echo -e "${GREEN}✓${NC} Environment file created"
echo

# Step 6: Build Application
echo -e "${GREEN}[6/7]${NC} Building application..."
npm run build
echo -e "${GREEN}✓${NC} Build completed"
echo

# Step 7: Create Start Script
echo -e "${GREEN}[7/7]${NC} Creating quick start script..."

cat > "$HOME/start-multichat.sh" << 'EOF'
#!/data/data/com.termux/files/usr/bin/bash
cd ~/MultiChat
echo "Starting MultiChat..."
echo "Open http://localhost:3000 in your browser"
npm start
EOF

chmod +x "$HOME/start-multichat.sh"

echo -e "${GREEN}✓${NC} Start script created"
echo

# Installation Complete
echo
echo -e "${GREEN}"
echo "╔═══════════════════════════════════════════════════════════╗"
echo "║          🎉 Installation Complete! 🎉                     ║"
echo "╚═══════════════════════════════════════════════════════════╝"
echo -e "${NC}"
echo
echo "📱 MultiChat is installed at: $HOME/MultiChat"
echo
echo "🚀 To Start MultiChat:"
echo
echo "   Option 1 (Quick):"
echo -e "   ${BLUE}~/start-multichat.sh${NC}"
echo
echo "   Option 2 (Manual):"
echo -e "   ${BLUE}cd ~/MultiChat && npm start${NC}"
echo
echo "📱 Then open in your browser:"
echo -e "   ${BLUE}http://localhost:3000${NC}"
echo
echo "💡 Useful Commands:"
echo -e "   Start:    ${BLUE}~/start-multichat.sh${NC}"
echo -e "   Stop:     ${BLUE}Ctrl + C${NC}"
echo -e "   Update:   ${BLUE}cd ~/MultiChat && git pull${NC}"
echo
echo "📚 Full Guide: ~/MultiChat/TERMUX-INSTALL.md"
echo
echo "✨ Enjoy MultiChat on your mobile! ✨"
echo

# Ask if user wants to start now
read -p "Start MultiChat now? (y/N): " -n 1 -r
echo
if [[ $REPLY =~ ^[Yy]$ ]]; then
    echo
    echo "Starting MultiChat..."
    echo "Open http://localhost:3000 in Chrome"
    echo
    cd "$HOME/MultiChat"
    npm start
fi
