import { faArrowsRotate, faSpinner } from "@fortawesome/free-solid-svg-icons";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { useSync } from "../stores";

export function SyncButton() {
	const { isOnline, isSyncing, sync } = useSync();

	const handleSync = async () => {
		await sync();
	};

	const isDisabled = !isOnline || isSyncing;

	return (
		<button
			type="button"
			data-testid="sync-button"
			onClick={handleSync}
			disabled={isDisabled}
			title={!isOnline ? "Cannot sync while offline" : undefined}
			className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium transition-all duration-200 ${
				isDisabled
					? "bg-ivory text-muted cursor-not-allowed"
					: "bg-primary text-white hover:bg-primary-dark active:scale-[0.98]"
			}`}
		>
			{isSyncing ? (
				<>
					<FontAwesomeIcon
						icon={faSpinner}
						className="w-4 h-4 animate-spin"
						aria-hidden="true"
					/>
					<span>Syncing...</span>
				</>
			) : (
				<>
					<FontAwesomeIcon
						icon={faArrowsRotate}
						className="w-4 h-4"
						aria-hidden="true"
					/>
					<span>Sync</span>
				</>
			)}
		</button>
	);
}
