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
|  |        +----------+ +----------+             ||
|  |        |   Auth   | |   Sync   |             ||
|  |        +----------+ +----------+             ||
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

The client is offline-first, so the server exposes only what the sync engine and
the login flow need. Decks, note types, notes, cards and reviews have no HTTP
endpoints of their own: they live in IndexedDB and reach the server as sync
payloads — see [Offline Sync Strategy](#offline-sync-strategy).

### Authentication

```
POST /api/auth/login      - Login (returns JWT)
POST /api/auth/refresh    - Refresh token
```

Note: User registration is disabled. Use CLI to add users: `pnpm user:add`

### Sync

```
POST /api/sync/push   - Push local changes to server
GET  /api/sync/pull   - Pull server changes
```

### Health

```
GET /api/health   - Liveness probe
```

## Offline Sync Strategy

Kioku is offline-first: **every** read and write goes to IndexedDB, and the
server is only ever contacted by the sync engine. No screen blocks on the
network, so the `OfflineBanner` promise — "Changes will sync when you
reconnect." — holds for all mutations: decks, note types, notes (including CSV
import) and reviews.

A user-facing walkthrough, the known limitations and the troubleshooting steps
live in [offline.md](./offline.md).

### Write Path

Every mutation follows the same four steps:

1. The client generates the row's UUID and writes it to IndexedDB with
   `_synced = false` (`src/client/db/repositories.ts`). Deletes are soft
   (`deletedAt`) and cascade locally — deleting a deck also soft-deletes its
   notes, field values and cards.
2. `queryClient.invalidateQueries(...)` re-evaluates the Jotai atoms, which read
   back from IndexedDB. The new state is on screen without a round trip.
3. `syncManager.sync()` is kicked off fire-and-forget. Offline it returns
   `{ success: false, error: "Offline" }` right away and the row simply stays
   pending.
4. On reconnect, the `online` event triggers an auto-sync (debounced 1s,
   `src/client/sync/manager.ts`) that drains everything queued.

Reviews take the same path through `submitReviewLocal()`
(`src/client/sync/scheduler.ts`): FSRS scheduling is computed client-side with
the shared implementation in `src/shared/fsrs.ts`, the card row is updated and
an append-only review log is written, both with `_synced = false`.

### Sync Endpoints

Client writes reach the server through exactly two endpoints:

```
POST /api/sync/push   - Push local changes to server
GET  /api/sync/pull   - Pull server changes
```

- **push** sends pending rows in foreign-key dependency order (note types →
  field types → decks → notes → field values → cards → review logs), split into
  batches of at most `DEFAULT_MAX_RECORDS_PER_REQUEST` (500) records, so a
  referenced row is never pushed after the rows referencing it. CRDT document
  binaries ride along in `crdtChanges` as base64.
- **pull** returns every row with `syncVersion > lastSyncVersion`, the watermark
  persisted in `localStorage` under `kioku_sync_state`.

### Sync Flow

`SyncManager.sync()` runs the following, serialized (a second call while one is
in flight returns `"Sync already in progress"`):

1. Push pending changes; the server replies with applied IDs and conflicts.
2. Store the Automerge binaries of successfully pushed entities in the CRDT
   sync state.
3. Pull server changes since the watermark and apply them to IndexedDB, marking
   the rows `_synced = true`.
4. Resolve every conflict the push reported, per the policy table below.
5. Update the watermark and the CRDT sync metadata; notify listeners so the UI
   refetches.

### Conflict Resolution

The **server** decides *that* a conflict happened
(`src/server/repositories/sync.ts`): on push it compares `updatedAt` per row and
reports a conflict only when its own row is the newer one. The **client** then
decides what to do about it, following the policy declared in
`entityConflictPolicies` (`src/client/sync/conflict.ts`):

| Entity | Policy | Behaviour |
|--------|--------|-----------|
| `deck` | LWW | Server row wins wholesale; metadata is rarely edited concurrently |
| `noteType` | LWW | Template/config metadata |
| `noteFieldType` | LWW | Field definition metadata |
| `note` | LWW | Note metadata only (deck, note type, timestamps) |
| `noteFieldValue` | CRDT | Automerge merge of the note text, LWW as fallback; the merged value is re-pushed |
| `card` | LWW | FSRS state is one coherent unit, never merged field by field |
| `reviewLog` | append-only | Immutable rows keyed by client UUID; the server de-duplicates, conflicts cannot occur |

LWW entities take the server row verbatim rather than merging field by field:
the server has already discarded the losing values, so merging locally would
resurrect them and leave the device permanently out of step.

### Local Storage Layout

| Store | Contents |
|-------|----------|
| IndexedDB `kioku` (Dexie v4) | `decks`, `cards`, `reviewLogs`, `noteTypes`, `noteFieldTypes`, `notes`, `noteFieldValues`. Every row carries `syncVersion` and `_synced` |
| IndexedDB `kioku-crdt-sync` (Dexie v1) | `syncState` — one Automerge binary per document, keyed `entityType:entityId` — and `metadata` (actor ID, sync watermark) |
| `localStorage.kioku_sync_state` | `lastSyncVersion`, `lastSyncAt` |
| `localStorage.kioku_user` + token storage | Authenticated user and JWTs |

`_synced` is deliberately not indexed: IndexedDB cannot index booleans, so
pending rows are found by a full scan of each table.

### Lifecycle

- **Startup / login**: `useSyncInit()` calls `ensureBootstrap()`, a single
  deduplicated full sync that populates IndexedDB from the server. SWR-style
  atoms await it when their local table is empty. Offline, it resolves
  immediately and the app runs on whatever is already stored.
- **Running**: auto-sync on the `online` event, plus the manual `SyncButton`
  (disabled while offline or syncing).
- **Session expiry**: local data is intentionally *kept*, so offline work is
  still there after re-authenticating.
- **Explicit logout**: `clearAllLocalData()` wipes both IndexedDB databases and
  the sync queue state, so the next user starts clean. Pending changes that
  never synced are lost with it.
- **Accounts**: one account per browser profile. The local databases are not
  namespaced by user, which is why logout clears them.

### Known Gaps

- `noteFieldValue` converges but does not merge character by character: the push
  path rebuilds a fresh Automerge document from the row instead of continuing
  the stored one, so two devices never share document history.
- The pull watermark is global while `syncVersion` is per row, so a freshly
  inserted row can sort below a long-lived client's watermark.

Both are tracked in [offline-e2e-checklist.md](./offline-e2e-checklist.md),
which is the manual pass to run before releasing changes to the sync path.

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
