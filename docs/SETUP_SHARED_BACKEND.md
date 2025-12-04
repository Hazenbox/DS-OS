# Setup Shared Backend for All Contributors

## Quick Setup (5 minutes)

Follow these steps to create a shared backend that all contributors can use:

### Step 1: Login to Convex

```bash
npx convex login
```

This will open your browser to authenticate. Use your existing Convex account or create a new one.

### Step 2: Deploy to Production

```bash
npx convex deploy
```

This will:
- Deploy your backend functions to Convex cloud
- Create a production deployment URL
- Make it accessible to all contributors

### Step 3: Get Your Production URL

After deployment, you'll see a URL like:
```
https://your-project-name.convex.cloud
```

You can also find it in:
- The deployment output
- Convex Dashboard: https://dashboard.convex.dev
- It will be saved in your `.env.local` automatically

### Step 4: Update `.env.example`

Edit `.env.example` and replace the URL with your production URL:

```env
# Shared Convex Backend URL (Production)
# All contributors use this same URL - no individual setup needed!
VITE_CONVEX_URL=https://your-project-name.convex.cloud

# Optional: Gemini API Key for AI features
GEMINI_API_KEY=your_gemini_api_key_here
```

### Step 5: Commit and Push

```bash
git add .env.example README.md CONTRIBUTING.md
git commit -m "Configure shared backend for contributors"
git push
```

## For Contributors

After you push, contributors will:

1. **Clone the repo**
2. **Run `npm install`**
3. **Copy `.env.example` to `.env.local`:**
   ```bash
   cp .env.example .env.local
   ```
4. **Run the app:**
   ```bash
   npm run dev:frontend
   ```

**That's it!** No need to:
- ❌ Run `npx convex login`
- ❌ Run `npx convex dev`
- ❌ Set up their own Convex account

## Benefits

✅ **Zero Setup** - Contributors just clone and run
✅ **Shared Data** - Everyone sees the same database
✅ **Faster Onboarding** - Minutes instead of hours
✅ **Consistent Environment** - Same backend for all

## Important Notes

⚠️ **Shared Database:**
- All contributors share the same data
- Changes by one person affect everyone
- Perfect for development/testing
- For production apps, consider user isolation

⚠️ **Updating the Backend:**
When you make changes to `convex/*.ts` files:
```bash
npx convex deploy
```
All contributors automatically get the updates!

## Alternative: Team Access

If you want team members to manage the deployment:

1. Go to https://dashboard.convex.dev
2. Navigate to your project
3. Settings → Team → Invite members

This allows them to deploy changes and manage the backend.

