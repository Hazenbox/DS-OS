# Deploy Shared Backend - Quick Guide

## One-Time Setup (5 minutes)

To set up a shared backend that all contributors can use:

### 1. Login to Convex

```bash
npx convex login
```

### 2. Deploy to Production

```bash
npx convex deploy
```

### 3. Get Your Production URL

After deployment, you'll see a URL like:
```
https://your-project-name.convex.cloud
```

### 4. Update `.env.example`

Replace `https://your-project-name.convex.cloud` in `.env.example` with your actual production URL.

### 5. Commit and Push

```bash
git add .env.example
git commit -m "Configure shared backend URL"
git push
```

## Done! 

Now all contributors can:
1. Clone the repo
2. Run `cp .env.example .env.local`
3. Run `npm run dev:frontend`

No individual Convex setup needed!

