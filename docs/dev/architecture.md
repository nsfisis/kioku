# Kioku Architecture

## Tech Stack

| Layer | Technology |
|-------|------------|
| Frontend | React + Vite |
| Routing | Wouter |
| State | Jotai + jotai-tanstack-query |
| Styling | TailwindCSS |
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
|  |  +----------+ +----------+ +----------+      ||
|  |  |   Auth   | |   FSRS   | |   Sync   |      ||
|  |  +----------+ +----------+ +----------+      ||
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
│   │   ├── schemas/          # Zod validation
│   │   └── scripts/          # CLI scripts (add-user)
│   └── client/               # React frontend
│       ├── index.tsx
│       ├── queryClient.ts    # Shared TanStack QueryClient instance
│       ├── components/
│       ├── pages/
│       ├── atoms/            # Jotai atoms (atomWithSuspenseQuery for server data)
│       ├── db/               # Dexie IndexedDB
│       ├── sync/             # Sync engine
│       └── api/
├── drizzle/                  # Drizzle migrations
├── public/                   # Static files (PWA manifest)
├── package.json
├── tsconfig.json
├── vite.config.ts
├── drizzle.config.ts
└── compose.yaml
```

## Note-Card Architecture

Kioku uses an Anki-compatible Note system for card content management:

- **NoteType** defines the structure (fields and templates) for creating notes
- **Note** holds the field values (e.g., "Front" and "Back" content)
- **Card** is generated from a Note and holds FSRS scheduling state

### Key Relationships

```
NoteType (1) ──< NoteFieldType (many)
    │
    └── defines structure for ──< Note (many)
                                    │
                                    ├──< NoteFieldValue (many) - actual content
                                    │
                                    └──< Card (1 or 2) - scheduling state
```

### Card Generation

- **Basic note type** (`is_reversible: false`): Creates 1 card
- **Basic (and reversed)** (`is_reversible: true`): Creates 2 cards
  - Normal card: `front_template` → front, `back_template` → back
  - Reversed card: `back_template` → front, `front_template` → back

### Template Rendering

Templates use mustache-like syntax: `{{FieldName}}` is replaced with the field value.

Example: If a note has fields `Front: "Tokyo"` and `Back: "Capital of Japan"`:
- Template `Q: {{Front}}` renders to `Q: Tokyo`
- Template `A: {{Back}}` renders to `A: Capital of Japan`

Card `front` and `back` fields store cached rendered content for performance.

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

### RefreshToken

```typescript
interface RefreshToken {
  id: string;          // UUID
  user_id: string;
  token_hash: string;
  expires_at: Date;
  created_at: Date;
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

### NoteType

Defines the structure of notes (fields and card templates). Similar to Anki's Note Type.

```typescript
interface NoteType {
  id: string;
  user_id: string;
  name: string;
  front_template: string;     // Mustache template, e.g., "{{Front}}"
  back_template: string;      // Mustache template, e.g., "{{Back}}"
  is_reversible: boolean;     // If true, creates reversed card too
  created_at: Date;
  updated_at: Date;
  deleted_at: Date | null;
  sync_version: number;
}
```

### NoteFieldType

Defines a field within a note type (e.g., "Front", "Back").

```typescript
interface NoteFieldType {
  id: string;
  note_type_id: string;
  name: string;               // e.g., "Front", "Back"
  order: number;              // Display order
  field_type: "text";         // Currently only "text" supported
  created_at: Date;
  updated_at: Date;
  deleted_at: Date | null;
  sync_version: number;
}
```

### Note

A container for field values. One Note can generate multiple Cards.

```typescript
interface Note {
  id: string;
  deck_id: string;
  note_type_id: string;
  created_at: Date;
  updated_at: Date;
  deleted_at: Date | null;
  sync_version: number;
}
```

### NoteFieldValue

Stores the actual content for each field of a note.

```typescript
interface NoteFieldValue {
  id: string;
  note_id: string;
  note_field_type_id: string;
  value: string;
  created_at: Date;
  updated_at: Date;
  sync_version: number;
}
```

### Card (FSRS)

Cards are generated from Notes. Each card has its own FSRS scheduling state.

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
  note_id: string;            // Reference to parent Note
  is_reversed: boolean;       // false=normal, true=reversed card
  front: string;              // Cached rendered content from template
  back: string;               // Cached rendered content from template

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

### Note Types

```
GET    /api/note-types                         - List user's note types
POST   /api/note-types                         - Create note type
GET    /api/note-types/:id                     - Get note type with fields
PUT    /api/note-types/:id                     - Update note type
DELETE /api/note-types/:id                     - Soft delete
POST   /api/note-types/:id/fields              - Add field
PUT    /api/note-types/:id/fields/:fieldId     - Update field
DELETE /api/note-types/:id/fields/:fieldId     - Remove field
PUT    /api/note-types/:id/fields/reorder      - Reorder fields
```

### Notes

```
GET    /api/decks/:deckId/notes           - List notes in deck
POST   /api/decks/:deckId/notes           - Create note (auto-generates cards)
GET    /api/decks/:deckId/notes/:noteId   - Get note with field values
PUT    /api/decks/:deckId/notes/:noteId   - Update note field values
DELETE /api/decks/:deckId/notes/:noteId   - Delete note and its cards
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

## Study

### Date Boundary

The "study day" rolls over at **3:00 AM local time**, not midnight. A study day spans from 3:00 AM to the next day's 3:00 AM. This boundary is used for:

- Determining which cards are due (`card.due < endOfStudyDay`)
- Counting today's new card reviews (budget calculation)
- Seeding the card shuffle order (see below)

### Card Shuffle Order

Cards fetched for a study session are shuffled client-side using the Fisher-Yates algorithm with a **seeded PRNG** (mulberry32). The seed is derived from `getStartOfStudyDayBoundary().getTime()`, which means:

- The shuffle order is **deterministic within the same study day** — reopening the study screen produces the same card order.
- The order **changes when the study day rolls over** (at 3:00 AM).

## Authentication

- **Hash**: Argon2 for password hashing
- **Access Token**: JWT, 15min expiry
- **Refresh Token**: JWT, 7 days, stored in DB

## References

- [ts-fsrs](https://github.com/open-spaced-repetition/ts-fsrs)
