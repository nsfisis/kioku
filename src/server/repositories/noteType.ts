import { and, eq, isNull, sql } from "drizzle-orm";
import { db } from "../db/index.js";
import { noteFieldTypes, notes, noteTypes } from "../db/schema.js";
import type {
	NoteFieldType,
	NoteFieldTypeRepository,
	NoteType,
	NoteTypeRepository,
	NoteTypeWithFields,
} from "./types.js";

export const noteTypeRepository: NoteTypeRepository = {
	async findByUserId(userId: string): Promise<NoteType[]> {
		const result = await db
			.select()
			.from(noteTypes)
			.where(and(eq(noteTypes.userId, userId), isNull(noteTypes.deletedAt)))
			.orderBy(noteTypes.createdAt);
		return result;
	},

	async findById(id: string, userId: string): Promise<NoteType | undefined> {
		const result = await db
			.select()
			.from(noteTypes)
			.where(
				and(
					eq(noteTypes.id, id),
					eq(noteTypes.userId, userId),
					isNull(noteTypes.deletedAt),
				),
			);
		return result[0];
	},

	async findByIdWithFields(
		id: string,
		userId: string,
	): Promise<NoteTypeWithFields | undefined> {
		const noteType = await this.findById(id, userId);
		if (!noteType) {
			return undefined;
		}

		const fields = await db
			.select()
			.from(noteFieldTypes)
			.where(
				and(
					eq(noteFieldTypes.noteTypeId, id),
					isNull(noteFieldTypes.deletedAt),
				),
			)
			.orderBy(noteFieldTypes.order);

		return {
			...noteType,
			fields,
		};
	},

	async create(data: {
		userId: string;
		name: string;
		frontTemplate: string;
		backTemplate: string;
		isReversible?: boolean;
	}): Promise<NoteType> {
		const [noteType] = await db
			.insert(noteTypes)
			.values({
				userId: data.userId,
				name: data.name,
				frontTemplate: data.frontTemplate,
				backTemplate: data.backTemplate,
				isReversible: data.isReversible ?? false,
			})
			.returning();
		if (!noteType) {
			throw new Error("Failed to create note type");
		}
		return noteType;
	},

	async update(
		id: string,
		userId: string,
		data: {
			name?: string;
			frontTemplate?: string;
			backTemplate?: string;
			isReversible?: boolean;
		},
	): Promise<NoteType | undefined> {
		const result = await db
			.update(noteTypes)
			.set({
				...data,
				updatedAt: new Date(),
				syncVersion: sql`${noteTypes.syncVersion} + 1`,
			})
			.where(
				and(
					eq(noteTypes.id, id),
					eq(noteTypes.userId, userId),
					isNull(noteTypes.deletedAt),
				),
			)
			.returning();
		return result[0];
	},

	async softDelete(id: string, userId: string): Promise<boolean> {
		const result = await db
			.update(noteTypes)
			.set({
				deletedAt: new Date(),
				updatedAt: new Date(),
				syncVersion: sql`${noteTypes.syncVersion} + 1`,
			})
			.where(
				and(
					eq(noteTypes.id, id),
					eq(noteTypes.userId, userId),
					isNull(noteTypes.deletedAt),
				),
			)
			.returning({ id: noteTypes.id });
		return result.length > 0;
	},

	async hasNotes(id: string, userId: string): Promise<boolean> {
		const noteType = await this.findById(id, userId);
		if (!noteType) {
			return false;
		}

		const result = await db
			.select({ id: notes.id })
			.from(notes)
			.where(and(eq(notes.noteTypeId, id), isNull(notes.deletedAt)))
			.limit(1);

		return result.length > 0;
	},
};

export const noteFieldTypeRepository: NoteFieldTypeRepository = {
	async findByNoteTypeId(noteTypeId: string): Promise<NoteFieldType[]> {
		const result = await db
			.select()
			.from(noteFieldTypes)
			.where(
				and(
					eq(noteFieldTypes.noteTypeId, noteTypeId),
					isNull(noteFieldTypes.deletedAt),
				),
			)
			.orderBy(noteFieldTypes.order);
		return result;
	},

	async findById(
		id: string,
		noteTypeId: string,
	): Promise<NoteFieldType | undefined> {
		const result = await db
			.select()
			.from(noteFieldTypes)
			.where(
				and(
					eq(noteFieldTypes.id, id),
					eq(noteFieldTypes.noteTypeId, noteTypeId),
					isNull(noteFieldTypes.deletedAt),
				),
			);
		return result[0];
	},

	async create(
		noteTypeId: string,
		data: {
			name: string;
			order: number;
			fieldType?: string;
		},
	): Promise<NoteFieldType> {
		const [field] = await db
			.insert(noteFieldTypes)
			.values({
				noteTypeId,
				name: data.name,
				order: data.order,
				fieldType: data.fieldType ?? "text",
			})
			.returning();
		if (!field) {
			throw new Error("Failed to create note field type");
		}
		return field;
	},

	async update(
		id: string,
		noteTypeId: string,
		data: {
			name?: string;
			order?: number;
		},
	): Promise<NoteFieldType | undefined> {
		const result = await db
			.update(noteFieldTypes)
			.set({
				...data,
				updatedAt: new Date(),
				syncVersion: sql`${noteFieldTypes.syncVersion} + 1`,
			})
			.where(
				and(
					eq(noteFieldTypes.id, id),
					eq(noteFieldTypes.noteTypeId, noteTypeId),
					isNull(noteFieldTypes.deletedAt),
				),
			)
			.returning();
		return result[0];
	},

	async softDelete(id: string, noteTypeId: string): Promise<boolean> {
		const result = await db
			.update(noteFieldTypes)
			.set({
				deletedAt: new Date(),
				updatedAt: new Date(),
				syncVersion: sql`${noteFieldTypes.syncVersion} + 1`,
			})
			.where(
				and(
					eq(noteFieldTypes.id, id),
					eq(noteFieldTypes.noteTypeId, noteTypeId),
					isNull(noteFieldTypes.deletedAt),
				),
			)
			.returning({ id: noteFieldTypes.id });
		return result.length > 0;
	},

	async reorder(
		noteTypeId: string,
		fieldIds: string[],
	): Promise<NoteFieldType[]> {
		const updatedFields: NoteFieldType[] = [];

		for (let i = 0; i < fieldIds.length; i++) {
			const fieldId = fieldIds[i];
			if (!fieldId) {
				continue;
			}
			const result = await db
				.update(noteFieldTypes)
				.set({
					order: i,
					updatedAt: new Date(),
					syncVersion: sql`${noteFieldTypes.syncVersion} + 1`,
				})
				.where(
					and(
						eq(noteFieldTypes.id, fieldId),
						eq(noteFieldTypes.noteTypeId, noteTypeId),
						isNull(noteFieldTypes.deletedAt),
					),
				)
				.returning();

			if (result[0]) {
				updatedFields.push(result[0]);
			}
		}

		return updatedFields.sort((a, b) => a.order - b.order);
	},

	async hasNoteFieldValues(id: string): Promise<boolean> {
		const { noteFieldValues } = await import("../db/schema.js");

		const result = await db
			.select({ id: noteFieldValues.id })
			.from(noteFieldValues)
			.where(eq(noteFieldValues.noteFieldTypeId, id))
			.limit(1);

		return result.length > 0;
	},
};
