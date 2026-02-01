/**
 * DAO Deployer - Blockchain Integration Tests
 * 
 * Comprehensive tests for the blockchain integration layer.
 */

import { describe, it, expect, beforeEach, beforeAll } from 'bun:test';
import { mainnet, base } from 'viem/chains';
import {
  // Constants
  SUPPORTED_CHAINS,
  isSupportedChain,
  getChainById,
  getContractAddresses,
  formatDuration,
  basisPointsToPercentage,
  
  // Errors
  DAOError,
  UnsupportedChainError,
  TransactionError,
  ProposalError,
  TokenError,
  TaskError,
  
  // Contracts
  SoulBoundTokenABI,
  DAOFactoryABI,
  ProposalManagerABI,
  TaskMarketABI,
  AragonDAOABI,
  
  // Viem
  createPublicViemClient,
  createWalletViemClient,
  getPublicClient,
  clearPublicClientCache,
  
  // IPFS
  IPFSClient,
  uploadToIPFS,
  retrieveFromIPFS,
  
  // Tokens
  getTokenMetadata,
  getTokenBalance,
  getVotingPower,
  formatTokenAmount,
  parseTokenAmount,
  TokenContract,
  
  // DAO
  getDAO,
  getTreasuryBalance,
  DAO,
  
  // Proposals
  getProposal,
  ProposalManager,
  ProposalStatus,
  VoteType,
  
  // Tasks
  getTask,
  TaskMarket,
  TaskStatus,
  BidStatus,
} from '../index.ts';

import {
  // Test utilities
  createMockPublicClient,
  createMockWalletClient,
  createMockProposal,
  createMockTask,
  createMockBid,
  createMockIPFSContent,
  createMockProposalContent,
  MockIPFSClient,
  MOCK_ACCOUNTS,
  MOCK_CONTRACTS,
  generateRandomAddress,
  expectError,
} from '../test-utils.ts';

// ============================================================================
// CONSTANTS TESTS
// ============================================================================

describe('Constants', () => {
  it('should export supported chains', () => {
    expect(SUPPORTED_CHAINS.length).toBeGreaterThan(0);
    expect(SUPPORTED_CHAINS).toContain(mainnet);
    expect(SUPPORTED_CHAINS).toContain(base);
  });

  it('should check if chain is supported', () => {
    expect(isSupportedChain(1)).toBe(true); // Mainnet
    expect(isSupportedChain(8453)).toBe(true); // Base
    expect(isSupportedChain(999999)).toBe(false);
  });

  it('should get chain by ID', () => {
    expect(getChainById(1)).toBe(mainnet);
    expect(getChainById(8453)).toBe(base);
    expect(getChainById(999999)).toBeUndefined();
  });

  it('should format duration', () => {
    expect(formatDuration(86400n)).toBe('1 day');
    expect(formatDuration(172800n)).toBe('2 days');
    expect(formatDuration(3600n)).toBe('1 hour');
    expect(formatDuration(7200n)).toBe('2 hours');
  });

  it('should convert basis points to percentage', () => {
    expect(basisPointsToPercentage(500000n)).toBe(50);
    expect(basisPointsToPercentage(100000n)).toBe(10);
    expect(basisPointsToPercentage(10000n)).toBe(1);
  });
});

// ============================================================================
// ERROR TESTS
// ============================================================================

