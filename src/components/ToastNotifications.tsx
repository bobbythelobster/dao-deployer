import { For, Show } from "solid-js";
import { useUI, uiState, uiActions, getToastStyles, type ToastType } from "../stores/uiStore";
import { TransitionGroup } from "solid-transition-group";

export default function ToastNotifications() {
  const { state } = useUI();

  const getIcon = (type: ToastType) => {
    switch (type) {
      case "success":
        return (
          <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7" />
          </svg>
        );
      case "error":
        return (
          <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
          </svg>
        );
      case "warning":
        return (
          <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
          </svg>
        );
      case "info":
      default:
        return (
          <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
        );
    }
  };

  return (
    <div class="fixed bottom-4 right-4 z-50 flex flex-col gap-2 max-w-sm w-full pointer-events-none">
      <For each={state.toasts}>
        {(toast) => {
          const styles = getToastStyles(toast.type);
          
          return (
            <div
              class="pointer-events-auto transform transition-all duration-300 ease-out"
              style={{
                animation: "slideIn 0.3s ease-out",
              }}
            >
              <div
                class="rounded-lg shadow-lg p-4 flex items-start gap-3 text-white"
                style={{ "background-color": styles.background }}
              >
                <div class="flex-shrink-0 mt-0.5">{getIcon(toast.type)}</div>
                <div class="flex-1 min-w-0">
                  <p class="text-sm font-medium">{toast.message}</p>
                </div>
                <button
                  onClick={() => uiActions.removeToast(toast.id)}
                  class="flex-shrink-0 text-white/70 hover:text-white transition-colors"
                >
                  <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
            </div>
          );
        }}
      </For>

      <style>{`
        @keyframes slideIn {
          from {
            opacity: 0;
            transform: translateX(100%);
          }
          to {
            opacity: 1;
            transform: translateX(0);
          }
        }
        
        @keyframes slideOut {
          from {
            opacity: 1;
            transform: translateX(0);
          }
          to {
            opacity: 0;
            transform: translateX(100%);
          }
        }
      `}</style>
    </div>
  );
}

// Simple toast hook for components
export function useToast() {
  return {
    success: (message: string, duration?: number) => 
      uiActions.success(message, duration),
    error: (message: string, duration?: number) => 
      uiActions.error(message, duration),
    warning: (message: string, duration?: number) => 
      uiActions.warning(message, duration),
    info: (message: string, duration?: number) => 
      uiActions.info(message, duration),
    show: (message: string, type: ToastType = "info", duration?: number) =>
      uiActions.showToast(message, type, duration),
  };
}
