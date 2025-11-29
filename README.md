# Kioku

A spaced repetition learning application (Anki clone) with PWA offline support and cloud sync.

## Features

- Spaced Repetition: FSRS algorithm for optimal learning scheduling
- Offline Support: Full PWA with IndexedDB local storage
- Cloud Sync: Automatic sync when online with conflict resolution
- Anki Import: Import existing .apkg decks from Anki

## Tech Stack

| Layer | Technology |
|-------|------------|
| Frontend | SvelteKit |
| Backend | Hono + TypeScript |
| Database | PostgreSQL |
| ORM | Drizzle |
| Client DB | Dexie.js (IndexedDB) |
| PWA | @vite-pwa/sveltekit |
| Algorithm | FSRS (ts-fsrs) |
| Auth | Username/password + JWT |
| Test | Vitest |
| Monorepo | pnpm workspace |

## Project Structure

```
kioku/
├── apps/
│   ├── web/        # SvelteKit frontend (PWA)
│   └── server/     # Hono backend API
└── packages/
    └── shared/     # Shared types and schemas
```

## Getting Started

### Prerequisites

- Node.js 22+
- pnpm 9+
- PostgreSQL 15+
- Docker (optional)

### Development

```bash
# Install dependencies
pnpm install

# Start PostgreSQL (with Docker)
docker compose up -d postgres

# Run database migrations
pnpm --filter server db:migrate

# Start development servers
pnpm dev
```

### Environment Variables

Create `.env` files in each app directory:

```apps/server/.env
DATABASE_URL=postgresql://user:password@localhost:5432/kioku
JWT_SECRET=your-secret-key
```

```apps/web/.env
PUBLIC_API_URL=http://localhost:3000
```

## Scripts

```bash
pnpm dev          # Start all apps in development
pnpm build        # Build all apps
pnpm test         # Run tests
pnpm lint         # Lint code
```

## Documentation

See [docs/dev/architecture.md](docs/dev/architecture.md) for detailed architecture documentation.

## License

MIT
