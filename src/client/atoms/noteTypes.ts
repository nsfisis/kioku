import { atomWithSuspenseQuery } from "jotai-tanstack-query";
import type { LocalNoteType } from "../db";
import { localNoteTypeRepository } from "../db/repositories";
import { ensureBootstrap } from "./sync";

export interface NoteType {
	id: string;
	name: string;
	frontTemplate: string;
	backTemplate: string;
	isReversible: boolean;
	createdAt: string;
	updatedAt: string;
}

async function loadCurrentUserId(): Promise<string | null> {
	const stored = localStorage.getItem("kioku_user");
	if (!stored) return null;
	try {
		const user = JSON.parse(stored) as { id?: string } | null;
		return user?.id ?? null;
	} catch {
		return null;
	}
}

function localNoteTypeToView(noteType: LocalNoteType): NoteType {
	return {
		id: noteType.id,
		name: noteType.name,
		frontTemplate: noteType.frontTemplate,
		backTemplate: noteType.backTemplate,
		isReversible: noteType.isReversible,
		createdAt: noteType.createdAt.toISOString(),
		updatedAt: noteType.updatedAt.toISOString(),
	};
}

async function loadNoteTypes(): Promise<NoteType[]> {
	const userId = await loadCurrentUserId();
	if (!userId) return [];
	const noteTypes = await localNoteTypeRepository.findByUserId(userId);
	noteTypes.sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime());
	return noteTypes.map(localNoteTypeToView);
}

// =====================
// NoteTypes List - Suspense-compatible, IndexedDB-first
// =====================

export const noteTypesAtom = atomWithSuspenseQuery(() => ({
	queryKey: ["noteTypes"],
	queryFn: async (): Promise<NoteType[]> => {
		const noteTypes = await loadNoteTypes();
		if (noteTypes.length > 0) {
			ensureBootstrap();
			return noteTypes;
		}
		await ensureBootstrap();
		return loadNoteTypes();
	},
}));
