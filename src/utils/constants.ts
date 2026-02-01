/**
 * DAO Deployer - Constants
 * 
 * Contract addresses, governance parameters, and network configurations
 * for Aragon OSX DAOs with Soul-Bound Token governance on Base/Ethereum.
 */

import { type Chain, mainnet, base, polygon, arbitrum, optimism } from 'viem/chains';

// ============================================================================
// SUPPORTED CHAINS
// ============================================================================

export const SUPPORTED_CHAINS = [mainnet, base, polygon, arbitrum, optimism] as const;

export type SupportedChain = (typeof SUPPORTED_CHAINS)[number];

export const CHAIN_NAMES: Record<number, string> = {
  [mainnet.id]: 'Ethereum Mainnet',
  [base.id]: 'Base',
  [polygon.id]: 'Polygon',
  [arbitrum.id]: 'Arbitrum One',
  [optimism.id]: 'Optimism',
};

export const CHAIN_SHORT_NAMES: Record<number, string> = {
  [mainnet.id]: 'mainnet',
  [base.id]: 'base',
  [polygon.id]: 'polygon',
  [arbitrum.id]: 'arbitrum',
  [optimism.id]: 'optimism',
};

// ============================================================================
// CONTRACT ADDRESSES
// ============================================================================

export interface ContractAddresses {
  soulBoundToken: `0x${string}`;
  daoFactory: `0x${string}`;
  proposalManager: `0x${string}`;
  taskMarket: `0x${string}`;
  aragonDAORegistry: `0x${string}`;
  aragonPluginRepoRegistry: `0x${string}`;
}

// Aragon OSX v1.3.0 addresses
export const ARAGON_ADDRESSES: Record<number, { daoFactory: `0x${string}`; pluginRepoRegistry: `0x${string}` }> = {
  // Ethereum Mainnet
  [mainnet.id]: {
    daoFactory: '0xA9C6a0a9263A63F6A5Ee6b93F8c5b8B9B9B9B9B9', // Placeholder - replace with actual
    pluginRepoRegistry: '0xA9C6a0a9263A63F6A5Ee6b93F8c5b8B9B9B9B9B9', // Placeholder
  },
  // Base
  [base.id]: {
    daoFactory: '0xA9C6a0a9263A63F6A5Ee6b93F8c5b8B9B9B9B9B9', // Placeholder - replace with actual
    pluginRepoRegistry: '0xA9C6a0a9263A63F6A5Ee6b93F8c5b8B9B9B9B9B9', // Placeholder
  },
  // Polygon
  [polygon.id]: {
    daoFactory: '0xA9C6a0a9263A63F6A5Ee6b93F8c5b8B9B9B9B9B9', // Placeholder
    pluginRepoRegistry: '0xA9C6a0a9263A63F6A5Ee6b93F8c5b8B9B9B9B9B9', // Placeholder
  },
  // Arbitrum
  [arbitrum.id]: {
    daoFactory: '0xA9C6a0a9263A63F6A5Ee6b93F8c5b8B9B9B9B9B9', // Placeholder
    pluginRepoRegistry: '0xA9C6a0a9263A63F6A5Ee6b93F8c5b8B9B9B9B9B9', // Placeholder
  },
  // Optimism
  [optimism.id]: {
    daoFactory: '0xA9C6a0a9263A63F6A5Ee6b93F8c5b8B9B9B9B9B9', // Placeholder
    pluginRepoRegistry: '0xA9C6a0a9263A63F6A5Ee6b93F8c5b8B9B9B9B9B9', // Placeholder
  },
};

