# Kioku Development Roadmap

## Phase 1: Foundation

### Project Setup
- [x] Create docs/dev/architecture.md
- [x] Create docs/dev/roadmap.md
- [ ] Initialize pnpm workspace
- [ ] Configure TypeScript
- [ ] Configure Biome
- [ ] Setup Vitest

### Database
- [ ] Docker Compose with PostgreSQL
- [ ] Drizzle ORM setup
- [ ] Database migrations

### Shared Package
- [ ] Create packages/shared
- [ ] Define types (User, Deck, Card, ReviewLog)
- [ ] Zod validation schemas

### Server Foundation
- [ ] Initialize Hono app
- [ ] Error handling middleware
- [ ] Logger middleware

### Authentication
- [ ] User registration endpoint
- [ ] Login endpoint (JWT)
- [ ] Refresh token endpoint
- [ ] Auth middleware

## Phase 2: Core Features

### Server API
- [ ] Deck CRUD endpoints
- [ ] Card CRUD endpoints
- [ ] ts-fsrs integration
- [ ] Study endpoints (get cards, submit review)

### Frontend Foundation
- [ ] Initialize SvelteKit
- [ ] Setup routing
- [ ] API client

### Auth UI
- [ ] Login page
- [ ] Register page
- [ ] Auth store

### Deck Management UI
- [ ] Deck list page
- [ ] Deck detail page
- [ ] Create/edit deck

### Card Management UI
- [ ] Card list view
- [ ] Create/edit card

### Study UI
- [ ] Study session page
- [ ] Card flip interaction
- [ ] Rating buttons (Again, Hard, Good, Easy)
- [ ] Progress display

## Phase 3: Offline Support

### IndexedDB
- [ ] Dexie.js setup
- [ ] Local schema (with sync flags)
- [ ] Local CRUD operations

### PWA
- [ ] @vite-pwa/sveltekit configuration
- [ ] Web manifest
- [ ] Service Worker
- [ ] Offline fallback

### Sync Engine
- [ ] Sync queue management
- [ ] Push implementation
- [ ] Pull implementation
- [ ] Conflict resolution
- [ ] Auto-sync on reconnect

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

### Import API
- [ ] POST /api/import/apkg
- [ ] Progress tracking

### Import UI
- [ ] File upload
- [ ] Import progress
- [ ] Import results

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
