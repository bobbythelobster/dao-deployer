import { Show, createSignal, type JSX } from "solid-js";
import { useToast } from "./ToastNotifications";
import { createRetryState } from "../utils/retry";
import { isRetryableError, classifyError, type DAOError } from "../utils/errors";

interface ErrorRecoveryProps {
  error: Error | null;
  onRetry: () => Promise<void>;
  onReset?: () => void;
  onDismiss?: () => void;
  title?: string;
  description?: string;
  children?: JSX.Element;
  maxRetries?: number;
  showDetails?: boolean;
}

export default function ErrorRecovery(props: ErrorRecoveryProps) {
  const toast = useToast();
  const retryState = createRetryState(props.maxRetries || 3);
  const [isRecovering, setIsRecovering] = createSignal(false);
  const [showDetails, setShowDetails] = createSignal(props.showDetails || false);

  const getErrorCategory = () => {
    if (!props.error) return "unknown";
    return classifyError(props.error);
  };

  const getErrorIcon = () => {
    const category = getErrorCategory();
    const icons: Record<string, string> = {
      chain: "🔗",
      transaction: "💸",
      contract: "📄",
      dao: "🏛️",
      proposal: "📋",
      token: "🪙",
      task: "📦",
      ipfs: "📤",
      aragon: "⚙️",
      validation: "⚠️",
      unknown: "❌",
    };
    return icons[category] || "❌";
  };

  const getErrorTitle = () => {
    if (props.title) return props.title;
    
    const category = getErrorCategory();
    const titles: Record<string, string> = {
      chain: "Network Connection Error",
      transaction: "Transaction Failed",
      contract: "Smart Contract Error",
      dao: "DAO Operation Failed",
      proposal: "Proposal Error",
      token: "Token Error",
      task: "Task Error",
      ipfs: "IPFS Error",
      aragon: "Aragon SDK Error",
      validation: "Validation Error",
      unknown: "Something Went Wrong",
    };
    return titles[category] || "Error";
  };

  const getErrorDescription = () => {
    if (props.description) return props.description;
    
    if (!props.error) return "An unknown error occurred.";
    
    const category = getErrorCategory();
    const messages: Record<string, string> = {
      chain: "We're having trouble connecting to the blockchain network. This is usually temporary.",
      transaction: "Your transaction couldn't be completed. This might be due to network congestion or insufficient funds.",
      contract: "There was an issue interacting with the smart contract. The contract might be paused or undergoing maintenance.",
      dao: "The DAO operation failed. You might not have the required permissions or the DAO is in an invalid state.",
      proposal: "There was a problem with the proposal. It may have expired or already been executed.",
      token: "Token operation failed. You might not have enough balance or the required approvals.",
      task: "Task operation couldn't be completed. The task may have been assigned to someone else.",
      ipfs: "Failed to upload or retrieve data from IPFS. The network might be experiencing issues.",
      aragon: "Aragon SDK encountered an error. Please try again in a few moments.",
      validation: "Some of the provided data is invalid. Please check your inputs and try again.",
      unknown: "An unexpected error occurred. Please try again or contact support if the problem persists.",
    };
    return messages[category];
  };

  const canRetry = () => {
    if (!props.error) return false;
    return isRetryableError(props.error) && retryState.attempt < (props.maxRetries || 3);
  };

  const handleRetry = async () => {
    if (!canRetry()) return;
    
    setIsRecovering(true);
    try {
      await retryState.execute(props.onRetry);
      toast.success("Operation completed successfully!");
      props.onDismiss?.();
    } catch (error) {
      const message = error instanceof Error ? error.message : "Retry failed";
      toast.error(`Retry failed: ${message}`);
    } finally {
      setIsRecovering(false);
    }
  };

  const handleReset = () => {
    retryState.reset();
    props.onReset?.();
  };

  return (
    <Show when={props.error}>
      <div class="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-xl p-6">
        {/* Header */}
        <div class="flex items-start gap-4 mb-4">
          <div class="w-12 h-12 bg-red-100 dark:bg-red-800 rounded-full flex items-center justify-center flex-shrink-0">
            <span class="text-2xl">{getErrorIcon()}</span>
          </div>
          <div class="flex-1">
            <h3 class="text-lg font-bold text-red-900 dark:text-red-100 mb-1">
              {getErrorTitle()}
            </h3>
            <p class="text-red-700 dark:text-red-300 text-sm">
              {getErrorDescription()}
            </p>
          </div>
        </div>

        {/* Error Details */}
        <Show when={showDetails()}>
          <div class="bg-red-100/50 dark:bg-red-900/30 rounded-lg p-4 mb-4 overflow-auto">
            <p class="text-sm font-mono text-red-800 dark:text-red-300 break-all">
              {props.error?.message}
            </p>
            {props.error?.stack && (
              <pre class="mt-2 text-xs text-red-700 dark:text-red-400 overflow-x-auto">
                {props.error.stack}
              </pre>
            )}
          </div>
        </Show>

        {/* Actions */}
        <div class="flex flex-wrap gap-3">
          <Show when={canRetry()}>
            <button
              onClick={handleRetry}
              disabled={isRecovering()}
              class="flex items-center gap-2 px-4 py-2 bg-red-600 hover:bg-red-700 disabled:bg-red-400 text-white font-medium rounded-lg transition-colors"
            >
              <Show
                when={isRecovering()}
                fallback={
                  <>
                    <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                    </svg>
                    <span>Try Again</span>
                    <span class="text-xs opacity-75">
                      ({retryState.attempt + 1}/{props.maxRetries || 3})
                    </span>
                  </>
                }
              >
                <svg class="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                  <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
                  <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
                <span>Retrying...</span>
              </Show>
            </button>
          </Show>

          <Show when={props.onReset}>
            <button
              onClick={handleReset}
              disabled={isRecovering()}
              class="px-4 py-2 border border-red-300 dark:border-red-700 text-red-700 dark:text-red-300 font-medium rounded-lg hover:bg-red-100 dark:hover:bg-red-900/30 transition-colors"
            >
              Start Over
            </button>
          </Show>

          <button
            onClick={() => setShowDetails(!showDetails())}
            class="px-4 py-2 text-red-600 dark:text-red-400 text-sm hover:underline"
          >
            {showDetails() ? "Hide Details" : "Show Details"}
          </button>

          <Show when={props.onDismiss}>
            <button
              onClick={props.onDismiss}
              disabled={isRecovering()}
              class="ml-auto px-4 py-2 text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-300"
            >
              Dismiss
            </button>
          </Show>
        </div>

        {/* Help Text */}
        <div class="mt-4 pt-4 border-t border-red-200 dark:border-red-800">
          <p class="text-sm text-red-600 dark:text-red-400">
            <span class="font-medium">Need help?</span>{" "}
            <a
              href="#"
              class="underline hover:text-red-800 dark:hover:text-red-300"
              onClick={(e) => {
                e.preventDefault();
                toast.info("Support contact: support@daodeployer.io");
              }}
            >
              Contact Support
            </a>{" "}
            or{" "}
            <button
              onClick={() => window.location.reload()}
              class="underline hover:text-red-800 dark:hover:text-red-300"
            >
              Refresh Page
            </button>
          </p>
        </div>

        {/* Custom Content */}
        {props.children}
      </div>
    </Show>
  );
}

