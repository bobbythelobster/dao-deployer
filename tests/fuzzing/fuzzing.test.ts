/**
 * Fuzzing Tests for DAO Deployer
 * Randomized input testing for critical functions
 */

import { describe, it, expect, beforeAll, beforeEach } from 'bun:test';
import { type Address, type WalletClient, type PublicClient, parseEther, getContract, keccak256, stringToHex, maxUint256 } from 'viem';
import { getTestContext, takeSnapshot, revertToSnapshot } from '../setup';
import { 
  DAOFactoryABI, DAOFactoryBytecode,
  ProposalManagerABI, ProposalManagerBytecode,
  SoulBoundTokenABI, SoulBoundTokenBytecode,
  TaskMarketABI, TaskMarketBytecode
} from '../contracts/abis';
import { MOCK_ACCOUNTS, ProposalState, VoteType, TaskState } from '../mocks/data';
import { deployContract, findEventLog, expectTransactionRevert, advanceBlocks } from '../utils/helpers';

// Fuzzing utilities
function randomBigInt(min: bigint, max: bigint): bigint {
  const range = max - min;
  const randomBytes = new Uint8Array(32);
  crypto.getRandomValues(randomBytes);
  let result = BigInt(0);
  for (let i = 0; i < 32; i++) {
    result = (result << BigInt(8)) | BigInt(randomBytes[i]);
  }
  return min + (result % (range + BigInt(1)));
}

