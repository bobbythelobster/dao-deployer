/**
 * DAO Deployer - Aragon OSX SDK Integration
 * 
 * Aragon SDK integration for DAO creation, plugin installation,
 * permission management, and DAO client factory.
 */

import {
  Context,
  ContextParams,
  Client,
  CreateDaoParams,
  DaoCreationSteps,
  DaoMetadata,
  PluginInstallItem,
  VotingMode,
  TokenType,
  VotingSettings,
} from '@aragon/sdk-client';
import { WalletClient, PublicClient } from 'viem';
import { getChainById, ARAGON_ADDRESSES, DAO_PERMISSIONS } from './constants.ts';
import {
  AragonSDKError,
  AragonClientError,
  PluginInstallationError,
  DAOCreationError,
  UnsupportedChainError,
  ChainConnectionError,
} from './errors.ts';

// ============================================================================
// TYPES
// ============================================================================

export interface AragonClientConfig {
  chainId: number;
  walletClient?: WalletClient;
  publicClient?: PublicClient;
  rpcUrl?: string;
  gasless?: boolean;
  ipfsNodes?: { url: string; headers?: Record<string, string> }[];
  graphqlNodes?: { url: string }[];
}

export interface DAOCreationConfig {
  metadata: DaoMetadata;
  plugins: PluginInstallItem[];
  ensSubdomain?: string;
}

export interface TokenVotingPluginConfig {
  votingSettings: VotingSettings;
  tokenAddress?: string;
  tokenName?: string;
  tokenSymbol?: string;
  tokenDecimals?: number;
  tokenType: TokenType;
  mintingConfig?: {
    receivers: string[];
    amounts: bigint[];
  };
}

export interface MultisigPluginConfig {
  members: string[];
  votingSettings: {
    minApprovals: number;
    onlyListed: boolean;
  };
}

export interface PermissionGrant {
  who: string;
  where: string;
  permission: string;
  condition?: string;
}

export interface PermissionRevoke {
  who: string;
  where: string;
  permission: string;
}

// ============================================================================
// ARAGON CLIENT FACTORY
// ============================================================================

export class AragonClientFactory {
  private clients: Map<number, Client> = new Map();
  private contexts: Map<number, Context> = new Map();

  /**
   * Create an Aragon SDK context
   */
  createContext(config: AragonClientConfig): Context {
    const chain = getChainById(config.chainId);
    if (!chain) {
      throw new UnsupportedChainError(config.chainId);
    }

    const addresses = ARAGON_ADDRESSES[config.chainId];
    if (!addresses) {
      throw new ChainConnectionError(
        config.chainId,
        new Error('Aragon contracts not deployed on this chain')
      );
    }

    const contextParams: ContextParams = {
      network: config.chainId.toString(),
      signer: config.walletClient,
      web3Providers: config.publicClient?.transport,
      ipfsNodes: config.ipfsNodes || [
        {
          url: 'https://ipfs.io/ipfs/',
        },
      ],
      graphqlNodes: config.graphqlNodes || [
        {
          url: `https://subgraph.satsuma-prod.com/aragon/core-${chain.name.toLowerCase()}/api`,
        },
      ],
      DAOFactory: addresses.daoFactory,
      ENSRegistry: '0x0000000000000000000000000000000000000000', // Placeholder
    };

    return new Context(contextParams);
  }

  /**
   * Create an Aragon SDK client
   */
  createClient(config: AragonClientConfig): Client {
    const context = this.createContext(config);
    return new Client(context);
  }

  /**
   * Get or create a cached client
   */
  getClient(config: AragonClientConfig): Client {
    const cacheKey = config.chainId;
    
    if (!this.clients.has(cacheKey)) {
      const client = this.createClient(config);
      this.clients.set(cacheKey, client);
      this.contexts.set(cacheKey, client.context);
    }
    
    return this.clients.get(cacheKey)!;
  }

  /**
   * Get the context for a cached client
   */
  getContext(chainId: number): Context | undefined {
    return this.contexts.get(chainId);
  }

  /**
   * Clear all cached clients
   */
  clearCache(): void {
    this.clients.clear();
    this.contexts.clear();
  }

