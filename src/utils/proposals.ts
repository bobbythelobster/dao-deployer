/**
 * DAO Deployer - Proposal Operations
 * 
 * Proposal operations including creation (with IPFS upload),
 * voting, execution, and status checking.
 */

import {
  type PublicClient,
  type WalletClient,
  encodeFunctionData,
} from 'viem';
import {
  ProposalManagerABI,
  AragonDAOABI,
  type Proposal,
  type ProposalMetadata,
  type ProposalAction,
  type Vote,
  ProposalStatus,
  VoteType,
  type ContractAddress,
} from './contracts.ts';
import {
  ProposalError,
  ProposalNotFoundError,
  ProposalCreationError,
  ProposalVotingError,
  ProposalExecutionError,
  ProposalAlreadyExecutedError,
  InvalidProposalError,
  TransactionError,
  ContractReadError,
  ContractWriteError,
  InsufficientBalanceError,
} from './errors.ts';
import { waitForTransaction } from './viem.ts';
import { IPFSClient, type ProposalContent } from './ipfs.ts';
import { PROPOSAL_CONFIG } from './constants.ts';
import { getVotingPower } from './tokens.ts';

// ============================================================================
// TYPES
// ============================================================================

export interface CreateProposalParams {
  metadata: ProposalMetadata;
  actions: ProposalAction[];
  allowFailureMap?: bigint;
}

export interface CastVoteParams {
  proposalId: bigint;
  voteType: VoteType;
  reason?: string;
  tryEarlyExecution?: boolean;
}

export interface ProposalResult {
  forVotes: bigint;
  againstVotes: bigint;
  abstainVotes: bigint;
  totalVotes: bigint;
  quorumReached: boolean;
  passed: boolean;
}

// ============================================================================
// PROPOSAL CREATION
// ============================================================================

/**
 * Create a new proposal
 * Uploads metadata to IPFS and stores hash on-chain
 */
export async function createProposal(
  publicClient: PublicClient,
  walletClient: WalletClient,
  proposalManagerAddress: ContractAddress,
  governanceTokenAddress: ContractAddress,
  params: CreateProposalParams
): Promise<{
  proposalId: bigint;
  metadataCID: string;
  transactionHash: `0x${string}`;
  blockNumber: bigint;
}> {
  try {
    // Validate proposal
    validateProposal(params.metadata);

    // Check proposer has voting power
    const proposer = walletClient.account?.address;
    if (!proposer) {
      throw new ProposalCreationError('No wallet connected');
    }

    const votingPower = await getVotingPower(
      publicClient,
      governanceTokenAddress,
      proposer as ContractAddress
    );

    if (votingPower === 0n) {
      throw new InsufficientBalanceError(
        1n,
        0n,
        new Error('Must have voting power to create proposal')
      );
    }

    // Upload metadata to IPFS
    const ipfsClient = new IPFSClient();
    const proposalContent: ProposalContent = {
      title: params.metadata.title,
      description: params.metadata.description,
      body: params.metadata.body,
      discussionUrl: params.metadata.discussionUrl,
      resources: params.metadata.resources,
      author: proposer,
      createdAt: new Date().toISOString(),
      version: '1.0',
    };

    const upload = await ipfsClient.uploadProposal(proposalContent);
    const metadataCID = upload.cid;

    // Encode proposal creation
    const data = encodeFunctionData({
      abi: ProposalManagerABI,
      functionName: 'createProposal',
      args: [
        `0x${Buffer.from(metadataCID).toString('hex')}` as `0x${string}`,
        params.actions.map(a => ({
          to: a.target,
          value: a.value,
          data: a.data,
        })),
        params.allowFailureMap || 0n,
      ],
    });

    const hash = await walletClient.sendTransaction({
      to: proposalManagerAddress,
      data,
      account: walletClient.account!,
      chain: walletClient.chain,
    });

    const receipt = await waitForTransaction(publicClient, hash);

    if (receipt.status === 'reverted') {
      throw new TransactionError(
        'Proposal creation transaction reverted',
        'PROPOSAL_CREATION_REVERTED',
        hash,
        receipt
      );
    }

    // Parse proposal ID from event logs
    // In real implementation, would parse the ProposalCreated event
    const proposalId = 1n;

    return {
      proposalId,
      metadataCID,
      transactionHash: hash,
      blockNumber: receipt.blockNumber,
    };
  } catch (error) {
    if (
      error instanceof ProposalError ||
      error instanceof TransactionError ||
      error instanceof InsufficientBalanceError
    ) {
      throw error;
    }
    throw new ProposalCreationError(
      error instanceof Error ? error.message : 'Proposal creation failed',
      proposalManagerAddress,
      error instanceof Error ? error : undefined
    );
  }
}

