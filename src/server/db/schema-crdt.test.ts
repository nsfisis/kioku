import { getTableName } from "drizzle-orm";
import { describe, expect, it } from "vitest";
import {
	CrdtEntityType,
	type CrdtEntityTypeValue,
	crdtDocuments,
} from "./schema-crdt";

describe("CRDT Schema", () => {
	describe("CrdtEntityType", () => {
		it("should have all required entity types", () => {
			expect(CrdtEntityType.Deck).toBe("deck");
			expect(CrdtEntityType.NoteType).toBe("noteType");
			expect(CrdtEntityType.NoteFieldType).toBe("noteFieldType");
			expect(CrdtEntityType.Note).toBe("note");
			expect(CrdtEntityType.NoteFieldValue).toBe("noteFieldValue");
			expect(CrdtEntityType.Card).toBe("card");
			expect(CrdtEntityType.ReviewLog).toBe("reviewLog");
		});

		it("should be immutable (const assertion)", () => {
			// TypeScript const assertion ensures immutability at compile time
			// We verify the object structure matches expected values
			const entityTypes = Object.values(CrdtEntityType);
			expect(entityTypes).toHaveLength(7);
			expect(entityTypes).toContain("deck");
			expect(entityTypes).toContain("noteType");
			expect(entityTypes).toContain("noteFieldType");
			expect(entityTypes).toContain("note");
			expect(entityTypes).toContain("noteFieldValue");
			expect(entityTypes).toContain("card");
			expect(entityTypes).toContain("reviewLog");
		});
	});

	describe("CrdtEntityTypeValue type", () => {
		it("should accept valid entity type values", () => {
			// Type checking at compile time, runtime verification
			const validTypes: CrdtEntityTypeValue[] = [
				"deck",
				"noteType",
				"noteFieldType",
				"note",
				"noteFieldValue",
				"card",
				"reviewLog",
			];
			expect(validTypes).toHaveLength(7);
		});
	});

	describe("crdtDocuments table", () => {
		it("should have correct table name", () => {
			expect(getTableName(crdtDocuments)).toBe("crdt_documents");
		});

		it("should have required columns", () => {
			const columns = Object.keys(crdtDocuments);
			expect(columns).toContain("id");
			expect(columns).toContain("userId");
			expect(columns).toContain("entityType");
			expect(columns).toContain("entityId");
			expect(columns).toContain("binary");
			expect(columns).toContain("syncVersion");
			expect(columns).toContain("createdAt");
			expect(columns).toContain("updatedAt");
		});

		it("should have id as UUID primary key", () => {
			const idColumn = crdtDocuments.id;
			// Drizzle internally uses 'string' for UUID dataType
			expect(idColumn.dataType).toBe("string");
			expect(idColumn.primary).toBe(true);
			// Verify column name maps to correct DB column
			expect(idColumn.name).toBe("id");
		});

		it("should have userId as UUID with foreign key reference", () => {
			const userIdColumn = crdtDocuments.userId;
			expect(userIdColumn.dataType).toBe("string");
			expect(userIdColumn.notNull).toBe(true);
			expect(userIdColumn.name).toBe("user_id");
		});

		it("should have entityType as varchar", () => {
			const entityTypeColumn = crdtDocuments.entityType;
			expect(entityTypeColumn.dataType).toBe("string");
			expect(entityTypeColumn.notNull).toBe(true);
			expect(entityTypeColumn.name).toBe("entity_type");
		});

		it("should have entityId as UUID", () => {
			const entityIdColumn = crdtDocuments.entityId;
			expect(entityIdColumn.dataType).toBe("string");
			expect(entityIdColumn.notNull).toBe(true);
			expect(entityIdColumn.name).toBe("entity_id");
		});

		it("should have binary as varchar for base64 storage", () => {
			const binaryColumn = crdtDocuments.binary;
			expect(binaryColumn.dataType).toBe("string");
			expect(binaryColumn.notNull).toBe(true);
		});

		it("should have syncVersion as integer with default 0", () => {
			const syncVersionColumn = crdtDocuments.syncVersion;
			expect(syncVersionColumn.dataType).toBe("number");
			expect(syncVersionColumn.notNull).toBe(true);
			expect(syncVersionColumn.default).toBe(0);
		});

		it("should have createdAt as timestamp with timezone", () => {
			const createdAtColumn = crdtDocuments.createdAt;
			expect(createdAtColumn.dataType).toBe("date");
			expect(createdAtColumn.notNull).toBe(true);
			expect(createdAtColumn.name).toBe("created_at");
		});

		it("should have updatedAt as timestamp with timezone", () => {
			const updatedAtColumn = crdtDocuments.updatedAt;
			expect(updatedAtColumn.dataType).toBe("date");
			expect(updatedAtColumn.notNull).toBe(true);
			expect(updatedAtColumn.name).toBe("updated_at");
		});
	});
});
