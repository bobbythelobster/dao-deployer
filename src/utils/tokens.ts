/**
 * DAO Deployer - Token Operations
 * 
 * Token operations for Soul-Bound Tokens including balance queries,
 * voting power, minting, and burning (DAO only).
 */

import {
  type PublicClient,
  type WalletClient,
  type Address,
  type Hex,
  encodeFunctionData,
  decodeFunctionResult,
} from 'viem';
import {
  SoulBoundTokenABI,
  ERC20ABI,
  type SoulBoundTokenContract,
  type ContractAddress,
} from './contracts.ts';
import {
  getContractAddresses,
  TRANSACTION_CONFIG,
} from './constants.ts';
import {
  TokenError,
  TokenNotFoundError,
  InsufficientBalanceError,
  TokenTransferError,
  SoulBoundTokenError,
  TokenNotTransferableError,
  TransactionError,
  createErrorFromViemError,
  ContractReadError,
  ContractWriteError,
} from './errors.ts';
import { waitForTransaction } from './viem.ts';

// ============================================================================
// TYPES
// ============================================================================

export interface TokenBalance {
  address: ContractAddress;
  balance: bigint;
  votingPower: bigint;
  tokenId?: bigint;
}

export interface TokenMetadata {
  name: string;
  symbol: string;
  decimals: number;
  totalSupply: bigint;
  owner: ContractAddress;
}

export interface MintParams {
  to: ContractAddress;
  uri?: string;
  amount?: bigint; // For ERC20-style SBTs
}

export interface BurnParams {
  tokenId?: bigint;
  from?: ContractAddress;
  amount?: bigint;
}

// ============================================================================
// READ OPERATIONS
// ============================================================================

/**
 * Get token metadata
 */
export async function getTokenMetadata(
  publicClient: PublicClient,
  tokenAddress: ContractAddress
): Promise<TokenMetadata> {
  try {
    const [name, symbol, decimals, totalSupply] = await Promise.all([
      publicClient.readContract({
        address: tokenAddress,
        abi: SoulBoundTokenABI,
        functionName: 'name',
      }),
      publicClient.readContract({
        address: tokenAddress,
        abi: SoulBoundTokenABI,
        functionName: 'symbol',
      }),
      publicClient.readContract({
        address: tokenAddress,
        abi: SoulBoundTokenABI,
        functionName: 'decimals',
      }),
      publicClient.readContract({
        address: tokenAddress,
        abi: SoulBoundTokenABI,
        functionName: 'totalSupply',
      }),
    ]);

    return {
      name,
      symbol,
      decimals,
      totalSupply,
      owner: tokenAddress, // Would need to fetch from contract
    };
  } catch (error) {
    throw new ContractReadError(
      tokenAddress,
      'getTokenMetadata',
      [],
      error instanceof Error ? error : undefined
    );
  }
}

/**
 * Get token balance for an account
 */
export async function getTokenBalance(
  publicClient: PublicClient,
  tokenAddress: ContractAddress,
  account: ContractAddress
): Promise<bigint> {
  try {
    const balance = await publicClient.readContract({
      address: tokenAddress,
      abi: SoulBoundTokenABI,
      functionName: 'balanceOf',
      args: [account],
    });

    return balance;
  } catch (error) {
    throw new ContractReadError(
      tokenAddress,
      'balanceOf',
      [account],
      error instanceof Error ? error : undefined
    );
  }
}

/**
 * Get voting power for an account
 */
export async function getVotingPower(
  publicClient: PublicClient,
  tokenAddress: ContractAddress,
  account: ContractAddress
): Promise<bigint> {
  try {
    const votingPower = await publicClient.readContract({
      address: tokenAddress,
      abi: SoulBoundTokenABI,
      functionName: 'getVotes',
      args: [account],
    });

    return votingPower;
  } catch (error) {
    throw new ContractReadError(
      tokenAddress,
      'getVotes',
      [account],
      error instanceof Error ? error : undefined
    );
  }
}

