import {
	faCircle,
	faCircleCheck,
	faCircleXmark,
	faClock,
	faSpinner,
} from "@fortawesome/free-solid-svg-icons";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { useAtomValue } from "jotai";
import {
	isOnlineAtom,
	isSyncingAtom,
	lastErrorAtom,
	pendingCountAtom,
	SyncStatus,
	syncStatusAtom,
} from "../atoms";

export function SyncStatusIndicator() {
	const isOnline = useAtomValue(isOnlineAtom);
	const isSyncing = useAtomValue(isSyncingAtom);
	const pendingCount = useAtomValue(pendingCountAtom);
	const lastError = useAtomValue(lastErrorAtom);
	const status = useAtomValue(syncStatusAtom);

	const getStatusText = (): string => {
		if (!isOnline) {
			return "Offline";
		}
		if (isSyncing) {
			return "Syncing...";
		}
		if (status === SyncStatus.Error && lastError) {
			return "Sync error";
		}
		if (pendingCount > 0) {
			return `${pendingCount} pending`;
		}
		return "Synced";
	};

	const getStatusStyles = (): string => {
		if (!isOnline) {
			return "bg-muted/10 text-muted";
		}
		if (isSyncing) {
			return "bg-info/10 text-info";
		}
		if (status === SyncStatus.Error) {
			return "bg-error/10 text-error";
		}
		if (pendingCount > 0) {
			return "bg-warning/10 text-warning";
		}
		return "bg-success/10 text-success";
	};

	const getStatusIcon = () => {
		if (!isOnline) {
			return (
				<FontAwesomeIcon
					icon={faCircle}
					className="w-3.5 h-3.5"
					aria-hidden="true"
				/>
			);
		}
		if (isSyncing) {
			return (
				<FontAwesomeIcon
					icon={faSpinner}
					className="w-3.5 h-3.5 animate-spin"
					aria-hidden="true"
				/>
			);
		}
		if (status === SyncStatus.Error) {
			return (
				<FontAwesomeIcon
					icon={faCircleXmark}
					className="w-3.5 h-3.5"
					aria-hidden="true"
				/>
			);
		}
		if (pendingCount > 0) {
			return (
				<FontAwesomeIcon
					icon={faClock}
					className="w-3.5 h-3.5"
					aria-hidden="true"
				/>
			);
		}
		return (
			<FontAwesomeIcon
				icon={faCircleCheck}
				className="w-3.5 h-3.5"
				aria-hidden="true"
			/>
		);
	};

	return (
		<div
			data-testid="sync-status-indicator"
			className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium transition-colors ${getStatusStyles()}`}
			title={lastError || undefined}
		>
			{getStatusIcon()}
			<span>{getStatusText()}</span>
		</div>
	);
}
