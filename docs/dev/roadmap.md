# Kioku Development Roadmap

## Add ORDER BY to SELECT Queries

複数行を返すSELECTクエリにORDER BYを追加し、実行結果の順序を決定的にする。

**Background:**
- PostgreSQLはORDER BYがない場合、行の返却順序を保証しない
- UI表示やSync結果の一貫性のため、明示的なソート順が必要

### Phase 1: Core Repository Queries

- [ ] `src/server/repositories/deck.ts`
  - `findByUserId()`: `.orderBy(decks.createdAt)` 追加
- [ ] `src/server/repositories/note.ts`
  - `findByDeckId()`: `.orderBy(notes.createdAt)` 追加
  - `findByIdWithFieldValues()` 内のfieldValues取得: `.orderBy(noteFieldValues.noteFieldTypeId)` 追加
  - `update()` 内のallFieldValues取得: `.orderBy(noteFieldValues.noteFieldTypeId)` 追加
- [ ] `src/server/repositories/noteType.ts`
  - `findByUserId()`: `.orderBy(noteTypes.createdAt)` 追加
- [ ] `src/server/repositories/card.ts`
  - `findByDeckId()`: `.orderBy(cards.createdAt)` 追加
  - `findByNoteId()`: `.orderBy(cards.isReversed)` 追加 (通常カードを先に)

### Phase 2: Sync Repository Queries

- [ ] `src/server/repositories/sync.ts`
  - pull系クエリ (cards, noteFieldTypes, notes, noteFieldValues): `.orderBy(*.id)` 追加

### Phase 3: Verification

- [ ] `pnpm typecheck` 実行
- [ ] `pnpm lint` 実行
- [ ] `pnpm test` 実行
