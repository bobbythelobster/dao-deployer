/**
 * Mock Data Generators for DAO Deployer Tests
 * Provides consistent test data for contracts, components, and integration tests
 */

import { type Address, type Hex, stringToHex, keccak256, encodePacked } from 'viem';

// ============ ACCOUNT DATA ============

export interface TestAccount {
  name: string;
  address: Address;
  privateKey: Hex;
  votingPower: bigint;
}

export const MOCK_ACCOUNTS: TestAccount[] = [
  {
    name: 'deployer',
    address: '0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266',
    privateKey: '0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80',
    votingPower: BigInt(0),
  },
  {
    name: 'alice',
    address: '0x70997970C51812dc3A010C7d01b50e0d17dc79C8',
    privateKey: '0x59c6995e998f97a5a0044966f0945389dc9e86dae88c7a8412f4603b6b78690d',
    votingPower: BigInt(1000) * BigInt(1e18),
  },
  {
    name: 'bob',
    address: '0x3C44CdDdB6a900fa2b585dd299e03d12FA4293BC',
    privateKey: '0x5de4111afa1a4b94908f83103eb1f1706367c2e68ca870fc3fb9a804cdab365a',
    votingPower: BigInt(500) * BigInt(1e18),
  },
  {
    name: 'carol',
    address: '0x90F79bf6EB2c4f870365E785982E1f101E93b906',
    privateKey: '0x7c852118294e51e653712a81e05800f419141751be58f605c371e15141b007a6',
    votingPower: BigInt(250) * BigInt(1e18),
  },
  {
    name: 'dave',
    address: '0x15d34AAf54267DB7D7c367839AAf71A00a2C6A65',
    privateKey: '0x47e179ec197488593b187f80a00eb0da91f1b9d0b13f8733639f19c30a34926a',
    votingPower: BigInt(100) * BigInt(1e18),
  },
];

// ============ CONTRACT DATA ============

export interface TokenConfig {
  name: string;
  symbol: string;
  totalSupply: bigint;
  decimals: number;
}

export const MOCK_TOKEN_CONFIG: TokenConfig = {
  name: 'DAO Governance Token',
  symbol: 'DAO',
  totalSupply: BigInt(1000000) * BigInt(1e18), // 1M tokens
  decimals: 18,
};

export interface DAOConfig {
  name: string;
  description: string;
  metadata: string;
  votingDelay: number; // blocks
  votingPeriod: number; // blocks
  proposalThreshold: bigint;
  quorumNumerator: number; // percentage (0-100)
  minVotingPower: bigint;
}

export const MOCK_DAO_CONFIG: DAOConfig = {
  name: 'Test DAO',
  description: 'A test decentralized autonomous organization',
  metadata: 'ipfs://QmTest123',
  votingDelay: 1, // 1 block
  votingPeriod: 10080, // ~1 day in blocks (assuming 12s block time)
  proposalThreshold: BigInt(100) * BigInt(1e18), // 100 tokens
  quorumNumerator: 40, // 40% quorum
  minVotingPower: BigInt(10) * BigInt(1e18), // 10 tokens
};

// ============ PROPOSAL DATA ============

