import { atomWithSuspenseQuery } from "jotai-tanstack-query";
import type { LocalNoteType } from "../db";
import { localNoteTypeRepository } from "../db/repositories";
import { sessionGenerationAtom, userAtom } from "./auth";
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

async function loadNoteTypes(userId: string | null): Promise<NoteType[]> {
	if (!userId) return [];
	const noteTypes = await localNoteTypeRepository.findByUserId(userId);
	noteTypes.sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime());
	return noteTypes.map(localNoteTypeToView);
}

// =====================
// NoteTypes List - Suspense-compatible, IndexedDB-first
// =====================

export const noteTypesAtom = atomWithSuspenseQuery((get) => {
	// Rebuild on sign-in/out; see sessionGenerationAtom.
	get(sessionGenerationAtom);
	const userId = get(userAtom)?.id ?? null;
	return {
		queryKey: ["noteTypes"],
		queryFn: async (): Promise<NoteType[]> => {
			const noteTypes = await loadNoteTypes(userId);
			if (noteTypes.length > 0) {
				ensureBootstrap();
				return noteTypes;
			}
			await ensureBootstrap();
			return loadNoteTypes(userId);
		},
	};
});
