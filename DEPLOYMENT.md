# 🚀 StudyTrack - Production Deployment Guide

This guide walks you through deploying **StudyTrack** to production with **MongoDB Atlas** and cloud platforms like **Render**, **Railway**, **Vercel**, or **Docker/VPS**.

---

## 🍃 1. MongoDB Atlas Setup (Free Cloud Database)

Before deploying the app, set up your production MongoDB database:

1. **Sign Up / Log In**: Go to [MongoDB Atlas](https://www.mongodb.com/cloud/atlas) and log in.
2. **Create a Cluster**:
   - Select **M0 (Free Tier)**.
   - Choose a cloud provider and region closest to your users (e.g., AWS / us-east-1 or eu-central-1).
3. **Create Database User**:
   - Go to **Security > Database Access > Add New Database User**.
   - Select **Password Authentication**.
   - Enter a username (e.g. `studytrack_admin`) and a secure password (save this password).
   - Set privileges to **Read and write to any database** (or `Built-in: readWriteAnyDatabase`).
4. **Configure Network Access**:
   - Go to **Security > Network Access > Add IP Address**.
   - Click **Allow Access from Anywhere (`0.0.0.0/0`)** so your cloud hosting provider (Render/Railway/AWS) can connect.
   - Click **Confirm**.
5. **Get Connection String**:
   - Go to **Database > Clusters > Connect**.
   - Select **Drivers** (Node.js).
   - Copy the connection URI. It will look like:
     ```text
     mongodb+srv://studytrack_admin:<password>@cluster0.xxxxx.mongodb.net/studytrack?retryWrites=true&w=majority
     ```
   - Replace `<password>` with your actual database user password (remember to URL-encode special characters if needed).

---

## ⚡ 2. Option A: Full-Stack Deployment on Render.com (Recommended)

Render deploys the entire application (Backend API + WebSockets + Built Frontend) on a single web service.

### Step 1: Push Project to GitHub
```bash
git init
git add .
git commit -m "Initial production commit"
git branch -M main
git remote add origin https://github.com/your-username/studytrack.git
git push -u origin main
```

### Step 2: Create Web Service on Render
1. Log in to [Render.com](https://render.com/).
2. Click **New + > Web Service**.
3. Connect your GitHub repository `studytrack`.
4. Configure the service:
   - **Name**: `studytrack`
   - **Region**: Same region as your MongoDB Atlas cluster.
   - **Branch**: `main`
   - **Runtime**: `Node`
   - **Build Command**:
     ```bash
     npm run build
     ```
   - **Start Command**:
     ```bash
     npm start
     ```
   - **Plan**: `Free` or `Starter`

### Step 3: Add Environment Variables in Render Dashboard
Under **Environment Variables**, add:
| Key | Value |
| :--- | :--- |
| `NODE_ENV` | `production` |
| `MONGODB_URI` | `mongodb+srv://studytrack_admin:<password>@cluster0.xxxxx.mongodb.net/studytrack?retryWrites=true&w=majority` |
| `JWT_SECRET` | `(Paste 64-char random string generated below)` |
| `REFRESH_TOKEN_SECRET` | `(Paste 64-char random string generated below)` |

> 💡 **Tip to generate JWT secrets in terminal**:
> ```bash
> node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
> ```

5. Click **Create Web Service**. Render will automatically install packages, build the Vite frontend, and launch the server.

### Step 4: Seed Demo Data (Optional)
To populate demo users, study groups, mentor channels, tasks, and sessions:
- In the Render dashboard, open the **Shell** tab and run:
  ```bash
  npm run seed
  ```

---

## 🚂 3. Option B: Deployment on Railway.app

1. Go to [Railway.app](https://railway.app/) and click **New Project > Deploy from GitHub repo**.
2. Select your `studytrack` repository.
3. In the project **Settings / Variables**, add:
   - `NODE_ENV` = `production`
   - `MONGODB_URI` = your Atlas connection string
   - `JWT_SECRET` = your JWT secret
   - `REFRESH_TOKEN_SECRET` = your refresh secret
4. Railway will automatically detect the root `package.json`, build the frontend, and start `server.js`.

---

## 🐳 4. Option C: Docker Container / Self-Hosted VPS

If deploying to a VPS (Ubuntu / Debian with Docker installed) or AWS ECS / GCP Cloud Run:

### Build and Run with Docker:
```bash
# 1. Build the production container
docker build -t studytrack:latest .

# 2. Run container with environment variables
docker run -d \
  -p 5000:5000 \
  --name studytrack \
  -e NODE_ENV=production \
  -e PORT=5000 \
  -e MONGODB_URI="mongodb+srv://..." \
  -e JWT_SECRET="your_secret" \
  -e REFRESH_TOKEN_SECRET="your_refresh_secret" \
  studytrack:latest
```

### Or using Docker Compose:
Edit `docker-compose.yml` with your production secrets, then run:
```bash
docker-compose up -d --build
```

---

## 🛡️ Production Checklist

- [x] **Compression**: Gzip enabled for fast static and API loads.
- [x] **Security**: Helmet security headers configured.
- [x] **Proxy Support**: `app.set('trust proxy', 1)` enabled for real client IP rate limiting.
- [x] **Rate Limiting**: Enabled on `/api/` and `/api/auth/` routes against DDoS and brute-force.
- [x] **Cross-Origin WebSockets**: Socket.io configured for same-origin and multi-domain deployments.
- [x] **Static Caching**: 1-year immutable caching on production Vite assets.
- [x] **Graceful Shutdown**: SIGTERM and SIGINT listeners in place for zero downtime container restarts.
