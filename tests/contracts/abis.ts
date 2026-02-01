/**
 * Contract ABIs for Testing
 * Simplified ABIs for the DAO Deployer contracts
 */

export const SoulBoundTokenABI = [
  // Events
  {
    type: 'event',
    name: 'Transfer',
    inputs: [
      { indexed: true, name: 'from', type: 'address' },
      { indexed: true, name: 'to', type: 'address' },
      { indexed: false, name: 'value', type: 'uint256' },
    ],
  },
  {
    type: 'event',
    name: 'Mint',
    inputs: [
      { indexed: true, name: 'to', type: 'address' },
      { indexed: false, name: 'amount', type: 'uint256' },
    ],
  },
  {
    type: 'event',
    name: 'Burn',
    inputs: [
      { indexed: true, name: 'from', type: 'address' },
      { indexed: false, name: 'amount', type: 'uint256' },
    ],
  },
  {
    type: 'event',
    name: 'DelegateChanged',
    inputs: [
      { indexed: true, name: 'delegator', type: 'address' },
      { indexed: true, name: 'fromDelegate', type: 'address' },
      { indexed: true, name: 'toDelegate', type: 'address' },
    ],
  },
  {
    type: 'event',
    name: 'DelegateVotesChanged',
    inputs: [
      { indexed: true, name: 'delegate', type: 'address' },
      { indexed: false, name: 'previousBalance', type: 'uint256' },
      { indexed: false, name: 'newBalance', type: 'uint256' },
    ],
  },
  
  // View functions
  {
    type: 'function',
    name: 'name',
    inputs: [],
    outputs: [{ type: 'string' }],
    stateMutability: 'view',
  },
  {
    type: 'function',
    name: 'symbol',
    inputs: [],
    outputs: [{ type: 'string' }],
    stateMutability: 'view',
  },
  {
    type: 'function',
    name: 'decimals',
    inputs: [],
    outputs: [{ type: 'uint8' }],
    stateMutability: 'view',
  },
  {
    type: 'function',
    name: 'totalSupply',
    inputs: [],
    outputs: [{ type: 'uint256' }],
    stateMutability: 'view',
  },
  {
    type: 'function',
    name: 'balanceOf',
    inputs: [{ name: 'account', type: 'address' }],
    outputs: [{ type: 'uint256' }],
    stateMutability: 'view',
  },
  {
    type: 'function',
    name: 'getVotes',
    inputs: [{ name: 'account', type: 'address' }],
    outputs: [{ type: 'uint256' }],
    stateMutability: 'view',
  },
  {
    type: 'function',
    name: 'getPastVotes',
    inputs: [
      { name: 'account', type: 'address' },
      { name: 'blockNumber', type: 'uint256' },
    ],
    outputs: [{ type: 'uint256' }],
    stateMutability: 'view',
  },
  {
    type: 'function',
    name: 'delegates',
    inputs: [{ name: 'account', type: 'address' }],
    outputs: [{ type: 'address' }],
    stateMutability: 'view',
  },
  {
    type: 'function',
    name: 'owner',
    inputs: [],
    outputs: [{ type: 'address' }],
    stateMutability: 'view',
  },
  
  // Write functions
  {
    type: 'function',
    name: 'mint',
    inputs: [
      { name: 'to', type: 'address' },
      { name: 'amount', type: 'uint256' },
    ],
    outputs: [],
    stateMutability: 'nonpayable',
  },
  {
    type: 'function',
    name: 'burn',
    inputs: [
      { name: 'from', type: 'address' },
      { name: 'amount', type: 'uint256' },
    ],
    outputs: [],
    stateMutability: 'nonpayable',
  },
  {
    type: 'function',
    name: 'delegate',
    inputs: [{ name: 'delegatee', type: 'address' }],
    outputs: [],
    stateMutability: 'nonpayable',
  },
  {
    type: 'function',
    name: 'transfer',
    inputs: [
      { name: 'to', type: 'address' },
      { name: 'amount', type: 'uint256' },
    ],
    outputs: [{ type: 'bool' }],
    stateMutability: 'nonpayable',
  },
  {
    type: 'function',
    name: 'transferFrom',
    inputs: [
      { name: 'from', type: 'address' },
      { name: 'to', type: 'address' },
      { name: 'amount', type: 'uint256' },
    ],
    outputs: [{ type: 'bool' }],
    stateMutability: 'nonpayable',
  },
  {
    type: 'function',
    name: 'renounceOwnership',
    inputs: [],
    outputs: [],
    stateMutability: 'nonpayable',
  },
  {
    type: 'function',
    name: 'transferOwnership',
    inputs: [{ name: 'newOwner', type: 'address' }],
    outputs: [],
    stateMutability: 'nonpayable',
  },
] as const;