/**
 * Get past voting power at a specific block
 */
export async function getPastVotingPower(
  publicClient: PublicClient,
  tokenAddress: ContractAddress,
  account: ContractAddress,
  blockNumber: bigint
): Promise<bigint> {
  try {
    const votingPower = await publicClient.readContract({
      address: tokenAddress,
      abi: SoulBoundTokenABI,
      functionName: 'getPastVotes',
      args: [account, blockNumber],
    });

    return votingPower;
  } catch (error) {
    throw new ContractReadError(
      tokenAddress,
      'getPastVotes',
      [account, blockNumber],
      error instanceof Error ? error : undefined
    );
  }
}

/**
 * Get total supply
 */
export async function getTotalSupply(
  publicClient: PublicClient,
  tokenAddress: ContractAddress
): Promise<bigint> {
  try {
    const totalSupply = await publicClient.readContract({
      address: tokenAddress,
      abi: SoulBoundTokenABI,
      functionName: 'totalSupply',
    });

    return totalSupply;
  } catch (error) {
    throw new ContractReadError(
      tokenAddress,
      'totalSupply',
      [],
      error instanceof Error ? error : undefined
    );
  }
}

/**
 * Get token holder information
 */
export async function getTokenHolder(
  publicClient: PublicClient,
  tokenAddress: ContractAddress,
  account: ContractAddress
): Promise<TokenBalance> {
  try {
    const [balance, votingPower] = await Promise.all([
      getTokenBalance(publicClient, tokenAddress, account),
      getVotingPower(publicClient, tokenAddress, account),
    ]);

    return {
      address: account,
      balance,
      votingPower,
    };
  } catch (error) {
    throw new TokenError(
      `Failed to get token holder info for ${account}`,
      'TOKEN_HOLDER_ERROR',
      tokenAddress,
      account,
      undefined,
      error instanceof Error ? error : undefined
    );
  }
}

/**
 * Get all token holders (requires indexing or events)
 * Note: This is a placeholder - real implementation would use subgraph or event logs
 */
export async function getAllTokenHolders(
  publicClient: PublicClient,
  tokenAddress: ContractAddress
): Promise<TokenBalance[]> {
  // This would typically query a subgraph or event logs
  // For now, return empty array
  return [];
}

/**
 * Check if an account has tokens
 */
export async function hasTokens(
  publicClient: PublicClient,
  tokenAddress: ContractAddress,
  account: ContractAddress
): Promise<boolean> {
  const balance = await getTokenBalance(publicClient, tokenAddress, account);
  return balance > 0n;
}

/**
 * Check if an account has voting power
 */
export async function hasVotingPower(
  publicClient: PublicClient,
  tokenAddress: ContractAddress,
  account: ContractAddress
): Promise<boolean> {
  const power = await getVotingPower(publicClient, tokenAddress, account);
  return power > 0n;
}

// ============================================================================
// WRITE OPERATIONS (DAO ONLY)
// ============================================================================

/**
 * Mint a soul-bound token (DAO only)
 */
export async function mintToken(
  publicClient: PublicClient,
  walletClient: WalletClient,
  tokenAddress: ContractAddress,
  params: MintParams
): Promise<{
  transactionHash: `0x${string}`;
  tokenId: bigint;
}> {
  try {
    // Encode the mint function call
    const data = encodeFunctionData({
      abi: SoulBoundTokenABI,
      functionName: 'mint',
      args: [params.to, params.uri || ''],
    });

    // Send transaction
    const hash = await walletClient.sendTransaction({
      to: tokenAddress,
      data,
      account: walletClient.account!,
      chain: walletClient.chain,
    });

    // Wait for confirmation
    const receipt = await waitForTransaction(publicClient, hash);

    if (receipt.status === 'reverted') {
      throw new TransactionError(
        'Token minting transaction reverted',
        'MINT_REVERTED',
        hash,
        receipt
      );
    }

    // Parse token ID from event logs (simplified)
    // In real implementation, would parse event logs
    const tokenId = 1n;

    return {
      transactionHash: hash,
      tokenId,
    };
  } catch (error) {
    if (error instanceof TransactionError) throw error;
    throw new ContractWriteError(
      tokenAddress,
      'mint',
      [params.to, params.uri],
      error instanceof Error ? error : undefined
    );
  }
}

