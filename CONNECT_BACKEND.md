# Connect to Convex Backend

## Quick Setup Steps

### Step 1: Login to Convex
Open a terminal and run:
```bash
cd /Users/upendranath.kaki/Desktop/Codes/DS-OS-Secondary/DS-OS
npx convex login
```

This will:
- Open your browser for authentication
- Create a free Convex account if you don't have one
- Authenticate your CLI

### Step 2: Initialize Convex
After logging in, run:
```bash
npx convex dev
```

This will:
- Initialize your Convex project
- Create a `.convex` directory with configuration
- Create a `.env.local` file with your `VITE_CONVEX_URL`
- Start the Convex dev server on port 3210

**Keep this terminal running!** The Convex dev server needs to stay active.

### Step 3: Start the Frontend
In a **new terminal window**, run:
```bash
cd /Users/upendranath.kaki/Desktop/Codes/DS-OS-Secondary/DS-OS
npm run dev:frontend
```

Or you can run both together:
```bash
npm run dev
```

## What Happens Next

1. The Convex dev server will start on port 3210
2. Your frontend will connect to it automatically
3. The `.env.local` file will contain your deployment URL
4. You can now use all features that require the backend

## Troubleshooting

- **"Cannot prompt for input"**: You need to run `npx convex login` manually in your terminal
- **Port 3210 already in use**: Stop any existing Convex processes with `pkill -f convex`
- **Connection errors**: Make sure both Convex dev server and Vite are running

## Alternative: Run in Separate Terminals

**Terminal 1** (Convex backend):
```bash
npm run dev:backend
```

**Terminal 2** (Vite frontend):
```bash
npm run dev:frontend
```

