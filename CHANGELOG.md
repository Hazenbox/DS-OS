# Changelog

## [Unreleased] - Codebase Restructure

### Changed
- **Restructured codebase to industry standards**
  - Moved all source code to `src/` directory
  - Organized components into `src/components/`
  - Moved services to `src/services/`
  - Centralized types in `src/types/`
  - Moved styles to `src/styles/`
  
- **Documentation organization**
  - Consolidated all documentation into `docs/` directory
  - Removed duplicate documentation files
  - Created `docs/README.md` as documentation index
  
- **Scripts organization**
  - Moved all utility scripts to `scripts/` directory
  - Organized shell scripts and setup scripts
  
- **Configuration updates**
  - Updated `vite.config.ts` with proper path aliases (`@` → `src`)
  - Updated `tsconfig.json` to reflect new structure
  - Updated `index.html` to point to new entry point
  - Added `src/vite-env.d.ts` for Vite type definitions

### Fixed
- Fixed all import paths to work with new structure
- Fixed TypeScript type errors
- Improved type safety with proper Vite environment types

### Added
- `PROJECT_STRUCTURE.md` - Documentation of project structure
- `docs/README.md` - Documentation index
- `src/vite-env.d.ts` - Vite environment type definitions