export const DAOFactoryABI = [
  // Events
  {
    type: 'event',
    name: 'DAOCreated',
    inputs: [
      { indexed: true, name: 'daoAddress', type: 'address' },
      { indexed: true, name: 'tokenAddress', type: 'address' },
      { indexed: false, name: 'name', type: 'string' },
    ],
  },
  {
    type: 'event',
    name: 'TokenDeployed',
    inputs: [
      { indexed: true, name: 'tokenAddress', type: 'address' },
      { indexed: false, name: 'name', type: 'string' },
      { indexed: false, name: 'symbol', type: 'string' },
    ],
  },
  {
    type: 'event',
    name: 'PluginInstalled',
    inputs: [
      { indexed: true, name: 'daoAddress', type: 'address' },
      { indexed: true, name: 'pluginAddress', type: 'address' },
    ],
  },
  
  // View functions
  {
    type: 'function',
    name: 'getDAO',
    inputs: [{ name: 'daoAddress', type: 'address' }],
    outputs: [
      {
        type: 'tuple',
        components: [
          { name: 'name', type: 'string' },
          { name: 'tokenAddress', type: 'address' },
          { name: 'createdAt', type: 'uint256' },
          { name: 'active', type: 'bool' },
        ],
      },
    ],
    stateMutability: 'view',
  },
  {
    type: 'function',
    name: 'getDAOsByCreator',
    inputs: [{ name: 'creator', type: 'address' }],
    outputs: [{ type: 'address[]' }],
    stateMutability: 'view',
  },
  {
    type: 'function',
    name: 'aragonRepo',
    inputs: [],
    outputs: [{ type: 'address' }],
    stateMutability: 'view',
  },
  
  // Write functions
  {
    type: 'function',
    name: 'createDAO',
    inputs: [
      {
        name: 'config',
        type: 'tuple',
        components: [
          { name: 'name', type: 'string' },
          { name: 'symbol', type: 'string' },
          { name: 'metadata', type: 'string' },
          { name: 'votingDelay', type: 'uint256' },
          { name: 'votingPeriod', type: 'uint256' },
          { name: 'proposalThreshold', type: 'uint256' },
          { name: 'quorumNumerator', type: 'uint256' },
        ],
      },
    ],
    outputs: [
      { name: 'daoAddress', type: 'address' },
      { name: 'tokenAddress', type: 'address' },
    ],
    stateMutability: 'nonpayable',
  },
  {
    type: 'function',
    name: 'deployToken',
    inputs: [
      { name: 'name', type: 'string' },
      { name: 'symbol', type: 'string' },
      { name: 'initialHolders', type: 'address[]' },
      { name: 'initialBalances', type: 'uint256[]' },
    ],
    outputs: [{ type: 'address' }],
    stateMutability: 'nonpayable',
  },
  {
    type: 'function',
    name: 'installPlugin',
    inputs: [
      { name: 'daoAddress', type: 'address' },
      { name: 'pluginAddress', type: 'address' },
      { name: 'data', type: 'bytes' },
    ],
    outputs: [],
    stateMutability: 'nonpayable',
  },
] as const;

