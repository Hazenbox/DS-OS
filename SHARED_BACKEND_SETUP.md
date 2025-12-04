# Setting Up a Shared Backend for All Contributors

## Overview

This guide will help you set up a **shared Convex backend** that all contributors can use without setting up their own Convex deployments.

## Step 1: Deploy to Convex Production

1. **Make sure you're logged in:**
   ```bash
   npx convex login
   ```

2. **Deploy your backend to production:**
   ```bash
   npx convex deploy --prod
   ```

   This will:
   - Deploy your Convex functions to production
   - Create a production deployment URL (e.g., `https://your-project.convex.cloud`)
   - Make it accessible to anyone with the URL

3. **Get your production deployment URL:**
   
   After deployment, Convex will show you the deployment URL. It will look like:
   ```
   https://your-project-name.convex.cloud
   ```

   You can also find it in:
   - The Convex dashboard: https://dashboard.convex.dev
   - Your `.env.local` file (if it was auto-updated)

## Step 2: Update Configuration Files

### Update `.env.example`:

Replace the localhost URL with your production URL:

```env
# Shared Convex Backend URL (Production)
# All contributors use this same URL - no setup needed!
VITE_CONVEX_URL=https://your-project-name.convex.cloud

# Optional: Gemini API Key for AI features
GEMINI_API_KEY=your_gemini_api_key_here
```

### Update `README.md`:

Change the setup instructions to use the shared backend.

## Step 3: Share with Contributors

Contributors now only need to:

1. Clone the repo
2. Run `npm install`
3. Copy `.env.example` to `.env.local`
4. Run `npm run dev:frontend` (no need for `npx convex dev`!)

## Benefits of Shared Backend

✅ **No Setup Required** - Contributors don't need Convex accounts
✅ **Shared Data** - Everyone sees the same data
✅ **Faster Onboarding** - Just clone and run
✅ **Consistent Environment** - Same backend for everyone

## Important Notes

⚠️ **Production Deployment:**
- All contributors will share the same database
- Changes by one contributor affect everyone
- Use this for development/testing, not for production apps with real users

⚠️ **Local Development (Optional):**
- Contributors can still run `npx convex dev` for local development
- They would need their own Convex account for this
- Use the shared URL for quick setup, local dev for isolated testing

## Updating the Shared Backend

When you make changes to backend functions:

1. Make your changes to `convex/*.ts` files
2. Deploy to production:
   ```bash
   npx convex deploy --prod
   ```
3. All contributors will automatically get the updates

## Team Access (Optional)

If you want to give team members access to manage the deployment:

1. Go to Convex Dashboard: https://dashboard.convex.dev
2. Navigate to your project
3. Go to Settings → Team
4. Invite team members by email

This allows them to:
- View the dashboard
- Deploy changes
- Manage the deployment

