# Kioku

A spaced repetition learning application (Anki clone).

![Kioku icon](./public/icon.svg)

> [!NOTE]
> Built with AI & Vibe Coding - This project is developed through collaborative coding with AI assistants.

## Features

- Spaced Repetition: FSRS algorithm for optimal learning scheduling
- Offline Support: Full PWA with IndexedDB local storage
- Cloud Sync: Automatic sync when online with conflict resolution
- CSV Import: Bulk import notes from CSV files

## Development Setup

### Prerequisites

- Node.js 22+
- pnpm 10+
- Docker (for PostgreSQL)

### Setup

```bash
# Install dependencies
pnpm install

# Copy environment variables
cp .env.example .env

# Start PostgreSQL
docker compose up db -d

# Run database migrations
docker compose exec server pnpm db:migrate

# Add a user
docker compose exec server pnpm user:add

# Start development servers (in separate terminals)
pnpm dev          # Backend server (port 3000)
pnpm dev:client   # Frontend dev server (port 5173)
```

### Environment Variables

| Variable | Description | Example |
|----------|-------------|---------|
| `POSTGRES_USER` | PostgreSQL username | `kioku` |
| `POSTGRES_PASSWORD` | PostgreSQL password | `kioku` |
| `POSTGRES_DB` | PostgreSQL database name | `kioku` |
| `POSTGRES_HOST` | PostgreSQL host | `kioku-db` |
| `POSTGRES_PORT` | PostgreSQL port | `5432` |
| `JWT_SECRET` | Secret key for JWT tokens (use a secure random string in production) | `your-secret-key` |

## Scripts

| Command | Description |
|---------|-------------|
| `pnpm dev` | Start backend server in development |
| `pnpm dev:client` | Start frontend dev server |
| `pnpm build` | Build both server and client |
| `pnpm start` | Start production server |
| `pnpm test` | Run tests |
| `pnpm typecheck` | Run TypeScript type checking |
| `pnpm lint` | Lint code with Biome |
| `pnpm lint:fix` | Lint and auto-fix issues |
| `pnpm db:migrate` | Run database migrations |
| `pnpm db:studio` | Open Drizzle Studio (database GUI) |
| `pnpm user:add` | Add a new user (interactive) |

## Docker

### Services

- **db**: PostgreSQL 18 database
- **server**: Node.js backend (Hono)
- **client**: Nginx serving the React frontend

### Commands

```bash
# Start all services
docker compose up -d

# View logs
docker compose logs -f

# Connect database
docker compose exec db psql -U kioku

# Stop all services
docker compose down

# Rebuild after code changes
docker compose up -d --build

# Add a user in production
docker compose exec server pnpm user:add
```

## Documentation

- [Features](docs/manual/features.md) - Feature list
- [Architecture](docs/dev/architecture.md) - System design and data models

## License

MIT
