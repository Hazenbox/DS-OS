# Fixing "TypeError: fetch failed" with Convex Token

## The Problem
When trying to use the Convex token, you're getting a `TypeError: fetch failed` error. This is typically caused by SSL certificate verification issues.

## Solution 1: Use the Fixed Script (Recommended)

Run the provided script that bypasses SSL verification:

```bash
./start-convex-fixed.sh
```

This script sets `NODE_TLS_REJECT_UNAUTHORIZED=0` which allows Node.js to bypass SSL certificate verification.

## Solution 2: Manual Command

Run this command directly in your terminal:

```bash
cd /Users/upendranath.kaki/Desktop/Codes/DS-OS-Secondary/DS-OS
NODE_TLS_REJECT_UNAUTHORIZED=0 npx convex dev
```

## Solution 3: Use Existing Deployment URL

If you already have a Convex deployment URL, you can skip the dev server and use the production URL directly:

1. Get your deployment URL from the Convex dashboard (https://dashboard.convex.dev)
2. Update `.env.local`:
   ```env
   VITE_CONVEX_URL=https://your-deployment-name.convex.cloud
   ```
3. Restart your frontend - no need to run `convex dev`

## Solution 4: Fix SSL Certificates (Long-term)

If you want to properly fix SSL issues:

1. Update your Node.js certificates:
   ```bash
   npm config set ca ""
   ```
2. Or update your system certificates
3. Then try `npx convex dev` again

## Current Setup

- ✅ `.env.local` is configured with `VITE_CONVEX_URL=http://localhost:3210`
- ✅ Frontend is ready to connect
- ⚠️ Backend needs to be started with SSL workaround

## Quick Start

```bash
# Terminal 1: Start Convex backend (with SSL fix)
./start-convex-fixed.sh

# Terminal 2: Start frontend (if not already running)
npm run dev:frontend
```

## Note

The `NODE_TLS_REJECT_UNAUTHORIZED=0` setting is a workaround for development. In production, you should properly configure SSL certificates.

