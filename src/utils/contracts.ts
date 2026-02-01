/**
 * DAO Deployer - Contract ABIs and Types
 * 
 * TypeScript definitions and ABIs for all smart contracts used in the DAO Deployer.
 * Includes SoulBoundToken, DAOFactory, ProposalManager, TaskMarket, and Aragon DAO contracts.
 */

import { type Abi, type Address, type Hex } from 'viem';

// ============================================================================
// TYPE DEFINITIONS
// ============================================================================

export type ContractAddress = `0x${string}`;
export type Bytes32 = `0x${string}`;

// Soul Bound Token Types
export interface SoulBoundTokenMetadata {
  name: string;
  symbol: string;
  decimals: number;
  totalSupply: bigint;
  owner: ContractAddress;
}

export interface TokenHolder {
  address: ContractAddress;
  balance: bigint;
  votingPower: bigint;
  tokenId?: bigint;
}

// DAO Types
export interface DAOMetadata {
  name: string;
  description: string;
  avatar?: string;
  links: { name: string; url: string }[];
}

export interface DAOSettings {
  governanceToken: ContractAddress;
  votingDelay: bigint;
  votingPeriod: bigint;
  proposalThreshold: bigint;
  quorumNumerator: bigint;
  timelockDelay: bigint;
}

// Proposal Types
export interface ProposalMetadata {
  title: string;
  description: string;
  body: string;
  discussionUrl?: string;
  resources?: { name: string; url: string }[];
}

export interface Proposal {
  id: bigint;
  proposer: ContractAddress;
  metadata: ProposalMetadata;
  metadataCID: string;
  startTime: bigint;
  endTime: bigint;
  forVotes: bigint;
  againstVotes: bigint;
  abstainVotes: bigint;
  status: ProposalStatus;
  executed: boolean;
  eta: bigint;
  actions: ProposalAction[];
}

export interface ProposalAction {
  target: ContractAddress;
  value: bigint;
  data: Hex;
  description?: string;
}

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

export interface Vote {
  voter: ContractAddress;
  proposalId: bigint;
  support: VoteType;
  votes: bigint;
  reason?: string;
}

export enum VoteType {
  Against = 0,
  For = 1,
  Abstain = 2,
}

// Task Market Types
export interface Task {
  id: bigint;
  creator: ContractAddress;
  title: string;
  description: string;
  budget: bigint;
  token: ContractAddress;
  deadline: bigint;
  status: TaskStatus;
  assignee?: ContractAddress;
  deliverablesCID?: string;
  createdAt: bigint;
  completedAt?: bigint;
}

export enum TaskStatus {
  Open = 0,
  Assigned = 1,
  Completed = 2,
  Cancelled = 3,
  Disputed = 4,
}

export interface Bid {
  id: bigint;
  taskId: bigint;
  bidder: ContractAddress;
  amount: bigint;
  timeline: bigint; // hours
  description: string;
  status: BidStatus;
  createdAt: bigint;
}

export enum BidStatus {
  Pending = 0,
  Accepted = 1,
  Rejected = 2,
  Withdrawn = 3,
}

// Aragon Types
export interface AragonPlugin {
  id: string;
  repoAddress: ContractAddress;
  version: string;
  installed: boolean;
}

export interface AragonPermission {
  who: ContractAddress;
  where: ContractAddress;
  what: Bytes32;
  condition?: ContractAddress;
}

// ============================================================================
// SOUL BOUND TOKEN ABI
// ============================================================================

