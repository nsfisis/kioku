# CSV Import

Kioku allows you to bulk import notes from CSV files.

## Basic Usage

1. Open the deck detail page and click the "Import" button
2. Select a CSV file
3. Review the import preview
4. Click "Import" to execute

## CSV Format

### Header Row

The first row is the header. Use the following format:

```
note_type,Field1,Field2,...
```

- **note_type**: Note type name (required)
- **Field names**: Field names defined in the note type

### Data Rows

Rows 2 and onwards contain the notes to import.

```csv
note_type,Front,Back
Basic,hello,world
Basic,goodbye,farewell
```

### Example: Basic Note Type

```csv
note_type,Front,Back
Basic,apple,a round fruit
Basic,banana,a yellow fruit
Basic,orange,a citrus fruit
```

### Example: Basic (and reversed card) Note Type

```csv
note_type,Front,Back
Basic (and reversed card),Tokyo,Japan
Basic (and reversed card),Paris,France
Basic (and reversed card),London,United Kingdom
```

## CSV Specification

Kioku's CSV parser is RFC 4180 compliant.

### Supported Format

- **Delimiter**: Comma (`,`)
- **Line endings**: LF (`\n`) or CRLF (`\r\n`)
- **Encoding**: UTF-8

### Quoting

Use double quotes (`"`) to include commas or newlines within a field:

```csv
note_type,Front,Back
Basic,"Hello, World!",example with comma
Basic,"Line 1
Line 2",example with newline
```

To include a double quote within a field, escape it by doubling:

```csv
note_type,Front,Back
Basic,"He said ""Hello""",example with quotes
```

## Important Notes

### Note Type Names

- Note type names are case-insensitive
- Note types must be created beforehand
- Rows with non-existent note types are skipped

### Field Names

- Field names are case-insensitive
- Rows with unrecognized field names are skipped
- All fields defined in the note type must be present in the CSV

### Validation

Validation runs before import. Rows with the following errors are skipped:

- Note type not found
- Field name mismatch
- Column count doesn't match the header

You can review errors in the preview screen.

## Troubleshooting

### "Note type 'XXX' not found" Error

The specified note type doesn't exist. Create the note type on the Note Types page first.

### "Field 'XXX' not found in note type" Error

The CSV field name doesn't match any field in the note type. Check the field names in your note type definition.

### "Expected N columns, got M" Error

The number of columns in a data row doesn't match the header. Check for missing or extra commas. If a field contains commas, wrap the value in double quotes.

### Character Encoding Issues

Save your CSV file as UTF-8. If using Excel, choose "CSV UTF-8" format when saving.