/**
 * Validate proposal metadata
 */
function validateProposal(metadata: ProposalMetadata): void {
  if (!metadata.title || metadata.title.length < PROPOSAL_CONFIG.minTitleLength) {
    throw new InvalidProposalError(
      `Title must be at least ${PROPOSAL_CONFIG.minTitleLength} characters`,
      { field: 'title', value: metadata.title }
    );
  }

  if (metadata.title.length > PROPOSAL_CONFIG.maxTitleLength) {
    throw new InvalidProposalError(
      `Title must not exceed ${PROPOSAL_CONFIG.maxTitleLength} characters`,
      { field: 'title', value: metadata.title }
    );
  }

  if (!metadata.body || metadata.body.length < PROPOSAL_CONFIG.minBodyLength) {
    throw new InvalidProposalError(
      `Body must be at least ${PROPOSAL_CONFIG.minBodyLength} characters`,
      { field: 'body', value: metadata.body }
    );
  }

  if (metadata.body.length > PROPOSAL_CONFIG.maxBodyLength) {
    throw new InvalidProposalError(
      `Body must not exceed ${PROPOSAL_CONFIG.maxBodyLength} characters`,
      { field: 'body', value: metadata.body }
    );
  }
}

// ============================================================================
// PROPOSAL QUERIES
// ============================================================================

/**
 * Get proposal by ID
 */
export async function getProposal(
  publicClient: PublicClient,
  proposalManagerAddress: ContractAddress,
  proposalId: bigint
): Promise<Proposal> {
  try {
    const proposalData = await publicClient.readContract({
      address: proposalManagerAddress,
      abi: ProposalManagerABI,
      functionName: 'getProposal',
      args: [proposalId],
    });

    // Get status
    const status = await getProposalStatus(
      publicClient,
      proposalManagerAddress,
      proposalId
    );

    // Get votes
    const [forVotes, againstVotes, abstainVotes] = await Promise.all([
      getVoteCount(publicClient, proposalManagerAddress, proposalId, VoteType.For),
      getVoteCount(publicClient, proposalManagerAddress, proposalId, VoteType.Against),
      getVoteCount(publicClient, proposalManagerAddress, proposalId, VoteType.Abstain),
    ]);

    // Fetch metadata from IPFS
    let metadata: ProposalMetadata = {
      title: '',
      description: '',
      body: '',
    };

    try {
      const ipfsClient = new IPFSClient();
      const content = await ipfsClient.retrieveProposal(''); // Would get CID from contract
      metadata = {
        title: content.title,
        description: content.description,
        body: content.body,
        discussionUrl: content.discussionUrl,
        resources: content.resources,
      };
    } catch {
      // If IPFS fetch fails, use on-chain data only
    }

    return {
      id: proposalId,
      proposer: '0x0000000000000000000000000000000000000000' as ContractAddress,
      metadata,
      metadataCID: '',
      startTime: 0n,
      endTime: 0n,
      forVotes,
      againstVotes,
      abstainVotes,
      status,
      executed: proposalData.executed,
      eta: 0n,
      actions: proposalData.actions.map((a: { to: string; value: bigint; data: `0x${string}` }) => ({
        target: a.to as ContractAddress,
        value: a.value,
        data: a.data,
      })),
    };
  } catch (error) {
    throw new ContractReadError(
      proposalManagerAddress,
      'getProposal',
      [proposalId],
      error instanceof Error ? error : undefined
    );
  }
}

