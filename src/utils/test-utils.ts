/**
 * DAO Deployer - Test Utilities
 * 
 * Mock utilities and test helpers for the blockchain integration layer.
 */

import { type PublicClient, type WalletClient, type Account, type Chain, type Transport } from 'viem';
import { mainnet } from 'viem/chains';
import { type ContractAddress, type Proposal, type Task, type Bid, ProposalStatus, TaskStatus, BidStatus, VoteType } from './contracts.ts';
import { type IPFSContent, type ProposalContent } from './ipfs.ts';

// ============================================================================
// MOCK ACCOUNTS
// ============================================================================

export const MOCK_ACCOUNTS = {
  deployer: '0x1111111111111111111111111111111111111111' as ContractAddress,
  daoCreator: '0x2222222222222222222222222222222222222222' as ContractAddress,
  member1: '0x3333333333333333333333333333333333333333' as ContractAddress,
  member2: '0x4444444444444444444444444444444444444444' as ContractAddress,
  member3: '0x5555555555555555555555555555555555555555' as ContractAddress,
  bidder1: '0x6666666666666666666666666666666666666666' as ContractAddress,
  bidder2: '0x7777777777777777777777777777777777777777' as ContractAddress,
};

export const MOCK_CONTRACTS = {
  soulBoundToken: '0xAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA' as ContractAddress,
  daoFactory: '0xBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBB' as ContractAddress,
  proposalManager: '0xCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCC' as ContractAddress,
  taskMarket: '0xDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDD' as ContractAddress,
  dao: '0xEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEE' as ContractAddress,
};

// ============================================================================
// MOCK PUBLIC CLIENT
// ============================================================================

export function createMockPublicClient(overrides?: Partial<PublicClient>): PublicClient {
  const mockClient = {
    chain: mainnet,
    transport: {} as Transport,
    
    // Contract reads
    readContract: async ({ functionName, args }: { functionName: string; args?: unknown[] }) => {
      switch (functionName) {
        case 'name':
          return 'Soul Bound Token';
        case 'symbol':
          return 'SBT';
        case 'decimals':
          return 18;
        case 'totalSupply':
          return 1000n;
        case 'balanceOf':
          return 100n;
        case 'getVotes':
          return 100n;
        case 'getPastVotes':
          return 100n;
        case 'ownerOf':
          return args?.[0] ? MOCK_ACCOUNTS.member1 : MOCK_ACCOUNTS.deployer;
        case 'hasVoted':
          return false;
        case 'canVote':
          return true;
        case 'canExecute':
          return true;
        case 'getProposal':
          return createMockProposal(1n);
        case 'getProposalStatus':
          return ProposalStatus.Active;
        case 'proposalCount':
          return 5n;
        case 'getTask':
          return createMockTask(1n);
        case 'getBid':
          return createMockBid(1n, 1n);
        case 'getTaskBids':
          return [1n, 2n];
        case 'taskCount':
          return 10n;
        case 'getAllDAOs':
          return [{
            dao: MOCK_CONTRACTS.dao,
            token: MOCK_CONTRACTS.soulBoundToken,
            createdAt: Date.now(),
            active: true,
          }];
        default:
          return null;
      }
    },
    
    // Chain operations
    getBalance: async () => 1000000000000000000n,
    getBlockNumber: async () => 1000000n,
    getGasPrice: async () => 20000000000n,
    getBytecode: async () => '0x1234',
    estimateGas: async () => 21000n,
    
    // Transaction operations
    getTransactionReceipt: async ({ hash }: { hash: `0x${string}` }) => ({
      transactionHash: hash,
      blockNumber: 1000000n,
      status: 'success' as const,
      gasUsed: 21000n,
    }),
    
    // Multicall
    multicall: async ({ contracts }: { contracts: unknown[] }) => {
      return contracts.map(() => ({
        status: 'success' as const,
        result: 100n,
      }));
    },
    
    ...overrides,
  } as unknown as PublicClient;
  
  return mockClient;
}

// ============================================================================
// MOCK WALLET CLIENT
// ============================================================================

export function createMockWalletClient(overrides?: Partial<WalletClient>): WalletClient {
  const mockClient = {
    chain: mainnet,
    account: {
      address: MOCK_ACCOUNTS.daoCreator,
      type: 'json-rpc',
    } as Account,
    transport: {} as Transport,
    
    // Transaction sending
    sendTransaction: async () => '0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef' as `0x${string}`,
    
    // Message signing
    signMessage: async () => '0xsignature' as `0x${string}`,
    signTypedData: async () => '0xsignature' as `0x${string}`,
    
    // Account operations
    getAddresses: async () => [MOCK_ACCOUNTS.daoCreator],
    requestAddresses: async () => [MOCK_ACCOUNTS.daoCreator],
    
    ...overrides,
  } as unknown as WalletClient;
  
  return mockClient;
}

