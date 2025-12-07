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
					<svg
						className="w-4 h-4 animate-spin"
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
					<span>Syncing...</span>
				</>
			) : (
				<>
					<svg
						className="w-4 h-4"
						fill="none"
						stroke="currentColor"
						viewBox="0 0 24 24"
						aria-hidden="true"
					>
						<path
							strokeLinecap="round"
							strokeLinejoin="round"
							strokeWidth={2}
							d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
						/>
					</svg>
					<span>Sync</span>
				</>
			)}
		</button>
	);
}