export const ProposalManagerABI = [
  // Events
  {
    type: 'event',
    name: 'ProposalCreated',
    inputs: [
      { indexed: true, name: 'proposalId', type: 'uint256' },
      { indexed: true, name: 'proposer', type: 'address' },
      { indexed: false, name: 'targets', type: 'address[]' },
      { indexed: false, name: 'values', type: 'uint256[]' },
      { indexed: false, name: 'calldatas', type: 'bytes[]' },
      { indexed: false, name: 'description', type: 'string' },
      { indexed: false, name: 'startBlock', type: 'uint256' },
      { indexed: false, name: 'endBlock', type: 'uint256' },
    ],
  },
  {
    type: 'event',
    name: 'VoteCast',
    inputs: [
      { indexed: true, name: 'voter', type: 'address' },
      { indexed: true, name: 'proposalId', type: 'uint256' },
      { indexed: false, name: 'support', type: 'uint8' },
      { indexed: false, name: 'votes', type: 'uint256' },
      { indexed: false, name: 'reason', type: 'string' },
    ],
  },
  {
    type: 'event',
    name: 'ProposalExecuted',
    inputs: [
      { indexed: true, name: 'proposalId', type: 'uint256' },
    ],
  },
  {
    type: 'event',
    name: 'ProposalCanceled',
    inputs: [
      { indexed: true, name: 'proposalId', type: 'uint256' },
    ],
  },
  
  // View functions
  {
    type: 'function',
    name: 'proposalCount',
    inputs: [],
    outputs: [{ type: 'uint256' }],
    stateMutability: 'view',
  },
  {
    type: 'function',
    name: 'proposals',
    inputs: [{ name: 'proposalId', type: 'uint256' }],
    outputs: [
      {
        type: 'tuple',
        components: [
          { name: 'id', type: 'uint256' },
          { name: 'proposer', type: 'address' },
          { name: 'forVotes', type: 'uint256' },
          { name: 'againstVotes', type: 'uint256' },
          { name: 'abstainVotes', type: 'uint256' },
          { name: 'startBlock', type: 'uint256' },
          { name: 'endBlock', type: 'uint256' },
          { name: 'executed', type: 'bool' },
          { name: 'canceled', type: 'bool' },
        ],
      },
    ],
    stateMutability: 'view',
  },
  {
    type: 'function',
    name: 'state',
    inputs: [{ name: 'proposalId', type: 'uint256' }],
    outputs: [{ type: 'uint8' }],
    stateMutability: 'view',
  },
  {
    type: 'function',
    name: 'hasVoted',
    inputs: [
      { name: 'proposalId', type: 'uint256' },
      { name: 'account', type: 'address' },
    ],
    outputs: [{ type: 'bool' }],
    stateMutability: 'view',
  },
  {
    type: 'function',
    name: 'quorum',
    inputs: [{ name: 'blockNumber', type: 'uint256' }],
    outputs: [{ type: 'uint256' }],
    stateMutability: 'view',
  },
  {
    type: 'function',
    name: 'proposalThreshold',
    inputs: [],
    outputs: [{ type: 'uint256' }],
    stateMutability: 'view',
  },
  {
    type: 'function',
    name: 'votingDelay',
    inputs: [],
    outputs: [{ type: 'uint256' }],
    stateMutability: 'view',
  },
  {
    type: 'function',
    name: 'votingPeriod',
    inputs: [],
    outputs: [{ type: 'uint256' }],
    stateMutability: 'view',
  },
  
  // Write functions
  {
    type: 'function',
    name: 'propose',
    inputs: [
      { name: 'targets', type: 'address[]' },
      { name: 'values', type: 'uint256[]' },
      { name: 'calldatas', type: 'bytes[]' },
      { name: 'description', type: 'string' },
    ],
    outputs: [{ type: 'uint256' }],
    stateMutability: 'nonpayable',
  },
  {
    type: 'function',
    name: 'castVote',
    inputs: [
      { name: 'proposalId', type: 'uint256' },
      { name: 'support', type: 'uint8' },
    ],
    outputs: [],
    stateMutability: 'nonpayable',
  },
  {
    type: 'function',
    name: 'castVoteWithReason',
    inputs: [
      { name: 'proposalId', type: 'uint256' },
      { name: 'support', type: 'uint8' },
      { name: 'reason', type: 'string' },
    ],
    outputs: [],
    stateMutability: 'nonpayable',
  },
  {
    type: 'function',
    name: 'execute',
    inputs: [
      { name: 'targets', type: 'address[]' },
      { name: 'values', type: 'uint256[]' },
      { name: 'calldatas', type: 'bytes[]' },
      { name: 'descriptionHash', type: 'bytes32' },
    ],
    outputs: [],
    stateMutability: 'payable',
  },
  {
    type: 'function',
    name: 'cancel',
    inputs: [
      { name: 'targets', type: 'address[]' },
      { name: 'values', type: 'uint256[]' },
      { name: 'calldatas', type: 'bytes[]' },
      { name: 'descriptionHash', type: 'bytes32' },
    ],
    outputs: [],
    stateMutability: 'nonpayable',
  },
] as const;

