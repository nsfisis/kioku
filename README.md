# Kioku

A spaced repetition learning application (Anki clone) with PWA offline support and cloud sync.

## Features

- Spaced Repetition: FSRS algorithm for optimal learning scheduling
- Offline Support: Full PWA with IndexedDB local storage
- Cloud Sync: Automatic sync when online with conflict resolution
- Anki Import: Import existing .apkg decks from Anki

## Getting Started

### Prerequisites

- Node.js 22+
- pnpm 10+
- PostgreSQL 18+
- Docker
- Direnv (optional)

### Development

```bash
# Install dependencies
pnpm install

# Start containers
docker compose up

# Run database migrations
pnpm db:migrate

# Start development server
pnpm dev
```

### Environment Variables

Create `.env` file in the root directory:

```
DATABASE_URL=postgresql://user:password@localhost:5432/kioku
JWT_SECRET=your-secret-key
```

## Scripts

```bash
pnpm dev          # Start server in development
pnpm dev:client   # Start client in development
pnpm build        # Build all
pnpm test         # Run tests
pnpm lint         # Lint code
pnpm db:migrate   # Run database migrations
pnpm db:studio    # Open Drizzle Studio
```

## Documentation

See [docs/dev/architecture.md](docs/dev/architecture.md) for detailed architecture documentation.

## License

MIT
