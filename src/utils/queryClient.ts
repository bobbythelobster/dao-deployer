import { createContext, useContext, createSignal, createEffect, batch } from "solid-js";
import type { Component, JSX, Accessor } from "solid-js";

// Query types
interface QueryKey extends Array<string | number | object> {}

interface QueryOptions<T> {
  queryKey: QueryKey;
  queryFn: () => Promise<T>;
  staleTime?: number; // Time in ms before data is considered stale
  cacheTime?: number; // Time in ms to keep data in cache
  retry?: number | boolean;
  retryDelay?: number;
  enabled?: boolean | Accessor<boolean>;
  refetchOnWindowFocus?: boolean;
  refetchOnReconnect?: boolean;
  onSuccess?: (data: T) => void;
  onError?: (error: Error) => void;
}

interface QueryState<T> {
  data: T | undefined;
  error: Error | null;
  isLoading: boolean;
  isFetching: boolean;
  isStale: boolean;
  lastUpdated: number | null;
}

interface QueryCacheEntry<T> {
  state: QueryState<T>;
  subscribers: Set<() => void>;
  promise: Promise<T> | null;
  timeoutId: ReturnType<typeof setTimeout> | null;
}

// Query cache
const queryCache = new Map<string, QueryCacheEntry<any>>();

// Generate cache key from query key
const generateCacheKey = (queryKey: QueryKey): string => {
  return JSON.stringify(queryKey);
};

// Deduplication map - tracks in-flight requests
const inFlightRequests = new Map<string, Promise<any>>();

// Query context
interface QueryContextValue {
  prefetchQuery: <T>(options: QueryOptions<T>) => Promise<T>;
  invalidateQueries: (queryKey: QueryKey) => void;
  refetchQueries: (queryKey: QueryKey) => void;
  clearCache: () => void;
  getQueryState: <T>(queryKey: QueryKey) => QueryState<T> | undefined;
}

const QueryContext = createContext<QueryContextValue>();

// Query Client Provider
export const QueryClientProvider: Component<{ children: JSX.Element }> = (props) => {
  const prefetchQuery = async <T,>(options: QueryOptions<T>): Promise<T> => {
    const cacheKey = generateCacheKey(options.queryKey);
    
    // Check if request is already in flight (deduplication)
    if (inFlightRequests.has(cacheKey)) {
      return inFlightRequests.get(cacheKey) as Promise<T>;
    }

    // Check cache
    const cached = queryCache.get(cacheKey);
    if (cached && !cached.state.isStale) {
      if (cached.state.data !== undefined) {
        return cached.state.data;
      }
    }

    // Create new request
    const promise = fetchQuery(options);
    inFlightRequests.set(cacheKey, promise);

    try {
      const result = await promise;
      return result;
    } finally {
      inFlightRequests.delete(cacheKey);
    }
  };

  const fetchQuery = async <T,>(options: QueryOptions<T>): Promise<T> => {
    const cacheKey = generateCacheKey(options.queryKey);
    const cacheTime = options.cacheTime || 5 * 60 * 1000; // 5 minutes default

    try {
      const data = await options.queryFn();
      
      // Update cache
      const entry: QueryCacheEntry<T> = {
        state: {
          data,
          error: null,
          isLoading: false,
          isFetching: false,
          isStale: false,
          lastUpdated: Date.now(),
        },
        subscribers: new Set(),
        promise: null,
        timeoutId: setTimeout(() => {
          queryCache.delete(cacheKey);
        }, cacheTime),
      };
      
      queryCache.set(cacheKey, entry);
      
      options.onSuccess?.(data);
      
      return data;
    } catch (error) {
      const entry: QueryCacheEntry<T> = {
        state: {
          data: undefined,
          error: error as Error,
          isLoading: false,
          isFetching: false,
          isStale: true,
          lastUpdated: null,
        },
        subscribers: new Set(),
        promise: null,
        timeoutId: null,
      };
      
      queryCache.set(cacheKey, entry);
      
      options.onError?.(error as Error);
      
      throw error;
    }
  };

  const invalidateQueries = (queryKey: QueryKey) => {
    const keyPrefix = JSON.stringify(queryKey);
    
    queryCache.forEach((entry, cacheKey) => {
      if (cacheKey.startsWith(keyPrefix)) {
        entry.state.isStale = true;
        // Notify subscribers
        entry.subscribers.forEach((callback) => callback());
      }
    });
  };

  const refetchQueries = async (queryKey: QueryKey) => {
    const keyPrefix = JSON.stringify(queryKey);
    
    const promises: Promise<any>[] = [];
    queryCache.forEach((entry, cacheKey) => {
      if (cacheKey.startsWith(keyPrefix)) {
        // Trigger refetch for each matching query
        entry.subscribers.forEach((callback) => callback());
      }
    });
    
    await Promise.all(promises);
  };

  const clearCache = () => {
    queryCache.forEach((entry) => {
      if (entry.timeoutId) {
        clearTimeout(entry.timeoutId);
      }
    });
    queryCache.clear();
  };

  const getQueryState = <T,>(queryKey: QueryKey): QueryState<T> | undefined => {
    const cacheKey = generateCacheKey(queryKey);
    return queryCache.get(cacheKey)?.state;
  };

  const value: QueryContextValue = {
    prefetchQuery,
    invalidateQueries,
    refetchQueries,
    clearCache,
    getQueryState,
  };

  return (
    <QueryContext.Provider value={value}>
      {props.children}
    </QueryContext.Provider>
  );
};