export enum ProposalState {
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

export interface ProposalData {
  id: bigint;
  proposer: Address;
  targets: Address[];
  values: bigint[];
  calldatas: Hex[];
  description: string;
  descriptionHash: Hex;
  ipfsHash: string;
  startBlock: bigint;
  endBlock: bigint;
  forVotes: bigint;
  againstVotes: bigint;
  abstainVotes: bigint;
  executed: boolean;
  canceled: boolean;
  state: ProposalState;
}

export function generateProposal(
  proposer: Address,
  targets: Address[] = [],
  values: bigint[] = [],
  calldatas: Hex[] = [],
  description: string = 'Test proposal'
): ProposalData {
  const id = BigInt(Math.floor(Math.random() * 1000000));
  const descriptionHash = keccak256(stringToHex(description));
  
  return {
    id,
    proposer,
    targets: targets.length > 0 ? targets : [proposer],
    values: values.length > 0 ? values : [BigInt(0)],
    calldatas: calldatas.length > 0 ? calldatas : ['0x'],
    description,
    descriptionHash,
    ipfsHash: `Qm${'a'.repeat(44)}`,
    startBlock: BigInt(0),
    endBlock: BigInt(0),
    forVotes: BigInt(0),
    againstVotes: BigInt(0),
    abstainVotes: BigInt(0),
    executed: false,
    canceled: false,
    state: ProposalState.Pending,
  };
}

// ============ TASK MARKET DATA ============

export enum TaskState {
  Open = 0,
  Assigned = 1,
  Completed = 2,
  Cancelled = 3,
  Disputed = 4,
}

export interface TaskData {
  id: bigint;
  creator: Address;
  title: string;
  description: string;
  budget: bigint;
  deadline: bigint;
  assignee: Address | null;
  state: TaskState;
  createdAt: bigint;
  completedAt: bigint | null;
  ipfsHash: string;
}

export interface BidData {
  id: bigint;
  taskId: bigint;
  bidder: Address;
  amount: bigint;
  proposal: string;
  accepted: boolean;
  createdAt: bigint;
}

export function generateTask(
  creator: Address,
  overrides: Partial<TaskData> = {}
): TaskData {
  const id = BigInt(Math.floor(Math.random() * 1000000));
  const now = Math.floor(Date.now() / 1000);
  
  return {
    id,
    creator,
    title: `Task ${id.toString()}`,
    description: 'A test task description',
    budget: BigInt(1) * BigInt(1e18), // 1 ETH
    deadline: BigInt(now + 7 * 24 * 60 * 60), // 7 days
    assignee: null,
    state: TaskState.Open,
    createdAt: BigInt(now),
    completedAt: null,
    ipfsHash: `Qm${'b'.repeat(44)}`,
    ...overrides,
  };
}

export function generateBid(
  taskId: bigint,
  bidder: Address,
  amount: bigint = BigInt(0.5e18),
  overrides: Partial<BidData> = {}
): BidData {
  const id = BigInt(Math.floor(Math.random() * 1000000));
  const now = Math.floor(Date.now() / 1000);
  
  return {
    id,
    taskId,
    bidder,
    amount,
    proposal: 'I can complete this task efficiently',
    accepted: false,
    createdAt: BigInt(now),
    ...overrides,
  };
}

// ============ ARAGON SDK DATA ============

export interface AragonDAOParams {
  ensSubdomain: string;
  metadata: string;
  plugins: PluginInstallParams[];
}

export interface PluginInstallParams {
  pluginAddress: Address;
  pluginRepoAddress: Address;
  data: Hex;
}

export const MOCK_ARAGON_DAO: AragonDAOParams = {
  ensSubdomain: 'test-dao',
  metadata: stringToHex(JSON.stringify({
    name: 'Test DAO',
    description: 'A test DAO using Aragon OSX',
    avatar: '',
    links: [],
  })),
  plugins: [],
};

// Aragon plugin addresses (mainnet)
export const ARAGON_PLUGIN_ADDRESSES = {
  tokenVoting: '0x1234567890123456789012345678901234567890',
  addresslistVoting: '0x2345678901234567890123456789012345678901',
  multisig: '0x3456789012345678901234567890123456789012',
};

// ============ IPFS DATA ============

export interface IPFSMetadata {
  title: string;
  description: string;
  resources: string[];
  // Optional additional fields
  [key: string]: any;
}

export function generateIPFSMetadata(
  title: string = 'Test Metadata',
  description: string = 'Test description'
): IPFSMetadata {
  return {
    title,
    description,
    resources: [],
  };
}

export const MOCK_IPFS_HASHES = {
  proposal: `Qm${'1'.repeat(44)}`,
  task: `Qm${'2'.repeat(44)}`,
  daoMetadata: `Qm${'3'.repeat(44)}`,
};

// ============ COMPONENT PROPS DATA ============

export interface DAOInfo {
  address: Address;
  name: string;
  memberCount: number;
  proposalCount: number;
  tokenAddress: Address;
  tokenSymbol: string;
  votingPower: bigint;
}

export const MOCK_DAO_INFO: DAOInfo = {
  address: '0x1234567890123456789012345678901234567890',
  name: 'Test DAO',
  memberCount: 5,
  proposalCount: 12,
  tokenAddress: '0xabcdefabcdefabcdefabcdefabcdefabcdefabcd',
  tokenSymbol: 'DAO',
  votingPower: BigInt(1000) * BigInt(1e18),
};

export interface ProposalCardProps {
  id: string;
  title: string;
  state: ProposalState;
  forVotes: bigint;
  againstVotes: bigint;
  abstainVotes: bigint;
  endTime: Date;
  proposer: Address;
  description: string;
}

export function generateProposalCard(
  state: ProposalState = ProposalState.Active
): ProposalCardProps {
  const id = Math.random().toString(36).substring(7);
  
  return {
    id,
    title: `Proposal ${id}`,
    state,
    forVotes: BigInt(500) * BigInt(1e18),
    againstVotes: BigInt(100) * BigInt(1e18),
    abstainVotes: BigInt(50) * BigInt(1e18),
    endTime: new Date(Date.now() + 2 * 24 * 60 * 60 * 1000), // 2 days
    proposer: MOCK_ACCOUNTS[1].address,
    description: 'Test proposal description',
  };
}

// ============ GAS BENCHMARK DATA ============

export interface GasBenchmark {
  operation: string;
  gasUsed: bigint;
  minExpected?: bigint;
  maxExpected?: bigint;
}

export const GAS_BENCHMARKS: Record<string, bigint> = {
  'SoulBoundToken.mint': BigInt(75000),
  'SoulBoundToken.burn': BigInt(35000),
  'SoulBoundToken.delegate': BigInt(50000),
  'DAOFactory.createDAO': BigInt(2500000),
  'DAOFactory.deployToken': BigInt(1200000),
  'ProposalManager.createProposal': BigInt(200000),
  'ProposalManager.castVote': BigInt(80000),
  'ProposalManager.execute': BigInt(150000),
  'TaskMarket.createTask': BigInt(120000),
  'TaskMarket.submitBid': BigInt(80000),
  'TaskMarket.acceptBid': BigInt(100000),
  'TaskMarket.completeTask': BigInt(90000),
  'TaskMarket.releasePayment': BigInt(60000),
};

// ============ ERROR SCENARIOS ============

export const ERROR_SCENARIOS = {
  soulBound: {
    transferNotAllowed: 'SoulBoundToken: transfers not allowed',
    burnNotAuthorized: 'SoulBoundToken: burn not authorized',
    alreadyMinted: 'SoulBoundToken: already minted',
  },
  daoFactory: {
    invalidConfig: 'DAOFactory: invalid DAO configuration',
    tokenDeployFailed: 'DAOFactory: token deployment failed',
    pluginInstallFailed: 'DAOFactory: plugin installation failed',
  },
  proposalManager: {
    invalidProposal: 'ProposalManager: invalid proposal',
    votingClosed: 'ProposalManager: voting closed',
    alreadyVoted: 'ProposalManager: already voted',
    insufficientVotingPower: 'ProposalManager: insufficient voting power',
    proposalNotExecutable: 'ProposalManager: proposal not executable',
    quorumNotReached: 'ProposalManager: quorum not reached',
  },
  taskMarket: {
    taskNotFound: 'TaskMarket: task not found',
    bidTooLow: 'TaskMarket: bid below minimum',
    taskNotAssigned: 'TaskMarket: task not assigned',
    notWorker: 'TaskMarket: not the assigned worker',
    deadlinePassed: 'TaskMarket: deadline passed',
    alreadyCompleted: 'TaskMarket: already completed',
  },
};

// ============ NETWORK CONFIG ============

export interface NetworkConfig {
  chainId: number;
  name: string;
  rpcUrl: string;
  aragonRepo: Address;
  supported: boolean;
}

export const SUPPORTED_NETWORKS: NetworkConfig[] = [
  {
    chainId: 8453,
    name: 'Base',
    rpcUrl: 'https://mainnet.base.org',
    aragonRepo: '0x1234567890123456789012345678901234567890',
    supported: true,
  },
  {
    chainId: 84532,
    name: 'Base Sepolia',
    rpcUrl: 'https://sepolia.base.org',
    aragonRepo: '0x2345678901234567890123456789012345678901',
    supported: true,
  },
  {
    chainId: 1,
    name: 'Ethereum Mainnet',
    rpcUrl: 'https://eth.llamarpc.com',
    aragonRepo: '0x3456789012345678901234567890123456789012',
    supported: true,
  },
  {
    chainId: 11155111,
    name: 'Sepolia',
    rpcUrl: 'https://sepolia.drpc.org',
    aragonRepo: '0x4567890123456789012345678901234567890123',
    supported: true,
  },
];