/**
 * Get all proposals
 */
export async function getAllProposals(
  publicClient: PublicClient,
  proposalManagerAddress: ContractAddress
): Promise<Proposal[]> {
  try {
    const count = await publicClient.readContract({
      address: proposalManagerAddress,
      abi: ProposalManagerABI,
      functionName: 'proposalCount',
    });

    const proposals: Proposal[] = [];
    for (let i = 1n; i <= count; i++) {
      try {
        const proposal = await getProposal(publicClient, proposalManagerAddress, i);
        proposals.push(proposal);
      } catch {
        // Skip proposals that can't be fetched
      }
    }

    return proposals;
  } catch (error) {
    throw new ContractReadError(
      proposalManagerAddress,
      'getAllProposals',
      [],
      error instanceof Error ? error : undefined
    );
  }
}

/**
 * Get proposal status
 */
export async function getProposalStatus(
  publicClient: PublicClient,
  proposalManagerAddress: ContractAddress,
  proposalId: bigint
): Promise<ProposalStatus> {
  try {
    const status = await publicClient.readContract({
      address: proposalManagerAddress,
      abi: ProposalManagerABI,
      functionName: 'getProposalStatus',
      args: [proposalId],
    });

    return status as ProposalStatus;
  } catch (error) {
    throw new ContractReadError(
      proposalManagerAddress,
      'getProposalStatus',
      [proposalId],
      error instanceof Error ? error : undefined
    );
  }
}

/**
 * Get vote count for a specific vote type
 */
async function getVoteCount(
  publicClient: PublicClient,
  proposalManagerAddress: ContractAddress,
  proposalId: bigint,
  voteType: VoteType
): Promise<bigint> {
  // This would be fetched from the contract
  // For now, return 0
  return 0n;
}

/**
 * Check if an account has voted on a proposal
 */
export async function hasVoted(
  publicClient: PublicClient,
  proposalManagerAddress: ContractAddress,
  proposalId: bigint,
  voter: ContractAddress
): Promise<boolean> {
  try {
    const hasVotedResult = await publicClient.readContract({
      address: proposalManagerAddress,
      abi: ProposalManagerABI,
      functionName: 'hasVoted',
      args: [proposalId, voter],
    });

    return hasVotedResult;
  } catch (error) {
    throw new ContractReadError(
      proposalManagerAddress,
      'hasVoted',
      [proposalId, voter],
      error instanceof Error ? error : undefined
    );
  }
}

/**
 * Get vote details for an account
 */
export async function getVote(
  publicClient: PublicClient,
  proposalManagerAddress: ContractAddress,
  proposalId: bigint,
  voter: ContractAddress
): Promise<Vote | null> {
  try {
    const hasVotedResult = await hasVoted(
      publicClient,
      proposalManagerAddress,
      proposalId,
      voter
    );

    if (!hasVotedResult) return null;

    const voteData = await publicClient.readContract({
      address: proposalManagerAddress,
      abi: ProposalManagerABI,
      functionName: 'getVote',
      args: [proposalId, voter],
    });

    return {
      voter,
      proposalId,
      support: voteData.voteType as VoteType,
      votes: voteData.votingPower,
    };
  } catch (error) {
    throw new ContractReadError(
      proposalManagerAddress,
      'getVote',
      [proposalId, voter],
      error instanceof Error ? error : undefined
    );
  }
}

/**
 * Check if proposal can be executed
 */
export async function canExecute(
  publicClient: PublicClient,
  proposalManagerAddress: ContractAddress,
  proposalId: bigint
): Promise<boolean> {
  try {
    const canExecuteResult = await publicClient.readContract({
      address: proposalManagerAddress,
      abi: ProposalManagerABI,
      functionName: 'canExecute',
      args: [proposalId],
    });

    return canExecuteResult;
  } catch (error) {
    throw new ContractReadError(
      proposalManagerAddress,
      'canExecute',
      [proposalId],
      error instanceof Error ? error : undefined
    );
  }
}

/**
 * Check if account can vote on proposal
 */
