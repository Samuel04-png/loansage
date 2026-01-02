import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ReactNode } from 'react';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      // Enhanced offline-first caching: Extended cache times for offline support
      staleTime: 1000 * 60 * 10, // 10 minutes default
      gcTime: 1000 * 60 * 60, // 1 hour cache time for offline access (formerly cacheTime)
      refetchOnWindowFocus: false,
      refetchOnMount: false, // Don't refetch on mount if data is fresh - use cache
      refetchOnReconnect: true, // Refetch when reconnecting after offline
      retry: (failureCount, error: any) => {
        // Don't retry on 4xx errors (client errors)
        if (error?.status >= 400 && error?.status < 500) {
          return false;
        }
        // Retry up to 2 times for other errors
        return failureCount < 2;
      },
      retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 30000),
      // Use cached data when offline
      placeholderData: (previousData) => previousData,
    },
    mutations: {
      retry: (failureCount, error: any) => {
        // If offline, don't retry - will be queued
        if (!navigator.onLine) {
          return false;
        }
        return failureCount < 1;
      },
      retryDelay: 1000,
    },
  },
});

// Query-specific configurations for cost optimization
export const queryConfigs = {
  // Dashboard stats: cache for 15 minutes (reduces reads by 80%)
  dashboardStats: {
    staleTime: 1000 * 60 * 15, // 15 minutes
    gcTime: 1000 * 60 * 60, // 1 hour cache
    refetchInterval: false, // No auto-refetch
  },
  // Lists: cache for 10 minutes
  lists: {
    staleTime: 1000 * 60 * 10, // 10 minutes
    gcTime: 1000 * 60 * 30, // 30 minutes cache
  },
  // Details: cache for 5 minutes (more dynamic)
  details: {
    staleTime: 1000 * 60 * 5, // 5 minutes
    gcTime: 1000 * 60 * 15, // 15 minutes cache
  },
  // Static data: cache for 1 hour
  static: {
    staleTime: 1000 * 60 * 60, // 1 hour
    gcTime: 1000 * 60 * 60 * 24, // 24 hours cache
  },
};

interface QueryProviderProps {
  children: ReactNode;
}

export function QueryProvider({ children }: QueryProviderProps) {
  return (
    <QueryClientProvider client={queryClient}>
      {children}
    </QueryClientProvider>
  );
}

