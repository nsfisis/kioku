# Kioku

Spaced repetition learning app (Anki clone). Full-stack TypeScript with Hono backend, React frontend, PostgreSQL database, and offline-first PWA support.

## Quick Reference

```bash
pnpm install              # Install dependencies
pnpm dev                  # Start backend server (hot reload)
pnpm dev:client           # Start frontend dev server (port 5173)
pnpm build                # Build both server and client
pnpm test                 # Run tests (Vitest)
pnpm check                # Run all checks (TypeScript + lint)
pnpm check:ts             # TypeScript type checking
pnpm check:lint           # Lint with Biome
pnpm format               # Format with Biome
pnpm db:generate          # Generate database migrations
pnpm db:migrate           # Run database migrations
pnpm db:push              # Push schema changes to DB
```

## Architecture

See [docs/dev/architecture.md](docs/dev/architecture.md) for details.

## Code Style

- **Formatter/Linter**: Biome (run `pnpm check:lint` to check, `pnpm format` to auto-format)
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

Check (lint + typecheck) → Test → Build (see `.github/workflows/ci.yaml`)
