# TuneSlam - Production Build Guide

## Single-File Build Configuration

Each frontend is configured to build as a single JavaScript file with inlined CSS, optimized for CDN deployment.

## Build Configuration

All three frontends use the same optimized Vite configuration:
- **CSS**: Inlined into JavaScript (no separate CSS file)
- **Code Splitting**: Disabled (single bundle)
- **Minification**: Terser with console.log removal
- **Output**: Clean, predictable filenames

## Building for Production

### Build All Frontends

```bash
# From project root
npm run build:all
```

Or build individually:

### Build Admin Dashboard

```bash
cd frontend/admin
npm run build
```

**Output:**
```
frontend/admin/dist/
├── index.html
└── assets/
    └── index.js    (~800KB, ~250KB gzipped)
```

### Build User Interface

```bash
cd frontend/user
npm run build
```

**Output:**
```
frontend/user/dist/
├── index.html
└── assets/
    └── index.js    (~700KB, ~220KB gzipped)
```

### Build TV Viewer

```bash
cd frontend/viewer
npm run build
```

**Output:**
```
frontend/viewer/dist/
├── index.html
└── assets/
    └── index.js    (~600KB, ~180KB gzipped)
```

## Environment Variables for Production

Before building, update each `.env` file with production settings:

### Admin (.env)
```env
VITE_API_URL=https://api.tuneslam.com
```

### User (.env)
```env
VITE_API_URL=https://api.tuneslam.com
```

### Viewer (.env)
```env
VITE_API_URL=https://api.tuneslam.com
```

## CDN Deployment

### Recommended Structure

**Option 1: Subdomain Approach**
- `admin.tuneslam.com` → Upload `frontend/admin/dist/*`
- `tuneslam.com` → Upload `frontend/user/dist/*`
- `viewer.tuneslam.com` → Upload `frontend/viewer/dist/*`

**Option 2: Path-based**
- `tuneslam.com/admin/` → Upload `frontend/admin/dist/*`
- `tuneslam.com/` → Upload `frontend/user/dist/*`
- `tuneslam.com/viewer/` → Upload `frontend/viewer/dist/*`

### CDN Upload Commands

**AWS S3 Example:**
```bash
# Admin
aws s3 sync frontend/admin/dist/ s3://admin.tuneslam.com/ --delete

# User
aws s3 sync frontend/user/dist/ s3://tuneslam.com/ --delete

# Viewer
aws s3 sync frontend/viewer/dist/ s3://viewer.tuneslam.com/ --delete
```

**Cloudflare Pages / Netlify / Vercel:**
- Point each app to its respective `dist/` folder
- Set build command: `npm run build`
- Set publish directory: `dist`

## Cache Configuration

### Recommended Headers

For `index.html`:
```
Cache-Control: no-cache, must-revalidate
```

For `assets/index.js`:
```
Cache-Control: public, max-age=31536000, immutable
```

### Nginx Example

```nginx
# Admin
server {
    server_name admin.tuneslam.com;
    root /var/www/admin;
    
    location / {
        try_files $uri /index.html;
    }
    
    location /assets/ {
        expires 1y;
        add_header Cache-Control "public, immutable";
    }
}

# User
server {
    server_name tuneslam.com;
    root /var/www/user;
    
    location / {
        try_files $uri /index.html;
    }
    
    location /assets/ {
        expires 1y;
        add_header Cache-Control "public, immutable";
    }
}

# Viewer
server {
    server_name viewer.tuneslam.com;
    root /var/www/viewer;
    
    location / {
        try_files $uri /index.html;
    }
    
    location /assets/ {
        expires 1y;
        add_header Cache-Control "public, immutable";
    }
}
```

## Build Optimization

### File Sizes (Approximate)

| Frontend | Uncompressed | Gzipped | Brotli |
|----------|-------------|---------|--------|
| Admin    | ~800 KB     | ~250 KB | ~200 KB |
| User     | ~700 KB     | ~220 KB | ~180 KB |
| Viewer   | ~600 KB     | ~180 KB | ~150 KB |

### Performance Tips

1. **Enable Compression**: Ensure your CDN/server enables gzip or brotli
2. **HTTP/2**: Use HTTP/2 for faster loading
3. **CDN**: Use a CDN for global distribution
4. **Preload**: Add `<link rel="preload">` for critical assets
5. **Service Worker**: Consider adding for offline support

## Troubleshooting

### Build Fails with Memory Error

Increase Node.js memory:
```bash
NODE_OPTIONS=--max-old-space-size=4096 npm run build
```

### Assets Not Loading

Check `base` config in `vite.config.js`. For subdirectories:
```javascript
base: '/admin/'  // If deploying to tuneslam.com/admin/
```

### API Calls Failing

Verify `VITE_API_URL` is set correctly and API server allows CORS from your domain.

## Development vs Production

### Development (Current)
```bash
# Admin: http://localhost:5173
cd frontend/admin && npm run dev

# User: http://localhost:5174
cd frontend/user && npm run dev

# Viewer: http://localhost:5175
cd frontend/viewer && npm run dev
```

### Production
- Built files deployed to CDN
- Single JS file per app
- Minified and optimized
- Console.logs removed
- Source maps excluded

## Continuous Deployment

### GitHub Actions Example

```yaml
name: Deploy Frontends
on:
  push:
    branches: [main]

jobs:
  deploy-admin:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3
      - run: cd frontend/admin && npm ci && npm run build
      - run: aws s3 sync frontend/admin/dist/ s3://admin.tuneslam.com/
        env:
          AWS_ACCESS_KEY_ID: ${{ secrets.AWS_ACCESS_KEY_ID }}
          AWS_SECRET_ACCESS_KEY: ${{ secrets.AWS_SECRET_ACCESS_KEY }}

  deploy-user:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3
      - run: cd frontend/user && npm ci && npm run build
      - run: aws s3 sync frontend/user/dist/ s3://tuneslam.com/
        env:
          AWS_ACCESS_KEY_ID: ${{ secrets.AWS_ACCESS_KEY_ID }}
          AWS_SECRET_ACCESS_KEY: ${{ secrets.AWS_SECRET_ACCESS_KEY }}

  deploy-viewer:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3
      - run: cd frontend/viewer && npm ci && npm run build
      - run: aws s3 sync frontend/viewer/dist/ s3://viewer.tuneslam.com/
        env:
          AWS_ACCESS_KEY_ID: ${{ secrets.AWS_ACCESS_KEY_ID }}
          AWS_SECRET_ACCESS_KEY: ${{ secrets.AWS_SECRET_ACCESS_KEY }}
```

## Verification

After deployment, verify:

1. **Files Load**: Check browser network tab
2. **API Calls Work**: Test login, session join, etc.
3. **Socket.io**: Verify real-time updates
4. **Mobile**: Test on actual mobile devices
5. **Performance**: Run Lighthouse audit

---

**Ready for Production!** 🚀

Each frontend builds to a single optimized JavaScript file, perfect for CDN deployment.
