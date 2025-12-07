import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { App } from "./App";
import { AuthProvider, SyncProvider } from "./stores";
import "./styles.css";

const rootElement = document.getElementById("root");
if (!rootElement) {
	throw new Error("Root element not found");
}

createRoot(rootElement).render(
	<StrictMode>
		<AuthProvider>
			<SyncProvider>
				<App />
			</SyncProvider>
		</AuthProvider>
	</StrictMode>,
);