export const TaskMarketABI = [
  // Events
  {
    type: 'event',
    name: 'TaskCreated',
    inputs: [
      { indexed: true, name: 'taskId', type: 'uint256' },
      { indexed: true, name: 'creator', type: 'address' },
      { indexed: false, name: 'budget', type: 'uint256' },
    ],
  },
  {
    type: 'event',
    name: 'BidSubmitted',
    inputs: [
      { indexed: true, name: 'taskId', type: 'uint256' },
      { indexed: true, name: 'bidId', type: 'uint256' },
      { indexed: true, name: 'bidder', type: 'address' },
      { indexed: false, name: 'amount', type: 'uint256' },
    ],
  },
  {
    type: 'event',
    name: 'BidAccepted',
    inputs: [
      { indexed: true, name: 'taskId', type: 'uint256' },
      { indexed: true, name: 'bidId', type: 'uint256' },
      { indexed: true, name: 'worker', type: 'address' },
    ],
  },
  {
    type: 'event',
    name: 'TaskCompleted',
    inputs: [
      { indexed: true, name: 'taskId', type: 'uint256' },
      { indexed: true, name: 'worker', type: 'address' },
    ],
  },
  {
    type: 'event',
    name: 'PaymentReleased',
    inputs: [
      { indexed: true, name: 'taskId', type: 'uint256' },
      { indexed: true, name: 'worker', type: 'address' },
      { indexed: false, name: 'amount', type: 'uint256' },
    ],
  },
  {
    type: 'event',
    name: 'TaskCancelled',
    inputs: [
      { indexed: true, name: 'taskId', type: 'uint256' },
    ],
  },
  
  // View functions
  {
    type: 'function',
    name: 'tasks',
    inputs: [{ name: 'taskId', type: 'uint256' }],
    outputs: [
      {
        type: 'tuple',
        components: [
          { name: 'id', type: 'uint256' },
          { name: 'creator', type: 'address' },
          { name: 'title', type: 'string' },
          { name: 'description', type: 'string' },
          { name: 'budget', type: 'uint256' },
          { name: 'deadline', type: 'uint256' },
          { name: 'assignee', type: 'address' },
          { name: 'state', type: 'uint8' },
          { name: 'createdAt', type: 'uint256' },
          { name: 'completedAt', type: 'uint256' },
        ],
      },
    ],
    stateMutability: 'view',
  },
  {
    type: 'function',
    name: 'bids',
    inputs: [
      { name: 'taskId', type: 'uint256' },
      { name: 'bidId', type: 'uint256' },
    ],
    outputs: [
      {
        type: 'tuple',
        components: [
          { name: 'id', type: 'uint256' },
          { name: 'taskId', type: 'uint256' },
          { name: 'bidder', type: 'address' },
          { name: 'amount', type: 'uint256' },
          { name: 'proposal', type: 'string' },
          { name: 'accepted', type: 'bool' },
          { name: 'createdAt', type: 'uint256' },
        ],
      },
    ],
    stateMutability: 'view',
  },
  {
    type: 'function',
    name: 'getTaskBids',
    inputs: [{ name: 'taskId', type: 'uint256' }],
    outputs: [{ type: 'uint256[]' }],
    stateMutability: 'view',
  },
  {
    type: 'function',
    name: 'taskCount',
    inputs: [],
    outputs: [{ type: 'uint256' }],
    stateMutability: 'view',
  },
  {
    type: 'function',
    name: 'platformFeePercent',
    inputs: [],
    outputs: [{ type: 'uint256' }],
    stateMutability: 'view',
  },
  
  // Write functions
  {
    type: 'function',
    name: 'createTask',
    inputs: [
      { name: 'title', type: 'string' },
      { name: 'description', type: 'string' },
      { name: 'ipfsHash', type: 'string' },
      { name: 'deadline', type: 'uint256' },
    ],
    outputs: [{ type: 'uint256' }],
    stateMutability: 'payable',
  },
  {
    type: 'function',
    name: 'submitBid',
    inputs: [
      { name: 'taskId', type: 'uint256' },
      { name: 'amount', type: 'uint256' },
      { name: 'proposal', type: 'string' },
    ],
    outputs: [{ type: 'uint256' }],
    stateMutability: 'nonpayable',
  },
  {
    type: 'function',
    name: 'acceptBid',
    inputs: [
      { name: 'taskId', type: 'uint256' },
      { name: 'bidId', type: 'uint256' },
    ],
    outputs: [],
    stateMutability: 'nonpayable',
  },
  {
    type: 'function',
    name: 'submitWork',
    inputs: [
      { name: 'taskId', type: 'uint256' },
      { name: 'workResult', type: 'string' },
    ],
    outputs: [],
    stateMutability: 'nonpayable',
  },
  {
    type: 'function',
    name: 'completeTask',
    inputs: [{ name: 'taskId', type: 'uint256' }],
    outputs: [],
    stateMutability: 'nonpayable',
  },
  {
    type: 'function',
    name: 'cancelTask',
    inputs: [{ name: 'taskId', type: 'uint256' }],
    outputs: [],
    stateMutability: 'nonpayable',
  },
  {
    type: 'function',
    name: 'withdrawPlatformFees',
    inputs: [],
    outputs: [],
    stateMutability: 'nonpayable',
  },
] as const;

// Bytecode placeholders for testing (would be replaced with actual compiled bytecode)
export const SoulBoundTokenBytecode = '0x608060405234801561001057600080fd5b50' as const;
export const DAOFactoryBytecode = '0x608060405234801561001057600080fd5b50' as const;
export const ProposalManagerBytecode = '0x608060405234801561001057600080fd5b50' as const;
export const TaskMarketBytecode = '0x608060405234801561001057600080fd5b50' as const;
