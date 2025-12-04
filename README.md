<div align="center">
<img width="1200" height="475" alt="GHBanner" src="https://github.com/user-attachments/assets/0aa67016-6eaf-458a-adb2-6e31a0763ed6" />
</div>

# DS-OS: Design System Orchestrator

A powerful design system management platform with real-time persistence powered by [Convex](https://convex.dev).

## Features

- 🎨 **Token Manager** - Manage design tokens (colors, typography, spacing, etc.) with import/export
- 🤖 **AI Component Builder** - Generate React components using Google Gemini AI
- 📦 **Release Manager** - Orchestrate releases with CI/CD pipeline visualization
- 📊 **Dashboard** - Monitor design system health and activity
- ⚡ **Real-time Sync** - All changes sync instantly via Convex reactive database

## Tech Stack

- **Frontend**: React 19, TypeScript, Tailwind CSS
- **Database**: [Convex](https://convex.dev) - Reactive database with real-time sync
- **AI**: Google Gemini API for component generation
- **Icons**: Lucide React

## Getting Started

### Prerequisites

- Node.js 18+
- npm or yarn
- Convex account (free tier available)

### Installation

1. **Clone and install dependencies:**

```bash
git clone https://github.com/Hazenbox/DS-OS.git
cd DS-OS
npm install
```

2. **Configure Environment Variables:**

Copy the example file:

```bash
cp .env.example .env.local
```

The `.env.example` file contains the **shared backend URL** that all contributors use. No need to set up Convex individually!

Edit `.env.local` to add your optional API keys:

```env
# Shared Convex Backend URL (already configured)
VITE_CONVEX_URL=https://your-project-name.convex.cloud

# Optional: Gemini API Key for AI features
GEMINI_API_KEY=your_gemini_api_key_here
```

**Note:** The shared backend is already deployed and ready to use. Contributors don't need to run `npx convex dev` or set up their own Convex accounts!

Get your Gemini API key from [Google AI Studio](https://aistudio.google.com/).

3. **Run the app:**

```bash
# Start the frontend (backend is already deployed and shared)
npm run dev:frontend
```

The shared backend is already running in the cloud, so you only need to start the frontend!

4. **Open the app:**

Navigate to [http://localhost:3000](http://localhost:3000)

On first load, you'll be prompted to:
- Sign up / Login with email
- Seed the database with initial tokens and components (optional)

## Setting Up the Shared Backend (For Maintainers)

If you're setting up the shared backend for the first time, see [SETUP_SHARED_BACKEND.md](./SETUP_SHARED_BACKEND.md) for instructions.

## Project Structure

```
ds-os/
├── convex/                 # Convex backend
│   ├── schema.ts          # Database schema
│   ├── tokens.ts          # Token queries/mutations
│   ├── components.ts      # Component queries/mutations
│   ├── activity.ts        # Activity log
│   ├── releases.ts        # Release management
│   └── seed.ts            # Initial data seeding
├── components/            # React components
│   ├── Dashboard.tsx
│   ├── TokenManager.tsx
│   ├── ComponentBuilder.tsx
│   ├── ReleaseManager.tsx
│   └── ...
├── services/
│   └── geminiService.ts   # AI generation service
├── App.tsx                # Main app component
├── types.ts               # TypeScript types
└── index.tsx              # Entry point with ConvexProvider
```

## Database Schema

### Tokens
Design tokens with type, value, and optional brand support.

### Components
React components with status tracking (draft → review → stable → deprecated).

### Activity
Audit log of all changes across the system.

### Releases
Version management with changelog and status tracking.

## Self-Hosting Convex

You can also self-host Convex using Docker. See the [Convex self-hosting guide](https://docs.convex.dev/self-hosting) for details.

## Contributing

Contributions are welcome! Please see [CONTRIBUTING.md](./CONTRIBUTING.md) for detailed setup instructions.

**Important:** Each contributor needs their own Convex account and deployment. This ensures isolated development environments and prevents conflicts. See [CONTRIBUTING.md](./CONTRIBUTING.md) for details.

## License

MIT