export const SoulBoundTokenABI = [
  // ERC721 Metadata
  {
    inputs: [],
    name: 'name',
    outputs: [{ internalType: 'string', name: '', type: 'string' }],
    stateMutability: 'view',
    type: 'function',
  },
  {
    inputs: [],
    name: 'symbol',
    outputs: [{ internalType: 'string', name: '', type: 'string' }],
    stateMutability: 'view',
    type: 'function',
  },
  {
    inputs: [{ internalType: 'uint256', name: 'tokenId', type: 'uint256' }],
    name: 'tokenURI',
    outputs: [{ internalType: 'string', name: '', type: 'string' }],
    stateMutability: 'view',
    type: 'function',
  },
  // ERC721 Enumerable
  {
    inputs: [],
    name: 'totalSupply',
    outputs: [{ internalType: 'uint256', name: '', type: 'uint256' }],
    stateMutability: 'view',
    type: 'function',
  },
  {
    inputs: [{ internalType: 'address', name: 'owner', type: 'address' }],
    name: 'balanceOf',
    outputs: [{ internalType: 'uint256', name: '', type: 'uint256' }],
    stateMutability: 'view',
    type: 'function',
  },
  {
    inputs: [{ internalType: 'uint256', name: 'tokenId', type: 'uint256' }],
    name: 'ownerOf',
    outputs: [{ internalType: 'address', name: '', type: 'address' }],
    stateMutability: 'view',
    type: 'function',
  },
  // Voting Power
  {
    inputs: [{ internalType: 'address', name: 'account', type: 'address' }],
    name: 'getVotes',
    outputs: [{ internalType: 'uint256', name: '', type: 'uint256' }],
    stateMutability: 'view',
    type: 'function',
  },
  {
    inputs: [
      { internalType: 'address', name: 'account', type: 'address' },
      { internalType: 'uint256', name: 'timepoint', type: 'uint256' },
    ],
    name: 'getPastVotes',
    outputs: [{ internalType: 'uint256', name: '', type: 'uint256' }],
    stateMutability: 'view',
    type: 'function',
  },
  {
    inputs: [],
    name: 'getTotalSupply',
    outputs: [{ internalType: 'uint256', name: '', type: 'uint256' }],
    stateMutability: 'view',
    type: 'function',
  },
  // Minting (DAO only)
  {
    inputs: [
      { internalType: 'address', name: 'to', type: 'address' },
      { internalType: 'string', name: 'uri', type: 'string' },
    ],
    name: 'mint',
    outputs: [{ internalType: 'uint256', name: '', type: 'uint256' }],
    stateMutability: 'nonpayable',
    type: 'function',
  },
  {
    inputs: [
      { internalType: 'address[]', name: 'to', type: 'address[]' },
      { internalType: 'string[]', name: 'uris', type: 'string[]' },
    ],
    name: 'mintBatch',
    outputs: [{ internalType: 'uint256[]', name: '', type: 'uint256[]' }],
    stateMutability: 'nonpayable',
    type: 'function',
  },
  // Burning (DAO only)
  {
    inputs: [{ internalType: 'uint256', name: 'tokenId', type: 'uint256' }],
    name: 'burn',
    outputs: [],
    stateMutability: 'nonpayable',
    type: 'function',
  },
  // Soul Bound (non-transferable)
  {
    inputs: [
      { internalType: 'address', name: 'from', type: 'address' },
      { internalType: 'address', name: 'to', type: 'address' },
      { internalType: 'uint256', name: 'tokenId', type: 'uint256' },
    ],
    name: 'transferFrom',
    outputs: [],
    stateMutability: 'pure',
    type: 'function',
  },
  {
    inputs: [
      { internalType: 'address', name: 'from', type: 'address' },
      { internalType: 'address', name: 'to', type: 'address' },
      { internalType: 'uint256', name: 'tokenId', type: 'uint256' },
    ],
    name: 'safeTransferFrom',
    outputs: [],
    stateMutability: 'pure',
    type: 'function',
  },
  {
    inputs: [
      { internalType: 'address', name: 'from', type: 'address' },
      { internalType: 'address', name: 'to', type: 'address' },
      { internalType: 'uint256', name: 'tokenId', type: 'uint256' },
      { internalType: 'bytes', name: 'data', type: 'bytes' },
    ],
    name: 'safeTransferFrom',
    outputs: [],
    stateMutability: 'pure',
    type: 'function',
  },
  // Events
  {
    anonymous: false,
    inputs: [
      { indexed: true, internalType: 'address', name: 'owner', type: 'address' },
      { indexed: true, internalType: 'address', name: 'approved', type: 'address' },
      { indexed: true, internalType: 'uint256', name: 'tokenId', type: 'uint256' },
    ],
    name: 'Approval',
    type: 'event',
  },
  {
    anonymous: false,
    inputs: [
      { indexed: true, internalType: 'address', name: 'from', type: 'address' },
      { indexed: true, internalType: 'address', name: 'to', type: 'address' },
      { indexed: true, internalType: 'uint256', name: 'tokenId', type: 'uint256' },
    ],
    name: 'Transfer',
    type: 'event',
  },
  {
    anonymous: false,
    inputs: [
      { indexed: true, internalType: 'address', name: 'to', type: 'address' },
      { indexed: true, internalType: 'uint256', name: 'tokenId', type: 'uint256' },
    ],
    name: 'Mint',
    type: 'event',
  },
  {
    anonymous: false,
    inputs: [
      { indexed: true, internalType: 'uint256', name: 'tokenId', type: 'uint256' },
    ],
    name: 'Burn',
    type: 'event',
  },
  // Errors
  {
    inputs: [{ internalType: 'address', name: 'to', type: 'address' }],
    name: 'SoulBoundTransferNotAllowed',
    type: 'error',
  },
] as const satisfies Abi;