describe('Errors', () => {
  it('should create DAOError with correct properties', () => {
    const error = new DAOError('Test error', 'TEST_CODE', { key: 'value' });
    expect(error.message).toBe('Test error');
    expect(error.code).toBe('TEST_CODE');
    expect(error.context).toEqual({ key: 'value' });
    expect(error.name).toBe('DAOError');
  });

  it('should create UnsupportedChainError', () => {
    const error = new UnsupportedChainError(999999);
    expect(error.message).toContain('999999');
    expect(error.code).toBe('CHAIN_ERROR');
    expect(error.name).toBe('UnsupportedChainError');
  });

  it('should create TransactionError with hash', () => {
    const error = new TransactionError(
      'Transaction failed',
      'TX_ERROR',
      '0x1234',
      { blockNumber: 100n }
    );
    expect(error.transactionHash).toBe('0x1234');
    expect(error.receipt).toEqual({ blockNumber: 100n });
  });

  it('should create ProposalError with ID', () => {
    const error = new ProposalError(
      'Proposal not found',
      'PROPOSAL_NOT_FOUND',
      123n,
      '0xdao'
    );
    expect(error.proposalId).toBe(123n);
    expect(error.daoAddress).toBe('0xdao');
  });

  it('should create TokenError with addresses', () => {
    const error = new TokenError(
      'Insufficient balance',
      'INSUFFICIENT_BALANCE',
      '0xtoken',
      '0xaccount'
    );
    expect(error.tokenAddress).toBe('0xtoken');
    expect(error.account).toBe('0xaccount');
  });

  it('should create TaskError with ID', () => {
    const error = new TaskError('Task not found', 'TASK_NOT_FOUND', 456n);
    expect(error.taskId).toBe(456n);
  });

  it('should convert error to JSON', () => {
    const error = new DAOError('Test', 'CODE', { key: 'value' });
    const json = error.toJSON();
    expect(json.message).toBe('Test');
    expect(json.code).toBe('CODE');
    expect(json.context).toEqual({ key: 'value' });
  });
});

// ============================================================================
// CONTRACT ABIs TESTS
// ============================================================================

describe('Contract ABIs', () => {
  it('should export SoulBoundTokenABI', () => {
    expect(SoulBoundTokenABI).toBeDefined();
    expect(Array.isArray(SoulBoundTokenABI)).toBe(true);
    expect(SoulBoundTokenABI.length).toBeGreaterThan(0);
  });

  it('should export DAOFactoryABI', () => {
    expect(DAOFactoryABI).toBeDefined();
    expect(Array.isArray(DAOFactoryABI)).toBe(true);
  });

  it('should export ProposalManagerABI', () => {
    expect(ProposalManagerABI).toBeDefined();
    expect(Array.isArray(ProposalManagerABI)).toBe(true);
  });

  it('should export TaskMarketABI', () => {
    expect(TaskMarketABI).toBeDefined();
    expect(Array.isArray(TaskMarketABI)).toBe(true);
  });

  it('should export AragonDAOABI', () => {
    expect(AragonDAOABI).toBeDefined();
    expect(Array.isArray(AragonDAOABI)).toBe(true);
  });

  it('should have valid ABI structure', () => {
    const abi = SoulBoundTokenABI;
    const hasFunctions = abi.some(item => item.type === 'function');
    const hasEvents = abi.some(item => item.type === 'event');
    expect(hasFunctions || hasEvents).toBe(true);
  });
});

// ============================================================================
// VIEM CLIENT TESTS
// ============================================================================

describe('Viem Client', () => {
  beforeEach(() => {
    clearPublicClientCache();
  });

  it('should create public client', () => {
    const client = createPublicViemClient({ chain: mainnet });
    expect(client).toBeDefined();
    expect(client.chain).toBe(mainnet);
  });

  it('should create public client by chain ID', () => {
    const client = createPublicClientByChainId(1);
    expect(client).toBeDefined();
  });

  it('should throw for unsupported chain', () => {
    expect(() => createPublicClientByChainId(999999)).toThrow(UnsupportedChainError);
  });

  it('should cache public clients', () => {
    const client1 = getPublicClient(1);
    const client2 = getPublicClient(1);
    expect(client1).toBe(client2);
  });

  it('should create wallet client', () => {
    const mockAccount = MOCK_ACCOUNTS.daoCreator;
    const client = createMockWalletClient();
    expect(client).toBeDefined();
    expect(client.account).toBeDefined();
  });
});

