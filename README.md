# Literature (Fish) — Real-Time Multiplayer Card Game

A real-time, team-based implementation of the classic **Literature (Fish)** card game built with Node.js, Socket.IO, and React.

---

## 📁 Repository Architecture

This repository is structured as an **npm workspaces monorepo**:

```text
literature-game/
├── client/          # Frontend SPA (React 19, Vite, Tailwind CSS, Zustand, Socket.IO Client)
├── server/          # Backend (Node.js 22, Express 5, Socket.IO, In-Memory Rooms)
├── shared/          # Shared types, card/set definitions, and game protocol
├── package.json     # Workspace root scripts & dev dependencies
└── vercel.json      # Vercel deployment configuration for the client
```

---

## 🛠️ Prerequisites

- **Node.js**: `v22.0.0` or newer (`node -v`)
- **npm**: `v10.0.0` or newer
- **ngrok** (for tunneling your local/Ubuntu server to the Vercel-hosted client)

---

## 🚀 Quick Local Development (Everything on one machine)

If you want to run both the frontend and backend locally on the same laptop:

1. **Clone the repository and install dependencies**:
   ```bash
   git clone <repo-url>
   cd literature-game
   npm install
   ```

2. **Set up `.env`**:
   Create a `.env` file at the repository root:
   ```env
   PORT=3001
   CORS_ORIGINS=*
   NODE_ENV=development
   ```

3. **Start the server** (runs on `http://localhost:3001`):
   ```bash
   npm run dev:server
   ```

4. **Start the client** (runs on `http://localhost:5173`):
   In another terminal:
   ```bash
   npm run dev:client
   ```
   *Note: In local development, the Vite dev server automatically proxies `/socket.io` to port `3001`.*

---

## 🌐 Hybrid Setup: Local/Ubuntu Server + Vercel Frontend

This architecture runs the **client SPA on Vercel** and the **game server on your personal laptop / Ubuntu machine**.

```
[ Players / Web Browsers ]
          │
          ├── HTTPS ──────────► [ Vercel (Client SPA) ]
          │
          └── WSS / HTTPS ────► [ ngrok Secure Tunnel ]
                                        │
                                        ▼ (localhost:3001)
                                [ Your Ubuntu Server ]
```

> [!NOTE]
> **Why is ngrok needed?**
> Vercel serves the frontend over **HTTPS**. Modern browsers enforce Mixed Content Security and strictly block HTTPS websites from communicating with raw `http://` or `ws://` endpoints. An HTTPS tunnel provides a valid SSL certificate for your local server.

---

### Step 1: Deploying the Client to Vercel

