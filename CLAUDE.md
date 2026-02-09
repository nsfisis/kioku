# Kioku

Spaced repetition learning app (Anki clone). Full-stack TypeScript with Hono backend, React frontend, PostgreSQL database, and offline-first PWA support.

## Quick Reference

```bash
pnpm install              # Install dependencies
pnpm dev                  # Start backend server (hot reload)
pnpm dev:client           # Start frontend dev server (port 5173)
pnpm build                # Build both server and client
pnpm test                 # Run tests (Vitest)
pnpm typecheck            # TypeScript type checking
pnpm lint                 # Lint with Biome
pnpm lint:fix             # Auto-fix lint issues
pnpm format               # Format with Biome
pnpm db:generate          # Generate database migrations
pnpm db:migrate           # Run database migrations
pnpm db:push              # Push schema changes to DB
```

## Architecture

- **Backend**: Hono on Node.js 22 (built with esbuild) — `src/server/`
- **Frontend**: React 19 + Vite — `src/client/`
- **Shared**: Common utilities — `src/shared/`
- **Database**: PostgreSQL with Drizzle ORM — schema in `src/server/db/`
- **Migrations**: SQL files in `drizzle/`

### Backend Structure (`src/server/`)

Repository pattern with dependency injection. Routes → Services → Repositories → Drizzle ORM.

- `routes/` — API endpoint handlers
- `repositories/` — Data access layer
- `middleware/` — Auth, CORS, error handling, rate limiting
- `schemas/` — Zod validation schemas
- `services/` — Business logic
- `types/` — TypeScript interfaces (includes repository interfaces)
- `db/schema.ts` — Drizzle database schema

### Frontend Structure (`src/client/`)

- `pages/` — Route-level page components
- `components/` — Reusable React components
- `atoms/` — Jotai state management atoms
- `api/` — API client
- `db/` — Dexie.js IndexedDB schema (offline storage)
- `sync/` — Sync engine (client ↔ server)
- `utils/` — Utilities (CSV parser, template renderer)

### Key Libraries

- **State**: Jotai (atoms suffixed with `Atom`)
- **Routing**: Wouter
- **Styling**: Tailwind CSS v4
- **Sync**: Automerge CRDT for conflict-free offline sync
- **Scheduling**: ts-fsrs (spaced repetition algorithm)
- **Validation**: Zod

## Code Style

- **Formatter/Linter**: Biome (run `pnpm lint` to check, `pnpm lint:fix` to auto-fix)
- **Indentation**: Tabs
- **Quotes**: Double quotes for JS/TS
- **Imports**: Organized by Biome (auto-sorted)
- **Naming**: PascalCase for components/types, camelCase for functions/variables, atoms suffixed with `Atom`
- **Tests**: Co-located with source files (`*.test.ts`, `*.test.tsx`)

## Database Conventions

- Soft deletes via `deletedAt` timestamp
- Sync versioning via `syncVersion` field
- All tables have `createdAt` and `updatedAt` timestamps with timezone

## Testing

Vitest with `@testing-library/react` for component tests. Tests run with:

```bash
pnpm test           # Single run
pnpm test:watch     # Watch mode
```

Test environment uses `JWT_SECRET=test-secret-key` and mock factories for test data. IndexedDB is mocked with `fake-indexeddb`.

## CI Pipeline

Lint → Typecheck → Test → Build (see `.github/workflows/ci.yaml`)
