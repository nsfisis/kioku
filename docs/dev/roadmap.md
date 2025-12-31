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

- [ ] Create `src/client/sync/crdt/repositories.ts` - CRDT-aware repository wrappers
- [ ] Create `src/client/sync/crdt/sync-state.ts` - Sync state serialization

### Phase 3: Modify Sync Protocol

- [ ] Modify `src/client/sync/push.ts` - Add crdtChanges to push payload
- [ ] Modify `src/client/sync/pull.ts` - Handle crdtChanges in pull response
- [ ] Modify `src/client/sync/conflict.ts` - Replace LWW with Automerge merge
- [ ] Modify `src/client/sync/manager.ts` - Integrate CRDT sync flow

### Phase 4: Server-Side CRDT Support

- [ ] Install server dependency: `@automerge/automerge`
- [ ] Create `src/server/db/schema-crdt.ts` - CRDT document storage schema
- [ ] Create database migration for crdt_documents table
- [ ] Modify `src/server/routes/sync.ts` - Handle CRDT changes in API
- [ ] Modify `src/server/repositories/sync.ts` - Store/merge CRDT documents

### Phase 5: Migration

- [ ] Create `src/client/sync/crdt/migration.ts` - One-time migration script
- [ ] Create server migration script to convert existing data

### Phase 6: Testing and Cleanup

- [ ] Add unit tests for CRDT operations
- [ ] Add integration tests for concurrent edit scenarios
- [ ] Remove legacy LWW code after validation
