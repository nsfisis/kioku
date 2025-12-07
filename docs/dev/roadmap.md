# Kioku Development Roadmap

Each feature is implemented end-to-end (backend to frontend) before moving to the next.
Smaller features first to enable early MVP validation.

---

## Phase 1: Foundation ✅

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
- [x] Docker Compose with PostgreSQL
- [x] Drizzle ORM setup
- [x] Database migrations

### Shared Package
- [x] Create pkgs/shared
- [x] Define types (User, Deck, Card, ReviewLog)
- [x] Zod validation schemas

### Authentication API
- [x] User registration endpoint
- [x] Login endpoint (JWT)
- [x] Refresh token endpoint
- [x] Auth middleware
- [x] Add tests
- [x] Define repository types and avoid direct use of DB

---

## Phase 2: Auth UI

**Goal**: Minimal UI for user login and registration

### Frontend Foundation
- [x] Initialize React + Vite
- [x] Setup routing
- [x] API client (fetch wrapper with auth headers)
- [x] Auth store (token management)

### Auth Pages
- [x] Register page
- [x] Login page
- [x] Protected route handling (redirect to login)
- [x] Add tests

**✅ Milestone**: Users can log in from the browser

---

## Phase 3: Deployment

### Docker
- [x] Dockerfile for server
- [x] Dockerfile for web (static build)
- [x] compose.yml (full stack)

### Documentation
- [x] README.md (setup, usage)

**✅ Milestone**: Ready for production deployment

---

## Phase 4: Deck Management

**Goal**: Create, edit, and delete decks

### Server API
- [x] Deck CRUD endpoints (GET, POST, PUT, DELETE)
- [x] Add tests

### Frontend
- [x] Deck list page (empty state, list view)
- [x] Create deck modal/form
- [ ] Edit deck
- [ ] Delete deck (with confirmation)
- [ ] Add tests

**✅ Milestone**: Users can create and manage decks

---

## Phase 5: Card Management

**Goal**: Create, edit, and delete cards

### Server API
- [ ] Card CRUD endpoints (GET, POST, PUT, DELETE)
- [ ] Add tests

### Frontend
- [ ] Card list view (in deck detail page)
- [ ] Create card form (front/back)
- [ ] Edit card
- [ ] Delete card
- [ ] Add tests

**✅ Milestone**: Users can create and manage cards

---

## Phase 6: Study Session (MVP Complete)

**Goal**: Study with FSRS algorithm

### Server API
- [ ] ts-fsrs integration
- [ ] GET /api/decks/:deckId/study - Get due cards
- [ ] POST /api/decks/:deckId/study/:cardId - Submit review
- [ ] Add tests

### Frontend
- [ ] Study session page
- [ ] Card flip interaction
- [ ] Rating buttons (Again, Hard, Good, Easy)
- [ ] Progress display (remaining cards)
- [ ] Session complete screen
- [ ] Add tests

**✅ Milestone**: MVP complete - basic study flow works

---

## Phase 7: PWA & Offline Support

**Goal**: Study offline

### PWA Setup
- [ ] vite-plugin-pwa configuration
- [ ] Web manifest
- [ ] Service Worker
- [ ] Offline fallback page
- [ ] Add tests

### IndexedDB (Local Storage)
- [ ] Dexie.js setup
- [ ] Local schema (with _synced flag)
- [ ] Local CRUD operations for Deck/Card/ReviewLog
- [ ] Add tests

### Sync Engine
- [ ] POST /api/sync/push endpoint
- [ ] GET /api/sync/pull endpoint
- [ ] Client: Sync queue management
- [ ] Client: Push implementation
- [ ] Client: Pull implementation
- [ ] Conflict resolution (Last-Write-Wins)
- [ ] Auto-sync on reconnect
- [ ] Add tests

### Sync UI
- [ ] Sync status indicator
- [ ] Manual sync button
- [ ] Offline mode indicator

**✅ Milestone**: Study offline and sync when back online

---

## Phase 8: Anki Import

**Goal**: Import existing Anki decks

### Parser
- [ ] ZIP extraction
- [ ] SQLite database reading
- [ ] Note/Card mapping to Kioku format
- [ ] Add tests

### Server API
- [ ] POST /api/import/apkg
- [ ] Progress tracking
- [ ] Add tests

### Frontend
- [ ] File upload component
- [ ] Import progress indicator
- [ ] Import results display
- [ ] Add tests

**✅ Milestone**: Anki users can migrate their decks

---

## Future Considerations

By priority:

1. **Statistics and analytics** - Visualize learning progress
2. **Keyboard shortcuts** - Improve study efficiency
3. **Tags and search** - Organize decks and cards
4. **Export functionality** - Data portability
5. **Multiple card types** - Cloze deletion, etc.
