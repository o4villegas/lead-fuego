# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

This is a full-stack React application template built with:
- **React 19** + **TypeScript** for the frontend
- **Hono** web framework for API routes
- **Vite** for build tooling and development
- **Cloudflare Workers** for edge deployment

## Architecture

The project follows a dual-build architecture:

### Frontend (`src/react-app/`)
- Standard React app with TypeScript
- Built with Vite and deployed as static assets
- Main entry point: `src/react-app/main.tsx`
- App component: `src/react-app/App.tsx`

### Backend (`src/worker/`)
- Hono-based API running on Cloudflare Workers
- Entry point: `src/worker/index.ts`
- API routes prefixed with `/api/`
- Serves both API endpoints and static React assets

### Build Process
- React app builds to `dist/client/`
- Worker builds separately with TypeScript compilation
- Wrangler deploys worker with assets configuration pointing to built React app

## Common Commands

### Development
```bash
npm run dev          # Start Vite dev server (http://localhost:5173)
```

### Building and Testing
```bash
npm run build        # Build both React app and worker (tsc -b && vite build)
npm run check        # Full check: compile, build, and dry-run deploy
npm run preview      # Build and preview locally
```

### Linting and Type Checking
```bash
npm run lint         # Run ESLint
npm run cf-typegen   # Generate Cloudflare Worker types
```

### Deployment
```bash
npm run deploy       # Deploy to Cloudflare Workers
```

## Configuration Files

- `wrangler.json`: Cloudflare Workers configuration
- `vite.config.ts`: Vite build configuration with Cloudflare plugin
- `eslint.config.js`: ESLint configuration for TypeScript/React
- Multiple `tsconfig.*.json` files for different build targets (app, worker, node)

## Development Notes

- The worker serves both API routes and the React SPA
- Assets are configured for single-page-application routing
- API calls from React should use relative paths (e.g., `/api/`)
- Hot module replacement works in development via Vite