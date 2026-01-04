import { useAtomValue } from "jotai";
import type { ReactNode } from "react";
import { Redirect } from "wouter";
import { authLoadingAtom, isAuthenticatedAtom } from "../atoms";

export interface ProtectedRouteProps {
	children: ReactNode;
}

export function ProtectedRoute({ children }: ProtectedRouteProps) {
	const isAuthenticated = useAtomValue(isAuthenticatedAtom);
	const isLoading = useAtomValue(authLoadingAtom);

	if (isLoading) {
		return <output>Loading...</output>;
	}

	if (!isAuthenticated) {
		return <Redirect to="/login" replace />;
	}

	return <>{children}</>;
}
