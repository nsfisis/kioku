# Kioku Architecture

## Tech Stack

| Layer | Technology |
|-------|------------|
| Frontend | React + Vite |
| Backend | Hono + TypeScript |
| Database | PostgreSQL |
| ORM | Drizzle |
| Client DB | Dexie.js (IndexedDB) |
| PWA | vite-plugin-pwa |
| Algorithm | FSRS (ts-fsrs) |
| Auth | username/password + JWT |
| Test | Vitest |
| Deploy | Docker + VPS |

## Architecture Diagram

```
+--------------------------------------------------+
|                  Client (PWA)                    |
|  +-------------+  +------------+  +------------+ |
|  |    React    |  |  Dexie.js  |  |  Service   | |
|  |     UI      |<>| (IndexedDB)|<>|   Worker   | |
|  +-------------+  +------------+  +------------+ |
|        |               |                         |
|        +-------+-------+                         |
|                |                                 |
|         +------v------+                          |
|         | Sync Engine |                          |
|         +-------------+                          |
+--------------------------------------------------+
                    |
                    v HTTPS (REST API)
+--------------------------------------------------+
|                    Server                        |
|  +----------------------------------------------+|
|  |              Hono (TypeScript)               ||
|  |  +--------+ +--------+ +--------+ +--------+ ||
|  |  |  Auth  | |  FSRS  | |  Sync  | | Import | ||
|  |  +--------+ +--------+ +--------+ +--------+ ||
|  +----------------------------------------------+|
|                       |                          |
|                       v                          |
|  +----------------------------------------------+|
|  |            PostgreSQL (Drizzle)              ||
|  +----------------------------------------------+|
+--------------------------------------------------+
```

## Project Structure

```
kioku/
├── src/
│   ├── server/               # Hono backend
│   │   ├── index.ts
│   │   ├── db/               # Drizzle schema
│   │   ├── middleware/
│   │   ├── repositories/
│   │   ├── routes/
│   │   ├── types/            # Server types
│   │   ├── schemas/          # Zod validation
│   │   └── lib/
│   │       └── apkg/         # Anki import
│   └── client/               # React frontend
│       ├── index.tsx
│       ├── components/
│       ├── stores/
│       ├── db/               # Dexie IndexedDB
│       ├── sync/             # Sync engine
│       ├── types/            # Client types
│       └── api/
├── drizzle/                  # Drizzle migrations
├── public/                   # Static files (PWA manifest)
├── package.json
├── tsconfig.json
├── vite.config.ts
├── drizzle.config.ts
└── compose.yaml
```

## Data Models

### User

```typescript
interface User {
  id: string;          // UUID
  username: string;    // unique
  password_hash: string;
  created_at: Date;
  updated_at: Date;
}
```

### Deck

```typescript
interface Deck {
  id: string;
  user_id: string;
  name: string;
  description: string | null;
  new_cards_per_day: number;
  created_at: Date;
  updated_at: Date;
  deleted_at: Date | null;    // Soft delete
  sync_version: number;
}
```

### Card (FSRS)

```typescript
enum CardState {
  New = 0,
  Learning = 1,
  Review = 2,
  Relearning = 3,
}

interface Card {
  id: string;
  deck_id: string;
  front: string;              // Plain text
  back: string;               // Plain text

  // FSRS fields
  state: CardState;
  due: Date;
  stability: number;
  difficulty: number;
  elapsed_days: number;
  scheduled_days: number;
  reps: number;
  lapses: number;
  last_review: Date | null;

  created_at: Date;
  updated_at: Date;
  deleted_at: Date | null;
  sync_version: number;
}
```

### ReviewLog

```typescript
enum Rating {
  Again = 1,
  Hard = 2,
  Good = 3,
  Easy = 4,
}

interface ReviewLog {
  id: string;
  card_id: string;
  user_id: string;
  rating: Rating;
  state: CardState;
  scheduled_days: number;
  elapsed_days: number;
  reviewed_at: Date;
  duration_ms: number | null;
  sync_version: number;
}
```

## API Design

### Authentication

```
POST /api/auth/login      - Login (returns JWT)
POST /api/auth/refresh    - Refresh token
POST /api/auth/logout     - Logout
```

Note: User registration is disabled. Use CLI to add users: `pnpm user:add`

### Decks

```
GET    /api/decks         - List decks
POST   /api/decks         - Create deck
GET    /api/decks/:id     - Get deck
PUT    /api/decks/:id     - Update deck
DELETE /api/decks/:id     - Delete deck (soft)
```

### Cards

```
GET    /api/decks/:deckId/cards      - List cards
POST   /api/decks/:deckId/cards      - Create card
PUT    /api/decks/:deckId/cards/:id  - Update card
DELETE /api/decks/:deckId/cards/:id  - Delete card
```

### Study

```
GET    /api/decks/:deckId/study           - Get cards to study
POST   /api/decks/:deckId/study/:cardId   - Submit review
```

### Sync

```
POST /api/sync/push   - Push local changes to server
GET  /api/sync/pull   - Pull server changes
```

### Import

```
POST /api/import/apkg - Import Anki deck
```

## Offline Sync Strategy

### Approach

- **Method**: Last-Write-Wins with timestamps
- **Client**: Store in IndexedDB with `_synced` flag
- **Conflict Resolution**: Compare `updated_at`, newer wins
- **ReviewLog**: Append-only (no conflicts)

### Sync Flow

1. Local changes saved with `_synced = false`
2. On sync, push pending changes to server
3. Server resolves conflicts by timestamp
4. Client pulls server changes
5. Mark synced items with `_synced = true`

## Authentication

- **Hash**: Argon2 for password hashing
- **Access Token**: JWT, 15min expiry
- **Refresh Token**: JWT, 7 days, stored in DB

## References

- [ts-fsrs](https://github.com/open-spaced-repetition/ts-fsrs)
- [Anki APKG Format](https://eikowagenknecht.de/posts/understanding-the-anki-apkg-format/)
