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
- [x] Edit deck
- [x] Delete deck (with confirmation)
- [x] Add tests

**✅ Milestone**: Users can create and manage decks

---

## Phase 5: Card Management

**Goal**: Create, edit, and delete cards

### Server API
- [x] Card CRUD endpoints (GET, POST, PUT, DELETE)
- [x] Add tests

### Frontend
- [x] Card list view (in deck detail page)
- [x] Create card form (front/back)
- [x] Edit card
- [x] Delete card
- [x] Add tests

**✅ Milestone**: Users can create and manage cards

---

## Phase 6: Study Session (MVP Complete)

**Goal**: Study with FSRS algorithm

### Server API
- [x] ts-fsrs integration
- [x] GET /api/decks/:deckId/study - Get due cards
- [x] POST /api/decks/:deckId/study/:cardId - Submit review
- [x] Add tests

### Frontend
- [x] Study session page
- [x] Card flip interaction
- [x] Rating buttons (Again, Hard, Good, Easy)
- [x] Progress display (remaining cards)
- [x] Session complete screen
- [x] Add tests

**✅ Milestone**: MVP complete - basic study flow works

---

## Phase 7: PWA & Offline Support

**Goal**: Study offline

### PWA Setup
- [x] vite-plugin-pwa configuration
- [x] Web manifest
- [x] Service Worker
- [x] Offline fallback page
- [x] Add tests

### IndexedDB (Local Storage)
- [x] Dexie.js setup
- [x] Local schema (with _synced flag)
- [x] Local CRUD operations for Deck/Card/ReviewLog
- [x] Add tests

### Sync Engine
- [x] POST /api/sync/push endpoint
- [x] GET /api/sync/pull endpoint
- [x] Client: Sync queue management
- [x] Client: Push implementation
- [x] Client: Pull implementation
- [x] Conflict resolution (Last-Write-Wins)
- [x] Auto-sync on reconnect
- [x] Add tests

### Sync UI
- [x] Sync status indicator
- [x] Manual sync button
- [x] Offline mode indicator

**✅ Milestone**: Study offline and sync when back online

---

## Phase 8: Anki Import

**Goal**: Import existing Anki decks (.apkg, .colpkg)

### Parser
- [x] ZIP extraction
- [x] SQLite database reading
- [x] Note/Card mapping to Kioku format
- [x] Add tests

### Server command
- [ ] Add `src/server/scripts/import-anki.ts`

**✅ Milestone**: Anki users can migrate their decks

---

## Future Considerations

By priority:

1. **Statistics and analytics** - Visualize learning progress
2. **Keyboard shortcuts** - Improve study efficiency
3. **Tags and search** - Organize decks and cards
4. **Export functionality** - Data portability
5. **Multiple card types** - Cloze deletion, etc.
