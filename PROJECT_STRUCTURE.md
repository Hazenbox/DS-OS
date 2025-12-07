# Project Structure

This document describes the industry-standard structure of the DS-OS codebase.

## Directory Structure

```
DS-OS/
├── src/                    # Source code
│   ├── components/         # React components
│   ├── services/           # Service layer (API clients, utilities)
│   ├── types/              # TypeScript type definitions
│   ├── styles/             # Global styles and CSS
│   ├── App.tsx             # Main application component
│   └── index.tsx           # Application entry point
│
├── convex/                 # Convex backend
│   ├── _generated/         # Auto-generated Convex files
│   ├── auth.ts             # Authentication functions
│   ├── components.ts       # Component management
│   ├── schema.ts           # Database schema
│   └── ...                 # Other backend functions
│
├── docs/                   # Documentation
│   ├── README.md           # Documentation index
│   ├── CONTRIBUTING.md      # Contribution guidelines
│   └── ...                 # Other documentation files
│
├── scripts/                # Utility scripts
│   ├── setup-convex.js     # Convex setup script
│   └── *.sh                # Shell scripts
│
├── public/                 # Static assets (if any)
│
├── .env.example            # Environment variables template
├── .gitignore             # Git ignore rules
├── index.html              # HTML entry point
├── package.json            # Dependencies and scripts
├── README.md               # Main project documentation
├── tsconfig.json           # TypeScript configuration
├── vite.config.ts          # Vite configuration
└── tailwind.config.js      # Tailwind CSS configuration
```

## Key Directories

### `src/`
All application source code lives here. This follows industry standards for modern React/TypeScript projects.

- **`components/`**: React components organized by feature/domain
- **`services/`**: Business logic, API clients, and external service integrations
- **`types/`**: Shared TypeScript type definitions and interfaces
- **`styles/`**: Global CSS, theme variables, and style utilities

### `convex/`
Backend code for Convex database and functions. This directory is managed by Convex CLI.

### `docs/`
All project documentation is centralized here for easy discovery and maintenance.

### `scripts/`
Utility scripts for development, setup, and deployment tasks.

## Import Paths

The project uses path aliases for cleaner imports:

```typescript
// Use @ alias for src directory
import { Component } from '@/components/Component';
import { apiService } from '@/services/apiService';
import { User } from '@/types';
```

## Configuration Files

- **`vite.config.ts`**: Vite bundler configuration with path aliases
- **`tsconfig.json`**: TypeScript compiler configuration
- **`tailwind.config.js`**: Tailwind CSS configuration
- **`package.json`**: Dependencies and npm scripts

## Best Practices

1. **Components**: Keep components focused and reusable
2. **Services**: Encapsulate business logic and API calls
3. **Types**: Define shared types in `src/types/` to avoid duplication
4. **Styles**: Use Tailwind CSS classes; global styles go in `src/styles/`
5. **Documentation**: Keep docs up to date in `docs/` directory

