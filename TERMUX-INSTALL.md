# MultiChat Installation on Mobile (Termux)

Step-by-step guide to install MultiChat on your Android phone using Termux.

## 📱 Step-by-Step Installation

### Step 1: Open Termux

Open Termux app on your phone.

### Step 2: Update Termux Packages

Copy and paste these commands one by one:

```bash
# Update package lists
pkg update

# Upgrade installed packages (press Y when asked)
pkg upgrade
```

### Step 3: Install Required Packages

```bash
# Install Node.js and Git
pkg install nodejs git

# Verify installation
node --version
git --version
```

You should see version numbers if installed correctly.

### Step 4: Clone MultiChat Repository

```bash
# Clone the repository
git clone https://github.com/RachEma-ux/MultiChat.git

# Navigate to the directory
cd MultiChat

# Check if you're in the right directory
pwd
```

You should see: `/data/data/com.termux/files/home/MultiChat`

### Step 5: Install Dependencies

This will take a few minutes:

```bash
# Install all dependencies
npm install
```

Wait for it to complete. You'll see a progress bar.

### Step 6: Create Environment File

```bash
# Create .env file
cat > .env << 'EOF'
PORT=3000
NODE_ENV=development
VITE_API_URL=http://localhost:3000
JWT_SECRET=multichat-secret-key-12345
SESSION_SECRET=multichat-session-secret-67890
EOF

# Verify the file was created
cat .env
```

### Step 7: Build the Application

```bash
# Build client and server
npm run build
```

This may take a few minutes. Wait for "Build completed" message.

### Step 8: Start the Application

```bash
# Start the server
npm run start
```

You should see:
```
Server running on port 3000
✓ MultiChat is ready!
```

### Step 9: Access MultiChat

1. **Keep Termux running**
2. **Open Chrome browser** on your phone
3. **Go to:** `http://localhost:3000`
4. **You should see MultiChat!** 🎉

---

## 🔄 Daily Usage Commands

### To Start MultiChat:

```bash
# Navigate to directory
cd ~/MultiChat

# Start the app
npm run start
```

### To Stop MultiChat:

Press `Ctrl + C` in Termux

### To Run in Background:

```bash
# Install tmux
pkg install tmux

# Start tmux session
tmux new -s multichat

# Start MultiChat
cd ~/MultiChat && npm start

# Detach from session (keep it running)
# Press: Ctrl+B, then press D

# To reattach later
tmux attach -s multichat
```

---

## 🚀 Auto-Start Script

Create a script to start MultiChat easily:

```bash
# Create start script
cat > ~/start-multichat.sh << 'EOF'
#!/data/data/com.termux/files/usr/bin/bash
cd ~/MultiChat
npm start
EOF

# Make it executable
chmod +x ~/start-multichat.sh

# Now you can start with:
~/start-multichat.sh
```

---

## 📱 Add Home Screen Shortcut

### Option 1: Browser Bookmark

1. Open `http://localhost:3000` in Chrome
2. Tap the menu (⋮)
3. Tap "Add to Home screen"
4. Name it "MultiChat"
5. Tap "Add"

### Option 2: Termux Widget

1. Install Termux:Widget from F-Droid
2. Create shortcut script:

```bash
# Create shortcuts directory
mkdir -p ~/.shortcuts

# Create start script
cat > ~/.shortcuts/MultiChat << 'EOF'
#!/data/data/com.termux/files/usr/bin/bash
cd ~/MultiChat
npm start
EOF

# Make executable
chmod +x ~/.shortcuts/MultiChat
```

3. Add widget to home screen
4. Tap "MultiChat" to start

---

## 🔧 Troubleshooting

### Port Already in Use

```bash
# Kill process on port 3000
pkill -f "node.*3000"

# Or find and kill manually
lsof -i :3000
kill -9 <PID>
```

### npm install fails

```bash
# Clear cache
npm cache clean --force

# Try again
npm install
```

### Can't access http://localhost:3000

```bash
# Check if server is running
ps aux | grep node

# Check if port is listening
netstat -tulpn | grep 3000

# Restart the server
cd ~/MultiChat
npm start
```

### Out of storage

```bash
# Clear npm cache
npm cache clean --force

# Clear Termux cache
apt clean

# Check available space
df -h
```

### App crashes on start

```bash
# Check logs
cd ~/MultiChat
npm start 2>&1 | tee error.log

# View the log
cat error.log
```

---

## 💡 Useful Tips

### Keep Screen On

1. Go to Settings → Developer Options
2. Enable "Stay awake"

### Prevent Termux from Sleeping

1. Open Termux
2. Tap and hold the Termux notification
3. Select "Importance: High"
4. Enable "Override Do Not Disturb"

### Save Battery

Use tmux to run in background:

```bash
# Start in tmux
tmux new -s multichat
cd ~/MultiChat
npm start

# Detach: Ctrl+B, then D
# Termux can now be closed
```

### Update MultiChat

```bash
# Stop the app (Ctrl+C)
cd ~/MultiChat

# Pull latest changes
git pull

# Reinstall dependencies
npm install

# Rebuild
npm run build

# Start again
npm start
```

---

## 📊 Common Commands Reference

| Action | Command |
|--------|---------|
| Go to MultiChat folder | `cd ~/MultiChat` |
| Start app | `npm start` |
| Stop app | `Ctrl + C` |
| Update code | `git pull` |
| Reinstall packages | `npm install` |
| Rebuild | `npm run build` |
| View logs | `npm start 2>&1 \| tee log.txt` |
| Clear cache | `npm cache clean --force` |

---

## 🎯 Quick Start (After First Install)

Every time you want to use MultiChat:

1. **Open Termux**
2. **Run:**
   ```bash
   cd ~/MultiChat && npm start
   ```
3. **Open Chrome** and go to `http://localhost:3000`

That's it! ✨

---

## 🔄 Full Reinstall (If Needed)

```bash
# Remove old installation
cd ~
rm -rf MultiChat

# Clone fresh
git clone https://github.com/RachEma-ux/MultiChat.git
cd MultiChat

# Install and build
npm install
npm run build

# Start
npm start
```

---

## 📞 Need Help?

If you encounter issues:

1. Check error messages carefully
2. Make sure all commands completed successfully
3. Verify you're in the right directory: `pwd`
4. Check if Node.js is installed: `node --version`

---

**Enjoy MultiChat on your mobile! 📱💬**
