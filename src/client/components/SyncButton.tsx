import {
	faArrowsRotate,
	faCircleCheck,
	faCircleXmark,
	faSpinner,
} from "@fortawesome/free-solid-svg-icons";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { useAtomValue, useSetAtom } from "jotai";
import {
	isOnlineAtom,
	isSyncingAtom,
	lastErrorAtom,
	pendingCountAtom,
	SyncStatus,
	syncActionAtom,
	syncStatusAtom,
} from "../atoms";

type SyncButtonState = "offline" | "syncing" | "error" | "pending" | "synced";

const stateStyles: Record<SyncButtonState, string> = {
	offline: "bg-ivory text-muted cursor-not-allowed",
	syncing: "bg-info/10 text-info cursor-not-allowed",
	error: "bg-error/10 text-error hover:bg-error/20 active:scale-[0.98]",
	pending: "bg-warning/10 text-warning hover:bg-warning/20 active:scale-[0.98]",
	synced: "bg-success/10 text-success hover:bg-success/20 active:scale-[0.98]",
};

const stateIcons = {
	offline: faArrowsRotate,
	syncing: faSpinner,
	error: faCircleXmark,
	pending: faArrowsRotate,
	synced: faCircleCheck,
} as const satisfies Record<SyncButtonState, unknown>;

export function SyncButton() {
	const isOnline = useAtomValue(isOnlineAtom);
	const isSyncing = useAtomValue(isSyncingAtom);
	const pendingCount = useAtomValue(pendingCountAtom);
	const lastError = useAtomValue(lastErrorAtom);
	const status = useAtomValue(syncStatusAtom);
	const sync = useSetAtom(syncActionAtom);

	const handleSync = async () => {
		await sync();
	};

	const getState = (): SyncButtonState => {
		if (!isOnline) {
			return "offline";
		}
		if (isSyncing) {
			return "syncing";
		}
		if (status === SyncStatus.Error) {
			return "error";
		}
		if (pendingCount > 0) {
			return "pending";
		}
		return "synced";
	};

	const state = getState();

	const getTitle = (): string | undefined => {
		switch (state) {
			case "offline":
				return "Cannot sync while offline";
			case "syncing":
				return undefined;
			case "error":
				return lastError || "Sync failed";
			case "pending":
				return `${pendingCount} pending`;
			case "synced":
				return "Synced";
		}
	};

	return (
		<button
			type="button"
			data-testid="sync-button"
			data-state={state}
			onClick={handleSync}
			disabled={state === "offline" || state === "syncing"}
			title={getTitle()}
			className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium transition-all duration-200 ${stateStyles[state]}`}
		>
			<FontAwesomeIcon
				icon={stateIcons[state]}
				className={`w-4 h-4 ${state === "syncing" ? "animate-spin" : ""}`}
				aria-hidden="true"
			/>
			<span>{state === "syncing" ? "Syncing..." : "Sync"}</span>
			{state === "pending" && (
				<span
					data-testid="sync-pending-count"
					className="px-1.5 rounded-full bg-warning/20 text-xs tabular-nums"
				>
					{pendingCount}
				</span>
			)}
		</button>
	);
}