// Hook to use query
export const useQuery = <T,>(options: QueryOptions<T>) => {
  const context = useContext(QueryContext);
  if (!context) {
    throw new Error("useQuery must be used within a QueryClientProvider");
  }

  const cacheKey = generateCacheKey(options.queryKey);
  const staleTime = options.staleTime || 0;
  const retryCount = typeof options.retry === "number" ? options.retry : options.retry === false ? 0 : 3;
  const retryDelay = options.retryDelay || 1000;

  const [state, setState] = createSignal<QueryState<T>>({
    data: undefined,
    error: null,
    isLoading: true,
    isFetching: false,
    isStale: false,
    lastUpdated: null,
  });

  const enabled = () => {
    const opt = options.enabled;
    return typeof opt === "function" ? opt() : opt !== false;
  };

  const executeQuery = async (isBackground = false) => {
    if (!enabled()) return;

    // Check for deduplication
    if (inFlightRequests.has(cacheKey)) {
      try {
        const data = await inFlightRequests.get(cacheKey);
        setState((prev) => ({ ...prev, data, isLoading: false }));
        return;
      } catch (error) {
        // Continue to fetch
      }
    }

    // Check cache
    const cached = queryCache.get(cacheKey);
    if (cached && !cached.state.isStale) {
      const isStale = Date.now() - (cached.state.lastUpdated || 0) > staleTime;
      if (!isStale) {
        setState(cached.state);
        return;
      }
    }

    if (!isBackground) {
      setState((prev) => ({ ...prev, isLoading: true }));
    } else {
      setState((prev) => ({ ...prev, isFetching: true }));
    }

    let attempts = 0;
    const tryFetch = async (): Promise<void> => {
      try {
        const data = await context.prefetchQuery(options);
        batch(() => {
          setState({
            data,
            error: null,
            isLoading: false,
            isFetching: false,
            isStale: false,
            lastUpdated: Date.now(),
          });
        });
      } catch (error) {
        if (attempts < retryCount) {
          attempts++;
          await new Promise((resolve) => setTimeout(resolve, retryDelay * attempts));
          return tryFetch();
        }
        batch(() => {
          setState((prev) => ({
            ...prev,
            error: error as Error,
            isLoading: false,
            isFetching: false,
          }));
        });
      }
    };

    await tryFetch();
  };

  // Subscribe to cache updates
  createEffect(() => {
    if (!enabled()) return;

    const cached = queryCache.get(cacheKey);
    if (cached) {
      const unsubscribe = () => {
        cached.subscribers.delete(notify);
      };
      
      const notify = () => {
        setState(cached.state);
      };
      
      cached.subscribers.add(notify);
      
      // Initial fetch if needed
      if (cached.state.data === undefined && !cached.promise) {
        executeQuery();
      } else {
        setState(cached.state);
      }

      return unsubscribe;
    } else {
      executeQuery();
    }
  });

  // Refetch on window focus
  createEffect(() => {
    if (!options.refetchOnWindowFocus) return;
    
    const handleFocus = () => {
      const cached = queryCache.get(cacheKey);
      if (cached && cached.state.isStale) {
        executeQuery(true);
      }
    };

    window.addEventListener("focus", handleFocus);
    return () => window.removeEventListener("focus", handleFocus);
  });

  // Refetch on reconnect
  createEffect(() => {
    if (!options.refetchOnReconnect) return;
    
    const handleOnline = () => {
      executeQuery(true);
    };

    window.addEventListener("online", handleOnline);
    return () => window.removeEventListener("online", handleOnline);
  });

  const refetch = () => executeQuery(true);
  
  return {
    ...state(),
    refetch,
  };
};

