# Note Feature Implementation Roadmap

This document outlines the implementation plan for adding Anki-compatible "Note" concept to Kioku.

## Overview

Currently, Kioku uses a simple Card model with `front` and `back` text fields. To improve Anki interoperability, we will introduce:

1. **Note** - A container for field values (similar to Anki's Note)
2. **NoteType** - Defines the structure of notes (fields and card templates)
3. **Card** - Generated from Notes, holds FSRS scheduling state

### Key Concepts

- **One Note → Multiple Cards**: A "Basic (and reversed)" note type creates 2 cards (front→back, back→front)
- **One Note → One Card**: A "Basic" note type creates 1 card
- **Shared Content**: When note content is edited, all generated cards reflect the change
- **Independent Scheduling**: Each card has its own FSRS state (due date, stability, etc.)

## Data Model Design

### New Entities

```
NoteType
├── id: UUID
├── user_id: UUID (FK → users)
├── name: string
├── front_template: string (mustache template, e.g., "{{Front}}")
├── back_template: string (mustache template, e.g., "{{Back}}")
├── is_reversible: boolean (if true, creates reversed card too)
├── created_at: timestamp
├── updated_at: timestamp
├── deleted_at: timestamp (soft delete)
└── sync_version: number

NoteFieldType
├── id: UUID
├── note_type_id: UUID (FK → note_types)
├── name: string (e.g., "Front", "Back")
├── order: number (display order)
├── field_type: enum ("text") // Fixed to "text" for now
├── created_at: timestamp
├── updated_at: timestamp
├── deleted_at: timestamp
└── sync_version: number

Note
├── id: UUID
├── deck_id: UUID (FK → decks)
├── note_type_id: UUID (FK → note_types)
├── created_at: timestamp
├── updated_at: timestamp
├── deleted_at: timestamp
└── sync_version: number

NoteFieldValue
├── id: UUID
├── note_id: UUID (FK → notes)
├── note_field_type_id: UUID (FK → note_field_types)
├── value: text
├── created_at: timestamp
├── updated_at: timestamp
└── sync_version: number

Card (modified)
├── id: UUID
├── deck_id: UUID (FK → decks)
├── note_id: UUID (FK → notes) [NEW]
├── is_reversed: boolean [NEW] (false=normal, true=reversed)
├── front: text [DEPRECATED - kept for backward compat during migration]
├── back: text [DEPRECATED - kept for backward compat during migration]
├── (FSRS fields unchanged)
├── created_at: timestamp
├── updated_at: timestamp
├── deleted_at: timestamp
└── sync_version: number
```

### Card Display Logic

Template rendering uses a custom mustache-like renderer (no external dependencies).

Syntax: `{{FieldName}}` is replaced with the field value.

When displaying a card:
- **Normal card** (`is_reversed = false`): Render `front_template` on front, `back_template` on back
- **Reversed card** (`is_reversed = true`): Render `back_template` on front, `front_template` on back

Example templates:
- Simple: `{{Front}}`
- With text: `Q: {{Front}}`
- Multiple fields: `{{Word}} - {{Reading}}`

### Built-in Note Types

Create these as default note types for each user:

1. **Basic**
   - Fields: Front, Back
   - front_template: `{{Front}}`, back_template: `{{Back}}`
   - is_reversible: false

2. **Basic (and reversed card)**
   - Fields: Front, Back
   - front_template: `{{Front}}`, back_template: `{{Back}}`
   - is_reversible: true

### Behavior Rules

**Updating `is_reversible`:**
- Changing `is_reversible` does NOT affect existing cards
- Only affects new note creation (whether to create 1 or 2 cards)
- Existing reversed cards remain even if `is_reversible` is set to `false`

**Deletion Constraints (enforced by FK constraints + application logic):**
- **NoteType**: Cannot delete if any Notes reference it
- **NoteFieldType**: Cannot delete if any NoteFieldValues reference it
- **Note**: Deleting a Note cascades soft-delete to all its Cards
- **Card**: Deleting a Card also deletes its Note (and all sibling Cards via cascade)

**Required Tests for Deletion:**
- [ ] Attempt to delete NoteType with existing Notes → should fail
- [ ] Attempt to delete NoteFieldType with existing NoteFieldValues → should fail
- [ ] Delete Note → verify all related Cards are soft-deleted
- [ ] Delete Card → verify Note and all sibling Cards are soft-deleted

## Implementation Phases

### Phase 1: Database Schema

**Tasks:**
- [ ] Add `note_types` table schema (Drizzle)
- [ ] Add `note_field_types` table schema
- [ ] Add `notes` table schema
- [ ] Add `note_field_values` table schema
- [ ] Modify `cards` table: add `note_id`, `is_reversed` columns (nullable initially)
- [ ] Create migration file
- [ ] Add Zod validation schemas

**Files to modify:**
- `src/server/db/schema.ts`
- `src/server/schemas/index.ts`
- `drizzle/` (new migration)

### Phase 2: Server Repositories

**Tasks:**
- [x] Create `NoteTypeRepository`
  - CRUD operations
  - Include fields when fetching
- [x] Create `NoteTypeFieldRepository`
  - CRUD operations
  - Reorder fields
- [x] Create `NoteRepository`
  - Create note with field values (auto-generate cards based on `is_reversible`)
  - Update note (updates field values)
  - Delete note (cascade soft-delete to cards)
- [x] Modify `CardRepository`
  - Fetch card with note data for display
  - Support note-based card creation

**Files to create/modify:**
- `src/server/repositories/noteType.ts` (new)
- `src/server/repositories/note.ts` (new)
- `src/server/repositories/card.ts` (modify)
- `src/server/repositories/types.ts` (modify)

### Phase 3: Server API Routes

**Tasks:**
- [x] Add NoteType routes
  - `GET /api/note-types` - List user's note types
  - `POST /api/note-types` - Create note type
  - `GET /api/note-types/:id` - Get note type with fields
  - `PUT /api/note-types/:id` - Update note type (name, front_template, back_template, is_reversible)
  - `DELETE /api/note-types/:id` - Soft delete
- [x] Add NoteFieldType routes (nested under note-types)
  - `POST /api/note-types/:id/fields` - Add field
  - `PUT /api/note-types/:id/fields/:fieldId` - Update field
  - `DELETE /api/note-types/:id/fields/:fieldId` - Remove field
  - `PUT /api/note-types/:id/fields/reorder` - Reorder fields
- [x] Add Note routes
  - `GET /api/decks/:deckId/notes` - List notes in deck
  - `POST /api/decks/:deckId/notes` - Create note (auto-generates cards)
  - `GET /api/decks/:deckId/notes/:noteId` - Get note with field values
  - `PUT /api/decks/:deckId/notes/:noteId` - Update note field values
  - `DELETE /api/decks/:deckId/notes/:noteId` - Delete note and its cards
- [x] Modify Card routes
  - Update GET to include note data when available
- [x] Modify Study routes
  - Fetch note/field data for card display

**Files to create/modify:**
- `src/server/routes/noteTypes.ts` (new)
- `src/server/routes/notes.ts` (new)
- `src/server/routes/cards.ts` (modify)
- `src/server/routes/study.ts` (modify)
- `src/server/index.ts` (register new routes)

### Phase 4: Client Database (Dexie)

**Tasks:**
- [ ] Add `LocalNoteType` interface and table
- [ ] Add `LocalNoteTypeField` interface and table
- [ ] Add `LocalNote` interface and table
- [ ] Add `LocalNoteFieldValue` interface and table
- [ ] Modify `LocalCard` interface: add `noteId`, `isReversed`
- [ ] Update Dexie schema version and upgrade handler
- [ ] Create client repositories for new entities

**Files to modify:**
- `src/client/db/index.ts`
- `src/client/db/repositories.ts`

### Phase 5: Sync Logic

**Tasks:**
- [ ] Add sync for NoteType, NoteFieldType
- [ ] Add sync for Note, NoteFieldValue
- [ ] Update Card sync to include `noteId`, `isReversed`
- [ ] Define sync order (NoteTypes → Notes → Cards)
- [ ] Update pull/push sync handlers

**Files to modify:**
- `src/server/routes/sync.ts`
- `src/server/repositories/sync.ts`
- `src/client/sync/push.ts`
- `src/client/sync/pull.ts`

### Phase 6: Frontend - Note Type Management

**Tasks:**
- [ ] Create NoteType list page (`/note-types`)
- [ ] Create NoteType editor component
  - Edit name
  - Manage fields (add/remove/reorder)
  - Edit front/back templates (mustache syntax)
  - Toggle `is_reversible` option
- [ ] Add navigation to note type management

**Files to create:**
- `src/client/pages/NoteTypesPage.tsx`
- `src/client/components/NoteTypeEditor.tsx`
- `src/client/components/FieldEditor.tsx`

### Phase 7: Frontend - Note CRUD

**Tasks:**
- [ ] Update CreateCardModal → CreateNoteModal
  - Select note type
  - Dynamic field inputs based on note type
  - Preview generated cards
- [ ] Update EditCardModal → EditNoteModal
  - Load note and field values
  - Update all generated cards on save
- [ ] Update DeckDetailPage
  - Group cards by note
  - Show note-level actions (edit note, delete note)
  - Display whether card is normal or reversed

**Files to modify:**
- `src/client/components/CreateCardModal.tsx` → `CreateNoteModal.tsx`
- `src/client/components/EditCardModal.tsx` → `EditNoteModal.tsx`
- `src/client/pages/DeckDetailPage.tsx`

### Phase 8: Frontend - Study Page

**Tasks:**
- [ ] Create custom template renderer utility
- [ ] Update StudyPage to render cards based on note data
  - Fetch note field values
  - Use `isReversed` to determine which template to use for front/back
  - Render templates with custom renderer
  - Maintain front/back flip behavior
- [ ] Handle both legacy cards (direct front/back) and new note-based cards

**Files to modify/create:**
- `src/client/utils/templateRenderer.ts` (new)
- `src/client/pages/StudyPage.tsx`

### Phase 9: Data Migration

**Tasks:**
- [ ] Create migration script for existing data
  - Create "Basic" note type for each user
  - For each existing card:
    - Create a Note with Front/Back field values
    - Update Card to reference the Note
- [ ] Test migration with backup/restore capability
- [ ] Add migration endpoint or CLI command

**Files to create:**
- `src/server/scripts/migrate-to-notes.ts`

### Phase 10: Cleanup

**Tasks:**
- [ ] Remove deprecated `front`/`back` columns from Card (after migration)
- [ ] Update all tests
- [ ] Update API documentation
- [ ] Update architecture.md
- [ ] Performance testing with multiple cards per note

## Migration Strategy

### Backward Compatibility

During migration period:
1. Card retains `front`/`back` fields (nullable)
2. Card gains `noteId`/`isReversed` fields (nullable)
3. Display logic checks: if `noteId` exists, use note data; else use legacy `front`/`back`
4. New cards always created via Note
5. After full migration, remove legacy fields

### Data Migration Steps

1. **Preparation**
   - Backup database
   - Create default note types for all users

2. **Card Migration**
   - For each user's cards:
     - Group by deck
     - Create Note with "Basic" type
     - Set Front/Back field values from card
     - Link card to note

3. **Verification**
   - Compare card counts
   - Verify field values match
   - Test study flow

4. **Cleanup**
   - Remove legacy columns
   - Update indexes

## API Examples

### Create Note

```http
POST /api/decks/:deckId/notes
Content-Type: application/json

{
  "noteTypeId": "uuid-of-basic-reversed",
  "fields": {
    "field-uuid-front": "What is the capital of Japan?",
    "field-uuid-back": "Tokyo"
  }
}
```

Response:
```json
{
  "note": {
    "id": "note-uuid",
    "noteTypeId": "...",
    "deckId": "...",
    "fieldValues": [...]
  },
  "cards": [
    { "id": "card-1-uuid", "isReversed": false },
    { "id": "card-2-uuid", "isReversed": true }
  ]
}
```

### Get Cards for Study

```http
GET /api/decks/:deckId/study
```

Response:
```json
{
  "cards": [
    {
      "id": "card-uuid",
      "noteId": "note-uuid",
      "isReversed": false,
      "fieldValues": {
        "Front": "What is the capital of Japan?",
        "Back": "Tokyo"
      },
      "state": 0,
      "due": "2024-01-15T00:00:00Z",
      ...
    }
  ]
}
```

Note: Templates (`front_template`, `back_template`) are fetched separately via NoteType API and cached on the client. The client renders the card display using the template and field values.

## Testing Checklist

- [ ] Unit tests for all new repositories
- [ ] Integration tests for note CRUD
- [ ] Test card generation from different note types
- [ ] Test sync with note data
- [ ] Test migration script
- [ ] E2E tests for study flow with note-based cards