/**
 * Batch mint tokens (DAO only)
 */
export async function mintBatch(
  publicClient: PublicClient,
  walletClient: WalletClient,
  tokenAddress: ContractAddress,
  params: MintParams[]
): Promise<{
  transactionHash: `0x${string}`;
  tokenIds: bigint[];
}> {
  try {
    const to = params.map(p => p.to);
    const uris = params.map(p => p.uri || '');

    const data = encodeFunctionData({
      abi: SoulBoundTokenABI,
      functionName: 'mintBatch',
      args: [to, uris],
    });

    const hash = await walletClient.sendTransaction({
      to: tokenAddress,
      data,
      account: walletClient.account!,
      chain: walletClient.chain,
    });

    const receipt = await waitForTransaction(publicClient, hash);

    if (receipt.status === 'reverted') {
      throw new TransactionError(
        'Batch minting transaction reverted',
        'MINT_BATCH_REVERTED',
        hash,
        receipt
      );
    }

    return {
      transactionHash: hash,
      tokenIds: [], // Would parse from event logs
    };
  } catch (error) {
    if (error instanceof TransactionError) throw error;
    throw new ContractWriteError(
      tokenAddress,
      'mintBatch',
      [params.map(p => p.to), params.map(p => p.uri)],
      error instanceof Error ? error : undefined
    );
  }
}

/**
 * Burn a soul-bound token (DAO only)
 */
export async function burnToken(
  publicClient: PublicClient,
  walletClient: WalletClient,
  tokenAddress: ContractAddress,
  tokenId: bigint
): Promise<{
  transactionHash: `0x${string}`;
}> {
  try {
    const data = encodeFunctionData({
      abi: SoulBoundTokenABI,
      functionName: 'burn',
      args: [tokenId],
    });

    const hash = await walletClient.sendTransaction({
      to: tokenAddress,
      data,
      account: walletClient.account!,
      chain: walletClient.chain,
    });

    const receipt = await waitForTransaction(publicClient, hash);

    if (receipt.status === 'reverted') {
      throw new TransactionError(
        'Token burn transaction reverted',
        'BURN_REVERTED',
        hash,
        receipt
      );
    }

    return {
      transactionHash: hash,
    };
  } catch (error) {
    if (error instanceof TransactionError) throw error;
    throw new ContractWriteError(
      tokenAddress,
      'burn',
      [tokenId],
      error instanceof Error ? error : undefined
    );
  }
}

/**
 * Batch burn tokens (DAO only)
 */
export async function burnBatch(
  publicClient: PublicClient,
  walletClient: WalletClient,
  tokenAddress: ContractAddress,
  tokenIds: bigint[]
): Promise<{
  transactionHash: `0x${string}`;
}> {
  // This would be implemented as a custom batch burn function
  // For now, burn sequentially
  const results: { transactionHash: `0x${string}` }[] = [];
  
  for (const tokenId of tokenIds) {
    const result = await burnToken(publicClient, walletClient, tokenAddress, tokenId);
    results.push(result);
  }

  return {
    transactionHash: results[results.length - 1].transactionHash,
  };
}

// ============================================================================
// SOUL BOUND SPECIFIC
// ============================================================================

/**
 * Check if token is transferable (should always be false for SBTs)
 */
export async function isTransferable(
  publicClient: PublicClient,
  tokenAddress: ContractAddress
): Promise<boolean> {
  // Soul-bound tokens are non-transferable by definition
  // This could check a contract flag if the implementation supports it
  return false;
}

