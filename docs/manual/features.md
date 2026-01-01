# Kioku Features

A list of features available in Kioku.

## Deck Management

- Create, edit, and delete decks
- View all decks at a glance
- Confirmation dialog before deletion

## Note Types

- Define custom note structures with configurable fields
- Built-in note types: "Basic" and "Basic (and reversed card)"
- Mustache-style templates for card rendering (e.g., `{{Front}}`, `{{Back}}`)
- Reversible option: automatically generate both normal and reversed cards

## Note & Card Management

- Create notes with dynamic fields based on note type
- One note can generate multiple cards (e.g., front→back and back→front)
- Edit note content and all generated cards update automatically
- Browse cards grouped by note in deck view
- Independent scheduling: each card maintains its own FSRS state
- CSV import: Bulk import notes from CSV files

## Study Session

- Smart scheduling using the FSRS algorithm
- Flip cards to reveal answers
- Rate your recall: Again, Hard, Good, Easy
- See remaining cards in the session
- Completion screen when finished

## Offline Support & Sync

- Works offline: Study anywhere without an internet connection
- Installable: Add to your home screen as a native-like app (PWA)
- Cloud sync: Your progress syncs across devices when online
- Sync indicator: See your sync status at a glance
- Manual sync: Force sync with a button tap
- Offline indicator: Know when you're working offline
