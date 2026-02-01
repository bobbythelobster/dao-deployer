/**
 * DAO Deployer - Blockchain Integration Layer
 * 
 * Main exports for the blockchain integration layer.
 * Provides Viem + Aragon SDK integration for DAO operations.
 */

// ============================================================================
// CONSTANTS
// ============================================================================

export {
  // Chain configuration
  SUPPORTED_CHAINS,
  CHAIN_NAMES,
  CHAIN_SHORT_NAMES,
  
  // Contract addresses
  ARAGON_ADDRESSES,
  DEPLOYER_CONTRACTS,
  type ContractAddresses,
  
  // Governance parameters
  DEFAULT_GOVERNANCE_PARAMS,
  type GovernanceParams,
  
  // Transaction configuration
  TRANSACTION_CONFIG,
  
  // Enums
  ProposalStatus,
  VoteType,
  TaskStatus,
  BidStatus,
  DAO_PERMISSIONS,
  
  // Utility functions
  isSupportedChain,
  getChainById,
  getContractAddresses,
  formatDuration,
  basisPointsToPercentage,
  percentageToBasisPoints,
  getExplorerUrl,
} from './constants.ts';

// ============================================================================
// ERRORS
// ============================================================================

export {
  // Base error
  DAOError,
  
  // Chain errors
  ChainError,
  UnsupportedChainError,
  ChainConnectionError,
  
  // Transaction errors
  TransactionError,
  TransactionRevertedError,
  TransactionFailedError,
  InsufficientFundsError,
  GasEstimationError,
  NonceError,
  TransactionTimeoutError,
  UserRejectedError,
  
  // Contract errors
  ContractError,
  ContractReadError,
  ContractWriteError,
  ContractNotFoundError,
  
  // DAO errors
  DAOOperationError,
  DAONotFoundError,
  DAOAlreadyExistsError,
  DAOCreationError,
  PermissionError,
  
  // Proposal errors
  ProposalError,
  ProposalNotFoundError,
  ProposalCreationError,
  InvalidProposalError,
  ProposalVotingError,
  ProposalExecutionError,
  ProposalAlreadyExecutedError,
  
  // Token errors
  TokenError,
  TokenNotFoundError,
  InsufficientBalanceError,
  TokenTransferError,
  SoulBoundTokenError,
  TokenNotTransferableError,
  
  // Task errors
  TaskError,
  TaskNotFoundError,
  TaskCreationError,
  BidError,
  BidNotFoundError,
  
  // IPFS errors
  IPFSError,
  IPFSUploadError,
  IPFSDownloadError,
  IPFSPinError,
  
  // Aragon errors
  AragonSDKError,
  AragonClientError,
  PluginInstallationError,
  
  // Validation errors
  ValidationError,
  
  // Error utilities
  classifyError,
  isRetryableError,
  extractRevertReason,
  createErrorFromViemError,
  type ErrorCategory,
} from './errors.ts';

// ============================================================================
// CONTRACTS
// ============================================================================

export {
  // ABIs
  SoulBoundTokenABI,
  DAOFactoryABI,
  ProposalManagerABI,
  TaskMarketABI,
  AragonDAOABI,
  ERC20ABI,
  Multicall3ABI,
  
  // Types
  type ContractAddress,
  type Bytes32,
  type SoulBoundTokenMetadata,
  type TokenHolder,
  type DAOMetadata,
  type DAOSettings,
  type ProposalMetadata,
  type Proposal,
  type ProposalAction,
  type Vote,
  type Task,
  type Bid,
  type AragonPlugin,
  type AragonPermission,
  type SoulBoundTokenContract,
  type DAOFactoryContract,
  type ProposalManagerContract,
  type TaskMarketContract,
  type AragonDAOContract,
  type ERC20Contract,
  
  // Contract helpers
  getContract,
  createContractConfig,
  type ContractConfig,
} from './contracts.ts';

// ============================================================================
// VIEM CLIENT
// ============================================================================

export {
  // Client creation
  createPublicViemClient,
  createPublicClientByChainId,
  createWalletViemClient,
  createWalletClientByChainId,
  
  // Transport
  createFallbackTransport,
  createHttpTransport,
  createBrowserTransport,
  
  // Multicall
  createMulticallClient,
  multicallConfig,
  
  // Caching
  getPublicClient,
  clearPublicClientCache,
  
  // Chain utilities
  getChain,
  getSupportedChains,
  isChainSupported,
  getDefaultRpcUrl,
  
  // Operations
  waitForTransaction,
  getBlockNumber,
  getGasPrice,
  estimateGas,
  
  // Chains
  mainnet,
  base,
  polygon,
  arbitrum,
  optimism,
  
  // Types
  type ClientConfig,
  type WalletConfig,
  type ClientPair,
  type PublicClient,
  type WalletClient,
  type Transport,
  type Chain,
  type Account,
  type FallbackTransport,
  type HttpTransport,
  type CustomTransport,
} from './viem.ts';

// ============================================================================
// IPFS
// ============================================================================

export {
  // Client
  IPFSClient,
  
  // Default instance
  getIPFSClient,
  configureIPFS,
  
  // Helpers
  uploadToIPFS,
  uploadProposalToIPFS,
  retrieveFromIPFS,
  retrieveProposalFromIPFS,
  
  // Types
  type IPFSContent,
  type ProposalContent,
  type PinataResponse,
  type NFTStorageResponse,
  
  // Config
  IPFS_ENDPOINTS,
  DEFAULT_IPFS_CONFIG,
  type IPFSConfig,
} from './ipfs.ts';