// ============================================================================
// DAO FACTORY ABI
// ============================================================================

export const DAOFactoryABI = [
  {
    inputs: [
      {
        components: [
          { internalType: 'string', name: 'name', type: 'string' },
          { internalType: 'string', name: 'description', type: 'string' },
          { internalType: 'string', name: 'avatar', type: 'string' },
          { internalType: 'string[]', name: 'links', type: 'string[]' },
        ],
        internalType: 'struct DAOFactory.DAOMetadata',
        name: 'metadata',
        type: 'tuple',
      },
      {
        components: [
          { internalType: 'string', name: 'tokenName', type: 'string' },
          { internalType: 'string', name: 'tokenSymbol', type: 'string' },
          { internalType: 'uint8', name: 'tokenDecimals', type: 'uint8' },
        ],
        internalType: 'struct DAOFactory.TokenConfig',
        name: 'tokenConfig',
        type: 'tuple',
      },
      {
        components: [
          { internalType: 'uint256', name: 'supportThreshold', type: 'uint256' },
          { internalType: 'uint256', name: 'minParticipation', type: 'uint256' },
          { internalType: 'uint64', name: 'minDuration', type: 'uint64' },
          { internalType: 'uint256', name: 'minProposerVotingPower', type: 'uint256' },
        ],
        internalType: 'struct DAOFactory.GovernanceSettings',
        name: 'governanceSettings',
        type: 'tuple',
      },
      {
        components: [
          { internalType: 'address', name: 'pluginRepo', type: 'address' },
          { internalType: 'bytes', name: 'data', type: 'bytes' },
        ],
        internalType: 'struct DAOFactory.PluginSetup[]',
        name: 'plugins',
        type: 'tuple[]',
      },
    ],
    name: 'createDAO',
    outputs: [
      { internalType: 'address', name: 'dao', type: 'address' },
      { internalType: 'address', name: 'token', type: 'address' },
    ],
    stateMutability: 'nonpayable',
    type: 'function',
  },
  {
    inputs: [{ internalType: 'address', name: 'dao', type: 'address' }],
    name: 'getDAO',
    outputs: [
      {
        components: [
          { internalType: 'address', name: 'dao', type: 'address' },
          { internalType: 'address', name: 'token', type: 'address' },
          { internalType: 'uint256', name: 'createdAt', type: 'uint256' },
          { internalType: 'bool', name: 'active', type: 'bool' },
        ],
        internalType: 'struct DAOFactory.DAOInfo',
        name: '',
        type: 'tuple',
      },
    ],
    stateMutability: 'view',
    type: 'function',
  },
  {
    inputs: [],
    name: 'getAllDAOs',
    outputs: [
      {
        components: [
          { internalType: 'address', name: 'dao', type: 'address' },
          { internalType: 'address', name: 'token', type: 'address' },
          { internalType: 'uint256', name: 'createdAt', type: 'uint256' },
          { internalType: 'bool', name: 'active', type: 'bool' },
        ],
        internalType: 'struct DAOFactory.DAOInfo[]',
        name: '',
        type: 'tuple[]',
      },
    ],
    stateMutability: 'view',
    type: 'function',
  },
  {
    anonymous: false,
    inputs: [
      { indexed: true, internalType: 'address', name: 'dao', type: 'address' },
      { indexed: true, internalType: 'address', name: 'token', type: 'address' },
      { indexed: true, internalType: 'address', name: 'creator', type: 'address' },
    ],
    name: 'DAOCreated',
    type: 'event',
  },
] as const satisfies Abi;

// ============================================================================
// PROPOSAL MANAGER ABI
// ============================================================================

