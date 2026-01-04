import { atom, useSetAtom } from "jotai";
import { useEffect } from "react";
import { apiClient } from "../api/client";
import {
	conflictResolver,
	createPullService,
	createPushService,
	createSyncManager,
	type SyncManagerEvent,
	type SyncQueueState,
	type SyncResult,
	SyncStatus,
	syncQueue,
} from "../sync";
import type {
	ServerCard,
	ServerDeck,
	ServerNote,
	ServerNoteFieldType,
	ServerNoteFieldValue,
	ServerNoteType,
	ServerReviewLog,
	SyncPullResult,
} from "../sync/pull";
import type { SyncPushData, SyncPushResult } from "../sync/push";

// =====================
// Sync Services Setup
// =====================

interface PullResponse {
	decks: Array<
		Omit<ServerDeck, "createdAt" | "updatedAt" | "deletedAt"> & {
			createdAt: string;
			updatedAt: string;
			deletedAt: string | null;
		}
	>;
	cards: Array<
		Omit<
			ServerCard,
			"due" | "lastReview" | "createdAt" | "updatedAt" | "deletedAt"
		> & {
			due: string;
			lastReview: string | null;
			createdAt: string;
			updatedAt: string;
			deletedAt: string | null;
		}
	>;
	reviewLogs: Array<
		Omit<ServerReviewLog, "reviewedAt"> & {
			reviewedAt: string;
		}
	>;
	noteTypes: Array<
		Omit<ServerNoteType, "createdAt" | "updatedAt" | "deletedAt"> & {
			createdAt: string;
			updatedAt: string;
			deletedAt: string | null;
		}
	>;
	noteFieldTypes: Array<
		Omit<ServerNoteFieldType, "createdAt" | "updatedAt" | "deletedAt"> & {
			createdAt: string;
			updatedAt: string;
			deletedAt: string | null;
		}
	>;
	notes: Array<
		Omit<ServerNote, "createdAt" | "updatedAt" | "deletedAt"> & {
			createdAt: string;
			updatedAt: string;
			deletedAt: string | null;
		}
	>;
	noteFieldValues: Array<
		Omit<ServerNoteFieldValue, "createdAt" | "updatedAt"> & {
			createdAt: string;
			updatedAt: string;
		}
	>;
	currentSyncVersion: number;
}

async function pushToServer(data: SyncPushData): Promise<SyncPushResult> {
	const res = await apiClient.authenticatedFetch("/api/sync/push", {
		method: "POST",
		headers: {
			"Content-Type": "application/json",
		},
		body: JSON.stringify(data),
	});

	if (!res.ok) {
		const errorBody = (await res.json().catch(() => ({}))) as {
			error?: string;
		};
		throw new Error(errorBody.error || `Push failed with status ${res.status}`);
	}

	return res.json() as Promise<SyncPushResult>;
}

async function pullFromServer(
	lastSyncVersion: number,
): Promise<SyncPullResult> {
	const res = await apiClient.authenticatedFetch(
		`/api/sync/pull?lastSyncVersion=${lastSyncVersion}`,
	);

	if (!res.ok) {
		const errorBody = (await res.json().catch(() => ({}))) as {
			error?: string;
		};
		throw new Error(errorBody.error || `Pull failed with status ${res.status}`);
	}

	const data = (await res.json()) as PullResponse;

	return {
		decks: data.decks.map((d) => ({
			...d,
			createdAt: new Date(d.createdAt),
			updatedAt: new Date(d.updatedAt),
			deletedAt: d.deletedAt ? new Date(d.deletedAt) : null,
		})),
		cards: data.cards.map((c) => ({
			...c,
			due: new Date(c.due),
			lastReview: c.lastReview ? new Date(c.lastReview) : null,
			createdAt: new Date(c.createdAt),
			updatedAt: new Date(c.updatedAt),
			deletedAt: c.deletedAt ? new Date(c.deletedAt) : null,
		})),
		reviewLogs: data.reviewLogs.map((r) => ({
			...r,
			reviewedAt: new Date(r.reviewedAt),
		})),
		noteTypes: data.noteTypes.map((n) => ({
			...n,
			createdAt: new Date(n.createdAt),
			updatedAt: new Date(n.updatedAt),
			deletedAt: n.deletedAt ? new Date(n.deletedAt) : null,
		})),
		noteFieldTypes: data.noteFieldTypes.map((f) => ({
			...f,
			createdAt: new Date(f.createdAt),
			updatedAt: new Date(f.updatedAt),
			deletedAt: f.deletedAt ? new Date(f.deletedAt) : null,
		})),
		notes: data.notes.map((n) => ({
			...n,
			createdAt: new Date(n.createdAt),
			updatedAt: new Date(n.updatedAt),
			deletedAt: n.deletedAt ? new Date(n.deletedAt) : null,
		})),
		noteFieldValues: data.noteFieldValues.map((v) => ({
			...v,
			createdAt: new Date(v.createdAt),
			updatedAt: new Date(v.updatedAt),
		})),
		currentSyncVersion: data.currentSyncVersion,
	};
}

