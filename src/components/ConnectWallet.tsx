import { Show, createSignal } from "solid-js";
import { useWallet, walletState } from "../stores/walletStore";
import { injected } from "@wagmi/core";

export default function ConnectWallet() {
  const { actions } = useWallet();
  const [showOptions, setShowOptions] = createSignal(false);

  const handleConnect = async (connectorType: "injected" | "metamask") => {
    setShowOptions(false);
    
    try {
      // Use injected connector for both (MetaMask is an injected wallet)
      const connector = injected();
      await actions.connect(connector);
    } catch (error) {
      console.error("Connection error:", error);
    }
  };

  const formatAddress = (address: string) => {
    return `${address.slice(0, 6)}...${address.slice(-4)}`;
  };

  return (
    <div class="relative">
      <Show
        when={walletState.isConnected}
        fallback={
          <button
            onClick={() => setShowOptions(!showOptions())}
            class="bg-blue-600 hover:bg-blue-700 text-white font-semibold py-2 px-6 rounded-lg transition-colors duration-200 flex items-center gap-2"
          >
            <svg
              class="w-5 h-5"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                stroke-linecap="round"
                stroke-linejoin="round"
                stroke-width="2"
                d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"
              />
            </svg>
            Connect Wallet
          </button>
        }
      >
        <div class="flex items-center gap-3">
          <div class="bg-green-100 dark:bg-green-900 text-green-800 dark:text-green-200 px-4 py-2 rounded-lg flex items-center gap-2">
            <span class="w-2 h-2 bg-green-500 rounded-full animate-pulse"></span>
            <span class="font-medium">{formatAddress(walletState.address!)}</span>
          </div>
          <button
            onClick={() => actions.disconnect()}
            class="text-gray-500 hover:text-red-500 transition-colors p-2"
            title="Disconnect"
          >
            <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path
                stroke-linecap="round"
                stroke-linejoin="round"
                stroke-width="2"
                d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1"
              />
            </svg>
          </button>
        </div>
      </Show>

      {/* Wallet Options Dropdown */}
      <Show when={showOptions()}>
        <div class="absolute top-full right-0 mt-2 w-64 bg-white dark:bg-gray-800 rounded-lg shadow-xl border border-gray-200 dark:border-gray-700 overflow-hidden z-50">
          <div class="p-3 border-b border-gray-200 dark:border-gray-700">
            <p class="text-sm font-medium text-gray-700 dark:text-gray-300">
              Connect Wallet
            </p>
          </div>
          
          <button
            onClick={() => handleConnect("metamask")}
            class="w-full px-4 py-3 flex items-center gap-3 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors text-left"
          >
            <div class="w-8 h-8 bg-orange-100 rounded-full flex items-center justify-center">
              <span class="text-orange-600 font-bold text-xs">MM</span>
            </div>
            <div>
              <p class="font-medium text-gray-900 dark:text-white">MetaMask</p>
              <p class="text-xs text-gray-500">Popular browser wallet</p>
            </div>
          </button>

          <button
            onClick={() => handleConnect("injected")}
            class="w-full px-4 py-3 flex items-center gap-3 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors text-left"
          >
            <div class="w-8 h-8 bg-blue-100 rounded-full flex items-center justify-center">
              <svg class="w-4 h-4 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 10V3L4 14h7v7l9-11h-7z" />
              </svg>
            </div>
            <div>
              <p class="font-medium text-gray-900 dark:text-white">Browser Wallet</p>
              <p class="text-xs text-gray-500">Any injected wallet</p>
            </div>
          </button>

        </div>
      </Show>

      {/* Error Display */}
      <Show when={walletState.error}>
        <div class="absolute top-full right-0 mt-2 w-64 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-3 text-sm text-red-700 dark:text-red-400">
          <div class="flex items-start gap-2">
            <svg class="w-4 h-4 mt-0.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <span>{walletState.error}</span>
          </div>
          <button
            onClick={() => actions.clearError()}
            class="mt-2 text-xs text-red-600 dark:text-red-400 hover:underline"
          >
            Dismiss
          </button>
        </div>
      </Show>
    </div>
  );
}
