# Contributing to DS-OS

Thank you for your interest in contributing to DS-OS! This guide will help you set up the project locally.

## Initial Setup

### 1. Clone the Repository

```bash
git clone https://github.com/Hazenbox/DS-OS.git
cd DS-OS
```

### 2. Install Dependencies

```bash
npm install
```

### 3. Configure Environment Variables

Copy the example environment file:

```bash
cp .env.example .env.local
```

The `.env.example` file already contains the **shared backend URL**. No Convex setup needed!

Edit `.env.local` to add your optional API keys:

```env
# Shared Convex Backend URL (already configured - no setup needed!)
VITE_CONVEX_URL=https://your-project-name.convex.cloud

# Optional: Gemini API Key for AI features
GEMINI_API_KEY=your_gemini_api_key_here
```

### 4. Start the Development Server

The shared backend is already running in the cloud, so you only need to start the frontend:

```bash
npm run dev:frontend
```

**That's it!** No need to run `npx convex dev` or set up your own Convex account.

### 5. Open the Application

Navigate to [http://localhost:3000](http://localhost:3000)

On first load, you'll be prompted to:
1. Sign up / Login with email
2. Seed the database with initial data (optional)

## Important Notes

### Shared Backend Setup

**All contributors use the same backend:**
- ✅ No individual Convex setup required
- ✅ Shared database - everyone sees the same data
- ✅ Faster onboarding - just clone and run
- ✅ Consistent environment for all contributors

**What Gets Committed to Git:**

✅ **Committed:**
- All source code (`convex/`, `components/`, etc.)
- Schema definitions
- Backend functions
- Configuration files (package.json, tsconfig.json, etc.)
- `.env.example` with shared backend URL

❌ **NOT Committed (gitignored):**
- `.env.local` - Your personal environment variables (API keys, etc.)
- `.convex/` - Local Convex configuration (not needed with shared backend)
- `node_modules/` - Dependencies
- Build artifacts

### Updating the Shared Backend

When backend changes are made:
1. Changes are made to `convex/*.ts` files
2. Maintainer deploys: `npx convex deploy`
3. All contributors automatically get the updates (no action needed)

## Development Workflow

1. Create a feature branch
2. Make your changes
3. Test locally with your own Convex deployment
4. Commit and push your changes
5. Create a Pull Request

## Troubleshooting

### "Cannot prompt for input" Error
Run `npx convex login` manually in your terminal (requires interactive mode).

### Port 3210 Already in Use
Stop existing Convex processes:
```bash
pkill -f convex
```

### Connection Errors
- Ensure Convex dev server is running (`npm run dev:backend`)
- Check that `.env.local` has the correct `VITE_CONVEX_URL`
- Verify both backend and frontend are running

### Database Schema Changes
If you modify `convex/schema.ts`, Convex will automatically update your local database when you run `npx convex dev`.

## Questions?

Feel free to open an issue or reach out to the maintainers!