// ============================================================================
// MOCK DATA FACTORIES
// ============================================================================

export function createMockProposal(
  id: bigint,
  overrides?: Partial<Proposal>
): Proposal {
  return {
    id,
    proposer: MOCK_ACCOUNTS.daoCreator,
    metadata: {
      title: `Test Proposal ${id}`,
      description: 'This is a test proposal',
      body: '# Test Proposal\n\nThis is the body of the test proposal.',
    },
    metadataCID: `Qm${id.toString().padStart(44, '0')}`,
    startTime: BigInt(Date.now() / 1000 - 86400),
    endTime: BigInt(Date.now() / 1000 + 86400),
    forVotes: 50n,
    againstVotes: 20n,
    abstainVotes: 5n,
    status: ProposalStatus.Active,
    executed: false,
    eta: 0n,
    actions: [],
    ...overrides,
  };
}

export function createMockTask(
  id: bigint,
  overrides?: Partial<Task>
): Task {
  return {
    id,
    creator: MOCK_ACCOUNTS.daoCreator,
    title: `Test Task ${id}`,
    description: 'This is a test task description',
    budget: 1000n,
    token: MOCK_CONTRACTS.soulBoundToken,
    deadline: BigInt(Date.now() / 1000 + 604800), // 1 week
    status: TaskStatus.Open,
    createdAt: BigInt(Date.now() / 1000),
    ...overrides,
  };
}

export function createMockBid(
  id: bigint,
  taskId: bigint,
  overrides?: Partial<Bid>
): Bid {
  return {
    id,
    taskId,
    bidder: MOCK_ACCOUNTS.bidder1,
    amount: 800n,
    timeline: 72n, // 72 hours
    description: 'I can complete this task in 3 days',
    status: BidStatus.Pending,
    createdAt: BigInt(Date.now() / 1000),
    ...overrides,
  };
}

export function createMockIPFSContent(
  cid: string,
  overrides?: Partial<IPFSContent>
): IPFSContent {
  return {
    cid,
    content: 'Test content',
    size: 100,
    pinned: true,
    ...overrides,
  };
}

export function createMockProposalContent(
  overrides?: Partial<ProposalContent>
): ProposalContent {
  return {
    title: 'Test Proposal',
    description: 'This is a test proposal description',
    body: '# Test Proposal\n\nThis is the body of the test proposal.',
    author: MOCK_ACCOUNTS.daoCreator,
    createdAt: new Date().toISOString(),
    version: '1.0',
    ...overrides,
  };
}

// ============================================================================
// MOCK IPFS CLIENT
// ============================================================================

export class MockIPFSClient {
  private storage = new Map<string, string>();

  async upload(
    content: string | Uint8Array,
    filename: string = 'content.md'
  ): Promise<IPFSContent> {
    const cid = `Qm${Math.random().toString(36).substring(2, 46).padStart(44, '0')}`;
    const contentStr = content instanceof Uint8Array 
      ? new TextDecoder().decode(content)
      : content;
    
    this.storage.set(cid, contentStr);
    
    return {
      cid,
      content,
      size: contentStr.length,
      pinned: true,
    };
  }

  async uploadProposal(content: ProposalContent): Promise<IPFSContent> {
    const markdown = this.toMarkdown(content);
    return this.upload(markdown, 'proposal.md');
  }

  async retrieve(cid: string): Promise<string> {
    const content = this.storage.get(cid);
    if (!content) {
      throw new Error(`Content not found: ${cid}`);
    }
    return content;
  }

  async retrieveProposal(cid: string): Promise<ProposalContent> {
    const markdown = await this.retrieve(cid);
    return this.fromMarkdown(markdown);
  }

  async pin(cid: string): Promise<void> {
    // Mock pinning - does nothing
  }

  async unpin(cid: string): Promise<void> {
    this.storage.delete(cid);
  }

  isAvailable(cid: string): boolean {
    return this.storage.has(cid);
  }

  private toMarkdown(content: ProposalContent): string {
    return `# ${content.title}

**Author:** ${content.author}  
**Created:** ${content.createdAt}  
**Version:** ${content.version}

## Summary

${content.description}

## Details

${content.body}
`;
  }

