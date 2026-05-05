# TuneSlam Backend - AWS Deployment Guide

## AWS Elastic Beanstalk Deployment

Complete guide for deploying the TuneSlam backend to AWS Elastic Beanstalk.

## Prerequisites

1. **AWS Account** with Elastic Beanstalk access
2. **AWS CLI** installed and configured
3. **EB CLI** installed (optional but recommended)

### Install EB CLI (Optional)

```bash
pip install awsebcli
```

## Environment Configuration

### Development vs Production

The backend now supports separate environment configurations:

**Local Development:**
- Uses `.env.development`
- Local/cloud databases
- Local frontend URLs
- ngrok URLs for OAuth callbacks

**AWS Production:**
- Uses `.env.production`
- Production MongoDB Atlas
- Production Redis
- Production frontend URLs (Cloudflare)
- Production domain OAuth callbacks

### Update Production Environment

Edit `backend/.env.production` with your production values:

```env
# Frontend URLs - Update with your Cloudflare deployments
ADMIN_URL=https://admin.tuneslam.com
USER_URL=https://tuneslam.com
VIEWER_URL=https://viewer.tuneslam.com

# Spotify Redirects - Update with AWS domain
SPOTIFY_REDIRECT_ADMIN_URI=https://api.tuneslam.com/api/spotify/callback
SPOTIFY_REDIRECT_USER_URI=https://api.tuneslam.com/api/auth/spotify/callback

# Facebook Callback - Update with AWS domain
FACEBOOK_CALLBACK_URL=https://api.tuneslam.com/api/auth/facebook/callback

# Security - Generate strong secrets
JWT_SECRET=generate-a-strong-random-secret-here
SESSION_COOKIE_SECRET=generate-another-strong-random-secret
```

## Building for Deployment

### Step 1: Build Distribution Package

```bash
cd backend
npm run build
```

This script (`scripts/build-dist.js`):
- Creates `dist/` folder
- Copies all source code
- Copies `package.json`
- Copies `.env.production` as `.env`
- Copies `.ebextensions/` configuration
- Creates `Procfile`

**Output:**
```
dist/
├── src/                 (All source code)
├── package.json         (Dependencies)
├── .env                 (Production config)
├── .ebextensions/       (EB configuration)
├── Procfile             (Start command)
└── .gitignore
```

### Step 2: Create Deployment ZIP

```bash
npm run package
```

Creates `backend-deployment.zip` ready for upload.

**Or do both at once:**
```bash
npm run deploy:prepare
```

## Deployment Methods

### Method 1: EB CLI (Recommended)

**First Time Setup:**

```bash
cd backend/dist

# Initialize EB application
eb init

# Select:
# - Region: us-east-1 (or your preferred region)
# - Application name: tuneslam-api
# - Platform: Node.js 20.x
# - SSH: Yes (optional)

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

### Method 2: AWS Console Upload

**First Time:**

1. Go to AWS Elastic Beanstalk Console
2. Click "Create Application"
3. **Application name:** tuneslam-api
4. **Platform:** Node.js 20
5. **Application code:** Upload `backend-deployment.zip`
6. Click "Create application"

**Updates:**

1. Go to your EB application
2. Click "Upload and deploy"
3. Upload new `backend-deployment.zip`
4. Click "Deploy"

### Method 3: GitHub Actions CI/CD

Create `.github/workflows/deploy-backend.yml`:

```yaml
name: Deploy Backend to AWS
on:
  push:
    branches: [main]
    paths:
      - 'backend/**'

jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      
      - uses: actions/setup-node@v3
        with:
          node-version: '20'
      
      - name: Build deployment package
        run: |
          cd backend
          npm run build
          npm run package
      
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

## Configuration

### Elastic Beanstalk Configuration Files

**`.ebextensions/nodejs.config`:**
- Node.js version: 20.x
- Start command: `npm start`
- Environment: production

**`.ebextensions/environment.config`:**
- WebSocket support for Socket.io
- Nginx configuration
- Health check endpoint
- Instance type: t3.small
- Timeout settings for long connections

### Environment Variables in AWS

**Important Security Note:** Sensitive values should be set in AWS Console, not in `.env.production` file:

1. Go to EB Console → Configuration → Software
2. Add environment variables:
   - `JWT_SECRET` → Strong random string
   - `SESSION_COOKIE_SECRET` → Strong random string
   - Any other sensitive values

