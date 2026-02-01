/**
 * DAO Deployer - DAO Operations
 * 
 * DAO operations including creation, settings management,
 * treasury management, and token minting/burning.
 */

import {
  type PublicClient,
  type WalletClient,
  type Address,
  encodeFunctionData,
  parseEther,
  formatEther,
} from 'viem';
import {
  AragonDAOABI,
  DAOFactoryABI,
  SoulBoundTokenABI,
  type DAOMetadata,
  type DAOSettings,
  type ContractAddress,
} from './contracts.ts';
import {
  getContractAddresses,
  DEFAULT_GOVERNANCE_PARAMS,
  type GovernanceParams,
  DAO_PERMISSIONS,
  getExplorerUrl,
} from './constants.ts';
import {
  DAOOperationError,
  DAONotFoundError,
  DAOCreationError,
  PermissionError,
  TransactionError,
  ContractReadError,
  ContractWriteError,
  InsufficientFundsError,
} from './errors.ts';
import { waitForTransaction, getPublicClient } from './viem.ts';
import { IPFSClient } from './ipfs.ts';

// ============================================================================
// TYPES
// ============================================================================

export interface CreateDAOParams {
  metadata: DAOMetadata;
  governance: GovernanceParams;
  plugins?: string[];
  initialMembers?: ContractAddress[];
  ensSubdomain?: string;
}

export interface DAODetails {
  address: ContractAddress;
  tokenAddress: ContractAddress;
  metadata: DAOMetadata;
  settings: DAOSettings;
  createdAt: bigint;
  active: boolean;
  plugins: string[];
  permissions: string[];
}

export interface TreasuryBalance {
  token: ContractAddress;
  symbol: string;
  balance: bigint;
  decimals: number;
}

export interface UpdateSettingsParams {
  votingDelay?: bigint;
  votingPeriod?: bigint;
  proposalThreshold?: bigint;
  quorumNumerator?: bigint;
}

// ============================================================================
// DAO CREATION
// ============================================================================

/**
 * Create a new DAO with soul-bound token governance
 */
export async function createDAO(
  publicClient: PublicClient,
  walletClient: WalletClient,
  chainId: number,
  params: CreateDAOParams
): Promise<{
  daoAddress: ContractAddress;
  tokenAddress: ContractAddress;
  transactionHash: `0x${string}`;
  blockNumber: bigint;
}> {
  try {
    const addresses = getContractAddresses(chainId);
    if (!addresses) {
      throw new DAOCreationError(`No contract addresses for chain ${chainId}`);
    }

    // Upload metadata to IPFS
    const ipfsClient = new IPFSClient();
    const metadataContent = JSON.stringify({
      name: params.metadata.name,
      description: params.metadata.description,
      avatar: params.metadata.avatar,
      links: params.metadata.links,
    });
    const metadataUpload = await ipfsClient.upload(
      metadataContent,
      'dao-metadata.json'
    );

    // Encode DAO creation parameters
    const createData = encodeFunctionData({
      abi: DAOFactoryABI,
      functionName: 'createDAO',
      args: [
        {
          name: params.metadata.name,
          description: params.metadata.description,
          avatar: params.metadata.avatar || '',
          links: params.metadata.links.map(l => l.url),
        },
        {
          tokenName: params.governance.tokenName,
          tokenSymbol: params.governance.tokenSymbol,
          tokenDecimals: params.governance.tokenDecimals,
        },
        {
          supportThreshold: params.governance.supportThreshold,
          minParticipation: params.governance.minParticipation,
          minDuration: params.governance.minDuration,
          minProposerVotingPower: params.governance.minProposerVotingPower,
        },
        params.plugins?.map(p => ({
          pluginRepo: p as `0x${string}`,
          data: '0x' as `0x${string}`,
        })) || [],
      ],
    });

    // Send transaction
    const hash = await walletClient.sendTransaction({
      to: addresses.daoFactory,
      data: createData,
      account: walletClient.account!,
      chain: walletClient.chain,
    });

    // Wait for confirmation
    const receipt = await waitForTransaction(publicClient, hash);

    if (receipt.status === 'reverted') {
      throw new TransactionError(
        'DAO creation transaction reverted',
        'DAO_CREATION_REVERTED',
        hash,
        receipt
      );
    }

    // Parse DAO address from event logs
    // In real implementation, would parse the DAOCreated event
    const daoAddress = '0x0000000000000000000000000000000000000000' as ContractAddress;
    const tokenAddress = '0x0000000000000000000000000000000000000000' as ContractAddress;

    // Mint initial tokens if members specified
    if (params.initialMembers && params.initialMembers.length > 0 && tokenAddress) {
      for (const member of params.initialMembers) {
        await mintInitialToken(publicClient, walletClient, tokenAddress, member);
      }
    }

    return {
      daoAddress,
      tokenAddress,
      transactionHash: hash,
      blockNumber: receipt.blockNumber,
    };
  } catch (error) {
    if (error instanceof DAOOperationError || error instanceof TransactionError) {
      throw error;
    }
    throw new DAOCreationError(
      error instanceof Error ? error.message : 'DAO creation failed',
      error instanceof Error ? error : undefined
    );
  }
}