export const ProposalManagerABI = [
  {
    inputs: [
      { internalType: 'bytes', name: 'metadata', type: 'bytes' },
      {
        components: [
          { internalType: 'address', name: 'to', type: 'address' },
          { internalType: 'uint256', name: 'value', type: 'uint256' },
          { internalType: 'bytes', name: 'data', type: 'bytes' },
        ],
        internalType: 'struct ProposalManager.Action[]',
        name: 'actions',
        type: 'tuple[]',
      },
      { internalType: 'uint256', name: 'allowFailureMap', type: 'uint256' },
    ],
    name: 'createProposal',
    outputs: [{ internalType: 'uint256', name: 'proposalId', type: 'uint256' }],
    stateMutability: 'nonpayable',
    type: 'function',
  },
  {
    inputs: [
      { internalType: 'uint256', name: 'proposalId', type: 'uint256' },
      { internalType: 'uint8', name: 'voteType', type: 'uint8' },
      { internalType: 'bool', name: 'tryEarlyExecution', type: 'bool' },
    ],
    name: 'vote',
    outputs: [],
    stateMutability: 'nonpayable',
    type: 'function',
  },
  {
    inputs: [
      { internalType: 'uint256', name: 'proposalId', type: 'uint256' },
    ],
    name: 'execute',
    outputs: [],
    stateMutability: 'nonpayable',
    type: 'function',
  },
  {
    inputs: [{ internalType: 'uint256', name: 'proposalId', type: 'uint256' }],
    name: 'canExecute',
    outputs: [{ internalType: 'bool', name: '', type: 'bool' }],
    stateMutability: 'view',
    type: 'function',
  },
  {
    inputs: [{ internalType: 'uint256', name: 'proposalId', type: 'uint256' }],
    name: 'canVote',
    outputs: [
      { internalType: 'bool', name: '', type: 'bool' },
    ],
    stateMutability: 'view',
    type: 'function',
  },
  {
    inputs: [{ internalType: 'uint256', name: 'proposalId', type: 'uint256' }],
    name: 'getProposal',
    outputs: [
      {
        components: [
          { internalType: 'bool', name: 'executed', type: 'bool' },
          { internalType: 'uint16', name: 'approvals', type: 'uint16' },
          {
            components: [
              { internalType: 'address', name: 'to', type: 'address' },
              { internalType: 'uint256', name: 'value', type: 'uint256' },
              { internalType: 'bytes', name: 'data', type: 'bytes' },
            ],
            internalType: 'struct ProposalManager.Action[]',
            name: 'actions',
            type: 'tuple[]',
          },
          { internalType: 'uint256', name: 'allowFailureMap', type: 'uint256' },
        ],
        internalType: 'struct ProposalManager.Proposal',
        name: '',
        type: 'tuple',
      },
    ],
    stateMutability: 'view',
    type: 'function',
  },
  {
    inputs: [
      { internalType: 'uint256', name: 'proposalId', type: 'uint256' },
      { internalType: 'address', name: 'voter', type: 'address' },
    ],
    name: 'hasVoted',
    outputs: [{ internalType: 'bool', name: '', type: 'bool' }],
    stateMutability: 'view',
    type: 'function',
  },
  {
    inputs: [
      { internalType: 'uint256', name: 'proposalId', type: 'uint256' },
      { internalType: 'address', name: 'voter', type: 'address' },
    ],
    name: 'getVote',
    outputs: [
      { internalType: 'uint8', name: 'voteType', type: 'uint8' },
      { internalType: 'uint256', name: 'votingPower', type: 'uint256' },
    ],
    stateMutability: 'view',
    type: 'function',
  },
  {
    inputs: [],
    name: 'proposalCount',
    outputs: [{ internalType: 'uint256', name: '', type: 'uint256' }],
    stateMutability: 'view',
    type: 'function',
  },
  {
    inputs: [
      { internalType: 'uint256', name: 'proposalId', type: 'uint256' },
    ],
    name: 'getProposalStatus',
    outputs: [{ internalType: 'enum ProposalManager.ProposalStatus', name: '', type: 'uint8' }],
    stateMutability: 'view',
    type: 'function',
  },
  {
    anonymous: false,
    inputs: [
      { indexed: true, internalType: 'uint256', name: 'proposalId', type: 'uint256' },
      { indexed: true, internalType: 'address', name: 'creator', type: 'address' },
    ],
    name: 'ProposalCreated',
    type: 'event',
  },
  {
    anonymous: false,
    inputs: [
      { indexed: true, internalType: 'uint256', name: 'proposalId', type: 'uint256' },
      { indexed: true, internalType: 'address', name: 'voter', type: 'address' },
      { indexed: false, internalType: 'uint8', name: 'voteType', type: 'uint8' },
      { indexed: false, internalType: 'uint256', name: 'votingPower', type: 'uint256' },
    ],
    name: 'VoteCast',
    type: 'event',
  },
  {
    anonymous: false,
    inputs: [
      { indexed: true, internalType: 'uint256', name: 'proposalId', type: 'uint256' },
    ],
    name: 'ProposalExecuted',
    type: 'event',
  },
] as const satisfies Abi;

