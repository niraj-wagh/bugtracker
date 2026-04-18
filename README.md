# 🐞 BUGTRACKER — Deployment Guide

## Stack
- **Backend:** Node.js + Express → **Render** or **Railway**
- **Frontend:** React + Vite → **Vercel** or **Netlify**
- **Database:** MongoDB **Atlas** (free M0 cluster)

---

## Step 1 — MongoDB Atlas

1. Go to https://cloud.mongodb.com → create free account
2. Create **M0 free cluster** (any region)
3. **Database Access** → Add user: `bugtracker_db_user` + strong password
4. **Network Access** → Add IP: `0.0.0.0/0` (allow all — required for Render/Railway)
5. **Connect** → **Drivers** → copy the Standard connection string:
   ```
   mongodb://bugtracker_db_user:<password>@ac-xxx-shard-00-00.xxx.mongodb.net:27017,...?ssl=true&...
   ```
   Replace `<password>` with your actual password.

---

## Step 2 — Deploy Backend (Render — FREE)

1. Push your code to GitHub (root of repo)
2. Go to https://render.com → **New** → **Web Service**
3. Connect your GitHub repo
4. Configure:
   - **Root Directory:** `backend`
   - **Build Command:** `npm install`
   - **Start Command:** `npm start`
   - **Environment:** `Node`
5. Add **Environment Variables** in Render dashboard:

   | Key | Value |
   |-----|-------|
   | `MONGODB_URI` | Your Atlas connection string |
   | `JWT_SECRET` | Run: `node -e "console.log(require('crypto').randomBytes(64).toString('hex'))"` |
   | `JWT_REFRESH_SECRET` | Run same command again (different value) |
   | `NODE_ENV` | `production` |
   | `PORT` | `5000` |
   | `CORS_ORIGINS` | `https://your-app.vercel.app` (fill in after frontend deploy) |

6. Click **Deploy** — wait ~2 minutes
7. Note your backend URL: `https://bugtracker-api.onrender.com`

### Seed production database (one time only):
```bash
cd backend
MONGODB_URI="your-atlas-uri" node src/utils/seed.js
```

---

## Step 2 (alternative) — Railway

1. Go to https://railway.app → **New Project** → **Deploy from GitHub**
2. Select repo → set **Root Directory** to `backend`
3. Add same environment variables as above
4. Railway auto-detects `npm start`

---

## Step 3 — Deploy Frontend (Vercel — FREE)

1. Go to https://vercel.com → **Add New Project**
2. Import your GitHub repo
3. Configure:
   - **Framework Preset:** `Vite`
   - **Root Directory:** `frontend`
   - **Build Command:** `npm run build`
   - **Output Directory:** `dist`
4. Add **Environment Variables**:

   | Key | Value |
   |-----|-------|
   | `VITE_API_URL` | `https://your-backend.onrender.com/api/v1` |

5. Click **Deploy** — get your URL: `https://bugtracker-xyz.vercel.app`

6. Go back to **Render** → update `CORS_ORIGINS` to your Vercel URL → redeploy backend

---

## Step 3 (alternative) — Netlify

1. Go to https://netlify.com → **Add new site** → **Import from Git**
2. Build settings auto-detected from `netlify.toml`
3. Add environment variable: `VITE_API_URL = https://your-backend.onrender.com/api/v1`
4. Deploy

---

## Step 4 — Verify Everything Works

1. Visit your Vercel URL
2. Click **Admin** demo pill → **Log in**
3. Check that projects, tickets, members all load
4. Create a ticket → log out → log back in → ticket should still be there ✓

---

## Local Development

```bash
# Install
npm run install:all

# Configure backend/.env (copy from backend/.env.example)
cp backend/.env.example backend/.env
# Edit backend/.env and add your Atlas URI

# Seed database
npm run seed

# Run both servers
npm run dev
# API: http://localhost:5000/api/v1
# UI:  http://localhost:3000
```

---

## Generate Secure JWT Secrets

Run this in your terminal:
```bash
node -e "console.log(require('crypto').randomBytes(64).toString('hex'))"
```
Run it **twice** — use one for `JWT_SECRET`, one for `JWT_REFRESH_SECRET`.

---

## Demo Credentials (after seeding)

| Email | Password | Role |
|-------|----------|------|
| admin@bugtracker.io | admin123 | Admin |
| dev@bugtracker.io | dev123 | Member |
| qa@bugtracker.io | qa123 | Member |
| carol@bugtracker.io | carol123 | Member |
| dave@bugtracker.io | dave123 | Viewer |