/**
 * Mint initial token for DAO member
 */
async function mintInitialToken(
  publicClient: PublicClient,
  walletClient: WalletClient,
  tokenAddress: ContractAddress,
  to: ContractAddress
): Promise<void> {
  const data = encodeFunctionData({
    abi: SoulBoundTokenABI,
    functionName: 'mint',
    args: [to, ''],
  });

  const hash = await walletClient.sendTransaction({
    to: tokenAddress,
    data,
    account: walletClient.account!,
    chain: walletClient.chain,
  });

  await waitForTransaction(publicClient, hash);
}

// ============================================================================
// DAO QUERIES
// ============================================================================

/**
 * Get DAO details
 */
export async function getDAO(
  publicClient: PublicClient,
  daoAddress: ContractAddress
): Promise<DAODetails> {
  try {
    // Get metadata
    const metadataData = await publicClient.readContract({
      address: daoAddress,
      abi: AragonDAOABI,
      functionName: 'metadata',
    });

    // Parse metadata (would decode from bytes in real implementation)
    const metadata: DAOMetadata = {
      name: 'DAO',
      description: '',
      links: [],
    };

    // Get settings from proposal manager (if available)
    const settings: DAOSettings = {
      governanceToken: '0x0000000000000000000000000000000000000000' as ContractAddress,
      votingDelay: 0n,
      votingPeriod: 0n,
      proposalThreshold: 0n,
      quorumNumerator: 0n,
      timelockDelay: 0n,
    };

    return {
      address: daoAddress,
      tokenAddress: settings.governanceToken,
      metadata,
      settings,
      createdAt: 0n,
      active: true,
      plugins: [],
      permissions: [],
    };
  } catch (error) {
    throw new ContractReadError(
      daoAddress,
      'getDAO',
      [],
      error instanceof Error ? error : undefined
    );
  }
}

/**
 * Get all DAOs from factory
 */
export async function getAllDAOs(
  publicClient: PublicClient,
  chainId: number
): Promise<DAODetails[]> {
  const addresses = getContractAddresses(chainId);
  if (!addresses) {
    throw new DAOOperationError(
      `No contract addresses for chain ${chainId}`,
      'NO_CONTRACTS',
      undefined,
      { chainId }
    );
  }

  try {
    const daoList = await publicClient.readContract({
      address: addresses.daoFactory,
      abi: DAOFactoryABI,
      functionName: 'getAllDAOs',
    });

    // Fetch details for each DAO
    const daos: DAODetails[] = [];
    for (const daoInfo of daoList) {
      try {
        const details = await getDAO(publicClient, daoInfo.dao);
        daos.push(details);
      } catch {
        // Skip DAOs that can't be fetched
      }
    }

    return daos;
  } catch (error) {
    throw new ContractReadError(
      addresses.daoFactory,
      'getAllDAOs',
      [],
      error instanceof Error ? error : undefined
    );
  }
}

/**
 * Check if DAO exists
 */
export async function daoExists(
  publicClient: PublicClient,
  daoAddress: ContractAddress
): Promise<boolean> {
  try {
    const code = await publicClient.getBytecode({ address: daoAddress });
    return code !== undefined && code !== '0x';
  } catch {
    return false;
  }
}

// ============================================================================
// DAO SETTINGS
// ============================================================================

/**
 * Update DAO settings (requires permission)
 */
export async function updateDAOSettings(
  publicClient: PublicClient,
  walletClient: WalletClient,
  daoAddress: ContractAddress,
  params: UpdateSettingsParams
): Promise<{
  transactionHash: `0x${string}`;
}> {
  try {
    // This would be implemented based on the specific DAO plugin
    // For now, throw an error indicating this needs to be done via proposal
    throw new PermissionError(
      'EXECUTE',
      walletClient.account?.address || 'unknown',
      daoAddress
    );
  } catch (error) {
    if (error instanceof PermissionError) throw error;
    throw new ContractWriteError(
      daoAddress,
      'updateSettings',
      [params],
      error instanceof Error ? error : undefined
    );
  }
}

/**
 * Update DAO metadata (requires permission)
 */
