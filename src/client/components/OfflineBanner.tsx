import { useSync } from "../stores";

export function OfflineBanner() {
	const { isOnline, pendingCount } = useSync();

	if (isOnline) {
		return null;
	}

	return (
		<div
			data-testid="offline-banner"
			role="status"
			aria-live="polite"
			style={{
				backgroundColor: "#6c757d",
				color: "white",
				padding: "0.5rem 1rem",
				textAlign: "center",
				fontSize: "0.875rem",
				display: "flex",
				alignItems: "center",
				justifyContent: "center",
				gap: "0.5rem",
			}}
		>
			<span aria-hidden="true">⚡</span>
			<span>
				You're offline. Changes will sync when you reconnect.
				{pendingCount > 0 && (
					<span data-testid="offline-pending-count">
						{" "}
						({pendingCount} pending)
					</span>
				)}
			</span>
		</div>
	);
}
