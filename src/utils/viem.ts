/**
 * DAO Deployer - Viem Client Configuration
 * 
 * Configures Viem clients for Ethereum mainnet, Base, and other L2s.
 * Provides public clients for reading and wallet clients for writing.
 */

import {
  type PublicClient,
  type WalletClient,
  type Transport,
  type Chain,
  type Account,
  createPublicClient,
  createWalletClient,
  http,
  fallback,
  custom,
  type FallbackTransport,
  type HttpTransport,
  type CustomTransport,
} from 'viem';
import { mainnet, base, polygon, arbitrum, optimism } from 'viem/chains';
import { 
  SUPPORTED_CHAINS, 
  type SupportedChain, 
  PUBLIC_RPC_ENDPOINTS,
  TRANSACTION_CONFIG,
  getChainById,
  isSupportedChain,
} from './constants.ts';
import {
  ChainError,
  ChainConnectionError,
  UnsupportedChainError,
  TransactionError,
  createErrorFromViemError,
} from './errors.ts';

// ============================================================================
// TYPES
// ============================================================================

export type ClientConfig = {
  chain: SupportedChain;
  rpcUrl?: string;
  transport?: Transport;
  batch?: boolean;
  pollingInterval?: number;
};

export type WalletConfig = ClientConfig & {
  account: Account | `0x${string}`;
};

export type ClientPair = {
  public: PublicClient;
  wallet: WalletClient;
};

// ============================================================================
// TRANSPORT CONFIGURATION
// ============================================================================

/**
 * Create a fallback transport with multiple RPC endpoints
 */
export function createFallbackTransport(
  chainId: number,
  customRpcUrl?: string
): FallbackTransport<[HttpTransport, ...HttpTransport[]]> {
  const urls: string[] = [];
  
  // Add custom RPC first if provided
  if (customRpcUrl) {
    urls.push(customRpcUrl);
  }
  
  // Add public RPCs as fallbacks
  const publicRpcs = PUBLIC_RPC_ENDPOINTS[chainId] || [];
  urls.push(...publicRpcs);
  
  if (urls.length === 0) {
    throw new ChainError(`No RPC endpoints available for chain ${chainId}`, chainId);
  }
  
  const transports = urls.map(url => 
    http(url, {
      batch: true,
      retryCount: TRANSACTION_CONFIG.maxRetries,
      timeout: TRANSACTION_CONFIG.timeout,
    })
  );
  
  return fallback(transports, {
    rank: {
      interval: 60_000, // Re-rank every minute
      sampleCount: 5,
      timeout: 5_000,
    },
  });
}

/**
 * Create a simple HTTP transport
 */
export function createHttpTransport(
  rpcUrl: string,
  options?: { batch?: boolean; timeout?: number }
): HttpTransport {
  return http(rpcUrl, {
    batch: options?.batch ?? true,
    timeout: options?.timeout ?? TRANSACTION_CONFIG.timeout,
    retryCount: TRANSACTION_CONFIG.maxRetries,
  });
}

/**
 * Create a custom transport for browser wallets
 */
export function createBrowserTransport(
  provider: { request: (args: { method: string; params?: unknown[] }) => Promise<unknown> }
): CustomTransport {
  return custom(provider);
}

// ============================================================================
// PUBLIC CLIENT
// ============================================================================

/**
 * Create a public client for reading from the blockchain
 */
export function createPublicViemClient(
  config: ClientConfig
): PublicClient {
  const { chain, rpcUrl, batch = true, pollingInterval = 4_000 } = config;
  
  const transport = rpcUrl 
    ? createHttpTransport(rpcUrl, { batch })
    : createFallbackTransport(chain.id);
  
  return createPublicClient({
    chain,
    transport,
    batch: batch ? { multicall: true } : undefined,
    pollingInterval,
  });
}

/**
 * Create a public client by chain ID
 */
export function createPublicClientByChainId(
  chainId: number,
  rpcUrl?: string
): PublicClient {
  if (!isSupportedChain(chainId)) {
    throw new UnsupportedChainError(chainId);
  }
  
  const chain = getChainById(chainId);
  if (!chain) {
    throw new ChainConnectionError(chainId);
  }
  
  return createPublicViemClient({ chain, rpcUrl });
}

/**
 * Get a cached public client for a chain
 */
const publicClientCache = new Map<number, PublicClient>();

export function getPublicClient(
  chainId: number,
  rpcUrl?: string
): PublicClient {
  const cacheKey = rpcUrl ? `${chainId}-${rpcUrl}` : chainId;
  
  if (!publicClientCache.has(cacheKey as number)) {
    const client = createPublicClientByChainId(chainId, rpcUrl);
    publicClientCache.set(cacheKey as number, client);
  }
  
  return publicClientCache.get(cacheKey as number)!;
}

/**
 * Clear the public client cache
 */
export function clearPublicClientCache(): void {
  publicClientCache.clear();
}

// ============================================================================
// WALLET CLIENT
// ============================================================================

/**
 * Create a wallet client for writing to the blockchain
 */
