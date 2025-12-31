# 📱 MultiChat - Termux Quick Start

## One-Command Installation

Open **Termux** on your phone and run:

```bash
curl -O https://raw.githubusercontent.com/RachEma-ux/Provivers/main/termux-install-multichat.sh && bash termux-install-multichat.sh
```

**That's it!** The script will automatically:
- ✅ Update Termux
- ✅ Install Node.js and Git
- ✅ Clone MultiChat
- ✅ Install dependencies
- ✅ Build the app
- ✅ Create start script

---

## Manual Installation (Step by Step)

If you prefer to run commands manually:

### 1. Update Termux
```bash
pkg update && pkg upgrade
```

### 2. Install Requirements
```bash
pkg install nodejs git
```

### 3. Clone MultiChat
```bash
git clone https://github.com/RachEma-ux/MultiChat.git
cd MultiChat
```

### 4. Install & Build
```bash
npm install
npm run build
```

### 5. Start MultiChat
```bash
npm start
```

### 6. Open in Browser
Open Chrome and go to: **http://localhost:3000**

---

## 🚀 Daily Usage

### Start MultiChat:
```bash
cd ~/MultiChat
npm start
```

**Or use the quick script:**
```bash
~/start-multichat.sh
```

### Stop MultiChat:
Press **Ctrl + C** in Termux

### Access the App:
Open **Chrome** → **http://localhost:3000**

---

## 🔄 Keep Running in Background

### Install tmux:
```bash
pkg install tmux
```

### Start in tmux:
```bash
tmux new -s multichat
cd ~/MultiChat
npm start
```

### Detach (keep running):
Press: **Ctrl+B** then **D**

### Reattach later:
```bash
tmux attach -s multichat
```

---

## 📌 Add to Home Screen

1. Open **http://localhost:3000** in Chrome
2. Tap **⋮** (menu)
3. Tap **"Add to Home screen"**
4. Name it **"MultiChat"**
5. Tap **"Add"**

Now you have a home screen icon! 🎉

---

## 🔧 Quick Fixes

### Port Already in Use:
```bash
pkill -f node
```

### Update MultiChat:
```bash
cd ~/MultiChat
git pull
npm install
npm run build
npm start
```

### Reinstall Everything:
```bash
rm -rf ~/MultiChat
git clone https://github.com/RachEma-ux/MultiChat.git
cd MultiChat
npm install
npm run build
npm start
```

---

## 📱 Pro Tips

### Auto-Start on Termux Open:
```bash
echo 'cd ~/MultiChat && npm start' >> ~/.bashrc
```

### Check if Running:
```bash
ps aux | grep node
```

### View Logs:
```bash
cd ~/MultiChat
npm start 2>&1 | tee multichat.log
```

---

## ⚡ Super Quick Reference

| What | Command |
|------|---------|
| **Start** | `cd ~/MultiChat && npm start` |
| **Stop** | `Ctrl + C` |
| **Update** | `cd ~/MultiChat && git pull` |
| **Access** | `http://localhost:3000` |
| **Background** | `tmux new -s multichat` |

---

## 🎯 Complete One-Liner

Install AND start MultiChat in one command:

```bash
pkg update -y && pkg install -y nodejs git && git clone https://github.com/RachEma-ux/MultiChat.git && cd MultiChat && npm install && npm run build && npm start
```

**Then open:** http://localhost:3000

---

**Need Help?** Check `TERMUX-INSTALL.md` for detailed guide.

**Happy Chatting! 📱💬**
