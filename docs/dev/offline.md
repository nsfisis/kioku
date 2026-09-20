# Offline Mode

Kioku is offline-first: every read and write goes to the browser's local
database, and the server is only contacted by the sync engine. This document
covers how that looks from the user's side, what it cannot do, how to recover
when the local database misbehaves, and how the pieces fit together internally.

For the architectural overview see
[architecture.md § Offline Sync Strategy](./architecture.md#offline-sync-strategy);
for the manual release pass see [offline-e2e-checklist.md](./offline-e2e-checklist.md).

## For Users

### Getting set up

1. Open Kioku online once and sign in. The first sync downloads your decks,
   note types, notes and cards into the browser.
2. Install it as an app (the browser's "Install" / "Add to Home Screen"), so
   the service worker keeps the app shell available with no network.
3. That's it — there is no "offline mode" switch. The app always reads and
   writes locally.

### What works offline

Everything except signing in and signing out:

| Action | Offline |
|--------|---------|
| Study, rate cards, undo a review | Yes |
| Create / edit / delete decks | Yes |
| Create / edit / delete note types and their fields | Yes |
| Create / edit / delete notes | Yes |
| Import notes from CSV | Yes |
| Browse cards, decks, due counts | Yes |
| Sign in | **No** — the server issues the tokens |
| Sign out | Possible, but it erases local data (see below) |

While offline, a banner reads *"You're offline. Changes will sync when you
reconnect."* with the number of changes still waiting.

### How syncing happens

- **On reconnect**: sync starts automatically about a second after the browser
  reports it is online again. Nothing to press.
- **On app start**: a full sync runs once after sign-in to refresh local data.
- **Manually**: the **Sync** button in the header. It is disabled while offline
  or while a sync is already running.

If two devices changed the same thing while apart, the conflict is resolved
automatically on the next sync — see
[the policy table](./architecture.md#conflict-resolution). Note text is merged
via CRDT; everything else keeps the most recent edit.

### Signing out vs. closing the app

Signing out **erases all local data**, including changes that have not synced
yet. Reconnect and let a sync finish before signing out on a device that was
used offline.

Just closing the tab or the app is safe — everything stays in the browser, and
an expired session keeps local data too, so pending offline work is still there
after signing in again.

## Limitations

- **One account per browser profile.** The local databases are not namespaced
  by user, which is exactly why signing out clears them. To use two accounts,
  use two browser profiles (or one profile and one installed PWA).
- **Storage is the browser's to reclaim.** IndexedDB lives under the browser's
  quota (typically a percentage of free disk space) and can be evicted under
  storage pressure, in private windows, or by "clear site data". Kioku does not
  request persistent storage. A wiped local database is recoverable from the
  server, but *unsynced* changes in it are not.
- **The first sync downloads everything.** Pull is not paginated: the initial
  sync after sign-in fetches every deck, note, field value, card and review log
  for the account in one response. On a large collection over a slow
  connection this is the slowest moment in the app's life. It happens once per
  sign-in, not per launch.
- **Review logs only grow.** They are append-only and never pruned locally, so
  local storage grows with review history.
- **Sign-in needs the network.** A device that has never signed in cannot be
  used offline.
- **Text merge is convergent, not character-level.** Two devices editing the
  same field while both offline end up agreeing on one of the two texts, not a
  blend of both. Different fields of the same note do merge.

## Troubleshooting

### Changes are stuck as "pending"

1. Check the sync status indicator — if it shows an error, the last sync
   failed; press **Sync** to retry.
2. Confirm the session is still valid. If the app bounced to the login screen,
   sign in again; local data and the pending queue survive session expiry.
3. Look for failing requests to `/api/sync/push` in DevTools → Network. A 401
   means the token expired; anything 5xx is a server-side problem.

### Forcing a full re-pull

Pull only asks for rows newer than a stored watermark. To make the next sync
fetch everything again, clear that watermark and sync:

```js
// DevTools console, on the Kioku origin
localStorage.removeItem("kioku_sync_state");
location.reload();
```

The bootstrap sync on the next load then pulls from version 0. Local rows that
have not synced yet are unaffected and still get pushed.

### Resetting a corrupted local database

If the app throws Dexie errors on start, or data looks inconsistent in ways a
sync does not fix, drop the local databases and let them be rebuilt from the
server.

> [!WARNING]
> This discards any change that has not been pushed yet. Try a manual sync
> first if the device has been offline.

Either sign out and sign in again (which calls the same cleanup path), or from
the DevTools console:

```js
indexedDB.deleteDatabase("kioku");
indexedDB.deleteDatabase("kioku-crdt-sync");
localStorage.removeItem("kioku_sync_state");
location.reload();
```

The equivalent by hand: DevTools → Application → Storage → IndexedDB, delete
both databases, then reload.

### The app shell itself is broken or stale

The service worker updates automatically (`registerType: "autoUpdate"`), but a
hard reset is DevTools → Application → Service Workers → **Unregister**,
followed by a reload while online. Unregistering does not touch IndexedDB.

## For Developers

### Local database schema

Two IndexedDB databases, both via Dexie:

```
IndexedDB "kioku" (v4)                      IndexedDB "kioku-crdt-sync" (v1)
+--------------------------------------+    +--------------------------------+
| noteTypes                            |    | syncState                      |
|   id*, userId, updatedAt             |    |   documentId*                  |
|     |                                |    |   entityType, entityId         |
|     | 1:N                            |    |   binary (Automerge)           |
|     v                                |    |   lastSyncedAt, syncVersion    |
| noteFieldTypes                       |    +--------------------------------+
|   id*, noteTypeId, updatedAt         |    | metadata                       |
|     |                                |    |   key*, actorId                |
|     |                                |    |   lastSyncAt                   |
| decks                                |    |   syncVersionWatermark         |
|   id*, userId, updatedAt             |    +--------------------------------+
|     |                                |
|     | 1:N                            |    localStorage
|     v                                |    +--------------------------------+
| notes                                |    | kioku_sync_state               |
|   id*, deckId, noteTypeId, updatedAt |    |   lastSyncVersion, lastSyncAt  |
|     |         |                      |    | kioku_user                     |
|     | 1:N     | 1:N                  |    +--------------------------------+
|     v         v                      |
| noteFieldValues        cards         |
|   id*, noteId,           id*, deckId,|
|   noteFieldTypeId,       noteId, due,|
|   updatedAt              state       |
|                            |         |
|                            | 1:N     |
|                            v         |
|                          reviewLogs  |
|                            id*, cardId, userId, reviewedAt
+--------------------------------------+

* = primary key; other names are indexes
```

Every row in `kioku` carries `createdAt`, `updatedAt`, `syncVersion` and
`_synced`; everything except `noteFieldValues` and `reviewLogs` also carries
`deletedAt` for soft deletes. `_synced` is **not** indexed — IndexedDB cannot
index booleans — so pending rows are found by scanning each table.

Definitions: `src/client/db/index.ts` (schema and versions),
`src/client/db/repositories.ts` (per-entity CRUD),
`src/client/sync/crdt/sync-state.ts` (CRDT database).

### Sync queue

There is no separate queue table: the queue *is* the set of rows with
`_synced = false`. `SyncQueue` (`src/client/sync/queue.ts`) scans the tables and
returns them grouped by entity:

```ts
interface PendingChanges {
  decks: LocalDeck[];
  cards: LocalCard[];
  reviewLogs: LocalReviewLog[];
  noteTypes: LocalNoteType[];
  noteFieldTypes: LocalNoteFieldType[];
  notes: LocalNote[];
  noteFieldValues: LocalNoteFieldValue[];
}

interface SyncQueueState {
  status: "idle" | "syncing" | "error";
  pendingCount: number;
  lastSyncVersion: number;   // persisted in localStorage
  lastSyncAt: Date | null;   // persisted in localStorage
  lastError: string | null;
}
```

Consequences worth knowing:

- Nothing can be lost by a crash between "write" and "enqueue" — the write *is*
  the enqueue, inside the same Dexie transaction.
- A row that is edited twice before a sync is pushed once, in its final state.
- `markSynced()` flips `_synced` only for the IDs the server acknowledged;
  conflicted rows stay pending and are handled by the conflict resolver.
- `reset()` clears the queue state and the persisted watermark; it is part of
  `clearAllLocalData()` on logout.

Subscribers (`syncQueue.subscribe`) drive the pending counter in the offline
banner and the sync status indicator.

### CRDT document format

Automerge documents are per entity, not per table, and their IDs are
`` `${entityType}:${entityId}` `` (`createDocumentId`). Each document wraps the
entity in a fixed shape (`src/client/sync/crdt/types.ts`):

```ts
interface CrdtMetadata {
  entityId: string;
  lastModified: number;  // epoch ms
  deleted: boolean;
}

interface CrdtNoteFieldValueDocument {
  meta: CrdtMetadata;
  data: {
    noteId: string;
    noteFieldTypeId: string;
    value: string;      // the text that is actually merged
    createdAt: number;  // epoch ms
  };
}
```

All seven entity types have such a document type, but only `noteFieldValue` is
declared `ConflictPolicy.Crdt` — the rest exist so that the same machinery can
carry them, and are resolved by LWW. Dates are epoch milliseconds inside
documents, because Automerge has no `Date`.

On the wire, documents travel in the push/pull payload's `crdtChanges` as
`{ documentId, entityType, entityId, binary }` with `binary`
base64-encoded (`binaryToBase64` / `base64ToBinary`).

Known gap: `generateCrdtChanges()` in `src/client/sync/push.ts` rebuilds a fresh
Automerge document from the row on every push rather than continuing the stored
one, so two devices never share document history and a same-field conflict
resolves to one side's text instead of a character-level merge. Convergence
holds; merging both edits does not.

### Where to look

| Concern | File |
|---------|------|
| Local schema and migrations | `src/client/db/index.ts` |
| Local CRUD, cascades, soft deletes | `src/client/db/repositories.ts` |
| Wiping local data on logout | `src/client/db/clear.ts` |
| Pending changes, watermark | `src/client/sync/queue.ts` |
| Push batching, FK ordering | `src/client/sync/push.ts` |
| Pull and apply | `src/client/sync/pull.ts` |
| Conflict policies and resolution | `src/client/sync/conflict.ts` |
| Orchestration, auto-sync on reconnect | `src/client/sync/manager.ts` |
| Local FSRS review path | `src/client/sync/scheduler.ts`, `src/shared/fsrs.ts` |
| CRDT documents and sync state | `src/client/sync/crdt/` |
| Bootstrap sync, sync atoms | `src/client/atoms/sync.ts` |
| Server-side push/pull | `src/server/routes/sync.ts`, `src/server/repositories/sync.ts` |