export function createWalletViemClient(
  config: WalletConfig
): WalletClient {
  const { chain, account, rpcUrl, transport: customTransport } = config;
  
  const transport = customTransport || (rpcUrl 
    ? createHttpTransport(rpcUrl)
    : createFallbackTransport(chain.id));
  
  return createWalletClient({
    chain,
    account,
    transport,
  });
}

/**
 * Create a wallet client by chain ID
 */
export function createWalletClientByChainId(
  chainId: number,
  account: Account | `0x${string}`,
  rpcUrl?: string
): WalletClient {
  if (!isSupportedChain(chainId)) {
    throw new UnsupportedChainError(chainId);
  }
  
  const chain = getChainById(chainId);
  if (!chain) {
    throw new ChainConnectionError(chainId);
  }
  
  return createWalletViemClient({ chain, account, rpcUrl });
}

// ============================================================================
// MULTICALL CONFIGURATION
// ============================================================================

/**
 * Multicall configuration for batching read operations
 */
export const multicallConfig = {
  batchSize: 512, // Maximum number of calls in a single multicall
  wait: 16, // Wait time in ms before sending batch
};

/**
 * Create a public client with optimized multicall
 */
export function createMulticallClient(
  chain: SupportedChain,
  rpcUrl?: string
): PublicClient {
  const transport = rpcUrl 
    ? createHttpTransport(rpcUrl, { batch: true })
    : createFallbackTransport(chain.id);
  
  return createPublicClient({
    chain,
    transport,
    batch: {
      multicall: {
        batchSize: multicallConfig.batchSize,
        wait: multicallConfig.wait,
      },
    },
  });
}

// ============================================================================
// CHAIN UTILITIES
// ============================================================================

/**
 * Get the chain configuration by ID
 */
export function getChain(chainId: number): SupportedChain {
  const chain = getChainById(chainId);
  if (!chain) {
    throw new UnsupportedChainError(chainId);
  }
  return chain;
}

/**
 * Get all supported chains
 */
export function getSupportedChains(): readonly SupportedChain[] {
  return SUPPORTED_CHAINS;
}

/**
 * Check if a chain is supported
 */
export function isChainSupported(chainId: number): boolean {
  return isSupportedChain(chainId);
}

/**
 * Get default RPC URL for a chain
 */
export function getDefaultRpcUrl(chainId: number): string | undefined {
  const rpcs = PUBLIC_RPC_ENDPOINTS[chainId];
  return rpcs?.[0];
}

// ============================================================================
// CLIENT OPERATIONS
// ============================================================================

/**
 * Wait for a transaction receipt with timeout
 */
export async function waitForTransaction(
  publicClient: PublicClient,
  hash: `0x${string}`,
  confirmations: number = TRANSACTION_CONFIG.confirmationBlocks,
  timeout: number = TRANSACTION_CONFIG.timeout
): Promise<{
  transactionHash: `0x${string}`;
  blockNumber: bigint;
  status: 'success' | 'reverted';
  gasUsed: bigint;
}> {
  const startTime = Date.now();
  
  while (Date.now() - startTime < timeout) {
    try {
      const receipt = await publicClient.getTransactionReceipt({ hash });
      
      if (receipt) {
        // Wait for confirmations
        const currentBlock = await publicClient.getBlockNumber();
        const confirmationsReceived = Number(currentBlock - receipt.blockNumber);
        
        if (confirmationsReceived >= confirmations) {
          return {
            transactionHash: receipt.transactionHash,
            blockNumber: receipt.blockNumber,
            status: receipt.status,
            gasUsed: receipt.gasUsed,
          };
        }
      }
      
      // Wait before checking again
      await new Promise(resolve => setTimeout(resolve, 1000));
    } catch (error) {
      // If transaction not found yet, keep waiting
      if (error instanceof Error && error.message.includes('not found')) {
        await new Promise(resolve => setTimeout(resolve, 1000));
        continue;
      }
      throw createErrorFromViemError(error);
    }
  }
  
  throw new TransactionError(
    `Transaction ${hash} timed out after ${timeout}ms`,
    'TRANSACTION_TIMEOUT',
    hash
  );
}

/**
 * Get the current block number
 */
export async function getBlockNumber(
  publicClient: PublicClient
): Promise<bigint> {
  try {
    return await publicClient.getBlockNumber();
  } catch (error) {
    throw createErrorFromViemError(error);
  }
}

/**
 * Get the current gas price
 */
export async function getGasPrice(
  publicClient: PublicClient
): Promise<bigint> {
  try {
    return await publicClient.getGasPrice();
  } catch (error) {
    throw createErrorFromViemError(error);
  }
}

/**
 * Estimate gas for a transaction
 */
export async function estimateGas(
  publicClient: PublicClient,
  params: {
    account: `0x${string}`;
    to: `0x${string}`;
    data?: `0x${string}`;
    value?: bigint;
  }
): Promise<bigint> {
  try {
    return await publicClient.estimateGas(params);
  } catch (error) {
    throw createErrorFromViemError(error);
  }
}

// ============================================================================
// EXPORTS
// ============================================================================

export {
  mainnet,
  base,
  polygon,
  arbitrum,
  optimism,
};

export type {
  PublicClient,
  WalletClient,
  Transport,
  Chain,
  Account,
  FallbackTransport,
  HttpTransport,
  CustomTransport,
};