/**
 * Validate token transfer attempt
 * Will always throw for soul-bound tokens
 */
export function validateTokenTransfer(tokenAddress: ContractAddress): never {
  throw new TokenNotTransferableError(tokenAddress);
}

// ============================================================================
// UTILITIES
// ============================================================================

/**
 * Format token amount with decimals
 */
export function formatTokenAmount(
  amount: bigint,
  decimals: number
): string {
  const divisor = 10n ** BigInt(decimals);
  const integerPart = amount / divisor;
  const fractionalPart = amount % divisor;
  
  const fractionalStr = fractionalPart
    .toString()
    .padStart(decimals, '0')
    .replace(/0+$/, '');
  
  if (fractionalStr === '') {
    return integerPart.toString();
  }
  
  return `${integerPart}.${fractionalStr}`;
}

/**
 * Parse token amount to bigint
 */
export function parseTokenAmount(
  amount: string,
  decimals: number
): bigint {
  const [integerPart, fractionalPart = ''] = amount.split('.');
  
  const integer = BigInt(integerPart);
  const fractional = BigInt(
    fractionalPart.padEnd(decimals, '0').slice(0, decimals)
  );
  
  return integer * (10n ** BigInt(decimals)) + fractional;
}

/**
 * Calculate percentage of total supply
 */
export function calculatePercentageOfSupply(
  amount: bigint,
  totalSupply: bigint
): number {
  if (totalSupply === 0n) return 0;
  return Number((amount * 10000n) / totalSupply) / 100;
}

// ============================================================================
// TOKEN CONTRACT FACTORY
// ============================================================================

export class TokenContract {
  private publicClient: PublicClient;
  private walletClient?: WalletClient;
  private address: ContractAddress;

  constructor(
    publicClient: PublicClient,
    tokenAddress: ContractAddress,
    walletClient?: WalletClient
  ) {
    this.publicClient = publicClient;
    this.address = tokenAddress;
    this.walletClient = walletClient;
  }

  async getMetadata(): Promise<TokenMetadata> {
    return getTokenMetadata(this.publicClient, this.address);
  }

  async getBalance(account: ContractAddress): Promise<bigint> {
    return getTokenBalance(this.publicClient, this.address, account);
  }

  async getVotingPower(account: ContractAddress): Promise<bigint> {
    return getVotingPower(this.publicClient, this.address, account);
  }

  async getPastVotingPower(
    account: ContractAddress,
    blockNumber: bigint
  ): Promise<bigint> {
    return getPastVotingPower(this.publicClient, this.address, account, blockNumber);
  }

  async getTotalSupply(): Promise<bigint> {
    return getTotalSupply(this.publicClient, this.address);
  }

  async hasTokens(account: ContractAddress): Promise<boolean> {
    return hasTokens(this.publicClient, this.address, account);
  }

  async hasVotingPower(account: ContractAddress): Promise<boolean> {
    return hasVotingPower(this.publicClient, this.address, account);
  }

  async mint(params: MintParams): Promise<{ transactionHash: `0x${string}`; tokenId: bigint }> {
    if (!this.walletClient) {
      throw new TokenError(
        'Wallet client required for minting',
        'WALLET_REQUIRED',
        this.address
      );
    }
    return mintToken(this.publicClient, this.walletClient, this.address, params);
  }

  async burn(tokenId: bigint): Promise<{ transactionHash: `0x${string}` }> {
    if (!this.walletClient) {
      throw new TokenError(
        'Wallet client required for burning',
        'WALLET_REQUIRED',
        this.address
      );
    }
    return burnToken(this.publicClient, this.walletClient, this.address, tokenId);
  }
}

// ============================================================================
// EXPORTS
// ============================================================================

export {
  SoulBoundTokenABI,
  ERC20ABI,
};