// ============================================================================
// IPFS TESTS
// ============================================================================

describe('IPFS', () => {
  let ipfsClient: MockIPFSClient;

  beforeEach(() => {
    ipfsClient = new MockIPFSClient();
  });

  it('should upload content', async () => {
    const content = 'Test content';
    const result = await ipfsClient.upload(content, 'test.txt');
    
    expect(result.cid).toBeDefined();
    expect(result.cid.startsWith('Qm')).toBe(true);
    expect(result.size).toBe(content.length);
    expect(result.pinned).toBe(true);
  });

  it('should upload proposal content', async () => {
    const content = createMockProposalContent();
    const result = await ipfsClient.uploadProposal(content);
    
    expect(result.cid).toBeDefined();
    expect(result.pinned).toBe(true);
  });

  it('should retrieve content', async () => {
    const content = 'Test content';
    const upload = await ipfsClient.upload(content);
    const retrieved = await ipfsClient.retrieve(upload.cid);
    
    expect(retrieved).toBe(content);
  });

  it('should retrieve and parse proposal', async () => {
    const content = createMockProposalContent();
    const upload = await ipfsClient.uploadProposal(content);
    const retrieved = await ipfsClient.retrieveProposal(upload.cid);
    
    expect(retrieved.title).toBe(content.title);
    expect(retrieved.description).toBe(content.description);
    expect(retrieved.author).toBe(content.author);
  });

  it('should check if content is available', async () => {
    const content = 'Test content';
    const upload = await ipfsClient.upload(content);
    
    expect(ipfsClient.isAvailable(upload.cid)).toBe(true);
    expect(ipfsClient.isAvailable('QmNonExistent')).toBe(false);
  });

  it('should unpin content', async () => {
    const content = 'Test content';
    const upload = await ipfsClient.upload(content);
    
    expect(ipfsClient.isAvailable(upload.cid)).toBe(true);
    await ipfsClient.unpin(upload.cid);
    expect(ipfsClient.isAvailable(upload.cid)).toBe(false);
  });
});

// ============================================================================
// TOKEN TESTS
// ============================================================================

describe('Tokens', () => {
  let mockClient: ReturnType<typeof createMockPublicClient>;

  beforeEach(() => {
    mockClient = createMockPublicClient();
  });

  it('should get token metadata', async () => {
    const metadata = await getTokenMetadata(
      mockClient,
      MOCK_CONTRACTS.soulBoundToken
    );
    
    expect(metadata.name).toBe('Soul Bound Token');
    expect(metadata.symbol).toBe('SBT');
    expect(metadata.decimals).toBe(18);
    expect(metadata.totalSupply).toBe(1000n);
  });

  it('should get token balance', async () => {
    const balance = await getTokenBalance(
      mockClient,
      MOCK_CONTRACTS.soulBoundToken,
      MOCK_ACCOUNTS.member1
    );
    
    expect(balance).toBe(100n);
  });

  it('should get voting power', async () => {
    const power = await getVotingPower(
      mockClient,
      MOCK_CONTRACTS.soulBoundToken,
      MOCK_ACCOUNTS.member1
    );
    
    expect(power).toBe(100n);
  });

  it('should format token amount', () => {
    const amount = 1500000000000000000n; // 1.5 tokens
    const formatted = formatTokenAmount(amount, 18);
    expect(formatted).toBe('1.5');
  });

  it('should parse token amount', () => {
    const amount = '1.5';
    const parsed = parseTokenAmount(amount, 18);
    expect(parsed).toBe(1500000000000000000n);
  });

  it('should create TokenContract instance', () => {
    const token = new TokenContract(
      mockClient,
      MOCK_CONTRACTS.soulBoundToken
    );
    
    expect(token).toBeDefined();
  });
});

// ============================================================================
// DAO TESTS
// ============================================================================