const pushService = createPushService({
	syncQueue,
	pushToServer,
});

const pullService = createPullService({
	syncQueue,
	pullFromServer,
});

const syncManager = createSyncManager({
	syncQueue,
	pushService,
	pullService,
	conflictResolver,
});

// =====================
// Sync State Atoms
// =====================

export const isOnlineAtom = atom<boolean>(
	typeof navigator !== "undefined" ? navigator.onLine : true,
);
export const isSyncingAtom = atom<boolean>(false);
export const pendingCountAtom = atom<number>(0);
export const lastSyncAtAtom = atom<Date | null>(null);
export const lastErrorAtom = atom<string | null>(null);
export const syncStatusAtom = atom<SyncQueueState["status"]>(SyncStatus.Idle);

// Action atom - trigger sync
export const syncActionAtom = atom(null, async (): Promise<SyncResult> => {
	return syncManager.sync();
});

// Hook to initialize sync subscriptions
export function useSyncInit() {
	const setIsOnline = useSetAtom(isOnlineAtom);
	const setIsSyncing = useSetAtom(isSyncingAtom);
	const setPendingCount = useSetAtom(pendingCountAtom);
	const setLastSyncAt = useSetAtom(lastSyncAtAtom);
	const setLastError = useSetAtom(lastErrorAtom);
	const setStatus = useSetAtom(syncStatusAtom);

	useEffect(() => {
		syncManager.start();

		const unsubscribeManager = syncManager.subscribe(
			(event: SyncManagerEvent) => {
				switch (event.type) {
					case "online":
						setIsOnline(true);
						break;
					case "offline":
						setIsOnline(false);
						break;
					case "sync_start":
						setIsSyncing(true);
						setLastError(null);
						setStatus(SyncStatus.Syncing);
						break;
					case "sync_complete":
						setIsSyncing(false);
						setLastSyncAt(new Date());
						setStatus(SyncStatus.Idle);
						break;
					case "sync_error":
						setIsSyncing(false);
						setLastError(event.error);
						setStatus(SyncStatus.Error);
						break;
				}
			},
		);

		const unsubscribeQueue = syncQueue.subscribe((state: SyncQueueState) => {
			setPendingCount(state.pendingCount);
			if (state.lastSyncAt) {
				setLastSyncAt(state.lastSyncAt);
			}
			if (state.lastError) {
				setLastError(state.lastError);
			}
			setStatus(state.status);
		});

		// Initialize state from queue
		syncQueue.getState().then((state) => {
			setPendingCount(state.pendingCount);
			setLastSyncAt(state.lastSyncAt);
			setLastError(state.lastError);
			setStatus(state.status);
		});

		return () => {
			unsubscribeManager();
			unsubscribeQueue();
			syncManager.stop();
		};
	}, [
		setIsOnline,
		setIsSyncing,
		setPendingCount,
		setLastSyncAt,
		setLastError,
		setStatus,
	]);
}