// Hook for mutations
export const useMutation = <T, V = void>(
  mutationFn: (variables: V) => Promise<T>,
  options?: {
    onSuccess?: (data: T, variables: V) => void;
    onError?: (error: Error, variables: V) => void;
    onSettled?: (data: T | undefined, error: Error | null, variables: V) => void;
  }
) => {
  const [isLoading, setIsLoading] = createSignal(false);
  const [isSuccess, setIsSuccess] = createSignal(false);
  const [isError, setIsError] = createSignal(false);
  const [error, setError] = createSignal<Error | null>(null);
  const [data, setData] = createSignal<T | undefined>(undefined);

  const mutate = async (variables: V): Promise<T | undefined> => {
    setIsLoading(true);
    setIsSuccess(false);
    setIsError(false);
    setError(null);

    try {
      const result = await mutationFn(variables);
      batch(() => {
        setData(result);
        setIsSuccess(true);
        setIsLoading(false);
      });
      options?.onSuccess?.(result, variables);
      return result;
    } catch (err) {
      batch(() => {
        setError(err as Error);
        setIsError(true);
        setIsLoading(false);
      });
      options?.onError?.(err as Error, variables);
    } finally {
      options?.onSettled?.(data(), error(), variables);
    }
  };

  const reset = () => {
    setIsLoading(false);
    setIsSuccess(false);
    setIsError(false);
    setError(null);
    setData(undefined);
  };

  return {
    mutate,
    reset,
    isLoading,
    isSuccess,
    isError,
    error,
    data,
  };
};

// Hook for infinite queries (pagination)
export const useInfiniteQuery = <T,>(
  options: QueryOptions<T[]> & {
    getNextPageParam: (lastPage: T[], allPages: T[][]) => number | undefined;
    initialPageParam?: number;
  }
) => {
  const [pageParam, setPageParam] = createSignal(options.initialPageParam || 0);
  const [hasNextPage, setHasNextPage] = createSignal(true);
  const [allPages, setAllPages] = createSignal<T[][]>([]);

  const queryOptions: QueryOptions<T[]> = {
    ...options,
    queryKey: [...options.queryKey, pageParam()],
  };

  const query = useQuery(queryOptions);

  createEffect(() => {
    if (query.data) {
      setAllPages((prev) => {
        const newPages = [...prev];
        newPages[pageParam()] = query.data!;
        return newPages;
      });

      const nextParam = options.getNextPageParam(query.data!, allPages());
      setHasNextPage(nextParam !== undefined);
    }
  });

  const fetchNextPage = () => {
    if (hasNextPage() && !query.isFetching) {
      const nextParam = options.getNextPageParam(query.data!, allPages());
      if (nextParam !== undefined) {
        setPageParam(nextParam);
      }
    }
  };

  const data = () => allPages().flat();

  return {
    ...query,
    data,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage: query.isFetching,
    allPages,
  };
};

// Optimistic updates helper
export const optimisticUpdate = <T,>(
  queryKey: QueryKey,
  updateFn: (oldData: T | undefined) => T,
  rollbackOnError?: boolean
) => {
  const cacheKey = generateCacheKey(queryKey);
  const cached = queryCache.get(cacheKey);
  
  if (!cached) return { rollback: () => {}, commit: () => {} };

  const previousData = cached.state.data;
  
  // Apply optimistic update
  cached.state.data = updateFn(previousData);
  cached.subscribers.forEach((cb) => cb());

  const rollback = () => {
    cached.state.data = previousData;
    cached.subscribers.forEach((cb) => cb());
  };

  const commit = () => {
    // Update is already applied, just mark as not stale
    cached.state.isStale = false;
    cached.state.lastUpdated = Date.now();
  };

  return { rollback, commit };
};
