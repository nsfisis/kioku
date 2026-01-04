import { apiClient } from "../api/client";
import { createReloadableAtom } from "./utils";

export interface NoteType {
	id: string;
	name: string;
	frontTemplate: string;
	backTemplate: string;
	isReversible: boolean;
	createdAt: string;
	updatedAt: string;
}

// =====================
// NoteTypes List - Suspense-compatible
// =====================

export const noteTypesAtom = createReloadableAtom(async () => {
	const res = await apiClient.rpc.api["note-types"].$get();
	const data = await apiClient.handleResponse<{ noteTypes: NoteType[] }>(res);
	return data.noteTypes;
});
