import { faWifi } from "@fortawesome/free-solid-svg-icons";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { useSync } from "../stores";

export function OfflineBanner() {
	const { isOnline, pendingCount } = useSync();

	if (isOnline) {
		return null;
	}

	return (
		<output
			data-testid="offline-banner"
			aria-live="polite"
			className="bg-slate text-white py-2 px-4 text-sm flex items-center justify-center gap-2"
		>
			<FontAwesomeIcon
				icon={faWifi}
				className="w-4 h-4 text-warning"
				aria-hidden="true"
			/>
			<span>
				You're offline. Changes will sync when you reconnect.
				{pendingCount > 0 && (
					<span data-testid="offline-pending-count" className="ml-1 opacity-80">
						({pendingCount} pending)
					</span>
				)}
			</span>
		</output>
	);
}