// Inline error recovery for smaller spaces
export function InlineErrorRecovery(props: {
  error: Error | null;
  onRetry: () => Promise<void>;
  onDismiss?: () => void;
}) {
  const [isRetrying, setIsRetrying] = createSignal(false);

  const handleRetry = async () => {
    setIsRetrying(true);
    try {
      await props.onRetry();
      props.onDismiss?.();
    } catch (error) {
      // Error will still be displayed
    } finally {
      setIsRetrying(false);
    }
  };

  return (
    <Show when={props.error}>
      <div class="flex items-center gap-3 p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg">
        <svg class="w-5 h-5 text-red-600 dark:text-red-400 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
        <p class="text-sm text-red-700 dark:text-red-300 flex-1 truncate">
          {props.error?.message}
        </p>
        <button
          onClick={handleRetry}
          disabled={isRetrying()}
          class="flex items-center gap-1 px-3 py-1 text-sm font-medium text-red-700 dark:text-red-300 hover:bg-red-100 dark:hover:bg-red-900/30 rounded transition-colors"
        >
          <Show
            when={isRetrying()}
            fallback={
              <>
                <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                </svg>
                Retry
              </>
            }
          >
            <svg class="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
              <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
              <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
            </svg>
          </Show>
        </button>
      </div>
    </Show>
  );
}
