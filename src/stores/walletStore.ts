import { createStore } from "solid-js/store";
import { createSignal, createEffect } from "solid-js";
import { 
  createConfig, 
  connect, 
  disconnect, 
  getAccount, 
  getChainId,
  watchAccount,
  watchChainId,
  type Connector,
  injected
} from "@wagmi/core";
import { mainnet, sepolia, base, baseSepolia, arbitrum, optimism } from "viem/chains";
import { http } from "viem";

// Supported networks
export const SUPPORTED_CHAINS = [
  mainnet,
  sepolia,
  base,
  baseSepolia,
  arbitrum,
  optimism,
] as const;

// Configure wagmi
const config = createConfig({
  chains: SUPPORTED_CHAINS,
  transports: {
    [mainnet.id]: http(),
    [sepolia.id]: http(),
    [base.id]: http(),
    [baseSepolia.id]: http(),
    [arbitrum.id]: http(),
    [optimism.id]: http(),
  },
});

// Wallet state interface
interface WalletState {
  address: string | null;
  chainId: number | null;
  isConnected: boolean;
  isConnecting: boolean;
  connector: Connector | null;
  error: string | null;
}

// Create the store
const [walletState, setWalletState] = createStore<WalletState>({
  address: null,
  chainId: null,
  isConnected: false,
  isConnecting: false,
  connector: null,
  error: null,
});

// Actions
export const walletActions = {
  async connect(connector: Connector = injected()) {
    setWalletState("isConnecting", true);
    setWalletState("error", null);
    
    try {
      await connect(config, { connector });
      const account = getAccount(config);
      const chainId = getChainId(config);
      
      setWalletState({
        address: account.address || null,
        chainId,
        isConnected: account.isConnected,
        isConnecting: false,
        connector,
        error: null,
      });
    } catch (error) {
      setWalletState({
        isConnecting: false,
        error: error instanceof Error ? error.message : "Failed to connect wallet",
      });
    }
  },

  async disconnect() {
    try {
      await disconnect(config);
      setWalletState({
        address: null,
        chainId: null,
        isConnected: false,
        isConnecting: false,
        connector: null,
        error: null,
      });
    } catch (error) {
      setWalletState("error", error instanceof Error ? error.message : "Failed to disconnect");
    }
  },

  async switchChain(chainId: number) {
    try {
      const chain = SUPPORTED_CHAINS.find((c) => c.id === chainId);
      if (!chain) {
        throw new Error(`Chain ${chainId} not supported`);
      }
      
      // Use wallet_switchEthereumChain
      if (window.ethereum) {
        await window.ethereum.request({
          method: "wallet_switchEthereumChain",
          params: [{ chainId: `0x${chainId.toString(16)}` }],
        });
      }
    } catch (error) {
      setWalletState("error", error instanceof Error ? error.message : "Failed to switch chain");
    }
  },

  clearError() {
    setWalletState("error", null);
  },
};

// Watch for account changes
if (typeof window !== "undefined") {
  watchAccount(config, {
    onChange(account) {
      setWalletState({
        address: account.address || null,
        isConnected: account.isConnected,
      });
    },
  });

  watchChainId(config, {
    onChange(chainId) {
      setWalletState("chainId", chainId);
    },
  });
}

// Export store and config
export { walletState, config };

// Helper hooks
export function useWallet() {
  return {
    state: walletState,
    actions: walletActions,
    config,
  };
}

// Type declarations for window.ethereum
declare global {
  interface Window {
    ethereum?: {
      request: (args: { method: string; params?: unknown[] }) => Promise<unknown>;
      isMetaMask?: boolean;
    };
  }
}