export async function updateDAOMetadata(
  publicClient: PublicClient,
  walletClient: WalletClient,
  daoAddress: ContractAddress,
  metadata: DAOMetadata
): Promise<{
  transactionHash: `0x${string}`;
}> {
  try {
    // Upload new metadata to IPFS
    const ipfsClient = new IPFSClient();
    const metadataContent = JSON.stringify(metadata);
    const upload = await ipfsClient.upload(metadataContent, 'dao-metadata.json');

    // Encode metadata update
    const data = encodeFunctionData({
      abi: AragonDAOABI,
      functionName: 'setMetadata',
      args: [`0x${Buffer.from(upload.cid).toString('hex')}` as `0x${string}`],
    });

    const hash = await walletClient.sendTransaction({
      to: daoAddress,
      data,
      account: walletClient.account!,
      chain: walletClient.chain,
    });

    const receipt = await waitForTransaction(publicClient, hash);

    if (receipt.status === 'reverted') {
      throw new TransactionError(
        'Metadata update transaction reverted',
        'METADATA_UPDATE_REVERTED',
        hash,
        receipt
      );
    }

    return { transactionHash: hash };
  } catch (error) {
    if (error instanceof TransactionError) throw error;
    throw new ContractWriteError(
      daoAddress,
      'setMetadata',
      [metadata],
      error instanceof Error ? error : undefined
    );
  }
}

// ============================================================================
// TREASURY MANAGEMENT
// ============================================================================

/**
 * Get DAO treasury ETH balance
 */
export async function getTreasuryBalance(
  publicClient: PublicClient,
  daoAddress: ContractAddress
): Promise<bigint> {
  try {
    const balance = await publicClient.getBalance({ address: daoAddress });
    return balance;
  } catch (error) {
    throw new DAOOperationError(
      'Failed to get treasury balance',
      'TREASURY_BALANCE_ERROR',
      daoAddress,
      undefined,
      error instanceof Error ? error : undefined
    );
  }
}

/**
 * Get DAO treasury token balances
 */
export async function getTreasuryTokenBalances(
  publicClient: PublicClient,
  daoAddress: ContractAddress,
  tokenAddresses: ContractAddress[]
): Promise<TreasuryBalance[]> {
  const balances: TreasuryBalance[] = [];

  for (const tokenAddress of tokenAddresses) {
    try {
      const [balance, symbol, decimals] = await Promise.all([
        publicClient.readContract({
          address: tokenAddress,
          abi: [
            {
              inputs: [{ name: 'account', type: 'address' }],
              name: 'balanceOf',
              outputs: [{ name: '', type: 'uint256' }],
              stateMutability: 'view',
              type: 'function',
            },
          ],
          functionName: 'balanceOf',
          args: [daoAddress],
        }),
        publicClient.readContract({
          address: tokenAddress,
          abi: [
            {
              inputs: [],
              name: 'symbol',
              outputs: [{ name: '', type: 'string' }],
              stateMutability: 'view',
              type: 'function',
            },
          ],
          functionName: 'symbol',
        }).catch(() => 'UNKNOWN'),
        publicClient.readContract({
          address: tokenAddress,
          abi: [
            {
              inputs: [],
              name: 'decimals',
              outputs: [{ name: '', type: 'uint8' }],
              stateMutability: 'view',
              type: 'function',
            },
          ],
          functionName: 'decimals',
        }).catch(() => 18),
      ]);

      balances.push({
        token: tokenAddress,
        symbol,
        balance,
        decimals,
      });
    } catch {
      // Skip tokens that fail
    }
  }

  return balances;
}

/**
 * Deposit ETH to DAO treasury
 */
export async function depositToTreasury(
  publicClient: PublicClient,
  walletClient: WalletClient,
  daoAddress: ContractAddress,
  amount: bigint
): Promise<{
  transactionHash: `0x${string}`;
}> {
  try {
    const hash = await walletClient.sendTransaction({
      to: daoAddress,
      value: amount,
      account: walletClient.account!,
      chain: walletClient.chain,
    });

    const receipt = await waitForTransaction(publicClient, hash);

    if (receipt.status === 'reverted') {
      throw new TransactionError(
        'Deposit transaction reverted',
        'DEPOSIT_REVERTED',
        hash,
        receipt
      );
    }

    return { transactionHash: hash };
  } catch (error) {
    if (error instanceof TransactionError) throw error;
    throw new DAOOperationError(
      'Failed to deposit to treasury',
      'DEPOSIT_ERROR',
      daoAddress,
      undefined,
      error instanceof Error ? error : undefined
    );
  }
}

/**
 * Withdraw ETH from DAO treasury (requires proposal)
 */
