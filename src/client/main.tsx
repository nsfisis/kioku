import { Provider, useStore } from "jotai/react";
import { useHydrateAtoms } from "jotai/react/utils";
import { queryClientAtom } from "jotai-tanstack-query";
import { type ReactNode, StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { App } from "./App";
import { StoreInitializer } from "./components/StoreInitializer";
import { queryClient } from "./queryClient";
import "./styles.css";

function HydrateQueryClient({ children }: { children: ReactNode }) {
	const store = useStore();
	useHydrateAtoms([[queryClientAtom, queryClient]], { store });
	return <>{children}</>;
}

const rootElement = document.getElementById("root");
if (!rootElement) {
	throw new Error("Root element not found");
}

createRoot(rootElement).render(
	<StrictMode>
		<Provider>
			<HydrateQueryClient>
				<StoreInitializer>
					<App />
				</StoreInitializer>
			</HydrateQueryClient>
		</Provider>
	</StrictMode>,
);