// ============================================================================
// TASK MARKET ABI
// ============================================================================

export const TaskMarketABI = [
  {
    inputs: [
      { internalType: 'string', name: 'title', type: 'string' },
      { internalType: 'string', name: 'description', type: 'string' },
      { internalType: 'uint256', name: 'budget', type: 'uint256' },
      { internalType: 'address', name: 'token', type: 'address' },
      { internalType: 'uint256', name: 'deadline', type: 'uint256' },
    ],
    name: 'createTask',
    outputs: [{ internalType: 'uint256', name: 'taskId', type: 'uint256' }],
    stateMutability: 'nonpayable',
    type: 'function',
  },
  {
    inputs: [
      { internalType: 'uint256', name: 'taskId', type: 'uint256' },
      { internalType: 'uint256', name: 'amount', type: 'uint256' },
      { internalType: 'uint256', name: 'timeline', type: 'uint256' },
      { internalType: 'string', name: 'description', type: 'string' },
    ],
    name: 'submitBid',
    outputs: [{ internalType: 'uint256', name: 'bidId', type: 'uint256' }],
    stateMutability: 'nonpayable',
    type: 'function',
  },
  {
    inputs: [
      { internalType: 'uint256', name: 'taskId', type: 'uint256' },
      { internalType: 'uint256', name: 'bidId', type: 'uint256' },
    ],
    name: 'acceptBid',
    outputs: [],
    stateMutability: 'nonpayable',
    type: 'function',
  },
  {
    inputs: [{ internalType: 'uint256', name: 'taskId', type: 'uint256' }],
    name: 'markComplete',
    outputs: [],
    stateMutability: 'nonpayable',
    type: 'function',
  },
  {
    inputs: [{ internalType: 'uint256', name: 'taskId', type: 'uint256' }],
    name: 'releasePayment',
    outputs: [],
    stateMutability: 'nonpayable',
    type: 'function',
  },
  {
    inputs: [{ internalType: 'uint256', name: 'taskId', type: 'uint256' }],
    name: 'cancelTask',
    outputs: [],
    stateMutability: 'nonpayable',
    type: 'function',
  },
  {
    inputs: [{ internalType: 'uint256', name: 'taskId', type: 'uint256' }],
    name: 'getTask',
    outputs: [
      {
        components: [
          { internalType: 'uint256', name: 'id', type: 'uint256' },
          { internalType: 'address', name: 'creator', type: 'address' },
          { internalType: 'string', name: 'title', type: 'string' },
          { internalType: 'string', name: 'description', type: 'string' },
          { internalType: 'uint256', name: 'budget', type: 'uint256' },
          { internalType: 'address', name: 'token', type: 'address' },
          { internalType: 'uint256', name: 'deadline', type: 'uint256' },
          { internalType: 'enum TaskMarket.TaskStatus', name: 'status', type: 'uint8' },
          { internalType: 'address', name: 'assignee', type: 'address' },
          { internalType: 'string', name: 'deliverablesCID', type: 'string' },
          { internalType: 'uint256', name: 'createdAt', type: 'uint256' },
          { internalType: 'uint256', name: 'completedAt', type: 'uint256' },
        ],
        internalType: 'struct TaskMarket.Task',
        name: '',
        type: 'tuple',
      },
    ],
    stateMutability: 'view',
    type: 'function',
  },
  {
    inputs: [
      { internalType: 'uint256', name: 'taskId', type: 'uint256' },
      { internalType: 'uint256', name: 'bidId', type: 'uint256' },
    ],
    name: 'getBid',
    outputs: [
      {
        components: [
          { internalType: 'uint256', name: 'id', type: 'uint256' },
          { internalType: 'uint256', name: 'taskId', type: 'uint256' },
          { internalType: 'address', name: 'bidder', type: 'address' },
          { internalType: 'uint256', name: 'amount', type: 'uint256' },
          { internalType: 'uint256', name: 'timeline', type: 'uint256' },
          { internalType: 'string', name: 'description', type: 'string' },
          { internalType: 'enum TaskMarket.BidStatus', name: 'status', type: 'uint8' },
          { internalType: 'uint256', name: 'createdAt', type: 'uint256' },
        ],
        internalType: 'struct TaskMarket.Bid',
        name: '',
        type: 'tuple',
      },
    ],
    stateMutability: 'view',
    type: 'function',
  },
  {
    inputs: [{ internalType: 'uint256', name: 'taskId', type: 'uint256' }],
    name: 'getTaskBids',
    outputs: [{ internalType: 'uint256[]', name: '', type: 'uint256[]' }],
    stateMutability: 'view',
    type: 'function',
  },
  {
    inputs: [],
    name: 'taskCount',
    outputs: [{ internalType: 'uint256', name: '', type: 'uint256' }],
    stateMutability: 'view',
    type: 'function',
  },
  {
    anonymous: false,
    inputs: [
      { indexed: true, internalType: 'uint256', name: 'taskId', type: 'uint256' },
      { indexed: true, internalType: 'address', name: 'creator', type: 'address' },
    ],
    name: 'TaskCreated',
    type: 'event',
  },
  {
    anonymous: false,
    inputs: [
      { indexed: true, internalType: 'uint256', name: 'taskId', type: 'uint256' },
      { indexed: true, internalType: 'uint256', name: 'bidId', type: 'uint256' },
      { indexed: true, internalType: 'address', name: 'bidder', type: 'address' },
    ],
    name: 'BidSubmitted',
    type: 'event',
  },
  {
    anonymous: false,
    inputs: [
      { indexed: true, internalType: 'uint256', name: 'taskId', type: 'uint256' },
      { indexed: true, internalType: 'uint256', name: 'bidId', type: 'uint256' },
      { indexed: true, internalType: 'address', name: 'assignee', type: 'address' },
    ],
    name: 'BidAccepted',
    type: 'event',
  },
  {
    anonymous: false,
    inputs: [
      { indexed: true, internalType: 'uint256', name: 'taskId', type: 'uint256' },
    ],
    name: 'TaskCompleted',
    type: 'event',
  },
  {
    anonymous: false,
    inputs: [
      { indexed: true, internalType: 'uint256', name: 'taskId', type: 'uint256' },
      { indexed: true, internalType: 'address', name: 'assignee', type: 'address' },
      { indexed: false, internalType: 'uint256', name: 'amount', type: 'uint256' },
    ],
    name: 'PaymentReleased',
    type: 'event',
  },
] as const satisfies Abi;

