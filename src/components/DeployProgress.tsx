import { Show, For, createEffect } from "solid-js";
import { useDAO, daoState, type DeploymentStep } from "../stores/daoStore";
import LoadingSpinner from "./LoadingSpinner";

interface DeployProgressProps {
  onComplete?: () => void;
  onError?: () => void;
}

export default function DeployProgress(props: DeployProgressProps) {
  const { state } = useDAO();

  const steps: { id: DeploymentStep; label: string; description: string }[] = [
    { id: "preparing", label: "Preparing", description: "Validating configuration..." },
    { id: "deploying_token", label: "Deploy Token", description: "Deploying Soul-Bound Token contract..." },
    { id: "deploying_dao", label: "Deploy DAO", description: "Deploying DAO core contracts..." },
    { id: "configuring", label: "Configure", description: "Setting governance parameters..." },
    { id: "verifying", label: "Verify", description: "Verifying contracts on explorer..." },
    { id: "completed", label: "Complete", description: "Deployment successful!" },
  ];

  const currentStepIndex = () => {
    return steps.findIndex((s) => s.id === state.deploymentStatus.step);
  };

  createEffect(() => {
    if (state.deploymentStatus.step === "completed") {
      props.onComplete?.();
    } else if (state.deploymentStatus.step === "failed") {
      props.onError?.();
    }
  });

  const getStepStatus = (index: number) => {
    const current = currentStepIndex();
    if (index < current) return "completed";
    if (index === current) return "active";
    return "pending";
  };

  const getStepIcon = (status: string) => {
    switch (status) {
      case "completed":
        return (
          <div class="w-8 h-8 bg-green-500 rounded-full flex items-center justify-center">
            <svg class="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7" />
            </svg>
          </div>
        );
      case "active":
        return (
          <div class="w-8 h-8 bg-blue-500 rounded-full flex items-center justify-center animate-pulse">
            <LoadingSpinner size="sm" color="white" />
          </div>
        );
      default:
        return (
          <div class="w-8 h-8 bg-gray-200 dark:bg-gray-700 rounded-full flex items-center justify-center">
            <span class="text-gray-500 dark:text-gray-400 text-sm">{index + 1}</span>
          </div>
        );
    }
  };

  return (
    <div class="max-w-2xl mx-auto">
      <div class="text-center mb-8">
        <h2 class="text-2xl font-bold text-gray-900 dark:text-white mb-2">
          Deploying Your DAO
        </h2>
        <p class="text-gray-600 dark:text-gray-400">
          This may take a few minutes. Please don't close this window.
        </p>
      </div>

      {/* Progress Bar */}
      <div class="mb-8">
        <div class="flex justify-between text-sm font-medium text-gray-600 dark:text-gray-400 mb-2">
          <span>Progress</span>
          <span>{state.deploymentStatus.progress}%</span>
        </div>
        <div class="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-3 overflow-hidden">
          <div
            class="bg-blue-600 h-full rounded-full transition-all duration-500 ease-out"
            style={{ width: `${state.deploymentStatus.progress}%` }}
          />
        </div>
      </div>

      {/* Steps */}
      <div class="space-y-4 mb-8">
        <For each={steps}>
          {(step, index) => {
            const status = getStepStatus(index());
            return (
              <div
                class={`flex items-center gap-4 p-4 rounded-lg transition-all ${
                  status === "active"
                    ? "bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800"
                    : status === "completed"
                    ? "bg-green-50 dark:bg-green-900/20"
                    : "bg-gray-50 dark:bg-gray-800/50"
                }`}
              >
                {getStepIcon(status)}
                <div class="flex-1">
                  <h3
                    class={`font-medium ${
                      status === "active"
                        ? "text-blue-900 dark:text-blue-200"
                        : status === "completed"
                        ? "text-green-900 dark:text-green-200"
                        : "text-gray-700 dark:text-gray-300"
                    }`}
                  >
                    {step.label}
                  </h3>
                  <p class="text-sm text-gray-500 dark:text-gray-400">
                    {status === "active" ? state.deploymentStatus.message : step.description}
                  </p>
                </div>
                <Show when={status === "completed"}>
                  <svg class="w-5 h-5 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7" />
                  </svg>
                </Show>
              </div>
            );
          }}
        </For>
      </div>

      {/* Transaction Info */}
      <Show when={state.deploymentStatus.txHash}>
        <div class="bg-gray-50 dark:bg-gray-800 rounded-lg p-4 mb-6">
          <p class="text-sm text-gray-600 dark:text-gray-400 mb-2">Latest Transaction</p>
          <a
            href={`https://etherscan.io/tx/${state.deploymentStatus.txHash}`}
            target="_blank"
            rel="noopener noreferrer"
            class="text-sm font-mono text-blue-600 hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-300 break-all"
          >
            {state.deploymentStatus.txHash}
          </a>
        </div>
      </Show>

      {/* Error State */}
      <Show when={state.deploymentStatus.step === "failed"}>
        <div class="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-6 text-center">
          <div class="w-16 h-16 bg-red-100 dark:bg-red-800 rounded-full flex items-center justify-center mx-auto mb-4">
            <svg class="w-8 h-8 text-red-600 dark:text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>
          <h3 class="text-lg font-bold text-red-900 dark:text-red-100 mb-2">
            Deployment Failed
          </h3>
          <p class="text-red-700 dark:text-red-300 mb-4">
            {state.deploymentStatus.error || "An unexpected error occurred during deployment."}
          </p>
          <button
            onClick={() => window.location.reload()}
            class="px-6 py-2 bg-red-600 hover:bg-red-700 text-white font-semibold rounded-lg transition-colors"
          >
            Try Again
          </button>
        </div>
      </Show>

      {/* Success State */}
      <Show when={state.deploymentStatus.step === "completed"}>
        <div class="bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg p-6 text-center">
          <div class="w-16 h-16 bg-green-100 dark:bg-green-800 rounded-full flex items-center justify-center mx-auto mb-4">
            <svg class="w-8 h-8 text-green-600 dark:text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7" />
            </svg>
          </div>
          <h3 class="text-lg font-bold text-green-900 dark:text-green-100 mb-2">
            DAO Deployed Successfully!
          </h3>
          <p class="text-green-700 dark:text-green-300 mb-4">
            Your DAO is now live and ready to use.
          </p>
          <Show when={state.deploymentStatus.contractAddress}>
            <div class="bg-white dark:bg-gray-800 rounded-lg p-3 mb-4">
              <p class="text-xs text-gray-500 mb-1">DAO Address</p>
              <code class="text-sm font-mono text-gray-900 dark:text-white break-all">
                {state.deploymentStatus.contractAddress}
              </code>
            </div>
          </Show>
          <button
            onClick={props.onComplete}
            class="px-6 py-2 bg-green-600 hover:bg-green-700 text-white font-semibold rounded-lg transition-colors"
          >
            Go to DAO
          </button>
        </div>
      </Show>

      {/* Cancel Button (only show during active deployment) */}
      <Show when={state.deploymentStatus.step !== "completed" && state.deploymentStatus.step !== "failed"}>
        <div class="text-center">
          <button
            onClick={() => {
              if (confirm("Are you sure you want to cancel? The deployment may be incomplete.")) {
                window.location.reload();
              }
            }}
            class="text-gray-500 hover:text-red-500 text-sm transition-colors"
          >
            Cancel Deployment
          </button>
        </div>
      </Show>
    </div>
  );
}
