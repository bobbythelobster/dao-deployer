/**
 * Test Utilities and Helpers
 * Common functions for testing smart contracts and components
 */

import { 
  type Address, 
  type Hex, 
  type PublicClient, 
  type WalletClient,
  type TransactionReceipt,
  parseAbi,
  decodeEventLog,
  encodeFunctionData,
  getContract,
  stringToHex,
} from 'viem';
import { expect } from 'bun:test';

// ============ CONTRACT INTERACTION HELPERS ============

export async function deployContract(
  walletClient: WalletClient,
  publicClient: PublicClient,
  abi: any,
  bytecode: Hex,
  args: any[] = []
): Promise<Address> {
  const hash = await walletClient.deployContract({
    abi,
    bytecode,
    args,
  });

  const receipt = await publicClient.waitForTransactionReceipt({ hash });
  
  if (!receipt.contractAddress) {
    throw new Error('Contract deployment failed: no contract address');
  }

  return receipt.contractAddress;
}

export async function sendTransaction(
  walletClient: WalletClient,
  publicClient: PublicClient,
  to: Address,
  data: Hex,
  value: bigint = BigInt(0)
): Promise<TransactionReceipt> {
  const hash = await walletClient.sendTransaction({
    to,
    data,
    value,
  });

  return await publicClient.waitForTransactionReceipt({ hash });
}

export async function estimateGas(
  publicClient: PublicClient,
  from: Address,
  to: Address,
  data: Hex,
  value: bigint = BigInt(0)
): Promise<bigint> {
  return await publicClient.estimateGas({
    account: from,
    to,
    data,
    value,
  });
}

// ============ EVENT LOGGING HELPERS ============

export function parseEventLogs(
  receipt: TransactionReceipt,
  abi: any,
  eventName: string
): any[] {
  const events: any[] = [];

  for (const log of receipt.logs) {
    try {
      const decoded = decodeEventLog({
        abi,
        data: log.data,
        topics: log.topics,
      });
      
      if (decoded.eventName === eventName) {
        events.push(decoded.args);
      }
    } catch {
      // Skip logs that don't match the event
    }
  }

  return events;
}

export function findEventLog(
  receipt: TransactionReceipt,
  abi: any,
  eventName: string
): any | undefined {
  const events = parseEventLogs(receipt, abi, eventName);
  return events[0];
}

// ============ ASSERTION HELPERS ============

export function expectAddress(address: string): void {
  expect(address).toMatch(/^0x[a-fA-F0-9]{40}$/);
}

export function expectHex(hex: string): void {
  expect(hex).toMatch(/^0x[a-fA-F0-9]*$/);
}

export function expectTransactionSuccess(receipt: TransactionReceipt): void {
  expect(receipt.status).toBe('success');
}

export function expectTransactionRevert(
  promise: Promise<any>,
  errorMessage?: string | RegExp
): Promise<void> {
  return expect(promise).rejects.toThrow(errorMessage);
}

export function expectBigIntEquals(actual: bigint, expected: bigint): void {
  expect(actual).toBe(expected);
}

export function expectBigIntGt(actual: bigint, expected: bigint): void {
  expect(actual > expected).toBe(true);
}

export function expectBigIntLt(actual: bigint, expected: bigint): void {
  expect(actual < expected).toBe(true);
}

// ============ TIME HELPERS ============

export async function advanceBlocks(
  publicClient: PublicClient,
  blocks: number
): Promise<void> {
  for (let i = 0; i < blocks; i++) {
    await publicClient.request({
      method: 'anvil_mine',
      params: [],
    });
  }
}

export async function advanceTime(
  publicClient: PublicClient,
  seconds: number
): Promise<void> {
  await publicClient.request({
    method: 'anvil_increaseTime',
    params: [seconds],
  });
  
  // Mine a block to apply the time change
  await publicClient.request({
    method: 'anvil_mine',
    params: [],
  });
}

export function getCurrentTimestamp(): bigint {
  return BigInt(Math.floor(Date.now() / 1000));
}

export function addDays(days: number): bigint {
  return BigInt(Math.floor(Date.now() / 1000) + days * 24 * 60 * 60);
}

// ============ BALANCE HELPERS ============

export async function getBalance(
  publicClient: PublicClient,
  address: Address
): Promise<bigint> {
  return await publicClient.getBalance({ address });
}

export async function getTokenBalance(
  publicClient: PublicClient,
  tokenAddress: Address,
  account: Address
): Promise<bigint> {
  const result = await publicClient.readContract({
    address: tokenAddress,
    abi: parseAbi(['function balanceOf(address) view returns (uint256)']),
    functionName: 'balanceOf',
    args: [account],
  });

  return result as bigint;
}