describe('DAO', () => {
  let mockClient: ReturnType<typeof createMockPublicClient>;

  beforeEach(() => {
    mockClient = createMockPublicClient();
  });

  it('should get DAO details', async () => {
    const dao = await getDAO(mockClient, MOCK_CONTRACTS.dao);
    
    expect(dao).toBeDefined();
    expect(dao.address).toBe(MOCK_CONTRACTS.dao);
    expect(dao.active).toBe(true);
  });

  it('should get treasury balance', async () => {
    const balance = await getTreasuryBalance(mockClient, MOCK_CONTRACTS.dao);
    
    expect(balance).toBe(1000000000000000000n);
  });

  it('should create DAO instance', () => {
    const dao = new DAO(mockClient, MOCK_CONTRACTS.dao);
    
    expect(dao).toBeDefined();
  });

  it('should check if DAO exists', async () => {
    const exists = await mockClient.getBytecode({ address: MOCK_CONTRACTS.dao });
    expect(exists).toBeDefined();
  });
});

// ============================================================================
// PROPOSAL TESTS
// ============================================================================

describe('Proposals', () => {
  let mockClient: ReturnType<typeof createMockPublicClient>;

  beforeEach(() => {
    mockClient = createMockPublicClient();
  });

  it('should get proposal', async () => {
    const proposal = await getProposal(
      mockClient,
      MOCK_CONTRACTS.proposalManager,
      1n
    );
    
    expect(proposal).toBeDefined();
    expect(proposal.id).toBe(1n);
    expect(proposal.status).toBe(ProposalStatus.Active);
  });

  it('should create mock proposal', () => {
    const proposal = createMockProposal(1n);
    
    expect(proposal.id).toBe(1n);
    expect(proposal.metadata.title).toBe('Test Proposal 1');
    expect(proposal.forVotes).toBe(50n);
    expect(proposal.againstVotes).toBe(20n);
  });

  it('should create ProposalManager instance', () => {
    const manager = new ProposalManager(
      mockClient,
      MOCK_CONTRACTS.proposalManager
    );
    
    expect(manager).toBeDefined();
  });

  it('should check vote type enum', () => {
    expect(VoteType.Against).toBe(0);
    expect(VoteType.For).toBe(1);
    expect(VoteType.Abstain).toBe(2);
  });
});

// ============================================================================
// TASK TESTS
// ============================================================================

describe('Tasks', () => {
  let mockClient: ReturnType<typeof createMockPublicClient>;

  beforeEach(() => {
    mockClient = createMockPublicClient();
  });

  it('should get task', async () => {
    const task = await getTask(mockClient, MOCK_CONTRACTS.taskMarket, 1n);
    
    expect(task).toBeDefined();
    expect(task.id).toBe(1n);
    expect(task.status).toBe(TaskStatus.Open);
  });

  it('should create mock task', () => {
    const task = createMockTask(1n);
    
    expect(task.id).toBe(1n);
    expect(task.title).toBe('Test Task 1');
    expect(task.budget).toBe(1000n);
  });

  it('should create mock bid', () => {
    const bid = createMockBid(1n, 1n);
    
    expect(bid.id).toBe(1n);
    expect(bid.taskId).toBe(1n);
    expect(bid.status).toBe(BidStatus.Pending);
  });

  it('should create TaskMarket instance', () => {
    const market = new TaskMarket(mockClient, MOCK_CONTRACTS.taskMarket);
    
    expect(market).toBeDefined();
  });

  it('should check task status enum', () => {
    expect(TaskStatus.Open).toBe(0);
    expect(TaskStatus.Assigned).toBe(1);
    expect(TaskStatus.Completed).toBe(2);
    expect(TaskStatus.Cancelled).toBe(3);
    expect(TaskStatus.Disputed).toBe(4);
  });

  it('should check bid status enum', () => {
    expect(BidStatus.Pending).toBe(0);
    expect(BidStatus.Accepted).toBe(1);
    expect(BidStatus.Rejected).toBe(2);
    expect(BidStatus.Withdrawn).toBe(3);
  });
});