// ============================================================================
// ARAGON DAO ABI (Simplified)
// ============================================================================

export const AragonDAOABI = [
  {
    inputs: [{ internalType: 'bytes', name: 'metadata', type: 'bytes' }],
    name: 'setMetadata',
    outputs: [],
    stateMutability: 'nonpayable',
    type: 'function',
  },
  {
    inputs: [],
    name: 'metadata',
    outputs: [{ internalType: 'bytes', name: '', type: 'bytes' }],
    stateMutability: 'view',
    type: 'function',
  },
  {
    inputs: [
      { internalType: 'address', name: 'where', type: 'address' },
      { internalType: 'address', name: 'who', type: 'address' },
      { internalType: 'bytes32', name: 'permissionId', type: 'bytes32' },
    ],
    name: 'grant',
    outputs: [],
    stateMutability: 'nonpayable',
    type: 'function',
  },
  {
    inputs: [
      { internalType: 'address', name: 'where', type: 'address' },
      { internalType: 'address', name: 'who', type: 'address' },
      { internalType: 'bytes32', name: 'permissionId', type: 'bytes32' },
    ],
    name: 'revoke',
    outputs: [],
    stateMutability: 'nonpayable',
    type: 'function',
  },
  {
    inputs: [
      { internalType: 'address', name: 'where', type: 'address' },
      { internalType: 'address', name: 'who', type: 'address' },
      { internalType: 'bytes32', name: 'permissionId', type: 'bytes32' },
      { internalType: 'address', name: 'condition', type: 'address' },
    ],
    name: 'grantWithCondition',
    outputs: [],
    stateMutability: 'nonpayable',
    type: 'function',
  },
  {
    inputs: [
      { internalType: 'address', name: 'where', type: 'address' },
      { internalType: 'address', name: 'who', type: 'address' },
      { internalType: 'bytes32', name: 'permissionId', type: 'bytes32' },
    ],
    name: 'isGranted',
    outputs: [{ internalType: 'bool', name: '', type: 'bool' }],
    stateMutability: 'view',
    type: 'function',
  },
  {
    inputs: [
      {
        components: [
          { internalType: 'address', name: 'to', type: 'address' },
          { internalType: 'uint256', name: 'value', type: 'uint256' },
          { internalType: 'bytes', name: 'data', type: 'bytes' },
        ],
        internalType: 'struct IDAO.Action[]',
        name: 'actions',
        type: 'tuple[]',
      },
      { internalType: 'uint256', name: 'allowFailureMap', type: 'uint256' },
    ],
    name: 'execute',
    outputs: [
      { internalType: 'bytes[]', name: 'execResults', type: 'bytes[]' },
    ],
    stateMutability: 'nonpayable',
    type: 'function',
  },
  {
    inputs: [],
    name: 'daoURI',
    outputs: [{ internalType: 'string', name: '', type: 'string' }],
    stateMutability: 'view',
    type: 'function',
  },
  {
    anonymous: false,
    inputs: [
      { indexed: false, internalType: 'bytes', name: 'metadata', type: 'bytes' },
    ],
    name: 'MetadataSet',
    type: 'event',
  },
  {
    anonymous: false,
    inputs: [
      { indexed: true, internalType: 'address', name: 'sender', type: 'address' },
      { indexed: true, internalType: 'address', name: 'target', type: 'address' },
      { indexed: false, internalType: 'uint256', name: 'value', type: 'uint256' },
    ],
    name: 'NativeTokenDeposited',
    type: 'event',
  },
] as const satisfies Abi;