// DAO Deployer specific contract addresses (to be deployed)
export const DEPLOYER_CONTRACTS: Record<number, ContractAddresses> = {
  [mainnet.id]: {
    soulBoundToken: '0x0000000000000000000000000000000000000000',
    daoFactory: '0x0000000000000000000000000000000000000000',
    proposalManager: '0x0000000000000000000000000000000000000000',
    taskMarket: '0x0000000000000000000000000000000000000000',
    aragonDAORegistry: ARAGON_ADDRESSES[mainnet.id].daoFactory,
    aragonPluginRepoRegistry: ARAGON_ADDRESSES[mainnet.id].pluginRepoRegistry,
  },
  [base.id]: {
    soulBoundToken: '0x0000000000000000000000000000000000000000',
    daoFactory: '0x0000000000000000000000000000000000000000',
    proposalManager: '0x0000000000000000000000000000000000000000',
    taskMarket: '0x0000000000000000000000000000000000000000',
    aragonDAORegistry: ARAGON_ADDRESSES[base.id].daoFactory,
    aragonPluginRepoRegistry: ARAGON_ADDRESSES[base.id].pluginRepoRegistry,
  },
  [polygon.id]: {
    soulBoundToken: '0x0000000000000000000000000000000000000000',
    daoFactory: '0x0000000000000000000000000000000000000000',
    proposalManager: '0x0000000000000000000000000000000000000000',
    taskMarket: '0x0000000000000000000000000000000000000000',
    aragonDAORegistry: ARAGON_ADDRESSES[polygon.id].daoFactory,
    aragonPluginRepoRegistry: ARAGON_ADDRESSES[polygon.id].pluginRepoRegistry,
  },
  [arbitrum.id]: {
    soulBoundToken: '0x0000000000000000000000000000000000000000',
    daoFactory: '0x0000000000000000000000000000000000000000',
    proposalManager: '0x0000000000000000000000000000000000000000',
    taskMarket: '0x0000000000000000000000000000000000000000',
    aragonDAORegistry: ARAGON_ADDRESSES[arbitrum.id].daoFactory,
    aragonPluginRepoRegistry: ARAGON_ADDRESSES[arbitrum.id].pluginRepoRegistry,
  },
  [optimism.id]: {
    soulBoundToken: '0x0000000000000000000000000000000000000000',
    daoFactory: '0x0000000000000000000000000000000000000000',
    proposalManager: '0x0000000000000000000000000000000000000000',
    taskMarket: '0x0000000000000000000000000000000000000000',
    aragonDAORegistry: ARAGON_ADDRESSES[optimism.id].daoFactory,
    aragonPluginRepoRegistry: ARAGON_ADDRESSES[optimism.id].pluginRepoRegistry,
  },
};

// ============================================================================
// DEFAULT GOVERNANCE PARAMETERS
// ============================================================================

export interface GovernanceParams {
  // Voting parameters
  supportThreshold: bigint; // Percentage in basis points (e.g., 500000 = 50%)
  minParticipation: bigint; // Minimum participation in basis points
  minDuration: bigint; // Minimum voting duration in seconds
  minProposerVotingPower: bigint; // Minimum tokens to create proposal
  
  // Token parameters
  tokenName: string;
  tokenSymbol: string;
  tokenDecimals: number;
  
  // DAO metadata
  daoName: string;
  daoDescription: string;
  daoAvatar?: string;
  daoLinks: { name: string; url: string }[];
}

export const DEFAULT_GOVERNANCE_PARAMS: GovernanceParams = {
  supportThreshold: 500000n, // 50%
  minParticipation: 100000n, // 10%
  minDuration: 86400n, // 1 day
  minProposerVotingPower: 1n, // 1 token
  tokenName: 'Soul Bound Token',
  tokenSymbol: 'SBT',
  tokenDecimals: 18,
  daoName: 'New DAO',
  daoDescription: 'A DAO governed by soul-bound tokens',
  daoLinks: [],
};

// ============================================================================
// IPFS CONFIGURATION
// ============================================================================

export interface IPFSConfig {
  gateway: string;
  apiEndpoint: string;
  pinningService?: string;
  pinningApiKey?: string;
}

export const IPFS_ENDPOINTS: Record<string, IPFSConfig> = {
  pinata: {
    gateway: 'https://gateway.pinata.cloud/ipfs/',
    apiEndpoint: 'https://api.pinata.cloud/pinning/pinFileToIPFS',
    pinningService: 'pinata',
  },
  nftStorage: {
    gateway: 'https://nftstorage.link/ipfs/',
    apiEndpoint: 'https://api.nft.storage/upload',
    pinningService: 'nft.storage',
  },
  web3Storage: {
    gateway: 'https://w3s.link/ipfs/',
    apiEndpoint: 'https://api.web3.storage/upload',
    pinningService: 'web3.storage',
  },
  public: {
    gateway: 'https://ipfs.io/ipfs/',
    apiEndpoint: '',
  },
};

export const DEFAULT_IPFS_CONFIG = IPFS_ENDPOINTS.public;

// ============================================================================
// TRANSACTION CONFIGURATION
// ============================================================================

export const TRANSACTION_CONFIG = {
  maxRetries: 3,
  retryDelay: 1000, // ms
  gasLimitBuffer: 20n, // 20% buffer
  confirmationBlocks: 1,
  timeout: 120000, // 2 minutes
};

// ============================================================================
// PROPOSAL CONFIGURATION
// ============================================================================

export enum ProposalStatus {
  Pending = 0,
  Active = 1,
  Canceled = 2,
  Defeated = 3,
  Succeeded = 4,
  Queued = 5,
  Expired = 6,
  Executed = 7,
}

