import { useSync } from "../stores";

export function SyncButton() {
	const { isOnline, isSyncing, sync } = useSync();

	const handleSync = async () => {
		await sync();
	};

	const isDisabled = !isOnline || isSyncing;

	const getButtonText = (): string => {
		if (isSyncing) {
			return "Syncing...";
		}
		return "Sync";
	};

	return (
		<button
			type="button"
			data-testid="sync-button"
			onClick={handleSync}
			disabled={isDisabled}
			title={!isOnline ? "Cannot sync while offline" : undefined}
			style={{
				padding: "0.25rem 0.5rem",
				borderRadius: "4px",
				border: "1px solid #dee2e6",
				backgroundColor: isDisabled ? "#e9ecef" : "#007bff",
				color: isDisabled ? "#6c757d" : "white",
				cursor: isDisabled ? "not-allowed" : "pointer",
				fontSize: "0.875rem",
			}}
		>
			{getButtonText()}
		</button>
	);
}
