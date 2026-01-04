import type { ReactNode } from "react";
import { useAuthInit, useSyncInit } from "../atoms";

interface StoreInitializerProps {
	children: ReactNode;
}

export function StoreInitializer({ children }: StoreInitializerProps) {
	useAuthInit();
	useSyncInit();
	return <>{children}</>;
}