These override `.env` file values.

## Post-Deployment Configuration

### 1. Update Spotify Developer Dashboard

Add AWS callback URLs to your Spotify app:
- `https://api.tuneslam.com/api/spotify/callback`
- `https://api.tuneslam.com/api/auth/spotify/callback`

### 2. Update Facebook Developer Dashboard

Add AWS callback URL:
- `https://api.tuneslam.com/api/auth/facebook/callback`

### 3. Configure Custom Domain

**In AWS:**
1. EB Console → Configuration → Load balancer
2. Add listener: HTTPS (port 443)
3. SSL certificate: Request/upload certificate

**DNS (Route 53 or Cloudflare):**
```
api.tuneslam.com → CNAME → your-eb-url.elasticbeanstalk.com
```

### 4. Enable HTTPS Redirect

Update `.ebextensions/https-redirect.config`:

```yaml
files:
  "/etc/nginx/conf.d/https-redirect.conf":
    mode: "000644"
    owner: root
    group: root
    content: |
      if ($http_x_forwarded_proto != 'https') {
        return 301 https://$host$request_uri;
      }
```

## Monitoring & Logs

### View Logs

**Using EB CLI:**
```bash
eb logs
eb logs --stream  # Real-time
```

**Using AWS Console:**
1. EB Console → Logs
2. Request logs or stream logs

### Health Monitoring

**Health Check Endpoint:**
```
GET https://api.tuneslam.com/health
```

**Response:**
```json
{
  "status": "ok",
  "timestamp": "2026-05-05T01:00:00.000Z"
}
```

## Scaling

### Auto-Scaling Configuration

**EB Console → Configuration → Capacity:**

- **Environment type:** Load balanced
- **Min instances:** 1
- **Max instances:** 4
- **Instance type:** t3.small
- **Scaling triggers:** CPU > 70%

### WebSocket Considerations

Socket.io requires:
- **Sticky sessions** enabled (for WebSocket)
- **Application Load Balancer** (not Classic)

## Troubleshooting

### Build Issues

```bash
# Make script executable
chmod +x backend/scripts/build-dist.js

# Run build directly
node backend/scripts/build-dist.js
```

### Deployment Fails

Check EB logs:
```bash
eb logs
```

Common issues:
- Missing dependencies in package.json
- Wrong Node.js version
- Environment variables not set
- MongoDB/Redis connection issues

### Socket.io Not Working

1. Verify WebSocket proxy config in `.ebextensions/environment.config`
2. Check Load Balancer has sticky sessions enabled
3. Verify CORS allows your frontend domains

### Environment Variables Not Loading

1. Check `.env` file is in dist root
2. Verify `dotenv` is loaded first in server.js
3. Set critical variables in EB Console → Configuration

## Development Workflow

**Local Development:**
```bash
cd backend
npm run dev
# Uses .env.development
# Server: http://localhost:5000
```

**Test Production Build Locally:**
```bash
npm run build
cd dist
npm install
NODE_ENV=production npm start
```

**Deploy to AWS:**
```bash
npm run deploy:prepare
cd dist
eb deploy
```

## Cost Estimates

**Minimum Configuration:**
- t3.small instance: ~$15/month
- Load balancer: ~$15/month
- Data transfer: Variable
- **Total:** ~$30-50/month

**With Auto-Scaling (2-4 instances):**
- Instances: ~$30-60/month
- Load balancer: ~$15/month
- **Total:** ~$45-75/month

Plus external services:
- MongoDB Atlas: Free tier or ~$10+/month
- Redis Cloud: Free tier or ~$10+/month

## Security Checklist

Before deploying to production:

- [ ] Changed `JWT_SECRET` to strong random value
- [ ] Changed `SESSION_COOKIE_SECRET` to strong random value
- [ ] Updated all OAuth callback URLs
- [ ] Enabled HTTPS
- [ ] Set environment variables in AWS Console (not .env file)
- [ ] Configured security groups (only required ports open)
- [ ] Set up MongoDB Atlas IP whitelist
- [ ] Enabled CloudWatch logging

## Quick Reference

**Build:**
```bash
cd backend && npm run build
```

**Package:**
```bash
npm run package
```

**Deploy:**
```bash
npm run deploy:prepare && cd dist && eb deploy
```

---

**Ready for AWS Elastic Beanstalk!** 🚀

Your backend will be deployed with WebSocket support, health checks, and production environment configuration.
