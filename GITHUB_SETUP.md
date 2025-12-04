# GitHub Setup Guide

## What Gets Pushed to GitHub

### ✅ Will Be Committed:
- ✅ All source code (`convex/`, `components/`, `App.tsx`, etc.)
- ✅ Backend functions and schema (`convex/schema.ts`, `convex/auth.ts`, etc.)
- ✅ Configuration files (`package.json`, `tsconfig.json`, `vite.config.ts`)
- ✅ Documentation files
- ✅ Type definitions

### ❌ Will NOT Be Committed (gitignored):
- ❌ `.env.local` - Personal environment variables
- ❌ `.convex/` - Personal Convex project configuration
- ❌ `node_modules/` - Dependencies
- ❌ Build artifacts

## For Contributors

When a contributor clones the repo, they will:

1. **Get all the code** - including backend functions and schema
2. **Need to set up their own Convex account** - each contributor gets their own deployment
3. **Run `npx convex dev`** - this creates their own `.convex` and `.env.local`

## Why Each Contributor Needs Their Own Backend?

✅ **Isolated Development** - No conflicts between developers
✅ **Free Tier** - Each developer can use Convex's free tier
✅ **Independent Testing** - Test changes without affecting others
✅ **Easy Setup** - Just run `npx convex login` and `npx convex dev`

## Shared Production Deployment (Optional)

If you want a shared production deployment for the team:

1. One team member creates a Convex project
2. Share the production deployment URL
3. Contributors can use that URL in their `.env.local` for production testing
4. Each still uses their own local dev server for development

## Current Status

- ✅ Backend code (schema, functions) is in the repo
- ✅ Each contributor will set up their own Convex deployment
- ✅ `.env.local` and `.convex` are properly gitignored
- ✅ `.env.example` provides a template for contributors

## Ready to Push?

Your code is ready to push! Contributors will:
1. Clone the repo
2. Run `npm install`
3. Run `npx convex login` and `npx convex dev`
4. Start developing

The backend code is preserved in the repo, but each contributor gets their own isolated Convex deployment.