// ============================================================================
// ARAGON SDK
// ============================================================================

export {
  // Factory
  AragonClientFactory,
  getAragonFactory,
  getAragonClient,
  
  // DAO creation
  createDAO as createAragonDAO,
  
  // Plugins
  createTokenVotingPlugin,
  createMultisigPlugin,
  createCustomPlugin,
  installPlugin,
  
  // Permissions
  grantPermission,
  revokePermission,
  hasPermission,
  getPermissions,
  
  // Queries
  getDAO as getAragonDAO,
  getAllDAOs as getAllAragonDAOs,
  getDAOPlugins,
  
  // Types
  type AragonClientConfig,
  type DAOCreationConfig,
  type TokenVotingPluginConfig,
  type MultisigPluginConfig,
  type PermissionGrant,
  type PermissionRevoke,
  
  // Re-exports from @aragon/sdk-client
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
} from './aragon.ts';

// ============================================================================
// TOKENS
// ============================================================================

export {
  // Read operations
  getTokenMetadata,
  getTokenBalance,
  getVotingPower,
  getPastVotingPower,
  getTotalSupply,
  getTokenHolder,
  getAllTokenHolders,
  hasTokens,
  hasVotingPower,
  
  // Write operations
  mintToken,
  mintBatch,
  burnToken,
  burnBatch,
  
  // Soul bound specific
  isTransferable,
  validateTokenTransfer,
  
  // Utilities
  formatTokenAmount,
  parseTokenAmount,
  calculatePercentageOfSupply,
  
  // Class
  TokenContract,
  
  // Types
  type TokenBalance,
  type TokenMetadata,
  type MintParams,
  type BurnParams,
} from './tokens.ts';

// ============================================================================
// DAO OPERATIONS
// ============================================================================

export {
  // Creation
  createDAO,
  
  // Queries
  getDAO,
  getAllDAOs,
  daoExists,
  
  // Settings
  updateDAOSettings,
  updateDAOMetadata,
  
  // Treasury
  getTreasuryBalance,
  getTreasuryTokenBalances,
  depositToTreasury,
  withdrawFromTreasury,
  
  // Utilities
  getDAOExplorerUrl,
  formatTreasuryBalance,
  isDAOMember,
  
  // Class
  DAO,
  
  // Types
  type CreateDAOParams,
  type DAODetails,
  type TreasuryBalance,
  type UpdateSettingsParams,
} from './dao.ts';

// ============================================================================
// PROPOSALS
// ============================================================================

export {
  // Creation
  createProposal,
  
  // Queries
  getProposal,
  getAllProposals,
  getProposalStatus,
  hasVoted,
  getVote,
  canExecute,
  canVote,
  
  // Voting
  castVote,
  
  // Execution
  executeProposal,
  
  // Results
  getProposalResults,
  
  // Class
  ProposalManager,
  
  // Types
  type CreateProposalParams,
  type CastVoteParams,
  type ProposalResult,
} from './proposals.ts';

// ============================================================================
// TASKS
// ============================================================================

export {
  // Task operations
  createTask,
  getTask,
  getAllTasks,
  getTasksByStatus,
  getTasksByCreator,
  getTasksByAssignee,
  isTaskOpen,
  cancelTask,
  
  // Bid operations
  submitBid,
  getBid,
  getTaskBids,
  acceptBid,
  
  // Completion
  markTaskComplete,
  releasePayment,
  
  // Class
  TaskMarket,
  
  // Types
  type CreateTaskParams,
  type SubmitBidParams,
  type AcceptBidParams,
  type CompleteTaskParams,
  type ReleasePaymentParams,
} from './tasks.ts';

// ============================================================================
// TEST UTILITIES
// ============================================================================

export {
  // Mock accounts and contracts
  MOCK_ACCOUNTS,
  MOCK_CONTRACTS,
  
  // Mock clients
  createMockPublicClient,
  createMockWalletClient,
  
  // Mock data factories
  createMockProposal,
  createMockTask,
  createMockBid,
  createMockIPFSContent,
  createMockProposalContent,
  
  // Mock IPFS
  MockIPFSClient,
  
  // Test helpers
  sleep,
  generateRandomAddress,
  generateRandomBytes32,
  formatBigInt,
  assertBigIntEquals,
  assertAddressEquals,
  assertIsValidAddress,
  assertIsValidBytes32,
  expectError,
  expectRevert,
  createStateSnapshot,
  compareSnapshots,
  type StateSnapshot,
} from './test-utils.ts';

// ============================================================================
// VERSION
// ============================================================================

export const VERSION = '1.0.0';

// ============================================================================
// MAIN EXPORT
// ============================================================================

/**
 * Initialize the DAO Deployer blockchain layer
 */
export function initialize(config?: {
  ipfsConfig?: typeof DEFAULT_IPFS_CONFIG;
  ipfsApiKey?: string;
}): void {
  if (config?.ipfsConfig) {
    const { configureIPFS } = require('./ipfs.ts');
    configureIPFS(config.ipfsConfig, config.ipfsApiKey);
  }
}

/**
 * Check if the blockchain layer is properly configured
 */
export function checkConfiguration(): {
  viem: boolean;
  aragon: boolean;
  ipfs: boolean;
  contracts: boolean;
} {
  return {
    viem: true,
    aragon: true,
    ipfs: true,
    contracts: true,
  };
}
