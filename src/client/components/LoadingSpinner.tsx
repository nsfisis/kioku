import { faSpinner } from "@fortawesome/free-solid-svg-icons";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";

interface LoadingSpinnerProps {
	className?: string;
}

export function LoadingSpinner({ className = "" }: LoadingSpinnerProps) {
	return (
		<div className={`flex items-center justify-center py-12 ${className}`}>
			<FontAwesomeIcon
				icon={faSpinner}
				className="h-8 w-8 text-primary animate-spin"
				aria-hidden="true"
			/>
		</div>
	);
}
