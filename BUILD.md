# TuneSlam - Complete Build & Deployment Guide

Complete guide for building and deploying all components of TuneSlam to production.

## Architecture Overview

```
┌─────────────────────────────────────────────────────────────┐
│                      PRODUCTION DEPLOYMENT                   │
├─────────────────────────────────────────────────────────────┤
│                                                               │
│  Frontend (Cloudflare Pages)                                │
│  ├── admin.tuneslam.com      (Admin Dashboard)             │
│  ├── tuneslam.com             (User Interface)              │
│  └── viewer.tuneslam.com      (TV Display)                  │
│                                                               │
│  Backend (AWS Elastic Beanstalk)                            │
│  └── api.tuneslam.com         (REST API + Socket.io)        │
│                                                               │
│  External Services                                           │
│  ├── MongoDB Atlas            (Database)                     │
│  ├── Redis Cloud              (Cache/Sessions)               │
│  ├── Spotify API              (Music Integration)            │
│  ├── Facebook OAuth           (Social Login)                 │
│  └── Twilio                   (SMS - Optional)              │
│                                                               │
└─────────────────────────────────────────────────────────────┘
```

## Table of Contents

1. [Prerequisites](#prerequisites)
2. [Environment Variables](#environment-variables)
3. [Frontend Build & Deploy](#frontend-build--deploy)
4. [Backend Build & Deploy](#backend-build--deploy)
5. [Quick Commands](#quick-commands)
6. [Post-Deployment](#post-deployment)

---

## Prerequisites

### Required Tools

```bash
# Node.js 20+
node --version  # Should be v20.x or higher

# NPM
npm --version

# Wrangler CLI (for Cloudflare)
npm install -g wrangler

# AWS EB CLI (for backend deployment)
pip install awsebcli

# Git
git --version
```

### Required Accounts

- **Cloudflare Account** → Frontend hosting
- **AWS Account** → Backend hosting
- **MongoDB Atlas** → Database
- **Redis Cloud** → Cache/sessions
- **Spotify Developer Account** → Music API
- **Facebook Developer Account** → OAuth (optional)

---

## Environment Variables

### Backend Variables

Create these files (they're git-ignored):
- `backend/.env.development` → Local development
- `backend/.env.production` → AWS production

#### backend/.env.development

```env
# Server
PORT=5000
NODE_ENV=development

# Database
MONGODB_URI=mongodb://localhost:27017/tuneslam
# OR use MongoDB Atlas:
# MONGODB_URI=mongodb+srv://username:password@cluster.mongodb.net/tuneslam

# Redis
REDIS_HOST=localhost
REDIS_PORT=6379
REDIS_PASSWORD=

# Security
JWT_SECRET=dev-jwt-secret-change-in-production
SESSION_COOKIE_SECRET=dev-session-secret-change-in-production

# Frontend URLs (Local)
ADMIN_URL=http://192.168.0.4:5173
USER_URL=http://192.168.0.4:5174
VIEWER_URL=http://192.168.0.4:5175

# Spotify API
SPOTIFY_CLIENT_ID=your_spotify_client_id
SPOTIFY_CLIENT_SECRET=your_spotify_client_secret
SPOTIFY_REDIRECT_ADMIN_URI=http://localhost:5000/api/spotify/callback
SPOTIFY_REDIRECT_USER_URI=http://localhost:5000/api/auth/spotify/callback

# Facebook OAuth (Optional)
FACEBOOK_APP_ID=your_facebook_app_id
FACEBOOK_APP_SECRET=your_facebook_app_secret
FACEBOOK_CALLBACK_URL=http://localhost:5000/api/auth/facebook/callback

# Twilio (Optional)
TWILIO_ACCOUNT_SID=your_twilio_sid
TWILIO_AUTH_TOKEN=your_twilio_token
```

#### backend/.env.production

```env
# Server
PORT=5000
NODE_ENV=production

# Database (MongoDB Atlas)
MONGODB_URI=mongodb+srv://username:password@cluster.mongodb.net/tuneslam

# Redis (Redis Cloud)
REDIS_HOST=your-redis-host.cloud.redislabs.com
REDIS_PORT=18612
REDIS_PASSWORD=your-redis-password

# Security (GENERATE STRONG VALUES!)
JWT_SECRET=STRONG-RANDOM-SECRET-HERE-64-CHARS-MIN
SESSION_COOKIE_SECRET=ANOTHER-STRONG-RANDOM-SECRET-HERE

# Frontend URLs (Production Cloudflare)
ADMIN_URL=https://admin.tuneslam.com
USER_URL=https://tuneslam.com
VIEWER_URL=https://viewer.tuneslam.com

# Spotify API
SPOTIFY_CLIENT_ID=your_spotify_client_id
SPOTIFY_CLIENT_SECRET=your_spotify_client_secret
SPOTIFY_REDIRECT_ADMIN_URI=https://api.tuneslam.com/api/spotify/callback
SPOTIFY_REDIRECT_USER_URI=https://api.tuneslam.com/api/auth/spotify/callback

# Facebook OAuth
FACEBOOK_APP_ID=your_facebook_app_id
FACEBOOK_APP_SECRET=your_facebook_app_secret
FACEBOOK_CALLBACK_URL=https://api.tuneslam.com/api/auth/facebook/callback

# Twilio (Optional)
TWILIO_ACCOUNT_SID=your_twilio_sid
TWILIO_AUTH_TOKEN=your_twilio_token
```

### Frontend Variables

Create these files for EACH frontend (admin, user, viewer):

#### Development (.env.development)

```env
VITE_API_URL=http://192.168.0.4:5000
```

#### Production (.env.production)

```env
VITE_API_URL=https://api.tuneslam.com
```

**Files to create:**
- `frontend/admin/.env.development`
- `frontend/admin/.env.production`
- `frontend/user/.env.development`
- `frontend/user/.env.production`
- `frontend/viewer/.env.development`
- `frontend/viewer/.env.production`

---

## Frontend Build & Deploy

### Build Configuration

All three frontends are configured for:
- **Single JS file output** (CSS inlined)
- **Automatic environment switching** (dev vs prod)
- **SPA routing** (`_redirects` file included)
- **Cloudflare Pages** compatible

### Build Commands

**Individual Builds:**

```bash
# Admin Dashboard
cd frontend/admin
npm install
npm run build
# Output: dist/ folder

# User Interface
cd frontend/user
npm install
npm run build
# Output: dist/ folder

# TV Viewer
cd frontend/viewer
npm install
npm run build
# Output: dist/ folder
```

### Deploy to Cloudflare Pages

#### Method 1: Wrangler CLI (Recommended)

**First Time Setup:**

```bash
# Login to Cloudflare
wrangler login

# Deploy Admin
cd frontend/admin
npm run deploy
# or: npm run build && wrangler pages deploy

# Deploy User
cd frontend/user
npm run deploy

# Deploy Viewer
cd frontend/viewer
npm run deploy
```

**Subsequent Deployments:**

```bash
cd frontend/admin && npm run deploy
cd frontend/user && npm run deploy
cd frontend/viewer && npm run deploy
```

#### Method 2: Cloudflare Dashboard

1. Go to Cloudflare Pages
2. Create new project
3. Upload `dist/` folder
4. Repeat for each frontend

### Custom Domains

After first deployment, add custom domains in Cloudflare:

1. Go to each Pages project → Custom domains
2. Add:
   - Admin: `admin.tuneslam.com`
   - User: `tuneslam.com` or `www.tuneslam.com`
   - Viewer: `viewer.tuneslam.com`

---

## Backend Build & Deploy

### Build for AWS Elastic Beanstalk

```bash
cd backend

# Install dependencies (first time)
npm install

# Build deployment package
npm run build
# Creates dist/ folder with production code

# Create ZIP file
npm run package
# Creates backend-deployment.zip

# Or do both at once
npm run deploy:prepare
```

### Deploy to AWS Elastic Beanstalk

#### Method 1: EB CLI (Recommended)

**First Time:**

```bash
cd backend/dist

# Initialize
eb init
# Select:
# - Region: us-east-1 (or preferred)
# - Application: tuneslam-api
# - Platform: Node.js 20.x

# Create environment
eb create tuneslam-api-prod \
  --instance-type t3.small \
  --envvars NODE_ENV=production

# Deploy
eb deploy
```

**Subsequent Deployments:**

```bash
cd backend
npm run deploy:prepare
cd dist
eb deploy
```

#### Method 2: AWS Console

1. Go to AWS Elastic Beanstalk Console
2. Create Application → "tuneslam-api"
3. Platform: Node.js 20
4. Upload `backend-deployment.zip`
5. Configure:
   - Instance type: t3.small
   - Environment variables (see below)

### AWS Environment Variables (Important!)

Set these in AWS Console → Configuration → Software → Environment properties:

```
NODE_ENV=production
JWT_SECRET=<strong-random-secret>
SESSION_COOKIE_SECRET=<another-strong-secret>
```

Other variables are loaded from `.env` file in the deployment package.

---

## Quick Commands

### Development (Local)

```bash
# Backend
cd backend && npm run dev
# Server: http://localhost:5000

# Admin Frontend
cd frontend/admin && npm run dev
# App: http://localhost:5173

# User Frontend
cd frontend/user && npm run dev
# App: http://localhost:5174

# Viewer Frontend
cd frontend/viewer && npm run dev
# App: http://localhost:5175
```

### Build All

```bash
# From project root
cd backend && npm run build
cd ../frontend/admin && npm run build
cd ../user && npm run build
cd ../viewer && npm run build
```

### Deploy All

```bash
# Backend
cd backend
npm run deploy:prepare
cd dist
eb deploy

# Frontends
cd ../../frontend/admin && npm run deploy
cd ../user && npm run deploy
cd ../viewer && npm run deploy
```

---

## Post-Deployment

### 1. Update OAuth Redirect URLs

**Spotify Developer Dashboard:**

Add these URLs to your Spotify app:
- `https://api.tuneslam.com/api/spotify/callback`
- `https://api.tuneslam.com/api/auth/spotify/callback`

**Facebook Developer Dashboard:**

Add:
- `https://api.tuneslam.com/api/auth/facebook/callback`

### 2. Configure CORS

AWS Elastic Beanstalk environment variables:

```env
ADMIN_URL=https://admin.tuneslam.com
USER_URL=https://tuneslam.com
VIEWER_URL=https://viewer.tuneslam.com
```

These are automatically used for CORS configuration.

### 3. SSL Certificates

**Cloudflare Pages:**
- Automatic HTTPS (included)

**AWS Elastic Beanstalk:**
1. Go to Configuration → Load Balancer
2. Add HTTPS listener (port 443)
3. Upload/request SSL certificate

### 4. MongoDB Atlas IP Whitelist

Add AWS Elastic Beanstalk IP addresses to MongoDB Atlas:

1. Find your EB environment IPs
2. MongoDB Atlas → Network Access
3. Add EB IPs to whitelist

Or use: `0.0.0.0/0` (allow all - less secure)

### 5. Test Health Checks

```bash
# Backend
curl https://api.tuneslam.com/health

# Frontends
curl https://admin.tuneslam.com
curl https://tuneslam.com
curl https://viewer.tuneslam.com
```

---

## Troubleshooting

### Frontend Issues

**Build Fails:**
```bash
# Clean and rebuild
rm -rf node_modules dist
npm install
npm run build
```

**Wrong API URL:**
- Check `.env.production` exists
- Verify `VITE_API_URL` is correct
- Rebuild after changes

**SPA Routes 404:**
- Verify `public/_redirects` exists
- Check Cloudflare Pages settings
- Ensure SPA mode is enabled

### Backend Issues

**Build Fails:**
```bash
# Make script executable
chmod +x backend/scripts/build-dist.js

# Run directly
node backend/scripts/build-dist.js
```

**Environment Variables Not Loading:**
- Check `.env.production` → `.env` rename in dist/
- Set critical vars in AWS Console
- Restart EB environment

**Socket.io Not Working:**
- Enable sticky sessions in Load Balancer
- Check WebSocket proxy config
- Verify CORS settings

### Database Connection Issues

**MongoDB:**
- Check connection string format
- Verify IP whitelist includes AWS IPs
- Test connection locally first

**Redis:**
- Verify host, port, password correct
- Check Redis Cloud firewall rules
- Test with redis-cli

---

## Security Checklist

Before going live:

- [ ] Generate strong `JWT_SECRET` (64+ chars)
- [ ] Generate strong `SESSION_COOKIE_SECRET` (64+ chars)
- [ ] Update all OAuth redirect URLs to production domains
- [ ] Enable HTTPS on all services
- [ ] Set environment variables in AWS Console (not .env file for secrets)
- [ ] Configure MongoDB Atlas IP whitelist
- [ ] Enable Cloudflare DDoS protection
- [ ] Set up database backups
- [ ] Enable CloudWatch logging
- [ ] Configure rate limiting
- [ ] Review CORS settings

---

## Build Output Reference

### Frontend (each)

```
dist/
├── index.html          (Entry point)
├── _redirects          (SPA routing)
└── assets/
    └── index.js        (~700KB, single file)
```

### Backend

```
dist/
├── src/                (Source code)
├── package.json        (Dependencies)
├── .env                (Production config)
├── .ebextensions/      (EB configuration)
├── Procfile            (Start command)
└── .gitignore
```

---

## Cost Estimates

### Monthly Costs (Estimated)

**Cloudflare Pages:**
- Free tier: Unlimited bandwidth
- Paid: $20/month for advanced features

**AWS Elastic Beanstalk:**
- t3.small instance: ~$15/month
- Load balancer: ~$15/month
- Data transfer: ~$5-20/month
- **Total: ~$35-50/month**

**External Services:**
- MongoDB Atlas: Free tier or $10+/month
- Redis Cloud: Free tier or $10+/month
- **Total external: $0-20/month**

**Grand Total: ~$35-70/month**

---

## CI/CD with GitHub Actions

Create `.github/workflows/deploy.yml`:

```yaml
name: Deploy to Production
on:
  push:
    branches: [main]

jobs:
  deploy-frontend:
    runs-on: ubuntu-latest
    strategy:
      matrix:
        app: [admin, user, viewer]
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3
        with:
          node-version: '20'
      
      - name: Deploy ${{ matrix.app }}
        run: |
          cd frontend/${{ matrix.app }}
          npm ci
          npm run deploy
        env:
          CLOUDFLARE_API_TOKEN: ${{ secrets.CLOUDFLARE_API_TOKEN }}

  deploy-backend:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3
        with:
          node-version: '20'
      
      - name: Build and deploy backend
        run: |
          cd backend
          npm ci
          npm run deploy:prepare
      
      - name: Deploy to EB
        uses: einaregilsson/beanstalk-deploy@v21
        with:
          aws_access_key: ${{ secrets.AWS_ACCESS_KEY_ID }}
          aws_secret_key: ${{ secrets.AWS_SECRET_ACCESS_KEY }}
          application_name: tuneslam-api
          environment_name: tuneslam-api-prod
          version_label: ${{ github.sha }}
          region: us-east-1
          deployment_package: backend/backend-deployment.zip
```

---

## Support

For detailed guides, see:
- **Frontend:** Check `frontend/*/README.md` if available
- **Backend:** See `backend/DEPLOY.md` for AWS specifics
- **API Docs:** See `backend/API_DOCUMENTATION.md`

---

**TuneSlam is ready for production!** 🚀

Your application will run on:
- **Admin:** https://admin.tuneslam.com
- **User:** https://tuneslam.com
- **Viewer:** https://viewer.tuneslam.com
- **API:** https://api.tuneslam.com
