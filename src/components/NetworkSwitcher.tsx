import { createSignal, Show, For } from "solid-js";
import { useWallet, walletState, SUPPORTED_CHAINS } from "../stores/walletStore";
import { type Chain } from "viem";

export default function NetworkSwitcher() {
  const { actions } = useWallet();
  const [isOpen, setIsOpen] = createSignal(false);

  const currentChain = () => {
    return SUPPORTED_CHAINS.find((c) => c.id === walletState.chainId);
  };

  const handleSwitch = async (chainId: number) => {
    await actions.switchChain(chainId);
    setIsOpen(false);
  };

  const getChainIcon = (chain: Chain) => {
    const icons: Record<number, string> = {
      1: "🔷", // Ethereum
      11155111: "🔷", // Sepolia
      8453: "🔵", // Base
      84532: "🔵", // Base Sepolia
      42161: "🔹", // Arbitrum
      10: "🔴", // Optimism
    };
    return icons[chain.id] || "⛓";
  };

  const getChainColor = (chain: Chain) => {
    const colors: Record<number, string> = {
      1: "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200",
      11155111: "bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200",
      8453: "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200",
      84532: "bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-200",
      42161: "bg-indigo-100 text-indigo-800 dark:bg-indigo-900 dark:text-indigo-200",
      10: "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200",
    };
    return colors[chain.id] || "bg-gray-100 text-gray-800";
  };

  return (
    <div class="relative">
      <Show
        when={walletState.isConnected}
        fallback={
          <div class="px-3 py-2 text-sm text-gray-500 dark:text-gray-400 bg-gray-100 dark:bg-gray-800 rounded-lg">
            Connect wallet to switch networks
          </div>
        }
      >
        <button
          onClick={() => setIsOpen(!isOpen())}
          class={`flex items-center gap-2 px-3 py-2 rounded-lg font-medium text-sm transition-all ${
            currentChain()
              ? getChainColor(currentChain()!)
              : "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200"
          }`}
        >
          <Show when={currentChain()} fallback={<>⚠️ Unsupported Network</>}>
            <span>{getChainIcon(currentChain()!)}</span>
            <span>{currentChain()!.name}</span>
          </Show>
          <svg
            class={`w-4 h-4 transition-transform ${isOpen() ? "rotate-180" : ""}`}
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              stroke-linecap="round"
              stroke-linejoin="round"
              stroke-width="2"
              d="M19 9l-7 7-7-7"
            />
          </svg>
        </button>
      </Show>

      {/* Dropdown */}
      <Show when={isOpen() && walletState.isConnected}>
        <div class="absolute top-full left-0 mt-2 w-56 bg-white dark:bg-gray-800 rounded-lg shadow-xl border border-gray-200 dark:border-gray-700 overflow-hidden z-50">
          <div class="p-3 border-b border-gray-200 dark:border-gray-700">
            <p class="text-sm font-medium text-gray-700 dark:text-gray-300">
              Select Network
            </p>
          </div>

          <div class="max-h-64 overflow-y-auto">
            <For each={SUPPORTED_CHAINS}>
              {(chain) => (
                <button
                  onClick={() => handleSwitch(chain.id)}
                  class={`w-full px-4 py-3 flex items-center gap-3 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors text-left ${
                    walletState.chainId === chain.id
                      ? "bg-blue-50 dark:bg-blue-900/20 border-l-4 border-blue-500"
                      : "border-l-4 border-transparent"
                  }`}
                >
                  <span class="text-lg">{getChainIcon(chain)}</span>
                  <div class="flex-1">
                    <p class="font-medium text-gray-900 dark:text-white text-sm">
                      {chain.name}
                    </p>
                    <p class="text-xs text-gray-500">
                      Chain ID: {chain.id}
                    </p>
                  </div>
                  <Show when={walletState.chainId === chain.id}>
                    <svg
                      class="w-5 h-5 text-blue-500"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        stroke-linecap="round"
                        stroke-linejoin="round"
                        stroke-width="2"
                        d="M5 13l4 4L19 7"
                      />
                    </svg>
                  </Show>
                </button>
              )}
            </For>
          </div>

          <div class="p-3 bg-gray-50 dark:bg-gray-700/50 border-t border-gray-200 dark:border-gray-700">
            <p class="text-xs text-gray-500 dark:text-gray-400">
              Switch networks to interact with DAOs on different chains
            </p>
          </div>
        </div>
      </Show>
    </div>
  );
}