// ============================================================================
// ERC20 ABI (for token interactions)
// ============================================================================

export const ERC20ABI = [
  {
    inputs: [],
    name: 'name',
    outputs: [{ internalType: 'string', name: '', type: 'string' }],
    stateMutability: 'view',
    type: 'function',
  },
  {
    inputs: [],
    name: 'symbol',
    outputs: [{ internalType: 'string', name: '', type: 'string' }],
    stateMutability: 'view',
    type: 'function',
  },
  {
    inputs: [],
    name: 'decimals',
    outputs: [{ internalType: 'uint8', name: '', type: 'uint8' }],
    stateMutability: 'view',
    type: 'function',
  },
  {
    inputs: [],
    name: 'totalSupply',
    outputs: [{ internalType: 'uint256', name: '', type: 'uint256' }],
    stateMutability: 'view',
    type: 'function',
  },
  {
    inputs: [{ internalType: 'address', name: 'account', type: 'address' }],
    name: 'balanceOf',
    outputs: [{ internalType: 'uint256', name: '', type: 'uint256' }],
    stateMutability: 'view',
    type: 'function',
  },
  {
    inputs: [
      { internalType: 'address', name: 'to', type: 'address' },
      { internalType: 'uint256', name: 'amount', type: 'uint256' },
    ],
    name: 'transfer',
    outputs: [{ internalType: 'bool', name: '', type: 'bool' }],
    stateMutability: 'nonpayable',
    type: 'function',
  },
  {
    inputs: [
      { internalType: 'address', name: 'from', type: 'address' },
      { internalType: 'address', name: 'to', type: 'address' },
      { internalType: 'uint256', name: 'amount', type: 'uint256' },
    ],
    name: 'transferFrom',
    outputs: [{ internalType: 'bool', name: '', type: 'bool' }],
    stateMutability: 'nonpayable',
    type: 'function',
  },
  {
    inputs: [
      { internalType: 'address', name: 'spender', type: 'address' },
      { internalType: 'uint256', name: 'amount', type: 'uint256' },
    ],
    name: 'approve',
    outputs: [{ internalType: 'bool', name: '', type: 'bool' }],
    stateMutability: 'nonpayable',
    type: 'function',
  },
  {
    inputs: [
      { internalType: 'address', name: 'owner', type: 'address' },
      { internalType: 'address', name: 'spender', type: 'address' },
    ],
    name: 'allowance',
    outputs: [{ internalType: 'uint256', name: '', type: 'uint256' }],
    stateMutability: 'view',
    type: 'function',
  },
  {
    anonymous: false,
    inputs: [
      { indexed: true, internalType: 'address', name: 'from', type: 'address' },
      { indexed: true, internalType: 'address', name: 'to', type: 'address' },
      { indexed: false, internalType: 'uint256', name: 'value', type: 'uint256' },
    ],
    name: 'Transfer',
    type: 'event',
  },
  {
    anonymous: false,
    inputs: [
      { indexed: true, internalType: 'address', name: 'owner', type: 'address' },
      { indexed: true, internalType: 'address', name: 'spender', type: 'address' },
      { indexed: false, internalType: 'uint256', name: 'value', type: 'uint256' },
    ],
    name: 'Approval',
    type: 'event',
  },
] as const satisfies Abi;