// ============ ENCODING HELPERS ============

export function encodeProposalData(
  targets: Address[],
  values: bigint[],
  calldatas: Hex[],
  description: string
): Hex {
  return encodeFunctionData({
    abi: parseAbi(['function propose(address[],uint256[],bytes[],string)']),
    args: [targets, values, calldatas, description],
  });
}

export function hashDescription(description: string): Hex {
  return stringToHex(description, { size: 32 });
}

// ============ GAS TRACKING ============

export class GasProfiler {
  private measurements: Map<string, bigint[]> = new Map();

  record(operation: string, gasUsed: bigint): void {
    if (!this.measurements.has(operation)) {
      this.measurements.set(operation, []);
    }
    this.measurements.get(operation)!.push(gasUsed);
  }

  getAverage(operation: string): bigint {
    const measurements = this.measurements.get(operation);
    if (!measurements || measurements.length === 0) {
      return BigInt(0);
    }
    
    const sum = measurements.reduce((a, b) => a + b, BigInt(0));
    return sum / BigInt(measurements.length);
  }

  getMin(operation: string): bigint {
    const measurements = this.measurements.get(operation);
    if (!measurements || measurements.length === 0) {
      return BigInt(0);
    }
    return measurements.reduce((a, b) => (a < b ? a : b));
  }

  getMax(operation: string): bigint {
    const measurements = this.measurements.get(operation);
    if (!measurements || measurements.length === 0) {
      return BigInt(0);
    }
    return measurements.reduce((a, b) => (a > b ? a : b));
  }

  generateReport(): string {
    const lines: string[] = [];
    lines.push('╔══════════════════════════════════════════════════════════╗');
    lines.push('║                    GAS USAGE REPORT                      ║');
    lines.push('╠══════════════════════════════════════════════════════════╣');
    lines.push('║ Operation              │ Avg      │ Min      │ Max      ║');
    lines.push('╠══════════════════════════════════════════════════════════╣');

    for (const [operation, measurements] of this.measurements) {
      const avg = this.getAverage(operation);
      const min = this.getMin(operation);
      const max = this.getMax(operation);
      
      lines.push(
        `║ ${operation.padEnd(22)} │ ${avg.toString().padStart(8)} │ ${min.toString().padStart(8)} │ ${max.toString().padStart(8)} ║`
      );
    }

    lines.push('╚══════════════════════════════════════════════════════════╝');
    return lines.join('\n');
  }
}

// ============ SNAPSHOT TESTING ============

export async function takeSnapshot(publicClient: PublicClient): Promise<string> {
  return await publicClient.request({
    method: 'anvil_snapshot',
    params: [],
  }) as string;
}

export async function revertToSnapshot(
  publicClient: PublicClient,
  snapshotId: string
): Promise<void> {
  await publicClient.request({
    method: 'anvil_revert',
    params: [snapshotId],
  });
}

// ============ MOCK FACTORIES ============

export function createMockContract(
  address: Address,
  abi: any,
  mockImplementation: Record<string, (...args: any[]) => any>
) {
  return {
    address,
    abi,
    read: new Proxy({}, {
      get: (_, prop: string) => {
        return async (...args: any[]) => {
          if (mockImplementation[prop]) {
            return mockImplementation[prop](...args);
          }
          return null;
        };
      },
    }),
    write: new Proxy({}, {
      get: (_, prop: string) => {
        return async (...args: any[]) => {
          if (mockImplementation[prop]) {
            return mockImplementation[prop](...args);
          }
          return '0xmocktxhash' as Hex;
        };
      },
    }),
  };
}

// ============ IPFS MOCK ============

export const mockIPFSUpload = async (data: any): Promise<string> => {
  // Simulate IPFS upload delay
  await new Promise(resolve => setTimeout(resolve, 100));
  return `Qm${Math.random().toString(36).substring(2, 46)}`;
};

export const mockIPFSDownload = async (hash: string): Promise<any> => {
  // Simulate IPFS download delay
  await new Promise(resolve => setTimeout(resolve, 50));
  return {
    title: 'Mock Title',
    description: 'Mock Description',
  };
};

// ============ ARAGON SDK MOCK ============

export const mockAragonClient = {
  methods: {
    createDAO: async () => ({
      daoAddress: '0x1234567890123456789012345678901234567890',
      pluginAddresses: ['0xabcdefabcdefabcdefabcdefabcdefabcdefabcd'],
    }),
    createProposal: async () => ({
      proposalId: BigInt(1),
      transactionHash: '0xmocktxhash',
    }),
    vote: async () => ({
      transactionHash: '0xmocktxhash',
    }),
    execute: async () => ({
      transactionHash: '0xmocktxhash',
    }),
  },
};