  private fromMarkdown(markdown: string): ProposalContent {
    const titleMatch = markdown.match(/^# (.+)$/m);
    const authorMatch = markdown.match(/\*\*Author:\*\* (.+)/);
    const createdMatch = markdown.match(/\*\*Created:\*\* (.+)/);
    const versionMatch = markdown.match(/\*\*Version:\*\* (.+)/);
    const summaryMatch = markdown.match(/## Summary\n\n([\s\S]*?)(?=\n## |$)/);
    const detailsMatch = markdown.match(/## Details\n\n([\s\S]*?)(?=\n## |$)/);

    return {
      title: titleMatch?.[1] || '',
      description: summaryMatch?.[1] || '',
      body: detailsMatch?.[1] || '',
      author: authorMatch?.[1].trim() || '',
      createdAt: createdMatch?.[1].trim() || '',
      version: versionMatch?.[1].trim() || '1.0',
    };
  }
}

// ============================================================================
// TEST HELPERS
// ============================================================================

export function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

export function generateRandomAddress(): ContractAddress {
  const chars = '0123456789abcdef';
  let address = '0x';
  for (let i = 0; i < 40; i++) {
    address += chars[Math.floor(Math.random() * chars.length)];
  }
  return address as ContractAddress;
}

export function generateRandomBytes32(): `0x${string}` {
  const chars = '0123456789abcdef';
  let bytes = '0x';
  for (let i = 0; i < 64; i++) {
    bytes += chars[Math.floor(Math.random() * chars.length)];
  }
  return bytes as `0x${string}`;
}

export function formatBigInt(value: bigint, decimals: number = 18): string {
  const divisor = 10n ** BigInt(decimals);
  const integerPart = value / divisor;
  const fractionalPart = value % divisor;
  
  const fractionalStr = fractionalPart
    .toString()
    .padStart(decimals, '0')
    .replace(/0+$/, '');
  
  if (fractionalStr === '') {
    return integerPart.toString();
  }
  
  return `${integerPart}.${fractionalStr}`;
}

// ============================================================================
// ASSERTION HELPERS
// ============================================================================

export function assertBigIntEquals(actual: bigint, expected: bigint, message?: string): void {
  if (actual !== expected) {
    throw new Error(
      message || `Expected ${expected.toString()} but got ${actual.toString()}`
    );
  }
}

export function assertAddressEquals(actual: string, expected: string, message?: string): void {
  if (actual.toLowerCase() !== expected.toLowerCase()) {
    throw new Error(
      message || `Expected ${expected} but got ${actual}`
    );
  }
}

export function assertIsValidAddress(address: string, message?: string): void {
  if (!/^0x[a-fA-F0-9]{40}$/.test(address)) {
    throw new Error(message || `Invalid address: ${address}`);
  }
}

export function assertIsValidBytes32(value: string, message?: string): void {
  if (!/^0x[a-fA-F0-9]{64}$/.test(value)) {
    throw new Error(message || `Invalid bytes32: ${value}`);
  }
}

// ============================================================================
// ERROR TESTING
// ============================================================================

export async function expectError(
  fn: () => Promise<unknown>,
  errorType: new (...args: unknown[]) => Error,
  errorMessage?: string
): Promise<void> {
  try {
    await fn();
    throw new Error(`Expected ${errorType.name} to be thrown`);
  } catch (error) {
    if (!(error instanceof errorType)) {
      throw new Error(
        `Expected ${errorType.name} but got ${error?.constructor.name}`
      );
    }
    if (errorMessage && !(error as Error).message.includes(errorMessage)) {
      throw new Error(
        `Expected error message to include "${errorMessage}" but got "${(error as Error).message}"`
      );
    }
  }
}

export async function expectRevert(
  fn: () => Promise<unknown>,
  revertReason?: string
): Promise<void> {
  try {
    await fn();
    throw new Error('Expected transaction to revert');
  } catch (error) {
    if (revertReason && !(error as Error).message.includes(revertReason)) {
      throw new Error(
        `Expected revert reason "${revertReason}" but got "${(error as Error).message}"`
      );
    }
  }
}

// ============================================================================
// SNAPSHOT TESTING
// ============================================================================

export interface StateSnapshot {
  blockNumber: bigint;
  balances: Map<string, bigint>;
  proposals: Proposal[];
  tasks: Task[];
}

export function createStateSnapshot(
  blockNumber: bigint,
  overrides?: Partial<StateSnapshot>
): StateSnapshot {
  return {
    blockNumber,
    balances: new Map(),
    proposals: [],
    tasks: [],
    ...overrides,
  };
}

export function compareSnapshots(before: StateSnapshot, after: StateSnapshot): {
  blockNumberDelta: bigint;
  balanceChanges: Array<{ address: string; before: bigint; after: bigint }>;
  newProposals: Proposal[];
  newTasks: Task[];
} {
  const balanceChanges: Array<{ address: string; before: bigint; after: bigint }> = [];
  
  for (const [address, afterBalance] of after.balances) {
    const beforeBalance = before.balances.get(address) || 0n;
    if (beforeBalance !== afterBalance) {
      balanceChanges.push({
        address,
        before: beforeBalance,
        after: afterBalance,
      });
    }
  }
  
  return {
    blockNumberDelta: after.blockNumber - before.blockNumber,
    balanceChanges,
    newProposals: after.proposals.filter(
      p => !before.proposals.find(bp => bp.id === p.id)
    ),
    newTasks: after.tasks.filter(
      t => !before.tasks.find(bt => bt.id === t.id)
    ),
  };
}
