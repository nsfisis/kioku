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

	const getStatusColor = (): string => {
		if (!isOnline) {
			return "#6c757d"; // gray
		}
		if (isSyncing) {
			return "#007bff"; // blue
		}
		if (status === SyncStatus.Error) {
			return "#dc3545"; // red
		}
		if (pendingCount > 0) {
			return "#ffc107"; // yellow
		}
		return "#28a745"; // green
	};

	const getStatusIcon = (): string => {
		if (!isOnline) {
			return "\u25CB"; // hollow circle
		}
		if (isSyncing) {
			return "\u21BB"; // rotating arrows
		}
		if (status === SyncStatus.Error) {
			return "\u2717"; // cross mark
		}
		if (pendingCount > 0) {
			return "\u25D4"; // partial circle
		}
		return "\u2713"; // check mark
	};

	return (
		<div
			data-testid="sync-status-indicator"
			style={{
				display: "inline-flex",
				alignItems: "center",
				gap: "0.25rem",
				padding: "0.25rem 0.5rem",
				borderRadius: "4px",
				backgroundColor: "#f8f9fa",
				border: "1px solid #dee2e6",
				fontSize: "0.875rem",
			}}
			title={lastError || undefined}
		>
			<span
				style={{
					color: getStatusColor(),
					fontWeight: "bold",
				}}
				aria-hidden="true"
			>
				{getStatusIcon()}
			</span>
			<span style={{ color: getStatusColor() }}>{getStatusText()}</span>
		</div>
	);
}