export async function canVote(
  publicClient: PublicClient,
  proposalManagerAddress: ContractAddress,
  proposalId: bigint,
  voter: ContractAddress
): Promise<boolean> {
  try {
    const canVoteResult = await publicClient.readContract({
      address: proposalManagerAddress,
      abi: ProposalManagerABI,
      functionName: 'canVote',
      args: [proposalId, voter],
    });

    return canVoteResult;
  } catch (error) {
    throw new ContractReadError(
      proposalManagerAddress,
      'canVote',
      [proposalId, voter],
      error instanceof Error ? error : undefined
    );
  }
}

// ============================================================================
// VOTING
// ============================================================================

/**
 * Cast a vote on a proposal
 */
export async function castVote(
  publicClient: PublicClient,
  walletClient: WalletClient,
  proposalManagerAddress: ContractAddress,
  params: CastVoteParams
): Promise<{
  transactionHash: `0x${string}`;
  blockNumber: bigint;
}> {
  try {
    const voter = walletClient.account?.address;
    if (!voter) {
      throw new ProposalVotingError(params.proposalId, 'No wallet connected');
    }

    // Check if already voted
    const hasVotedResult = await hasVoted(
      publicClient,
      proposalManagerAddress,
      params.proposalId,
      voter as ContractAddress
    );

    if (hasVotedResult) {
      throw new ProposalVotingError(
        params.proposalId,
        'Already voted on this proposal'
      );
    }

    // Check if can vote
    const canVoteResult = await canVote(
      publicClient,
      proposalManagerAddress,
      params.proposalId,
      voter as ContractAddress
    );

    if (!canVoteResult) {
      throw new ProposalVotingError(
        params.proposalId,
        'Cannot vote on this proposal'
      );
    }

    // Encode vote
    const data = encodeFunctionData({
      abi: ProposalManagerABI,
      functionName: 'vote',
      args: [
        params.proposalId,
        params.voteType,
        params.tryEarlyExecution || false,
      ],
    });

    const hash = await walletClient.sendTransaction({
      to: proposalManagerAddress,
      data,
      account: walletClient.account!,
      chain: walletClient.chain,
    });

    const receipt = await waitForTransaction(publicClient, hash);

    if (receipt.status === 'reverted') {
      throw new TransactionError(
        'Vote transaction reverted',
        'VOTE_REVERTED',
        hash,
        receipt
      );
    }

    return {
      transactionHash: hash,
      blockNumber: receipt.blockNumber,
    };
  } catch (error) {
    if (error instanceof ProposalError || error instanceof TransactionError) {
      throw error;
    }
    throw new ProposalVotingError(
      params.proposalId,
      error instanceof Error ? error.message : 'Voting failed',
      error instanceof Error ? error : undefined
    );
  }
}

// ============================================================================
// EXECUTION
// ============================================================================

/**
 * Execute a proposal
 */
export async function executeProposal(
  publicClient: PublicClient,
  walletClient: WalletClient,
  proposalManagerAddress: ContractAddress,
  proposalId: bigint
): Promise<{
  transactionHash: `0x${string}`;
  blockNumber: bigint;
}> {
  try {
    // Check proposal status
    const status = await getProposalStatus(
      publicClient,
      proposalManagerAddress,
      proposalId
    );

    if (status === ProposalStatus.Executed) {
      throw new ProposalAlreadyExecutedError(proposalId);
    }

    if (status !== ProposalStatus.Succeeded && status !== ProposalStatus.Queued) {
      throw new ProposalExecutionError(
        proposalId,
        `Proposal is not executable. Current status: ${ProposalStatus[status]}`
      );
    }

    // Check if can execute
    const canExecuteResult = await canExecute(
      publicClient,
      proposalManagerAddress,
      proposalId
    );

    if (!canExecuteResult) {
      throw new ProposalExecutionError(proposalId, 'Proposal cannot be executed yet');
    }

    // Encode execution
    const data = encodeFunctionData({
      abi: ProposalManagerABI,
      functionName: 'execute',
      args: [proposalId],
    });

    const hash = await walletClient.sendTransaction({
      to: proposalManagerAddress,
      data,
      account: walletClient.account!,
      chain: walletClient.chain,
    });

    const receipt = await waitForTransaction(publicClient, hash);

    if (receipt.status === 'reverted') {
      throw new TransactionError(
        'Execution transaction reverted',
        'EXECUTION_REVERTED',
        hash,
        receipt
      );
    }

    return {
      transactionHash: hash,
      blockNumber: receipt.blockNumber,
    };
  } catch (error) {
    if (error instanceof ProposalError || error instanceof TransactionError) {
      throw error;
    }
    throw new ProposalExecutionError(
      proposalId,
      error instanceof Error ? error.message : 'Execution failed',
      error instanceof Error ? error : undefined
    );
  }
}