// ============================================================================
// MULTICALL3 ABI
// ============================================================================

export const Multicall3ABI = [
  {
    inputs: [
      {
        components: [
          { internalType: 'address', name: 'target', type: 'address' },
          { internalType: 'bytes', name: 'callData', type: 'bytes' },
        ],
        internalType: 'struct Multicall3.Call[]',
        name: 'calls',
        type: 'tuple[]',
      },
    ],
    name: 'aggregate',
    outputs: [
      { internalType: 'uint256', name: 'blockNumber', type: 'uint256' },
      { internalType: 'bytes[]', name: 'returnData', type: 'bytes[]' },
    ],
    stateMutability: 'payable',
    type: 'function',
  },
  {
    inputs: [
      {
        components: [
          { internalType: 'address', name: 'target', type: 'address' },
          { internalType: 'bool', name: 'allowFailure', type: 'bool' },
          { internalType: 'bytes', name: 'callData', type: 'bytes' },
        ],
        internalType: 'struct Multicall3.Call3[]',
        name: 'calls',
        type: 'tuple[]',
      },
    ],
    name: 'aggregate3',
    outputs: [
      {
        components: [
          { internalType: 'bool', name: 'success', type: 'bool' },
          { internalType: 'bytes', name: 'returnData', type: 'bytes' },
        ],
        internalType: 'struct Multicall3.Result[]',
        name: 'returnData',
        type: 'tuple[]',
      },
    ],
    stateMutability: 'payable',
    type: 'function',
  },
  {
    inputs: [],
    name: 'getBlockNumber',
    outputs: [{ internalType: 'uint256', name: 'blockNumber', type: 'uint256' }],
    stateMutability: 'view',
    type: 'function',
  },
  {
    inputs: [],
    name: 'getBlockHash',
    outputs: [{ internalType: 'bytes32', name: 'blockHash', type: 'bytes32' }],
    stateMutability: 'view',
    type: 'function',
  },
  {
    inputs: [],
    name: 'getChainId',
    outputs: [{ internalType: 'uint256', name: 'chainid', type: 'uint256' }],
    stateMutability: 'view',
    type: 'function',
  },
] as const satisfies Abi;

// ============================================================================
// CONTRACT TYPE EXPORTS
// ============================================================================

export type SoulBoundTokenContract = {
  address: ContractAddress;
  abi: typeof SoulBoundTokenABI;
};

export type DAOFactoryContract = {
  address: ContractAddress;
  abi: typeof DAOFactoryABI;
};

export type ProposalManagerContract = {
  address: ContractAddress;
  abi: typeof ProposalManagerABI;
};

export type TaskMarketContract = {
  address: ContractAddress;
  abi: typeof TaskMarketABI;
};

export type AragonDAOContract = {
  address: ContractAddress;
  abi: typeof AragonDAOABI;
};

export type ERC20Contract = {
  address: ContractAddress;
  abi: typeof ERC20ABI;
};

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

export function getContract<T extends Abi>(
  address: ContractAddress,
  abi: T
): { address: ContractAddress; abi: T } {
  return { address, abi };
}

export type ContractConfig = {
  soulBoundToken: SoulBoundTokenContract;
  daoFactory: DAOFactoryContract;
  proposalManager: ProposalManagerContract;
  taskMarket: TaskMarketContract;
  aragonDAO: AragonDAOContract;
};

export function createContractConfig(
  addresses: Record<string, ContractAddress>
): ContractConfig {
  return {
    soulBoundToken: {
      address: addresses.soulBoundToken,
      abi: SoulBoundTokenABI,
    },
    daoFactory: {
      address: addresses.daoFactory,
      abi: DAOFactoryABI,
    },
    proposalManager: {
      address: addresses.proposalManager,
      abi: ProposalManagerABI,
    },
    taskMarket: {
      address: addresses.taskMarket,
      abi: TaskMarketABI,
    },
    aragonDAO: {
      address: addresses.aragonDAO,
      abi: AragonDAOABI,
    },
  };
}
