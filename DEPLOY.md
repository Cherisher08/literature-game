# Deploying to Render

Two services, both on Render's free tier:

| Service | Type | What it is |
|---|---|---|
| `literature-api` | Node web service | The Socket.IO game server |
| `literature-web` | Static site | The built React client |

`render.yaml` at the repo root defines both, so Render can create them in one step.

---

## 1. Push the repo to GitHub

Render deploys from a Git remote.

```bash
git add -A
git commit -m "Add Render deployment config"
git push
```

## 2. Create the services

Render dashboard → **New** → **Blueprint** → pick this repository.

Render reads `render.yaml` and creates both services. Every variable marked
`sync: false` is left blank for you to fill in — that is deliberate, so secrets
never live in the repo.

## 3. Set the environment variables

Once both services exist you will have two URLs, roughly:

```
https://literature-api.onrender.com
https://literature-web.onrender.com
```

They reference each other, so set them **after** both are created.

**On `literature-api`:**

| Variable | Value |
|---|---|
| `CORS_ORIGINS` | `https://literature-web.onrender.com` |
| `LIVEKIT_URL` | `wss://your-project.livekit.cloud` *(optional)* |
| `LIVEKIT_API_KEY` | *(optional)* |
| `LIVEKIT_API_SECRET` | *(optional)* |

**On `literature-web`:**

| Variable | Value |
|---|---|
| `VITE_SERVER_URL` | `https://literature-api.onrender.com` |

`VITE_SERVER_URL` is baked in **at build time**, so the client must be
redeployed — not just restarted — after changing it.

## 4. Redeploy both

Manual Deploy → **Deploy latest commit** on each service.

## 5. Check it

```
https://literature-api.onrender.com/health
```

should return `{"ok":true,"rooms":0,...}`. Then open the web URL and create a
room. The API logs state whether voice came up:

```
[server] listening on http://localhost:10000
[server] voice:     enabled (wss://...)      <- or "disabled — set LIVEKIT_URL ..."
```

---

## Changing the URL

Render appends a random suffix (`literature-web-6qai`) when the name you asked
for is already taken — `.onrender.com` subdomains are global across all Render
users, so common words are long gone.

**To rename:** dashboard → the service → **Settings** → **Name**. The URL follows
the name. Pick something distinctive enough to be unclaimed.

**To use your own domain:** Settings → **Custom Domains** → add the hostname and
create the CNAME Render shows you. TLS is issued automatically. Worth doing if
you own a domain — the URL then survives moving off Render.

**Either way, fix the wiring afterwards.** The two services address each other by
URL:

| You renamed | Then you must |
|---|---|
| the web service | Update `CORS_ORIGINS` on the API to the new origin, exactly, no trailing slash |
| the API service | Update `VITE_SERVER_URL` on the web service **and redeploy it** — that value is compiled into the bundle, so a restart is not enough |

Skipping the first one is the nastier failure: the server stays healthy, the page
loads, and every browser silently refuses the socket.

> Renaming in the dashboard is safe. Changing `name:` in `render.yaml` and
> re-syncing the blueprint may create a *new* service instead of renaming the
> existing one, leaving you with two.

---

## Things that will surprise you

**The API sleeps.** Free web services stop after 15 minutes with no inbound
traffic and take about a minute to wake. Since February 2026 an incoming
WebSocket message also resets that timer, and Socket.IO's heartbeat sends one
roughly every 25 seconds — so an *active* game stays awake. An idle room does
not, and the first player after a quiet spell waits for a cold start. The static
site never sleeps, so the page itself always loads instantly.

**Rooms are lost on every restart.** This is by design (§63), and free-tier
sleeps make it routine rather than rare. Players see the terminal "server was
restarted" screen, which is why that screen is built properly rather than as an
afterthought.

**CORS is exact.** `CORS_ORIGINS` must match the client origin character for
character — no trailing slash. Get it wrong and the browser blocks the socket
while the server looks perfectly healthy. Leaving it as `*` works but lets any
site connect to your rooms.

**Voice needs HTTPS.** Both Render URLs are HTTPS, so microphone access works in
production — unlike local LAN testing over `http://192.168.x.x`, where browsers
refuse `getUserMedia`.

**LiveKit's free tier is 5,000 participant-minutes a month**, a hard cap. A
6-player, 30-minute game costs 180 of them — roughly 27 games (§69.6).

---

## Deploying elsewhere

Nothing here is Render-specific beyond `render.yaml`:

- **Client** — any static host. Build with
  `npm run build --workspace @memory-game/client`, serve `client/dist`, and
  rewrite all routes to `index.html`.
- **Server** — any host that runs Node 22 and holds a process open. Start with
  `npm start --workspace @memory-game/server`. It needs a real WebSocket
  connection, so serverless platforms will not work.

In-memory rooms mean the server cannot be scaled to multiple instances without
sticky routing by room id (§59.2). One instance is the intended shape.