// ============================================================================
// RESULTS
// ============================================================================

/**
 * Get proposal results
 */
export async function getProposalResults(
  publicClient: PublicClient,
  proposalManagerAddress: ContractAddress,
  proposalId: bigint,
  quorum: bigint
): Promise<ProposalResult> {
  const proposal = await getProposal(publicClient, proposalManagerAddress, proposalId);

  const totalVotes = proposal.forVotes + proposal.againstVotes + proposal.abstainVotes;
  const quorumReached = totalVotes >= quorum;
  const passed = quorumReached && proposal.forVotes > proposal.againstVotes;

  return {
    forVotes: proposal.forVotes,
    againstVotes: proposal.againstVotes,
    abstainVotes: proposal.abstainVotes,
    totalVotes,
    quorumReached,
    passed,
  };
}

// ============================================================================
// PROPOSAL CLASS
// ============================================================================

export class ProposalManager {
  private publicClient: PublicClient;
  private walletClient?: WalletClient;
  private address: ContractAddress;

  constructor(
    publicClient: PublicClient,
    proposalManagerAddress: ContractAddress,
    walletClient?: WalletClient
  ) {
    this.publicClient = publicClient;
    this.address = proposalManagerAddress;
    this.walletClient = walletClient;
  }

  async getProposal(proposalId: bigint): Promise<Proposal> {
    return getProposal(this.publicClient, this.address, proposalId);
  }

  async getAllProposals(): Promise<Proposal[]> {
    return getAllProposals(this.publicClient, this.address);
  }

  async getStatus(proposalId: bigint): Promise<ProposalStatus> {
    return getProposalStatus(this.publicClient, this.address, proposalId);
  }

  async hasVoted(proposalId: bigint, voter: ContractAddress): Promise<boolean> {
    return hasVoted(this.publicClient, this.address, proposalId, voter);
  }

  async getVote(proposalId: bigint, voter: ContractAddress): Promise<Vote | null> {
    return getVote(this.publicClient, this.address, proposalId, voter);
  }

  async canExecute(proposalId: bigint): Promise<boolean> {
    return canExecute(this.publicClient, this.address, proposalId);
  }

  async canVote(proposalId: bigint, voter: ContractAddress): Promise<boolean> {
    return canVote(this.publicClient, this.address, proposalId, voter);
  }

  async castVote(params: CastVoteParams): Promise<{ transactionHash: `0x${string}`; blockNumber: bigint }> {
    if (!this.walletClient) {
      throw new ProposalError(
        'Wallet client required',
        'WALLET_REQUIRED',
        params.proposalId
      );
    }
    return castVote(this.publicClient, this.walletClient, this.address, params);
  }

  async execute(proposalId: bigint): Promise<{ transactionHash: `0x${string}`; blockNumber: bigint }> {
    if (!this.walletClient) {
      throw new ProposalError(
        'Wallet client required',
        'WALLET_REQUIRED',
        proposalId
      );
    }
    return executeProposal(this.publicClient, this.walletClient, this.address, proposalId);
  }

  async getResults(proposalId: bigint, quorum: bigint): Promise<ProposalResult> {
    return getProposalResults(this.publicClient, this.address, proposalId, quorum);
  }
}

// ============================================================================
// EXPORTS
// ============================================================================

export {
  ProposalManagerABI,
  ProposalStatus,
  VoteType,
};
