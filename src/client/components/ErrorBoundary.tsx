import { Component, type ReactNode } from "react";

interface ErrorBoundaryProps {
	children: ReactNode;
	fallback?: ReactNode;
}

interface ErrorBoundaryState {
	hasError: boolean;
	error: Error | null;
}

export class ErrorBoundary extends Component<
	ErrorBoundaryProps,
	ErrorBoundaryState
> {
	override state: ErrorBoundaryState = { hasError: false, error: null };

	static getDerivedStateFromError(error: Error): ErrorBoundaryState {
		return { hasError: true, error };
	}

	override render() {
		if (this.state.hasError) {
			return this.props.fallback ?? <ErrorFallback error={this.state.error} />;
		}
		return this.props.children;
	}
}

function ErrorFallback({ error }: { error: Error | null }) {
	return (
		<div
			role="alert"
			className="bg-error/5 border border-error/20 rounded-xl p-4"
		>
			<span className="text-error">
				{error?.message ?? "An error occurred"}
			</span>
		</div>
	);
}
