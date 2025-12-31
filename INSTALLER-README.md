# MultiChat One-Tap Installer

Quick and easy installation scripts for the MultiChat application.

## 🚀 Quick Start

### Linux / macOS

```bash
# Download and run the installer
curl -O https://raw.githubusercontent.com/RachEma-ux/MultiChat/main/install-multichat.sh
chmod +x install-multichat.sh
./install-multichat.sh
```

Or if you have the file locally:

```bash
./install-multichat.sh
```

### Windows (PowerShell)

```powershell
# Run PowerShell as Administrator
# Then execute:
.\install-multichat.ps1
```

**Note:** You may need to enable script execution:
```powershell
Set-ExecutionPolicy -ExecutionPolicy RemoteSigned -Scope CurrentUser
```

## 📋 What the Installer Does

The one-tap installer automates the entire setup process:

### 1. Prerequisites Check ✓
- ✅ Node.js >= 18.0.0
- ✅ npm/yarn/pnpm
- ✅ Git

### 2. Repository Setup ✓
- Clones the MultiChat repository
- Or uses existing directory if present

### 3. Dependencies Installation ✓
- Auto-detects package manager (npm/yarn/pnpm)
- Installs all project dependencies
- Installs dev dependencies

### 4. Environment Configuration ✓
- Creates `.env` file from template
- Sets up default configuration
- Prompts for customization

### 5. Database Setup ✓
- Detects Drizzle ORM configuration
- Runs database migrations
- Sets up initial schema

### 6. Build (Optional) ✓
- Compiles TypeScript
- Builds client and server
- Optimizes for development

## 🎯 Installation Options

The installer is interactive and will prompt you for:

1. **Clone fresh or use existing?** - If MultiChat directory exists
2. **Run database migrations?** - Set up database schema
3. **Build application?** - Compile the code

You can choose yes/no for each step.

## 📦 What Gets Installed

```
MultiChat/
├── client/          # Frontend application
├── server/          # Backend services
├── shared/          # Shared utilities
├── drizzle/         # Database migrations
├── e2e/             # End-to-end tests
├── node_modules/    # Dependencies (installed)
├── .env             # Environment config (created)
└── package.json     # Project manifest
```

## 🔧 Manual Installation

If you prefer to install manually:

```bash
# 1. Clone repository
git clone https://github.com/RachEma-ux/MultiChat.git
cd MultiChat

# 2. Install dependencies
npm install
# or
yarn install
# or
pnpm install

# 3. Set up environment
cp .env.example .env
# Edit .env with your configuration

# 4. Run database migrations
npm run db:push

# 5. Build application
npm run build

# 6. Start development server
npm run dev
```

## 🌟 After Installation

Once installation is complete, you can:

### Start Development Server

```bash
cd MultiChat
npm run dev
```

### Or start client and server separately:

```bash
# Terminal 1 - Client
npm run dev:client

# Terminal 2 - Server
npm run dev:server
```

### Run Tests

```bash
npm test
```

### Build for Production

```bash
npm run build
```

## ⚙️ Configuration

Edit the `.env` file to configure:

### Database
```env
DATABASE_URL="postgresql://localhost:5432/multichat"
```

### Server
```env
PORT=3000
NODE_ENV=development
```

### Client
```env
VITE_API_URL=http://localhost:3000
```

### Security
```env
JWT_SECRET=your-secret-key-here
SESSION_SECRET=your-session-secret-here
```

### Optional Services
```env
OPENAI_API_KEY=your-openai-key
ANTHROPIC_API_KEY=your-anthropic-key
```

## 🐛 Troubleshooting

### Prerequisites Missing

**Error:** `Node.js is not installed`

**Solution:** Install Node.js from https://nodejs.org/

---

**Error:** `git is not installed`

**Solution:** Install Git from https://git-scm.com/

### Permission Denied (Linux/macOS)

**Error:** `Permission denied: ./install-multichat.sh`

**Solution:**
```bash
chmod +x install-multichat.sh
./install-multichat.sh
```

### Script Execution Disabled (Windows)

**Error:** `install-multichat.ps1 cannot be loaded`

**Solution:**
```powershell
Set-ExecutionPolicy -ExecutionPolicy RemoteSigned -Scope CurrentUser
```

### Database Connection Failed

**Error:** `Database connection failed`

**Solution:**
1. Make sure PostgreSQL is running
2. Check `DATABASE_URL` in `.env`
3. Create database: `createdb multichat`

### Port Already in Use

**Error:** `Port 3000 is already in use`

**Solution:**
1. Change `PORT` in `.env` to a different port
2. Or kill the process using port 3000:
   ```bash
   # Linux/macOS
   lsof -ti:3000 | xargs kill

   # Windows
   netstat -ano | findstr :3000
   taskkill /PID <PID> /F
   ```

## 📚 Available Scripts

After installation, you can run:

| Script | Description |
|--------|-------------|
| `npm run dev` | Start development server |
| `npm run dev:client` | Start client only |
| `npm run dev:server` | Start server only |
| `npm run build` | Build for production |
| `npm run test` | Run tests |
| `npm run test:e2e` | Run E2E tests |
| `npm run lint` | Lint code |
| `npm run format` | Format code |
| `npm run db:push` | Push database schema |
| `npm run db:studio` | Open database studio |

## 🆘 Getting Help

If you encounter issues:

1. **Check Prerequisites:** Make sure Node.js >= 18, npm, and git are installed
2. **Check Logs:** Look for error messages in the installer output
3. **Manual Installation:** Try the manual steps if installer fails
4. **Open Issue:** https://github.com/RachEma-ux/MultiChat/issues

## 📝 License

This installer script is provided as-is for setting up MultiChat.

---

**Happy Coding! 🚀**
