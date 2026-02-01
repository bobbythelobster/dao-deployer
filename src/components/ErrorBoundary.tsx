import { ErrorBoundary as SolidErrorBoundary, type JSX } from "solid-js";
import { useUI, uiActions } from "../stores/uiStore";

interface ErrorBoundaryProps {
  children: JSX.Element;
  fallback?: (error: Error, reset: () => void) => JSX.Element;
}

export default function ErrorBoundary(props: ErrorBoundaryProps) {
  const { state } = useUI();

  const defaultFallback = (error: Error, reset: () => void) => (
    <div class="min-h-[50vh] flex items-center justify-center p-4">
      <div class="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-xl p-8 max-w-lg w-full">
        <div class="flex items-center gap-3 mb-4">
          <div class="w-12 h-12 bg-red-100 dark:bg-red-800 rounded-full flex items-center justify-center">
            <svg
              class="w-6 h-6 text-red-600 dark:text-red-400"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                stroke-linecap="round"
                stroke-linejoin="round"
                stroke-width="2"
                d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
              />
            </svg>
          </div>
          <h2 class="text-xl font-bold text-red-900 dark:text-red-100">
            Something went wrong
          </h2>
        </div>

        <div class="bg-red-100/50 dark:bg-red-900/30 rounded-lg p-4 mb-6 overflow-auto">
          <p class="text-sm font-mono text-red-800 dark:text-red-300">
            {error.message}
          </p>
          {error.stack && (
            <pre class="mt-2 text-xs text-red-700 dark:text-red-400 overflow-x-auto">
              {error.stack.split("\n").slice(1, 5).join("\n")}
            </pre>
          )}
        </div>

        <div class="flex gap-3">
          <button
            onClick={reset}
            class="flex-1 bg-red-600 hover:bg-red-700 text-white font-semibold py-2 px-4 rounded-lg transition-colors"
          >
            Try Again
          </button>
          <button
            onClick={() => window.location.reload()}
            class="flex-1 bg-gray-200 hover:bg-gray-300 dark:bg-gray-700 dark:hover:bg-gray-600 text-gray-800 dark:text-gray-200 font-semibold py-2 px-4 rounded-lg transition-colors"
          >
            Reload Page
          </button>
        </div>

        <p class="mt-4 text-sm text-red-600 dark:text-red-400 text-center">
          If the problem persists, please contact support.
        </p>
      </div>
    </div>
  );

  return (
    <SolidErrorBoundary fallback={props.fallback || defaultFallback}>
      {props.children}
    </SolidErrorBoundary>
  );
}

// Component-level error boundary with smaller UI
export function ComponentErrorBoundary(props: {
  children: JSX.Element;
  title?: string;
}) {
  const fallback = (error: Error, reset: () => void) => (
    <div class="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4">
      <div class="flex items-start gap-3">
        <svg
          class="w-5 h-5 text-red-600 dark:text-red-400 mt-0.5 flex-shrink-0"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            stroke-linecap="round"
            stroke-linejoin="round"
            stroke-width="2"
            d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
          />
        </svg>
        <div class="flex-1 min-w-0">
          <p class="font-medium text-red-900 dark:text-red-100">
            {props.title || "Error loading component"}
          </p>
          <p class="text-sm text-red-700 dark:text-red-400 mt-1 truncate">
            {error.message}
          </p>
          <button
            onClick={reset}
            class="mt-2 text-sm text-red-600 dark:text-red-400 hover:underline"
          >
            Retry
          </button>
        </div>
      </div>
    </div>
  );

  return (
    <SolidErrorBoundary fallback={fallback}>
      {props.children}
    </SolidErrorBoundary>
  );
}

// Async error handler helper
export function useAsyncError() {
  return {
    handleError: (error: unknown) => {
      const message = error instanceof Error ? error.message : "An error occurred";
      uiActions.error(message);
      console.error(error);
    },
  };
}
