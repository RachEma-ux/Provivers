# MultiChat Mobile Installation Guide

Complete guide to install and run MultiChat on your mobile phone.

## 📱 Installation Methods

Choose the method that works best for you:

1. **[Cloud Deployment](#method-1-cloud-deployment-recommended)** - Deploy to Vercel/Netlify (Easiest)
2. **[Termux on Android](#method-2-termux-android-local-installation)** - Run locally on Android
3. **[PWA Installation](#method-3-pwa-progressive-web-app)** - Install as an app

---

## Method 1: Cloud Deployment (Recommended)

Deploy MultiChat to a cloud platform and access it from your mobile browser.

### Option A: Deploy to Vercel (Free)

#### Step 1: Install Vercel CLI on Desktop

```bash
npm install -g vercel
```

#### Step 2: Login to Vercel

```bash
vercel login
```

#### Step 3: Deploy from MultiChat Directory

```bash
cd MultiChat
vercel
```

Follow the prompts:
- Set up and deploy? **Yes**
- Which scope? **Your account**
- Link to existing project? **No**
- What's your project's name? **multichat**
- In which directory is your code? **.**
- Want to override settings? **No**

#### Step 4: Access on Mobile

1. Vercel will provide a URL: `https://multichat-xxx.vercel.app`
2. Open this URL on your mobile browser
3. Done! 🎉

### Option B: Deploy to Railway (Free Tier)

#### Step 1: Create Railway Account

Go to https://railway.app and sign up with GitHub.

#### Step 2: Deploy via GitHub

1. Push MultiChat to your GitHub
2. Go to Railway dashboard
3. Click "New Project"
4. Select "Deploy from GitHub repo"
5. Choose "RachEma-ux/MultiChat"
6. Railway auto-detects and deploys!

#### Step 3: Set Environment Variables

In Railway dashboard:
1. Go to your project
2. Click "Variables"
3. Add your environment variables:
   ```
   DATABASE_URL=your-database-url
   JWT_SECRET=your-secret
   ```

#### Step 4: Access on Mobile

1. Railway provides a URL: `https://multichat-production.up.railway.app`
2. Open on your mobile browser

---

## Method 2: Termux (Android) Local Installation

Run MultiChat directly on your Android device using Termux.

### Prerequisites

Download **Termux** from F-Droid (NOT Google Play):
- https://f-droid.org/en/packages/com.termux/

### Step 1: Setup Termux

Open Termux and run:

```bash
# Update packages
pkg update && pkg upgrade

# Install required packages
pkg install git nodejs postgresql
```

### Step 2: Clone MultiChat

```bash
# Clone repository
git clone https://github.com/RachEma-ux/MultiChat.git

# Navigate to directory
cd MultiChat
```

### Step 3: Install Dependencies

```bash
# Install dependencies
npm install
```

### Step 4: Setup Environment

```bash
# Create .env file
cat > .env << 'EOF'
DATABASE_URL="postgresql://localhost:5432/multichat"
PORT=3000
NODE_ENV=development
VITE_API_URL=http://localhost:3000
JWT_SECRET=your-secret-key-here
SESSION_SECRET=your-session-secret-here
EOF
```

### Step 5: Setup Database

```bash
# Start PostgreSQL
pg_ctl -D $PREFIX/var/lib/postgresql start

# Create database
createdb multichat

# Run migrations
npm run db:push
```

### Step 6: Build and Start

```bash
# Build the application
npm run build

# Start the server
npm run start
```

### Step 7: Access the App

Open your mobile browser and go to:
```
http://localhost:3000
```

### Termux Tips

**Keep App Running in Background:**
```bash
# Install tmux for persistent sessions
pkg install tmux

# Start tmux session
tmux new -s multichat

# Run your app
cd MultiChat && npm start

# Detach: Press Ctrl+B, then D
# Reattach: tmux attach -t multichat
```

**Auto-start on Termux Launch:**

Create `~/.bashrc`:
```bash
echo 'cd ~/MultiChat && npm start' >> ~/.bashrc
```

---

## Method 3: PWA (Progressive Web App)

Make MultiChat installable as a native-like app on your phone.

### Step 1: Enable PWA Support

Create `public/manifest.json`:

```json
{
  "name": "MultiChat",
  "short_name": "MultiChat",
  "description": "Multi-provider chat application",
  "start_url": "/",
  "display": "standalone",
  "background_color": "#ffffff",
  "theme_color": "#000000",
  "orientation": "portrait",
  "icons": [
    {
      "src": "/icon-192.png",
      "sizes": "192x192",
      "type": "image/png",
      "purpose": "any maskable"
    },
    {
      "src": "/icon-512.png",
      "sizes": "512x512",
      "type": "image/png",
      "purpose": "any maskable"
    }
  ]
}
```

### Step 2: Add Service Worker

Create `public/sw.js`:

```javascript
const CACHE_NAME = 'multichat-v1';
const urlsToCache = [
  '/',
  '/index.html',
  '/manifest.json'
];

self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => cache.addAll(urlsToCache))
  );
});

self.addEventListener('fetch', event => {
  event.respondWith(
    caches.match(event.request)
      .then(response => response || fetch(event.request))
  );
});
```

### Step 3: Register Service Worker

Add to your `index.html`:

```html
<link rel="manifest" href="/manifest.json">
<script>
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('/sw.js');
  }
</script>
```

### Step 4: Install on Mobile

1. Open MultiChat in Chrome/Safari on mobile
2. Tap the menu (3 dots)
3. Select "Add to Home Screen" or "Install App"
4. Done! App icon appears on home screen 🎉

---

## 🚀 Quick Start Scripts

### One-Command Deploy to Vercel

Save as `deploy-mobile.sh`:

```bash
#!/bin/bash

echo "🚀 Deploying MultiChat to Vercel..."

# Install Vercel CLI if not installed
if ! command -v vercel &> /dev/null; then
    echo "Installing Vercel CLI..."
    npm install -g vercel
fi

# Deploy
vercel --prod

echo "✅ Deployment complete!"
echo "📱 Open the provided URL on your mobile device"
```

Run:
```bash
chmod +x deploy-mobile.sh
./deploy-mobile.sh
```

---

## 📱 Recommended Setup

### For Best Mobile Experience:

1. **Deploy to Cloud** (Vercel/Railway)
   - ✅ Accessible anywhere
   - ✅ No battery drain
   - ✅ Always online
   - ✅ Automatic HTTPS

2. **Enable PWA**
   - ✅ Install as app
   - ✅ Offline support
   - ✅ Native-like experience
   - ✅ Push notifications

3. **Optimize for Mobile**
   - Add responsive CSS
   - Touch-friendly UI
   - Fast loading
   - Mobile gestures

---

## 🔧 Troubleshooting

### Termux Issues

**Error: `pkg: command not found`**
```bash
apt update && apt upgrade
```

**Error: `node: command not found`**
```bash
pkg install nodejs
```

**Error: `Port 3000 already in use`**
```bash
# Find and kill process
lsof -ti:3000 | xargs kill
```

### Deployment Issues

**Vercel: Build Failed**
```bash
# Check build locally first
npm run build

# Check vercel.json configuration
```

**Railway: Database Connection Failed**
```bash
# Add DATABASE_URL in Railway variables
# Use Railway's PostgreSQL addon
```

### PWA Issues

**"Add to Home Screen" not showing**
- Must use HTTPS (localhost or deployed)
- Manifest.json must be valid
- Service worker must be registered

---

## 📊 Comparison

| Method | Pros | Cons | Best For |
|--------|------|------|----------|
| **Vercel/Railway** | Easy, free, always online | Requires internet | Most users |
| **Termux** | Offline, private, local | Battery drain, complex | Advanced users |
| **PWA** | App-like, offline support | Needs deployment first | Best UX |

---

## 🎯 Recommended Path

**Easiest Installation:**

1. **Deploy to Vercel** (5 minutes)
   ```bash
   cd MultiChat
   npx vercel --prod
   ```

2. **Open on Mobile** (1 minute)
   - Open provided URL
   - Tap "Add to Home Screen"

3. **Done!** ✅

---

## 📞 Need Help?

- **Issues:** https://github.com/RachEma-ux/MultiChat/issues
- **Termux Wiki:** https://wiki.termux.com/
- **Vercel Docs:** https://vercel.com/docs
- **Railway Docs:** https://docs.railway.app/

---

**Happy chatting on mobile! 📱💬**
