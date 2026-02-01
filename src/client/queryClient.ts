import { QueryClient } from "@tanstack/query-core";

export const queryClient = new QueryClient({
	defaultOptions: {
		queries: {
			staleTime: 0,
			retry: false,
		},
	},
});
