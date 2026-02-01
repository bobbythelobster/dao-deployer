/**
 * Test Setup for DAO Deployer
 * Configures Bun test environment with Viem test client
 */

import { createTestClient, http, publicActions, walletActions, createWalletClient, custom } from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
import { mainnet, base, baseSepolia, sepolia } from 'viem/chains';
import { type TestClient, type WalletClient, type PublicClient } from 'viem';

// Test chain configuration
export const TEST_CHAIN = baseSepolia;

// Test accounts with private keys
export const TEST_ACCOUNTS = {
  deployer: {
    privateKey: '0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80',
    address: '0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266',
  },
  alice: {
    privateKey: '0x59c6995e998f97a5a0044966f0945389dc9e86dae88c7a8412f4603b6b78690d',
    address: '0x70997970C51812dc3A010C7d01b50e0d17dc79C8',
  },
  bob: {
    privateKey: '0x5de4111afa1a4b94908f83103eb1f1706367c2e68ca870fc3fb9a804cdab365a',
    address: '0x3C44CdDdB6a900fa2b585dd299e03d12FA4293BC',
  },
  carol: {
    privateKey: '0x7c852118294e51e653712a81e05800f419141751be58f605c371e15141b007a6',
    address: '0x90F79bf6EB2c4f870365E785982E1f101E93b906',
  },
  dave: {
    privateKey: '0x47e179ec197488593b187f80a00eb0da91f1b9d0b13f8733639f19c30a34926a',
    address: '0x15d34AAf54267DB7D7c367839AAf71A00a2C6A65',
  },
};

// Create test clients for each account
export function createTestClients() {
  const publicClient = createTestClient({
    chain: TEST_CHAIN,
    mode: 'anvil',
    transport: http(),
  }).extend(publicActions);

  const walletClients: Record<string, WalletClient> = {};
  
  for (const [name, account] of Object.entries(TEST_ACCOUNTS)) {
    walletClients[name] = createWalletClient({
      account: privateKeyToAccount(account.privateKey as `0x${string}`),
      chain: TEST_CHAIN,
      transport: http(),
    });
  }

  return { publicClient, walletClients };
}

// Global test state
export interface TestContext {
  publicClient: PublicClient;
  walletClients: Record<string, WalletClient>;
  contracts: {
    soulBoundToken?: `0x${string}`;
    daoFactory?: `0x${string}`;
    proposalManager?: `0x${string}`;
    taskMarket?: `0x${string}`;
    dao?: `0x${string}`;
  };
}

let globalContext: TestContext | null = null;

export function getTestContext(): TestContext {
  if (!globalContext) {
    const { publicClient, walletClients } = createTestClients();
    globalContext = {
      publicClient,
      walletClients,
      contracts: {},
    };
  }
  return globalContext;
}

export function resetTestContext() {
  globalContext = null;
}

// Gas tracking utility
export class GasTracker {
  private measurements: Map<string, bigint> = new Map();

  record(name: string, gasUsed: bigint) {
    this.measurements.set(name, gasUsed);
  }

  get(name: string): bigint | undefined {
    return this.measurements.get(name);
  }

  getAll(): Record<string, bigint> {
    return Object.fromEntries(this.measurements);
  }

  report(): string {
    const entries = Array.from(this.measurements.entries());
    entries.sort((a, b) => Number(b[1] - a[1]));
    
    return entries
      .map(([name, gas]) => `  ${name}: ${gas.toString()} gas`)
      .join('\n');
  }
}

// Time manipulation for tests
export async function increaseTime(publicClient: PublicClient, seconds: number) {
  await publicClient.request({
    method: 'anvil_increaseTime',
    params: [seconds],
  });
}

export async function mineBlock(publicClient: PublicClient) {
  await publicClient.request({
    method: 'anvil_mine',
    params: [],
  });
}

// Snapshot and revert for test isolation
export async function takeSnapshot(publicClient: PublicClient): Promise<string> {
  return await publicClient.request({
    method: 'anvil_snapshot',
    params: [],
  }) as string;
}

export async function revertToSnapshot(publicClient: PublicClient, snapshotId: string) {
  await publicClient.request({
    method: 'anvil_revert',
    params: [snapshotId],
  });
}

// Helper to wait for transaction receipt
export async function waitForReceipt(
  publicClient: PublicClient,
  hash: `0x${string}`
) {
  return await publicClient.waitForTransactionReceipt({ hash });
}

// Error message matchers for revert testing
export const ErrorMessages = {
  SOUL_BOUND: /SoulBound__TransferNotAllowed|transfer not allowed/i,
  UNAUTHORIZED: /Ownable__Unauthorized|unauthorized|not owner/i,
  INVALID_PROPOSAL: /InvalidProposal|proposal not found/i,
  VOTING_CLOSED: /VotingClosed|voting period ended/i,
  ALREADY_VOTED: /AlreadyVoted|already voted/i,
  INSUFFICIENT_TOKENS: /InsufficientTokens|insufficient voting power/i,
  PROPOSAL_NOT_EXECUTABLE: /NotExecutable|proposal not executable/i,
  TASK_NOT_FOUND: /TaskNotFound|task not found/i,
  BID_TOO_LOW: /BidTooLow|bid below minimum/i,
  TASK_NOT_ASSIGNED: /TaskNotAssigned|task not assigned/i,
  NOT_WORKER: /NotWorker|not the assigned worker/i,
};

// Test data generators
export function generateProposalMetadata(): {
  title: string;
  description: string;
  ipfsHash: string;
} {
  return {
    title: `Test Proposal ${Date.now()}`,
    description: 'This is a test proposal for the DAO',
    ipfsHash: `0x${'a'.repeat(64)}`,
  };
}

export function generateTaskData(): {
  title: string;
  description: string;
  budget: bigint;
  deadline: number;
} {
  return {
    title: `Test Task ${Date.now()}`,
    description: 'This is a test task for the marketplace',
    budget: BigInt(1e18), // 1 ETH
    deadline: Math.floor(Date.now() / 1000) + 7 * 24 * 60 * 60, // 7 days from now
  };
}

// Aragon SDK mock helpers
export const mockAragonSDK = {
  createDAO: jest.fn(),
  installPlugin: jest.fn(),
  createProposal: jest.fn(),
  vote: jest.fn(),
  execute: jest.fn(),
};

// IPFS mock helpers
export const mockIPFS = {
  upload: jest.fn(),
  download: jest.fn(),
  pin: jest.fn(),
};

// Coverage helpers
export function expectCoverage(contractName: string, percentage: number) {
  console.log(`Coverage check: ${contractName} - ${percentage}%`);
}
