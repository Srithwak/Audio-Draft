# Audio-Draft 🎵 — Setup Guide

> A Spotify-connected music analytics and collaboration platform built with Node.js, Express, and Supabase.

---

## Prerequisites

Before you start, make sure you have the following installed:

| Requirement | Version | Download |
|---|---|---|
| **Node.js** | v18 or higher | https://nodejs.org |
| **Git** | Any recent version | https://git-scm.com |
| **Spotify Premium** | Required (see below) | https://spotify.com/premium |

> **Why Spotify Premium?**  
> Audio-Draft uses the Spotify Web API to fetch your recently played tracks, top artists, and listening analytics. These endpoints (`/me/player/recently-played`, `/me/top/artists`, `/me/top/tracks`) are only accessible with an active **Spotify Premium** account. Without it, the personal analytics section of the dashboard will not work.

---

## Step 1 — Clone the Repository

```bash
git clone https://github.com/Srithwak/Audio-Draft.git
cd Audio-Draft
```

---

## Step 2 — Install Dependencies

Run the following in the root of the project:

```bash
npm install
```

This installs all required packages including Express, Supabase client, Electron, bcryptjs, axios, and others listed in `package.json`.

---

## Step 3 — Spotify Developer Setup

To use this app, you need a Spotify premium account.
You need to create a Spotify App to get your API credentials.

1. Go to the [Spotify Developer Dashboard](https://developer.spotify.com/dashboard) and log in.
2. Click **"Create App"**.
3. Fill in the details:
   - **App name**: anything (e.g. `Audio-Draft`)
   - **App description**: anything
   - **Redirect URI**: `http://127.0.0.1:3000/spotify/callback`  
      This must be **exact** — no trailing slash, no `localhost`.
4. Check the **Web API** box under "Which API/SDKs are you planning to use?", then click **Save**.
5. Once the app is created, open it and go to **Settings**.
6. Copy your **Client ID** and **Client Secret** — you'll need these in the next step.

---

## Step 4 — Supabase Setup

Audio-Draft uses Supabase as its PostgreSQL database.

1. Go to [supabase.com](https://supabase.com) and create a free account.
2. Create a new project. Choose a strong database password and save it.
3. Once your project is ready, go to **Project Settings → API**.
4. Copy:
   - **Project URL** (looks like `https://xxxx.supabase.co`)
   - **anon/public key** (a long JWT string)
5. Go to the **SQL Editor** in the Supabase dashboard.
6. Open `database/initialize_db.sql` from this project and paste the entire contents into the editor, then click **Run**. This creates all the required tables.

---

## Step 5 — Configure the `.env` File

Create a file at `database/.env` (copy from the example):

```bash
copy database\.env.example database\.env
```

Then open `database/.env` and fill in your values:

```env
API_URL="https://YOUR_PROJECT_ID.supabase.co"
ANON_PUBLIC_KEY="your_supabase_anon_key_here"

SUPABASE_DIRECT_CONNECT="postgresql://postgres:YOUR_PASSWORD@db.YOUR_PROJECT_ID.supabase.co:5432/postgres"

SPOTIFY_CLIENT_ID="your_spotify_client_id_here"
SPOTIFY_CLIENT_SECRET="your_spotify_client_secret_here"
```

> ⚠️ **Never commit this file.** It is already listed in `.gitignore`.

---

## Step 6 — Run the App

### 🪟 On Windows (Easy Launch)
Double-click `start.bat` or run it in your terminal:
```powershell
.\start.bat
```
This will automatically install dependencies, start the backend, and launch the Electron desktop app.

### 🍎 On Mac / 🐧 Linux (Easy Launch)
Open your terminal and run:
```bash
chmod +x start.sh
./start.sh
```
This will start the backend server. You can then access the app in your browser at `http://localhost:3000`.

### 🌐 Web-Only Version (Any OS)
If you only want to run the server without the desktop app:
```bash
node server.js
```
Then open: [http://localhost:3000](http://localhost:3000)

---

## Step 7 — Build Desktop App (Windows Only)
To generate the portable `.exe`:
```bash
npm run build
```
The executable will be saved in `release/Audio-Draft-win32-x64/`.


---

## Step 7 — Connect Spotify in the App

After logging in or registering:

1. Click **Settings** in the sidebar.
2. Click **"Connect Spotify"**.
3. You'll be redirected to Spotify's login page — log in and grant permissions.
4. You'll be redirected back to the app automatically.

Your personal analytics (recently played, top tracks, top artists) will now load.

---

## Common Issues & Solutions

### ❌ `FATAL: Missing API_URL or ANON_PUBLIC_KEY in database/.env`
**Cause:** The `.env` file is missing or in the wrong location.  
**Fix:** Make sure the file is at `database/.env` (not the root), and that both `API_URL` and `ANON_PUBLIC_KEY` are filled in with no extra spaces or quotes mismatches.

---

### ❌ Spotify login redirects but shows an error / "Invalid redirect URI"
**Cause:** The redirect URI in your Spotify Developer App doesn't match exactly.  
**Fix:** Go to your Spotify App settings and make sure the redirect URI is set to exactly:
```
http://127.0.0.1:3000/spotify/callback
```
Do **not** use `localhost` — use `127.0.0.1`. Do **not** add a trailing slash.

---

### ❌ Analytics shows "mock" or placeholder data instead of real listening history
**Cause:** Either Spotify isn't connected yet, or your account is not Premium.  
**Fix:** Connect Spotify via Settings (Step 7). Confirm your account is Spotify Premium. Free accounts do not have access to the listening history endpoints.

---

### ❌ `npm install` fails or `node_modules` errors
**Cause:** Outdated Node.js version or corrupted install.  
**Fix:** Ensure you're on Node.js v18+. Run:
```bash
node -v
```
If below v18, download the latest LTS from [nodejs.org](https://nodejs.org). Then delete `node_modules` and `package-lock.json` and re-run `npm install`.

---

### ❌ Supabase tables are missing / login/register doesn't work
**Cause:** The database schema was never initialized.  
**Fix:** Open the Supabase SQL Editor, paste the contents of `database/initialize_db.sql`, and click **Run**. This creates all required tables (`users`, `playlists`, `notifications`, etc.).

---

### ❌ Port 3000 is already in use
**Cause:** Another process is using port 3000.  
**Fix (Windows):**
```powershell
netstat -ano | findstr :3000
taskkill /PID <PID_NUMBER> /F
```
Then re-run `node server.js`.

---

### ❌ Electron app opens a blank white window
**Cause:** The backend server isn't running before Electron tries to connect.  
**Fix:** Always start the server first (`node server.js`) before launching Electron (`npm run start:desktop`), or just use `start.bat` which handles the ordering automatically.

---

*For more info, visit the [GitHub repository](https://github.com/Srithwak/Audio-Draft).*
