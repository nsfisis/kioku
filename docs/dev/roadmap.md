# Kioku Development Roadmap

## Phase 1: Foundation

### Project Setup
- [x] Create docs/dev/architecture.md
- [x] Create docs/dev/roadmap.md
- [x] Initialize pnpm workspace
- [x] Configure TypeScript
- [x] Configure Biome

### Server Foundation
- [x] Initialize Hono app
- [x] Setup Vitest
- [x] Add simple test to test that Hono works
- [x] Error handling middleware
- [x] Logger middleware

### Database
- [ ] Docker Compose with PostgreSQL
- [ ] Drizzle ORM setup
- [ ] Database migrations

### Shared Package
- [ ] Create pkgs/shared
- [ ] Define types (User, Deck, Card, ReviewLog)
- [ ] Zod validation schemas

### Authentication
- [ ] User registration endpoint
- [ ] Login endpoint (JWT)
- [ ] Refresh token endpoint
- [ ] Auth middleware
- [ ] Add tests

## Phase 2: Core Features

### Server API
- [ ] Deck CRUD endpoints
- [ ] Add tests
- [ ] Card CRUD endpoints
- [ ] Add tests
- [ ] ts-fsrs integration
- [ ] Add tests
- [ ] Study endpoints (get cards, submit review)
- [ ] Add tests

### Frontend Foundation
- [ ] Initialize SvelteKit
- [ ] Setup routing
- [ ] API client
- [ ] Add tests

### Auth UI
- [ ] Login page
- [ ] Add UI tests
- [ ] Register page
- [ ] Add UI tests
- [ ] Auth store
- [ ] Add UI tests

### Deck Management UI
- [ ] Deck list page
- [ ] Add UI tests
- [ ] Deck detail page
- [ ] Add UI tests
- [ ] Create/edit deck
- [ ] Add UI tests

### Card Management UI
- [ ] Card list view
- [ ] Add UI tests
- [ ] Create/edit card
- [ ] Add UI tests

### Study UI
- [ ] Study session page
- [ ] Add UI tests
- [ ] Card flip interaction
- [ ] Add UI tests
- [ ] Rating buttons (Again, Hard, Good, Easy)
- [ ] Add UI tests
- [ ] Progress display
- [ ] Add UI tests

## Phase 3: Offline Support

### IndexedDB
- [ ] Dexie.js setup
- [ ] Local schema (with sync flags)
- [ ] Local CRUD operations
- [ ] Add tests

### PWA
- [ ] @vite-pwa/sveltekit configuration
- [ ] Web manifest
- [ ] Service Worker
- [ ] Offline fallback
- [ ] Add tests

### Sync Engine
- [ ] Sync queue management
- [ ] Add tests
- [ ] Push implementation
- [ ] Add tests
- [ ] Pull implementation
- [ ] Add tests
- [ ] Conflict resolution
- [ ] Add tests
- [ ] Auto-sync on reconnect
- [ ] Add tests

### Sync API
- [ ] POST /api/sync/push
- [ ] GET /api/sync/pull

### Sync UI
- [ ] Sync status indicator
- [ ] Manual sync button
- [ ] Offline mode indicator

## Phase 4: Anki Import

### Parser
- [ ] ZIP extraction
- [ ] SQLite database reading
- [ ] Note/Card mapping
- [ ] Add tests

### Import API
- [ ] POST /api/import/apkg
- [ ] Progress tracking
- [ ] Add tests

### Import UI
- [ ] File upload
- [ ] Import progress
- [ ] Import results
- [ ] Add tests

## Phase 5: Deployment

### Docker
- [ ] Dockerfile for server
- [ ] Dockerfile for web (static build)
- [ ] compose.yml (full stack)

### Production
- [ ] Environment configuration
- [ ] Backup strategy

### Documentation
- [ ] README.md

## Future Considerations

- Statistics and analytics
- Export functionality
- Multiple card types
- Tags and search
- Keyboard shortcuts
