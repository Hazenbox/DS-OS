# Convex Setup Instructions

## Issue
The Convex dev server isn't running because it requires interactive authentication.

## Solution

You need to initialize Convex manually in your terminal. Follow these steps:

### Step 1: Login to Convex
Open a terminal and run:
```bash
cd /Users/upendranath.kaki/Desktop/Codes/DS-OS-Secondary/DS-OS
npx convex login
```

This will open a browser window for you to authenticate with Convex (free account available).

### Step 2: Initialize Convex Dev Server
After logging in, run:
```bash
npx convex dev
```

This will:
- Initialize your Convex project
- Create a `.env.local` file with your `VITE_CONVEX_URL`
- Start the Convex dev server on port 3210

### Step 3: Start the Application
Once Convex is running, in a **new terminal window**, run:
```bash
cd /Users/upendranath.kaki/Desktop/Codes/DS-OS-Secondary/DS-OS
npm run dev:frontend
```

Or if you want to run both in the same terminal (after Convex is already running):
```bash
npm run dev
```

### Alternative: Run in Separate Terminals

**Terminal 1** (Convex backend):
```bash
cd /Users/upendranath.kaki/Desktop/Codes/DS-OS-Secondary/DS-OS
npm run dev:backend
```

**Terminal 2** (Vite frontend):
```bash
cd /Users/upendranath.kaki/Desktop/Codes/DS-OS-Secondary/DS-OS
npm run dev:frontend
```

## After Setup

Once Convex is initialized, the `.env.local` file will be created automatically. You can then add your Gemini API key if needed:

```env
GEMINI_API_KEY=your_gemini_api_key_here
```

The app will be available at: http://localhost:3000