function randomInt(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function randomAddress(): Address {
  const bytes = new Uint8Array(20);
  crypto.getRandomValues(bytes);
  return ('0x' + Array.from(bytes).map(b => b.toString(16).padStart(2, '0')).join('')) as Address;
}

function randomString(length: number): string {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789!@#$%^&*()_+-=[]{}|;:,.<>?';
  let result = '';
  for (let i = 0; i < length; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
}

function randomBytes(length: number): `0x${string}` {
  const bytes = new Uint8Array(length);
  crypto.getRandomValues(bytes);
  return ('0x' + Array.from(bytes).map(b => b.toString(16).padStart(2, '0')).join('')) as `0x${string}`;
}

describe('Fuzzing Tests', () => {
  let context: ReturnType<typeof getTestContext>;
  let publicClient: PublicClient;
  let deployer: WalletClient;
  let alice: WalletClient;
  let bob: WalletClient;
  let snapshotId: string;

  beforeAll(async () => {
    context = getTestContext();
    publicClient = context.publicClient;
    deployer = context.walletClients.deployer;
    alice = context.walletClients.alice;
    bob = context.walletClients.bob;
  });

  beforeEach(async () => {
    snapshotId = await takeSnapshot(publicClient);
  });

  afterEach(async () => {
    await revertToSnapshot(publicClient, snapshotId);
  });

  describe('SoulBoundToken Fuzzing', () => {
    let tokenAddress: Address;

    beforeEach(async () => {
      tokenAddress = await deployContract(
        deployer,
        publicClient,
        SoulBoundTokenABI,
        SoulBoundTokenBytecode,
        ['Fuzz Token', 'FUZZ']
      );
    });

    it('should handle fuzzed mint amounts', async () => {
      const token = getContract({
        address: tokenAddress,
        abi: SoulBoundTokenABI,
        client: { public: publicClient, wallet: deployer },
      });

      const iterations = 50;
      let successCount = 0;
      let revertCount = 0;

      for (let i = 0; i < iterations; i++) {
        const amount = randomBigInt(BigInt(0), parseEther('1000000'));
        const to = randomAddress();

        try {
          const hash = await token.write.mint([to, amount]);
          await publicClient.waitForTransactionReceipt({ hash });
          successCount++;
        } catch (error: any) {
          // Expected for zero address or zero amount
          if (error.message?.match(/zero|invalid/i)) {
            revertCount++;
          } else {
            throw error; // Unexpected error
          }
        }
      }

      console.log(`   Mint fuzzing: ${successCount} success, ${revertCount} reverts (expected)`);
      expect(successCount + revertCount).toBe(iterations);
    });

    it('should handle fuzzed burn amounts', async () => {
      const token = getContract({
        address: tokenAddress,
        abi: SoulBoundTokenABI,
        client: { public: publicClient, wallet: deployer },
      });

      // First mint some tokens
      const initialMint = parseEther('1000');
      await token.write.mint([MOCK_ACCOUNTS[1].address, initialMint]);

      const iterations = 30;
      let successCount = 0;
      let revertCount = 0;

      for (let i = 0; i < iterations; i++) {
        const amount = randomBigInt(BigInt(1), parseEther('2000'));

        try {
          const hash = await token.write.burn([MOCK_ACCOUNTS[1].address, amount]);
          await publicClient.waitForTransactionReceipt({ hash });
          successCount++;
        } catch (error: any) {
          // Expected for insufficient balance
          if (error.message?.match(/insufficient|balance|exceeds/i)) {
            revertCount++;
          } else {
            throw error;
          }
        }
      }

      console.log(`   Burn fuzzing: ${successCount} success, ${revertCount} reverts (expected)`);
    });

    it('should handle fuzzed delegation targets', async () => {
      const token = getContract({
        address: tokenAddress,
        abi: SoulBoundTokenABI,
        client: { public: publicClient, wallet: deployer },
      });

      await token.write.mint([MOCK_ACCOUNTS[1].address, parseEther('100')]);

      const aliceToken = getContract({
        address: tokenAddress,
        abi: SoulBoundTokenABI,
        client: { public: publicClient, wallet: alice },
      });

      const iterations = 20;

      for (let i = 0; i < iterations; i++) {
        const delegatee = randomAddress();
        
        // Should not revert regardless of address
        const hash = await aliceToken.write.delegate([delegatee]);
        const receipt = await publicClient.waitForTransactionReceipt({ hash });
        expect(receipt.status).toBe('success');
      }
    });

    it('should maintain invariants under fuzzed operations', async () => {
      const token = getContract({
        address: tokenAddress,
        abi: SoulBoundTokenABI,
        client: { public: publicClient, wallet: deployer },
      });

      const operations = 100;
      let totalMinted = BigInt(0);
      let totalBurned = BigInt(0);

      for (let i = 0; i < operations; i++) {
        const operation = randomInt(0, 2);
        const amount = randomBigInt(BigInt(1), parseEther('100'));
        const to = MOCK_ACCOUNTS[randomInt(1, 4)].address;

        try {
          if (operation === 0) {
            // Mint
            const hash = await token.write.mint([to, amount]);
            await publicClient.waitForTransactionReceipt({ hash });
            totalMinted += amount;
          } else if (operation === 1) {
            // Burn (may fail if insufficient balance)
            const hash = await token.write.burn([to, amount]);
            await publicClient.waitForTransactionReceipt({ hash });
            totalBurned += amount;
          } else {
            // Delegate (always succeeds)
            const delegatee = MOCK_ACCOUNTS[randomInt(1, 4)].address;
            const delegateToken = getContract({
              address: tokenAddress,
              abi: SoulBoundTokenABI,
              client: { public: publicClient, wallet: context.walletClients[['alice', 'bob', 'carol', 'dave'][randomInt(0, 3)]] },
            });
            await delegateToken.write.delegate([delegatee]);
          }
        } catch {
          // Expected failures
        }
      }

      // Verify invariant: totalSupply = totalMinted - totalBurned
      const totalSupply = await token.read.totalSupply();
      expect(totalSupply).toBe(totalMinted - totalBurned);

      console.log(`   Operations: ${operations}, Minted: ${totalMinted}, Burned: ${totalBurned}`);
    });
  });

  describe('DAOFactory Fuzzing', () => {
    let factoryAddress: Address;

    beforeEach(async () => {
      factoryAddress = await deployContract(
        deployer,
        publicClient,
        DAOFactoryABI,
        DAOFactoryBytecode,
        ['0x1234567890123456789012345678901234567890']
      );
    });

    it('should handle fuzzed DAO configurations', async () => {
      const factory = getContract({
        address: factoryAddress,
        abi: DAOFactoryABI,
        client: { public: publicClient, wallet: deployer },
      });

      const iterations = 30;
      let successCount = 0;
      let revertCount = 0;

      for (let i = 0; i < iterations; i++) {
        const config = {
          name: randomString(randomInt(1, 100)),
          symbol: randomString(randomInt(1, 10)).toUpperCase(),
          metadata: randomString(randomInt(10, 100)),
          votingDelay: BigInt(randomInt(0, 1000)),
          votingPeriod: BigInt(randomInt(1, 10000)),
          proposalThreshold: randomBigInt(BigInt(1), parseEther('10000')),
          quorumNumerator: BigInt(randomInt(1, 100)),
        };

        try {
          const hash = await factory.write.createDAO([config]);
          await publicClient.waitForTransactionReceipt({ hash });
          successCount++;
        } catch (error: any) {
          if (error.message?.match(/invalid|zero|empty/i)) {
            revertCount++;
          } else {
            throw error;
          }
        }
      }

      console.log(`   DAO config fuzzing: ${successCount} success, ${revertCount} reverts`);
    });

    it('should handle fuzzed token distributions', async () => {
      const factory = getContract({
        address: factoryAddress,
        abi: DAOFactoryABI,
        client: { public: publicClient, wallet: deployer },
      });

      const iterations = 20;

      for (let i = 0; i < iterations; i++) {
        const holderCount = randomInt(1, 50);
        const holders: Address[] = [];
        const balances: bigint[] = [];

        for (let j = 0; j < holderCount; j++) {
          holders.push(randomAddress());
          balances.push(randomBigInt(BigInt(1), parseEther('10000')));
        }

        try {
          const hash = await factory.write.deployToken([
            `FuzzToken${i}`,
            `FUZZ${i}`,
            holders,
            balances,
          ]);
          const receipt = await publicClient.waitForTransactionReceipt({ hash });
          expect(receipt.status).toBe('success');
        } catch (error: any) {
          // Should not fail with valid inputs
          console.log(`   Failed with ${holderCount} holders: ${error.message}`);
          throw error;
        }
      }
    });
  });

  describe('ProposalManager Fuzzing', () => {
    let managerAddress: Address;
    let tokenAddress: Address;

    beforeEach(async () => {
      tokenAddress = await deployContract(
        deployer,
        publicClient,
        SoulBoundTokenABI,
        SoulBoundTokenBytecode,
        ['Gov Token', 'GOV']
      );

      const token = getContract({
        address: tokenAddress,
        abi: SoulBoundTokenABI,
        client: { public: publicClient, wallet: deployer },
      });

      // Distribute tokens
      for (let i = 1; i <= 4; i++) {
        await token.write.mint([MOCK_ACCOUNTS[i].address, parseEther('1000')]);
      }

      managerAddress = await deployContract(
        deployer,
        publicClient,
        ProposalManagerABI,
        ProposalManagerBytecode,
        [
          tokenAddress,
          1,
          100,
          parseEther('100'),
          40,
        ]
      );
    });

    it('should handle fuzzed proposal parameters', async () => {
      const manager = getContract({
        address: managerAddress,
        abi: ProposalManagerABI,
        client: { public: publicClient, wallet: alice },
      });

      const iterations = 40;
      let successCount = 0;
      let revertCount = 0;

      for (let i = 0; i < iterations; i++) {
        const actionCount = randomInt(1, 10);
        const targets: Address[] = [];
        const values: bigint[] = [];
        const calldatas: `0x${string}`[] = [];

        for (let j = 0; j < actionCount; j++) {
          targets.push(randomAddress());
          values.push(randomBigInt(BigInt(0), parseEther('10')));
          calldatas.push(randomBytes(randomInt(0, 100)));
        }

        const description = randomString(randomInt(10, 500));

        try {
          const hash = await manager.write.propose([targets, values, calldatas, description]);
          await publicClient.waitForTransactionReceipt({ hash });
          successCount++;
        } catch (error: any) {
          if (error.message?.match(/empty|mismatch|invalid/i)) {
            revertCount++;
          } else {
            throw error;
          }
        }
      }

      console.log(`   Proposal fuzzing: ${successCount} success, ${revertCount} reverts`);
    });

    it('should handle fuzzed voting patterns', async () => {
      const manager = getContract({
        address: managerAddress,
        abi: ProposalManagerABI,
        client: { public: publicClient, wallet: alice },
      });

      // Create a proposal
      const hash = await manager.write.propose([
        [MOCK_ACCOUNTS[0].address],
        [BigInt(0)],
        ['0x'],
        'Fuzz voting test',
      ]);
      const receipt = await publicClient.waitForTransactionReceipt({ hash });
      const event = findEventLog(receipt, ProposalManagerABI, 'ProposalCreated');

      await advanceBlocks(publicClient, 2);

      const voters = [alice, bob, carol, context.walletClients.dave];
      const iterations = 50;
      let votedCount = 0;

      for (let i = 0; i < iterations; i++) {
        const voter = voters[randomInt(0, voters.length - 1)];
        const voteType = randomInt(0, 2); // 0=Against, 1=For, 2=Abstain

        const voterManager = getContract({
          address: managerAddress,
          abi: ProposalManagerABI,
          client: { public: publicClient, wallet: voter },
        });

        try {
          const voteHash = await voterManager.write.castVote([event.proposalId, voteType]);
          await publicClient.waitForTransactionReceipt({ hash: voteHash });
          votedCount++;
        } catch (error: any) {
          // Expected for already voted
          if (!error.message?.match(/already voted|voting closed/i)) {
            throw error;
          }
        }
      }

      // Get final vote counts
      const proposal = await manager.read.proposals([event.proposalId]);
      const totalVotes = proposal.forVotes + proposal.againstVotes + proposal.abstainVotes;

      console.log(`   Voting fuzzing: ${votedCount} votes cast, total weight: ${totalVotes}`);
    });
  });

  describe('TaskMarket Fuzzing', () => {
    let marketAddress: Address;

    beforeEach(async () => {
      marketAddress = await deployContract(
        deployer,
        publicClient,
        TaskMarketABI,
        TaskMarketBytecode,
        [250]
      );
    });

    it('should handle fuzzed task parameters', async () => {
      const market = getContract({
        address: marketAddress,
        abi: TaskMarketABI,
        client: { public: publicClient, wallet: alice },
      });

      const iterations = 30;
      let successCount = 0;
      let revertCount = 0;

      for (let i = 0; i < iterations; i++) {
        const title = randomString(randomInt(1, 100));
        const description = randomString(randomInt(20, 500));
        const ipfsHash = `Qm${randomString(44)}`;
        const deadline = BigInt(Math.floor(Date.now() / 1000) + randomInt(3600, 30 * 86400));
        const budget = randomBigInt(BigInt(1), parseEther('10'));

        try {
          const hash = await market.write.createTask(
            [title, description, ipfsHash, deadline],
            { value: budget }
          );
          await publicClient.waitForTransactionReceipt({ hash });
          successCount++;
        } catch (error: any) {
          if (error.message?.match(/empty|past|zero|invalid/i)) {
            revertCount++;
          } else {
            throw error;
          }
        }
      }

      console.log(`   Task creation fuzzing: ${successCount} success, ${revertCount} reverts`);
    });

    it('should handle fuzzed bid parameters', async () => {
      const aliceMarket = getContract({
        address: marketAddress,
        abi: TaskMarketABI,
        client: { public: publicClient, wallet: alice },
      });

      // Create a task first
      const hash = await aliceMarket.write.createTask(
        ['Fuzz Task', 'Description', 'Qm', BigInt(Math.floor(Date.now() / 1000) + 7 * 86400)],
        { value: parseEther('1') }
      );
      const receipt = await publicClient.waitForTransactionReceipt({ hash });
      const event = findEventLog(receipt, TaskMarketABI, 'TaskCreated');

      const bobMarket = getContract({
        address: marketAddress,
        abi: TaskMarketABI,
        client: { public: publicClient, wallet: bob },
      });

      const iterations = 30;
      let successCount = 0;
      let revertCount = 0;

      for (let i = 0; i < iterations; i++) {
        const amount = randomBigInt(BigInt(1), parseEther('2'));
        const proposal = randomString(randomInt(10, 200));

        try {
          const bidHash = await bobMarket.write.submitBid([event.taskId, amount, proposal]);
          await publicClient.waitForTransactionReceipt({ hash: bidHash });
          successCount++;
        } catch (error: any) {
          if (error.message?.match(/exceeds|too high|not open/i)) {
            revertCount++;
          } else {
            throw error;
          }
        }
      }

      console.log(`   Bid fuzzing: ${successCount} success, ${revertCount} reverts`);
    });
  });

  describe('State Transition Fuzzing', () => {
    it('should maintain valid state through random operation sequences', async () => {
      // Deploy full system
      const tokenAddress = await deployContract(
        deployer,
        publicClient,
        SoulBoundTokenABI,
        SoulBoundTokenBytecode,
        ['State Token', 'STATE']
      );

      const token = getContract({
        address: tokenAddress,
        abi: SoulBoundTokenABI,
        client: { public: publicClient, wallet: deployer },
      });

      await token.write.mint([MOCK_ACCOUNTS[1].address, parseEther('1000')]);
      await token.write.mint([MOCK_ACCOUNTS[2].address, parseEther('1000')]);

      const managerAddress = await deployContract(
        deployer,
        publicClient,
        ProposalManagerABI,
        ProposalManagerBytecode,
        [
          tokenAddress,
          1,
          50,
          parseEther('100'),
          40,
        ]
      );

      const manager = getContract({
        address: managerAddress,
        abi: ProposalManagerABI,
        client: { public: publicClient, wallet: alice },
      });

      const operations = 100;
      const proposals: bigint[] = [];

      for (let i = 0; i < operations; i++) {
        const operation = randomInt(0, 4);

        try {
          switch (operation) {
            case 0: // Create proposal
              const hash = await manager.write.propose([
                [MOCK_ACCOUNTS[0].address],
                [BigInt(0)],
                ['0x'],
                `Fuzz Proposal ${i}`,
              ]);
              const receipt = await publicClient.waitForTransactionReceipt({ hash });
              const event = findEventLog(receipt, ProposalManagerABI, 'ProposalCreated');
              proposals.push(event.proposalId);
              break;

            case 1: // Vote
              if (proposals.length > 0) {
                const proposalId = proposals[randomInt(0, proposals.length - 1)];
                const voteType = randomInt(0, 2);
                const voter = [alice, bob][randomInt(0, 1)];
                
                const voterManager = getContract({
                  address: managerAddress,
                  abi: ProposalManagerABI,
                  client: { public: publicClient, wallet: voter },
                });
                
                await voterManager.write.castVote([proposalId, voteType]);
              }
              break;

            case 2: // Advance blocks
              await advanceBlocks(publicClient, randomInt(1, 10));
              break;

            case 3: // Check state
              if (proposals.length > 0) {
                const checkId = proposals[randomInt(0, proposals.length - 1)];
                const state = await manager.read.state([checkId]);
                expect(state).toBeGreaterThanOrEqual(0);
                expect(state).toBeLessThanOrEqual(7); // Max state value
              }
              break;

            case 4: // Get proposal info
              if (proposals.length > 0) {
                const infoId = proposals[randomInt(0, proposals.length - 1)];
                const proposal = await manager.read.proposals([infoId]);
                expect(proposal).toBeDefined();
              }
              break;
          }
        } catch (error: any) {
          // Expected failures
          if (!error.message?.match(/already voted|voting closed|not executable|invalid/i)) {
            console.log(`   Unexpected error in operation ${i}: ${error.message}`);
          }
        }
      }

      // Final state verification
      for (const proposalId of proposals) {
        const state = await manager.read.state([proposalId]);
        expect([0, 1, 2, 3, 4, 5, 6, 7]).toContain(state);
      }

      console.log(`   State fuzzing: ${proposals.length} proposals, ${operations} operations`);
    });
  });

  describe('Invariant Fuzzing', () => {
    it('should maintain token balance invariants', async () => {
      const tokenAddress = await deployContract(
        deployer,
        publicClient,
        SoulBoundTokenABI,
        SoulBoundTokenBytecode,
        ['Invariant Token', 'INV']
      );

      const token = getContract({
        address: tokenAddress,
        abi: SoulBoundTokenABI,
        client: { public: publicClient, wallet: deployer },
      });

      const accounts = [1, 2, 3, 4];
      const initialBalances: Map<number, bigint> = new Map();

      // Initialize with random balances
      for (const acc of accounts) {
        const amount = randomBigInt(BigInt(1), parseEther('1000'));
        await token.write.mint([MOCK_ACCOUNTS[acc].address, amount]);
        initialBalances.set(acc, amount);
      }

      // Perform random operations
      const operations = 50;
      for (let i = 0; i < operations; i++) {
        const acc = accounts[randomInt(0, accounts.length - 1)];
        const operation = randomInt(0, 2);

        try {
          if (operation === 0) {
            // Mint more
            const amount = randomBigInt(BigInt(1), parseEther('100'));
            await token.write.mint([MOCK_ACCOUNTS[acc].address, amount]);
            initialBalances.set(acc, (initialBalances.get(acc) || BigInt(0)) + amount);
          } else if (operation === 1) {
            // Burn some
            const current = await token.read.balanceOf([MOCK_ACCOUNTS[acc].address]);
            if (current > BigInt(0)) {
              const amount = randomBigInt(BigInt(1), current);
              await token.write.burn([MOCK_ACCOUNTS[acc].address, amount]);
              initialBalances.set(acc, (initialBalances.get(acc) || BigInt(0)) - amount);
            }
          }
        } catch {
          // Expected failures
        }
      }

      // Verify invariants
      let totalBalance = BigInt(0);
      for (const acc of accounts) {
        const balance = await token.read.balanceOf([MOCK_ACCOUNTS[acc].address]);
        totalBalance += balance;
      }

      const totalSupply = await token.read.totalSupply();
      expect(totalSupply).toBe(totalBalance);

      const expectedTotal = Array.from(initialBalances.values()).reduce((a, b) => a + b, BigInt(0));
      expect(totalSupply).toBe(expectedTotal);

      console.log(`   Invariant check passed: totalSupply=${totalSupply}, sum of balances=${totalBalance}`);
    });
  });
});
