# Kioku Development Roadmap

## Issue #3: Introduce CRDT Library for Conflict Resolution

Replace the current Last-Write-Wins (LWW) conflict resolution with Automerge CRDT for better offline sync.

**Decisions:**
- Library: Automerge
- Text conflicts: LWW Register (simple, predictable)
- Migration: Clean migration (no backward compatibility)

### Phase 1: Add Automerge and Core Types

- [x] Install dependencies: `@automerge/automerge`, `@automerge/automerge-repo`, `@automerge/automerge-repo-storage-indexeddb`
- [x] Create `src/client/sync/crdt/types.ts` - Automerge document type definitions
- [x] Create `src/client/sync/crdt/document-manager.ts` - Automerge document lifecycle management
- [x] Create `src/client/sync/crdt/index.ts` - Module exports

### Phase 2: Create CRDT Repository Layer

- [x] Create `src/client/sync/crdt/repositories.ts` - CRDT-aware repository wrappers
- [x] Create `src/client/sync/crdt/sync-state.ts` - Sync state serialization

### Phase 3: Modify Sync Protocol

- [x] Modify `src/client/sync/push.ts` - Add crdtChanges to push payload
- [x] Modify `src/client/sync/pull.ts` - Handle crdtChanges in pull response
- [x] Modify `src/client/sync/conflict.ts` - Replace LWW with Automerge merge
- [x] Modify `src/client/sync/manager.ts` - Integrate CRDT sync flow

### Phase 4: Server-Side CRDT Support

- [x] Install server dependency: `@automerge/automerge`
- [x] Create `src/server/db/schema-crdt.ts` - CRDT document storage schema
- [x] Create database migration for crdt_documents table
- [x] Modify `src/server/routes/sync.ts` - Handle CRDT changes in API
- [x] Modify `src/server/repositories/sync.ts` - Store/merge CRDT documents

### Phase 5: Migration

- [x] Create `src/client/sync/crdt/migration.ts` - One-time migration script
- [x] Server data migration - Not needed (no existing production data)

### Phase 6: Testing and Cleanup

- [x] Add unit tests for CRDT operations
- [x] Add integration tests for concurrent edit scenarios
- [ ] Remove legacy LWW code after validation
