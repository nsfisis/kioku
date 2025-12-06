import type { ReactNode } from "react";
import { Redirect } from "wouter";
import { useAuth } from "../stores";

export interface ProtectedRouteProps {
	children: ReactNode;
}

export function ProtectedRoute({ children }: ProtectedRouteProps) {
	const { isAuthenticated, isLoading } = useAuth();

	if (isLoading) {
		return <div>Loading...</div>;
	}

	if (!isAuthenticated) {
		return <Redirect to="/login" replace />;
	}

	return <>{children}</>;
}