1. Push this repository to GitHub / GitLab.
2. Import the project in [Vercel](https://vercel.com).
3. **Important Project Settings**:
   - **Root Directory**: Leave as `./` (the root of the repo — do **not** set to `client`).
   - The repository includes [`vercel.json`](./vercel.json), which automatically configures:
     - `installCommand`: `npm install --include=dev`
     - `buildCommand`: `npm run build --workspace @memory-game/client`
     - `outputDirectory`: `client/dist`
     - SPA rewrites to `/index.html`

---

### Step 2: Setting up the Server on Ubuntu

SSH into your Ubuntu machine and perform the setup:

1. **Verify Node.js (v22+)**:
   ```bash
   node -v
   ```
   *(To install Node 22: `curl -fsSL https://deb.nodesource.com/setup_22.x | sudo -E bash - && sudo apt install -y nodejs`)*

2. **Clone and install dependencies**:
   ```bash
   cd ~
   git clone <repo-url> literature-game
   cd literature-game
   npm install
   ```

3. **Create `.env`**:
   ```bash
   cat <<EOF > .env
   PORT=3001
   CORS_ORIGINS=*
   NODE_ENV=development
   EOF
   ```

---

### Step 3: Installing and Configuring ngrok

1. **Install ngrok on Ubuntu**:
   ```bash
   curl -s https://ngrok-agent.s3.amazonaws.com/ngrok.asc | sudo tee /etc/apt/trusted.gpg.d/ngrok.asc >/dev/null
   echo "deb https://ngrok-agent.s3.amazonaws.com buster main" | sudo tee /etc/apt/sources.list.d/ngrok.list
   sudo apt update && sudo apt install -y ngrok
   ```

2. **Get your Authtoken**:
   - Create a free account at [dashboard.ngrok.com](https://dashboard.ngrok.com/signup).
   - Copy your authtoken from [dashboard.ngrok.com/get-started/your-authtoken](https://dashboard.ngrok.com/get-started/your-authtoken).
   - Configure it on Ubuntu:
     ```bash
     ngrok config add-authtoken YOUR_AUTHTOKEN_HERE
     ```

3. **Claim your Free Permanent Static Domain**:
   - In the ngrok dashboard, navigate to **Cloud Edge** → **[Domains](https://dashboard.ngrok.com/cloud-edge/domains)**.
   - Click **Create Domain** (e.g. `your-domain.ngrok-free.app`).
   - Using a static domain prevents your URL from changing every time ngrok restarts!

---

### Step 4: Running the Server in Background with `nohup`

To keep the server running in the background while leaving your terminal free for ngrok:

1. **Start server with `nohup`**:
   ```bash
   nohup npm run dev:server > server.log 2>&1 &
   ```

2. **Verify it is running**:
   ```bash
   tail -n 15 server.log
   ```
   You should see: `[server] listening on http://localhost:3001`.

3. **Set up the `restart-server` command**:
   Add an alias to your shell profile so you can restart the background server at any time:
   ```bash
   echo "alias restart-server='kill \$(lsof -t -i:3001) 2>/dev/null; sleep 1; nohup npm run dev:server > server.log 2>&1 & echo \"[server restarted]\"'" >> ~/.bashrc
   source ~/.bashrc
   ```
   Now, whenever code changes or you need to restart:
   ```bash
   restart-server
   ```

4. **Monitoring logs**:
   ```bash
   tail -f server.log
   ```
   *(Press `Ctrl + C` to stop watching logs; the server keeps running).*

5. **Stopping the server**:
   ```bash
   kill $(lsof -t -i:3001)
   ```

---

### Step 5: Starting the ngrok Tunnel

In your active terminal, run:

```bash
# With static domain:
ngrok http --domain=your-domain.ngrok-free.app 3001

# Or with a random dynamic domain:
ngrok http 3001
```

Copy the public `https://...` Forwarding URL displayed in the terminal.

---

### Step 6: Connect Vercel to Your Server

1. Go to your project on the [Vercel Dashboard](https://vercel.com).
2. Go to **Settings** → **Environment Variables**.
3. Add or update:
   - **Key**: `VITE_SERVER_URL`
   - **Value**: `https://your-domain.ngrok-free.app` *(no trailing slash)*
   - Target: **Production**, **Preview**, **Development**
4. **Trigger a Redeploy**:
   - Go to **Deployments** → click `...` on the latest deployment → **Redeploy**.
   - *(Vite injects `VITE_SERVER_URL` at build time, so redeploying is required).*

---

## 🔍 Verification & Health Check

1. **Verify Server Health**:
   Open in your browser:
   ```text
   https://your-domain.ngrok-free.app/health
   ```
   Output: `{"ok":true,"rooms":0,"uptime":...}`

2. **Verify Frontend**:
   - Open your Vercel deployment URL (`https://your-app.vercel.app`).
   - Open browser developer tools (`F12` → **Console**):
     You will see: `SERVER URL: https://your-domain.ngrok-free.app`.
   - Create a room and start playing!

---

## 🎙️ Optional: In-Game Voice Chat (LiveKit)

Voice chat is optional. The game runs completely fine without it. If desired:
1. Sign up for a free plan at [LiveKit Cloud](https://cloud.livekit.io).
2. Add the credentials to your server's `.env`:
   ```env
   LIVEKIT_URL=wss://your-project.livekit.cloud
   LIVEKIT_API_KEY=your-api-key
   LIVEKIT_API_SECRET=your-api-secret
   ```
3. Run `restart-server`. The server logs will display `[server] voice: enabled`.
