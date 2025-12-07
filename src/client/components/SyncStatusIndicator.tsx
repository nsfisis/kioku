import { useSync } from "../stores";
import { SyncStatus } from "../sync";

export function SyncStatusIndicator() {
	const { isOnline, isSyncing, pendingCount, lastError, status } = useSync();

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
				<svg
					className="w-3.5 h-3.5"
					fill="currentColor"
					viewBox="0 0 20 20"
					aria-hidden="true"
				>
					<circle cx="10" cy="10" r="4" />
				</svg>
			);
		}
		if (isSyncing) {
			return (
				<svg
					className="w-3.5 h-3.5 animate-spin"
					fill="none"
					viewBox="0 0 24 24"
					aria-hidden="true"
				>
					<circle
						className="opacity-25"
						cx="12"
						cy="12"
						r="10"
						stroke="currentColor"
						strokeWidth="4"
					/>
					<path
						className="opacity-75"
						fill="currentColor"
						d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
					/>
				</svg>
			);
		}
		if (status === SyncStatus.Error) {
			return (
				<svg
					className="w-3.5 h-3.5"
					fill="currentColor"
					viewBox="0 0 20 20"
					aria-hidden="true"
				>
					<path
						fillRule="evenodd"
						d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z"
						clipRule="evenodd"
					/>
				</svg>
			);
		}
		if (pendingCount > 0) {
			return (
				<svg
					className="w-3.5 h-3.5"
					fill="currentColor"
					viewBox="0 0 20 20"
					aria-hidden="true"
				>
					<path
						fillRule="evenodd"
						d="M10 18a8 8 0 100-16 8 8 0 000 16zm1-12a1 1 0 10-2 0v4a1 1 0 00.293.707l2.828 2.829a1 1 0 101.415-1.415L11 9.586V6z"
						clipRule="evenodd"
					/>
				</svg>
			);
		}
		return (
			<svg
				className="w-3.5 h-3.5"
				fill="currentColor"
				viewBox="0 0 20 20"
				aria-hidden="true"
			>
				<path
					fillRule="evenodd"
					d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z"
					clipRule="evenodd"
				/>
			</svg>
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