  /**
   * Remove a specific client from cache
   */
  removeClient(chainId: number): void {
    this.clients.delete(chainId);
    this.contexts.delete(chainId);
  }
}

// ============================================================================
// DAO CREATION
// ============================================================================

export async function* createDAO(
  client: Client,
  config: DAOCreationConfig
): AsyncGenerator<DaoCreationSteps, void, unknown> {
  try {
    const params: CreateDaoParams = {
      metadataUri: await uploadDaoMetadata(client, config.metadata),
      plugins: config.plugins,
      ensSubdomain: config.ensSubdomain,
    };

    for await (const step of client.methods.createDao(params)) {
      yield step;
    }
  } catch (error) {
    throw new DAOCreationError(
      error instanceof Error ? error.message : 'DAO creation failed',
      error instanceof Error ? error : undefined
    );
  }
}

/**
 * Upload DAO metadata to IPFS
 */
async function uploadDaoMetadata(
  client: Client,
  metadata: DaoMetadata
): Promise<string> {
  try {
    const cid = await client.methods.pinMetadata(metadata);
    return `ipfs://${cid}`;
  } catch (error) {
    throw new AragonSDKError(
      'Failed to upload DAO metadata',
      'METADATA_UPLOAD_ERROR',
      undefined,
      error instanceof Error ? error : undefined
    );
  }
}

// ============================================================================
// PLUGIN CONFIGURATION
// ============================================================================

/**
 * Create token voting plugin installation item
 */
export function createTokenVotingPlugin(
  config: TokenVotingPluginConfig
): PluginInstallItem {
  return {
    id: 'token-voting.plugin.dao.eth',
    data: new Uint8Array(), // Plugin-specific installation data
  };
}

/**
 * Create multisig plugin installation item
 */
export function createMultisigPlugin(
  config: MultisigPluginConfig
): PluginInstallItem {
  return {
    id: 'multisig.plugin.dao.eth',
    data: new Uint8Array(), // Plugin-specific installation data
  };
}

/**
 * Create custom plugin installation item
 */
export function createCustomPlugin(
  pluginId: string,
  data: Uint8Array
): PluginInstallItem {
  return {
    id: pluginId,
    data,
  };
}

// ============================================================================
// PLUGIN INSTALLATION
// ============================================================================

export async function* installPlugin(
  client: Client,
  daoAddress: string,
  plugin: PluginInstallItem
): AsyncGenerator<unknown, void, unknown> {
  try {
    const params = {
      daoAddressOrEns: daoAddress,
      pluginSetup: plugin,
    };

    for await (const step of client.methods.prepareInstallation(params)) {
      yield step;
    }
  } catch (error) {
    throw new PluginInstallationError(
      plugin.id,
      error instanceof Error ? error : undefined
    );
  }
}

// ============================================================================
// PERMISSION MANAGEMENT
// ============================================================================

/**
 * Grant a permission in a DAO
 */
export async function grantPermission(
  client: Client,
  daoAddress: string,
  grant: PermissionGrant
): Promise<void> {
  try {
    const params = {
      daoAddressOrEns: daoAddress,
      where: grant.where,
      who: grant.who,
      permission: grant.permission as Parameters<Client['methods']['grantPermission']>[0]['permission'],
      condition: grant.condition,
    };

    await client.methods.grantPermission(params);
  } catch (error) {
    throw new AragonSDKError(
      `Failed to grant permission ${grant.permission}`,
      'PERMISSION_GRANT_ERROR',
      { grant },
      error instanceof Error ? error : undefined
    );
  }
}

/**
 * Revoke a permission in a DAO
 */
export async function revokePermission(
  client: Client,
  daoAddress: string,
  revoke: PermissionRevoke
): Promise<void> {
  try {
    const params = {
      daoAddressOrEns: daoAddress,
      where: revoke.where,
      who: revoke.who,
      permission: revoke.permission as Parameters<Client['methods']['revokePermission']>[0]['permission'],
    };

    await client.methods.revokePermission(params);
  } catch (error) {
    throw new AragonSDKError(
      `Failed to revoke permission ${revoke.permission}`,
      'PERMISSION_REVOKE_ERROR',
      { revoke },
      error instanceof Error ? error : undefined
    );
  }
}

