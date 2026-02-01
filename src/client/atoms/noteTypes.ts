import { atomWithSuspenseQuery } from "jotai-tanstack-query";
import { apiClient } from "../api/client";

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

export const noteTypesAtom = atomWithSuspenseQuery(() => ({
	queryKey: ["noteTypes"],
	queryFn: async () => {
		const res = await apiClient.rpc.api["note-types"].$get();
		const data = await apiClient.handleResponse<{ noteTypes: NoteType[] }>(res);
		return data.noteTypes;
	},
}));