// ============================================================================
// MOCK UTILITIES TESTS
// ============================================================================

describe('Mock Utilities', () => {
  it('should create mock public client', () => {
    const client = createMockPublicClient();
    
    expect(client).toBeDefined();
    expect(client.readContract).toBeDefined();
    expect(client.getBalance).toBeDefined();
  });

  it('should create mock wallet client', () => {
    const client = createMockWalletClient();
    
    expect(client).toBeDefined();
    expect(client.sendTransaction).toBeDefined();
    expect(client.account).toBeDefined();
  });

  it('should generate random address', () => {
    const address = generateRandomAddress();
    
    expect(address).toMatch(/^0x[a-fA-F0-9]{40}$/);
  });

  it('should create mock IPFS content', () => {
    const content = createMockIPFSContent('QmTest');
    
    expect(content.cid).toBe('QmTest');
    expect(content.pinned).toBe(true);
  });

  it('should have mock accounts', () => {
    expect(MOCK_ACCOUNTS.deployer).toMatch(/^0x[a-fA-F0-9]{40}$/);
    expect(MOCK_ACCOUNTS.daoCreator).toMatch(/^0x[a-fA-F0-9]{40}$/);
  });

  it('should have mock contracts', () => {
    expect(MOCK_CONTRACTS.soulBoundToken).toMatch(/^0x[a-fA-F0-9]{40}$/);
    expect(MOCK_CONTRACTS.daoFactory).toMatch(/^0x[a-fA-F0-9]{40}$/);
  });
});

// ============================================================================
// INTEGRATION TESTS
// ============================================================================

describe('Integration', () => {
  it('should export all modules', () => {
    // Constants
    expect(SUPPORTED_CHAINS).toBeDefined();
    expect(isSupportedChain).toBeDefined();
    
    // Errors
    expect(DAOError).toBeDefined();
    expect(UnsupportedChainError).toBeDefined();
    
    // Contracts
    expect(SoulBoundTokenABI).toBeDefined();
    expect(DAOFactoryABI).toBeDefined();
    
    // Viem
    expect(createPublicViemClient).toBeDefined();
    expect(getPublicClient).toBeDefined();
    
    // IPFS
    expect(IPFSClient).toBeDefined();
    expect(uploadToIPFS).toBeDefined();
    
    // Tokens
    expect(getTokenMetadata).toBeDefined();
    expect(getTokenBalance).toBeDefined();
    expect(TokenContract).toBeDefined();
    
    // DAO
    expect(getDAO).toBeDefined();
    expect(getTreasuryBalance).toBeDefined();
    expect(DAO).toBeDefined();
    
    // Proposals
    expect(getProposal).toBeDefined();
    expect(ProposalManager).toBeDefined();
    
    // Tasks
    expect(getTask).toBeDefined();
    expect(TaskMarket).toBeDefined();
  });

  it('should work with mock clients', async () => {
    const publicClient = createMockPublicClient();
    const walletClient = createMockWalletClient();
    
    // Test token operations
    const metadata = await getTokenMetadata(
      publicClient,
      MOCK_CONTRACTS.soulBoundToken
    );
    expect(metadata.name).toBe('Soul Bound Token');
    
    // Test DAO operations
    const dao = await getDAO(publicClient, MOCK_CONTRACTS.dao);
    expect(dao.address).toBe(MOCK_CONTRACTS.dao);
    
    // Test proposal operations
    const proposal = await getProposal(
      publicClient,
      MOCK_CONTRACTS.proposalManager,
      1n
    );
    expect(proposal.id).toBe(1n);
    
    // Test task operations
    const task = await getTask(publicClient, MOCK_CONTRACTS.taskMarket, 1n);
    expect(task.id).toBe(1n);
  });
});
