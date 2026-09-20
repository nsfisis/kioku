# Offline / Multi-Device E2E Checklist

Manual test pass for the offline-first write path. The automated equivalents live in
`src/client/sync/crdt/concurrent-edits.test.ts` ("Multi-device sync scenarios") and
`src/client/sync/conflict.test.ts`; this checklist covers what they cannot: real
browsers, real service workers and real network transitions.

Run it before releasing a change that touches `src/client/sync/**`,
`src/client/db/repositories.ts` or `src/server/repositories/sync.ts`.

## Conflict resolution policy under test

The policy each entity is resolved with is declared in `src/client/sync/conflict.ts`
(`entityConflictPolicies`) and must match what this checklist observes:

| Entity | Policy | Expected behaviour |
| --- | --- | --- |
| `deck` | LWW | Newer `updatedAt` wins the whole row |
| `noteType` | LWW | Newer `updatedAt` wins the whole row |
| `noteFieldType` | LWW | Newer `updatedAt` wins the whole row |
| `note` | LWW | Newer `updatedAt` wins the whole row |
| `noteFieldValue` | CRDT | Automerge merge, pushed back to the server |
| `card` | LWW | FSRS state is taken as one unit, never field-merged |
| `reviewLog` | append-only | Every log survives; duplicates de-duplicate by ID |

## Setup

- Two devices (or two browser profiles) signed in as the same user. Called A and B below.
- Both installed as a PWA, or at least loaded once online so the service worker is active.
- Go offline with DevTools → Network → Offline, **not** by disabling Wi-Fi, so the
  service worker still serves the app shell.

## 1. Offline writes accumulate and sync on reconnect

- [ ] A: go offline. The `OfflineBanner` appears.
- [ ] A: create a deck, then add 5 notes to it.
- [ ] A: the new deck and all 5 notes are visible while still offline.
- [ ] A: reload the page while offline — the deck and notes are still there.
- [ ] A: go back online. Sync runs automatically (no manual action needed).
- [ ] B: reload. The deck and all 5 notes appear.

## 2. Independent creates on both devices

- [ ] A: go offline, create deck "A offline".
- [ ] B: stay online, create deck "B online".
- [ ] A: go back online.
- [ ] Both devices list **both** decks, with no duplicates.

## 3. Concurrent edits to different fields of the same note

- [ ] Both devices open the same note.
- [ ] Both go offline.
- [ ] A: edit the **Front** field. B: edit the **Back** field.
- [ ] Both go back online.
- [ ] Both devices show A's Front **and** B's Back.

## 4. Concurrent edits to the same field of the same note

- [ ] Both devices open the same note, both go offline.
- [ ] A and B both edit the **same** field to different text.
- [ ] Both go back online, then reload both.
- [ ] Both devices and the server agree on the same text — nothing is left holding a
      value the other side never sees.
- [ ] Known limitation: the surviving text is one of the two edits, not a
      character-level merge of both. See "Known gaps" below.

## 5. Concurrent delete

- [ ] Both devices have the same deck, both go offline.
- [ ] Both delete that deck.
- [ ] Both go back online.
- [ ] The deck is gone from both devices, and neither device resurrects it on a later
      sync.
- [ ] Notes and cards of the deleted deck are gone too (cascade).

## 6. Reviews offline

- [ ] A: go offline, study a deck and answer several cards.
- [ ] A: the scheduling updates immediately and survives a reload while offline.
- [ ] A: go back online.
- [ ] B: reload. The same cards show the same due dates, and the review history
      contains every answer from A (append-only — none are dropped or duplicated).

## 7. Concurrent review of the same card

- [ ] Both devices have the same card due. Both go offline.
- [ ] A answers "Good", B answers "Again".
- [ ] Both go back online.
- [ ] Both devices show **one** consistent FSRS state — `state`, `stability`,
      `difficulty`, `reps`, `due` all come from the same answer, never a mix.
- [ ] Both review logs are present in the history.

## 8. Sign-out / sign-in

- [ ] A: sign out. IndexedDB is cleared (Application → IndexedDB shows empty stores).
- [ ] A: sign in again. Data is pulled back from the server.
- [ ] A: no rows from the previous session leak into the new one.

## 9. Storage and app update

- [ ] Import a large CSV offline (a few hundred notes). No quota errors.
- [ ] Deploy a new client build, reload with pending offline changes queued, and
      confirm the queued changes still sync after the service worker updates.

## Known gaps

Things this checklist intentionally does not assert yet, because the implementation
does not provide them:

- **Character-level text merge.** `noteFieldValue` is declared CRDT and the conflict
  resolver does merge Automerge documents, but the push path
  (`generateCrdtChanges` in `src/client/sync/push.ts`) rebuilds a fresh Automerge
  document from the row on every push instead of continuing the stored one. Two
  devices therefore never share document history, so Automerge falls back to picking
  one side's value. Convergence holds; merging both edits does not.
- **Per-row `syncVersion` vs. a global pull watermark.** The server increments
  `syncVersion` per row and pull filters with `syncVersion > lastSyncVersion`, which
  is a global watermark. A freshly inserted row (version 1) can therefore sort below
  a client's watermark. Exercise step 2 after a device has been syncing for a while,
  not only on a fresh account.