export enum VoteType {
  Against = 0,
  For = 1,
  Abstain = 2,
}

export const PROPOSAL_CONFIG = {
  minTitleLength: 10,
  maxTitleLength: 200,
  minBodyLength: 100,
  maxBodyLength: 100000,
  allowedFormats: ['markdown', 'plaintext'] as const,
};

// ============================================================================
// TASK MARKET CONFIGURATION
// ============================================================================

export enum TaskStatus {
  Open = 0,
  Assigned = 1,
  Completed = 2,
  Cancelled = 3,
  Disputed = 4,
}

export enum BidStatus {
  Pending = 0,
  Accepted = 1,
  Rejected = 2,
  Withdrawn = 3,
}

export const TASK_CONFIG = {
  minBudget: 0n,
  maxBudget: 1000000000000000000000000n, // 1M tokens
  platformFeeBasisPoints: 250n, // 2.5%
  minDeadlineHours: 24,
  maxDeadlineDays: 365,
};

// ============================================================================
// PERMISSIONS
// ============================================================================

export const DAO_PERMISSIONS = {
  ROOT: '0x0000000000000000000000000000000000000000000000000000000000000000',
  EXECUTE: '0x0000000000000000000000000000000000000000000000000000000000000001',
  UPGRADE: '0x0000000000000000000000000000000000000000000000000000000000000002',
  MINT: '0x0000000000000000000000000000000000000000000000000000000000000003',
  BURN: '0x0000000000000000000000000000000000000000000000000000000000000004',
  PROPOSE: '0x0000000000000000000000000000000000000000000000000000000000000005',
  VOTE: '0x0000000000000000000000000000000000000000000000000000000000000006',
} as const;

// ============================================================================
// RPC ENDPOINTS (for fallback)
// ============================================================================

export const PUBLIC_RPC_ENDPOINTS: Record<number, string[]> = {
  [mainnet.id]: [
    'https://eth.llamarpc.com',
    'https://rpc.ankr.com/eth',
    'https://ethereum.publicnode.com',
  ],
  [base.id]: [
    'https://base.llamarpc.com',
    'https://base.drpc.org',
    'https://mainnet.base.org',
  ],
  [polygon.id]: [
    'https://polygon.llamarpc.com',
    'https://rpc.ankr.com/polygon',
    'https://polygon-rpc.com',
  ],
  [arbitrum.id]: [
    'https://arbitrum.llamarpc.com',
    'https://rpc.ankr.com/arbitrum',
    'https://arb1.arbitrum.io/rpc',
  ],
  [optimism.id]: [
    'https://optimism.llamarpc.com',
    'https://rpc.ankr.com/optimism',
    'https://mainnet.optimism.io',
  ],
};

// ============================================================================
// EXPLORER URLS
// ============================================================================

export const EXPLORER_URLS: Record<number, string> = {
  [mainnet.id]: 'https://etherscan.io',
  [base.id]: 'https://basescan.org',
  [polygon.id]: 'https://polygonscan.com',
  [arbitrum.id]: 'https://arbiscan.io',
  [optimism.id]: 'https://optimistic.etherscan.io',
};

export function getExplorerUrl(chainId: number, type: 'tx' | 'address' | 'block', hash: string): string {
  const base = EXPLORER_URLS[chainId];
  if (!base) return '';
  return `${base}/${type}/${hash}`;
}

// ============================================================================
// UTILITY FUNCTIONS
// ============================================================================

export function isSupportedChain(chainId: number): chainId is SupportedChain['id'] {
  return SUPPORTED_CHAINS.some(chain => chain.id === chainId);
}

export function getChainById(chainId: number): SupportedChain | undefined {
  return SUPPORTED_CHAINS.find(chain => chain.id === chainId);
}

export function getContractAddresses(chainId: number): ContractAddresses | undefined {
  return DEPLOYER_CONTRACTS[chainId];
}

export function formatDuration(seconds: bigint): string {
  const days = Number(seconds / 86400n);
  const hours = Number((seconds % 86400n) / 3600n);
  const minutes = Number((seconds % 3600n) / 60n);
  
  if (days > 0) return `${days} day${days > 1 ? 's' : ''}`;
  if (hours > 0) return `${hours} hour${hours > 1 ? 's' : ''}`;
  return `${minutes} minute${minutes > 1 ? 's' : ''}`;
}

export function basisPointsToPercentage(basisPoints: bigint): number {
  return Number(basisPoints) / 10000;
}

export function percentageToBasisPoints(percentage: number): bigint {
  return BigInt(Math.round(percentage * 10000));
}
