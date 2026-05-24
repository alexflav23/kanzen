import { QueryClient } from "@tanstack/react-query";

/** One shared TanStack Query client. Conservative defaults: retry once, no refetch on
  * focus, short stale window — tune per-query as features need. */
export const queryClient = new QueryClient({
  defaultOptions: {
    queries: { retry: 1, refetchOnWindowFocus: false, staleTime: 30_000 },
  },
});
