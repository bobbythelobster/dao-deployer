import { createStore } from "solid-js/store";
import { createSignal } from "solid-js";

// Toast notification types
export type ToastType = "success" | "error" | "warning" | "info";

export interface Toast {
  id: string;
  message: string;
  type: ToastType;
  duration: number;
  createdAt: number;
}

// Modal types
export type ModalType = 
  | "connectWallet"
  | "createProposal"
  | "createBid"
  | "confirmVote"
  | "executeProposal"
  | "delegate"
  | "none";

// UI State interface
interface UIState {
  // Loading states
  globalLoading: boolean;
  loadingMessage: string;
  
  // Toasts
  toasts: Toast[];
  
  // Modal
  activeModal: ModalType;
  modalData: Record<string, unknown> | null;
  
  // Theme
  theme: "light" | "dark" | "system";
  
  // Navigation
  sidebarOpen: boolean;
  
  // Errors
  globalError: string | null;
}

// Create the store
const [uiState, setUIState] = createStore<UIState>({
  globalLoading: false,
  loadingMessage: "",
  toasts: [],
  activeModal: "none",
  modalData: null,
  theme: "system",
  sidebarOpen: true,
  globalError: null,
});

// Toast ID counter
let toastIdCounter = 0;

// UI Actions
export const uiActions = {
  // Toast notifications
  showToast(message: string, type: ToastType = "info", duration: number = 5000) {
    const id = `toast-${++toastIdCounter}`;
    const toast: Toast = {
      id,
      message,
      type,
      duration,
      createdAt: Date.now(),
    };
    
    setUIState("toasts", (toasts) => [...toasts, toast]);
    
    // Auto-remove toast after duration
    if (duration > 0) {
      setTimeout(() => {
        uiActions.removeToast(id);
      }, duration);
    }
    
    return id;
  },

  removeToast(id: string) {
    setUIState("toasts", (toasts) => toasts.filter((t) => t.id !== id));
  },

  removeAllToasts() {
    setUIState("toasts", []);
  },

  // Convenience methods for different toast types
  success(message: string, duration?: number) {
    return uiActions.showToast(message, "success", duration);
  },

  error(message: string, duration?: number) {
    return uiActions.showToast(message, "error", duration);
  },

  warning(message: string, duration?: number) {
    return uiActions.showToast(message, "warning", duration);
  },

  info(message: string, duration?: number) {
    return uiActions.showToast(message, "info", duration);
  },

  // Modal management
  openModal(type: ModalType, data?: Record<string, unknown>) {
    setUIState("activeModal", type);
    setUIState("modalData", data || null);
  },

  closeModal() {
    setUIState("activeModal", "none");
    setUIState("modalData", null);
  },

  // Global loading state
  setGlobalLoading(loading: boolean, message: string = "") {
    setUIState("globalLoading", loading);
    setUIState("loadingMessage", message);
  },

  // Sidebar
  toggleSidebar() {
    setUIState("sidebarOpen", (open) => !open);
  },

  setSidebarOpen(open: boolean) {
    setUIState("sidebarOpen", open);
  },

  // Theme
  setTheme(theme: "light" | "dark" | "system") {
    setUIState("theme", theme);
    
    // Apply theme to document
    if (theme === "dark" || (theme === "system" && window.matchMedia("(prefers-color-scheme: dark)").matches)) {
      document.documentElement.classList.add("dark");
    } else {
      document.documentElement.classList.remove("dark");
    }
  },

  // Global error
  setGlobalError(error: string | null) {
    setUIState("globalError", error);
  },

  clearGlobalError() {
    setUIState("globalError", null);
  },
};

// Helper to get toast styles
export function getToastStyles(type: ToastType): { background: string; icon: string } {
  const styles: Record<ToastType, { background: string; icon: string }> = {
    success: {
      background: "#10b981",
      icon: "✓",
    },
    error: {
      background: "#ef4444",
      icon: "✕",
    },
    warning: {
      background: "#f59e0b",
      icon: "⚠",
    },
    info: {
      background: "#3b82f6",
      icon: "ℹ",
    },
  };
  return styles[type];
}

// Export store
export { uiState };

// Hook
export function useUI() {
  return {
    state: uiState,
    actions: uiActions,
  };
}