/**
 * Check if an address has a permission
 */
export async function hasPermission(
  client: Client,
  daoAddress: string,
  where: string,
  who: string,
  permission: string
): Promise<boolean> {
  try {
    const params = {
      daoAddressOrEns: daoAddress,
      where,
      who,
      permission: permission as Parameters<Client['methods']['hasPermission']>[0]['permission'],
      data: new Uint8Array(),
    };

    return await client.methods.hasPermission(params);
  } catch (error) {
    throw new AragonSDKError(
      'Failed to check permission',
      'PERMISSION_CHECK_ERROR',
      { where, who, permission },
      error instanceof Error ? error : undefined
    );
  }
}

/**
 * Get all permissions for a DAO
 */
export async function getPermissions(
  client: Client,
  daoAddress: string
): Promise<PermissionGrant[]> {
  try {
    const dao = await client.methods.getDao(daoAddress);
    if (!dao) {
      throw new AragonSDKError(
        `DAO not found: ${daoAddress}`,
        'DAO_NOT_FOUND'
      );
    }

    // This would need to be implemented based on the actual Aragon SDK
    // For now, return an empty array
    return [];
  } catch (error) {
    throw new AragonSDKError(
      'Failed to get permissions',
      'PERMISSION_GET_ERROR',
      { daoAddress },
      error instanceof Error ? error : undefined
    );
  }
}

// ============================================================================
// DAO QUERIES
// ============================================================================

/**
 * Get DAO details
 */
export async function getDAO(
  client: Client,
  daoAddress: string
): Promise<{
  address: string;
  metadata: DaoMetadata;
  plugins: string[];
  creationBlock: number;
} | null> {
  try {
    const dao = await client.methods.getDao(daoAddress);
    
    if (!dao) return null;

    return {
      address: daoAddress,
      metadata: dao.metadata,
      plugins: dao.plugins.map(p => p.id),
      creationBlock: dao.creationBlockNumber,
    };
  } catch (error) {
    throw new AragonSDKError(
      `Failed to get DAO: ${daoAddress}`,
      'DAO_GET_ERROR',
      { daoAddress },
      error instanceof Error ? error : undefined
    );
  }
}

/**
 * Get all DAOs
 */
export async function getAllDAOs(
  client: Client
): Promise<string[]> {
  try {
    const daos = await client.methods.getDaos();
    return daos.map(dao => dao.address);
  } catch (error) {
    throw new AragonSDKError(
      'Failed to get DAOs',
      'DAO_LIST_ERROR',
      undefined,
      error instanceof Error ? error : undefined
    );
  }
}

/**
 * Get DAO plugins
 */
export async function getDAOPlugins(
  client: Client,
  daoAddress: string
): Promise<string[]> {
  try {
    const dao = await client.methods.getDao(daoAddress);
    if (!dao) {
      throw new AragonSDKError(
        `DAO not found: ${daoAddress}`,
        'DAO_NOT_FOUND'
      );
    }

    return dao.plugins.map(p => p.id);
  } catch (error) {
    throw new AragonSDKError(
      'Failed to get DAO plugins',
      'DAO_PLUGINS_ERROR',
      { daoAddress },
      error instanceof Error ? error : undefined
    );
  }
}

// ============================================================================
// DEFAULT INSTANCE
// ============================================================================

const defaultFactory = new AragonClientFactory();

/**
 * Get the default Aragon client factory
 */
export function getAragonFactory(): AragonClientFactory {
  return defaultFactory;
}

/**
 * Get a client using the default factory
 */
export function getAragonClient(config: AragonClientConfig): Client {
  return defaultFactory.getClient(config);
}

// ============================================================================
// EXPORTS
// ============================================================================

export {
  Context,
  ContextParams,
  Client,
  CreateDaoParams,
  DaoCreationSteps,
  DaoMetadata,
  PluginInstallItem,
  VotingMode,
  TokenType,
  VotingSettings,
};