export async function withdrawFromTreasury(
  publicClient: PublicClient,
  walletClient: WalletClient,
  daoAddress: ContractAddress,
  to: ContractAddress,
  amount: bigint
): Promise<{
  transactionHash: `0x${string}`;
}> {
  try {
    // Check treasury balance
    const balance = await getTreasuryBalance(publicClient, daoAddress);
    if (balance < amount) {
      throw new InsufficientFundsError(amount, balance);
    }

    // This would typically be done via a proposal
    // For direct execution, check permissions
    const data = encodeFunctionData({
      abi: AragonDAOABI,
      functionName: 'execute',
      args: [
        [
          {
            to,
            value: amount,
            data: '0x' as `0x${string}`,
          },
        ],
        0n,
      ],
    });

    const hash = await walletClient.sendTransaction({
      to: daoAddress,
      data,
      account: walletClient.account!,
      chain: walletClient.chain,
    });

    const receipt = await waitForTransaction(publicClient, hash);

    if (receipt.status === 'reverted') {
      throw new TransactionError(
        'Withdrawal transaction reverted',
        'WITHDRAWAL_REVERTED',
        hash,
        receipt
      );
    }

    return { transactionHash: hash };
  } catch (error) {
    if (error instanceof TransactionError || error instanceof InsufficientFundsError) {
      throw error;
    }
    throw new DAOOperationError(
      'Failed to withdraw from treasury',
      'WITHDRAWAL_ERROR',
      daoAddress,
      undefined,
      error instanceof Error ? error : undefined
    );
  }
}

// ============================================================================
// DAO UTILITIES
// ============================================================================

/**
 * Get DAO explorer URL
 */
export function getDAOExplorerUrl(
  chainId: number,
  daoAddress: ContractAddress
): string {
  return getExplorerUrl(chainId, 'address', daoAddress);
}

/**
 * Format treasury balance
 */
export function formatTreasuryBalance(
  balance: bigint,
  decimals: number = 18,
  symbol: string = 'ETH'
): string {
  const formatted = formatEther(balance);
  return `${formatted} ${symbol}`;
}

/**
 * Check if address is DAO member (has tokens)
 */
export async function isDAOMember(
  publicClient: PublicClient,
  daoAddress: ContractAddress,
  account: ContractAddress
): Promise<boolean> {
  try {
    const dao = await getDAO(publicClient, daoAddress);
    if (!dao.tokenAddress) return false;

    const balance = await publicClient.readContract({
      address: dao.tokenAddress,
      abi: SoulBoundTokenABI,
      functionName: 'balanceOf',
      args: [account],
    });

    return balance > 0n;
  } catch {
    return false;
  }
}

// ============================================================================
// DAO CLASS
// ============================================================================

export class DAO {
  private publicClient: PublicClient;
  private walletClient?: WalletClient;
  private address: ContractAddress;

  constructor(
    publicClient: PublicClient,
    daoAddress: ContractAddress,
    walletClient?: WalletClient
  ) {
    this.publicClient = publicClient;
    this.address = daoAddress;
    this.walletClient = walletClient;
  }

  async getDetails(): Promise<DAODetails> {
    return getDAO(this.publicClient, this.address);
  }

  async exists(): Promise<boolean> {
    return daoExists(this.publicClient, this.address);
  }

  async getTreasuryBalance(): Promise<bigint> {
    return getTreasuryBalance(this.publicClient, this.address);
  }

  async getTreasuryTokens(tokenAddresses: ContractAddress[]): Promise<TreasuryBalance[]> {
    return getTreasuryTokenBalances(this.publicClient, this.address, tokenAddresses);
  }

  async isMember(account: ContractAddress): Promise<boolean> {
    return isDAOMember(this.publicClient, this.address, account);
  }

  async deposit(amount: bigint): Promise<{ transactionHash: `0x${string}` }> {
    if (!this.walletClient) {
      throw new DAOOperationError(
        'Wallet client required',
        'WALLET_REQUIRED',
        this.address
      );
    }
    return depositToTreasury(this.publicClient, this.walletClient, this.address, amount);
  }

  async withdraw(
    to: ContractAddress,
    amount: bigint
  ): Promise<{ transactionHash: `0x${string}` }> {
    if (!this.walletClient) {
      throw new DAOOperationError(
        'Wallet client required',
        'WALLET_REQUIRED',
        this.address
      );
    }
    return withdrawFromTreasury(this.publicClient, this.walletClient, this.address, to, amount);
  }

  async updateMetadata(metadata: DAOMetadata): Promise<{ transactionHash: `0x${string}` }> {
    if (!this.walletClient) {
      throw new DAOOperationError(
        'Wallet client required',
        'WALLET_REQUIRED',
        this.address
      );
    }
    return updateDAOMetadata(this.publicClient, this.walletClient, this.address, metadata);
  }

  getExplorerUrl(chainId: number): string {
    return getDAOExplorerUrl(chainId, this.address);
  }
}

// ============================================================================
// EXPORTS
// ============================================================================

export {
  AragonDAOABI,
  DAOFactoryABI,
};
