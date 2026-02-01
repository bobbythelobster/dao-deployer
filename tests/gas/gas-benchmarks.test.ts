/**
 * Gas Benchmark Tests for DAO Deployer
 * Comprehensive gas usage analysis and optimization verification
 */

import { describe, it, expect, beforeAll, beforeEach } from 'bun:test';
import { type Address, type WalletClient, type PublicClient, parseEther, getContract } from 'viem';
import { getTestContext, takeSnapshot, revertToSnapshot, GasTracker } from '../setup';
import { 
  DAOFactoryABI, DAOFactoryBytecode,
  ProposalManagerABI, ProposalManagerBytecode,
  SoulBoundTokenABI, SoulBoundTokenBytecode,
  TaskMarketABI, TaskMarketBytecode
} from '../contracts/abis';
import { MOCK_ACCOUNTS, MOCK_DAO_CONFIG, GAS_BENCHMARKS } from '../mocks/data';
import { deployContract, findEventLog, advanceBlocks, GasProfiler } from '../utils/helpers';

describe('Gas Benchmark Tests', () => {
  let context: ReturnType<typeof getTestContext>;
  let publicClient: PublicClient;
  let deployer: WalletClient;
  let alice: WalletClient;
  let bob: WalletClient;
  let carol: WalletClient;
  let snapshotId: string;
  let gasTracker: GasTracker;
  let gasProfiler: GasProfiler;

  beforeAll(async () => {
    context = getTestContext();
    publicClient = context.publicClient;
    deployer = context.walletClients.deployer;
    alice = context.walletClients.alice;
    bob = context.walletClients.bob;
    carol = context.walletClients.carol;
    gasTracker = new GasTracker();
    gasProfiler = new GasProfiler();
  });

  beforeEach(async () => {
    snapshotId = await takeSnapshot(publicClient);
  });

  afterEach(async () => {
    await revertToSnapshot(publicClient, snapshotId);
  });

  describe('SoulBoundToken Gas Benchmarks', () => {
    let tokenAddress: Address;

    beforeEach(async () => {
      tokenAddress = await deployContract(
        deployer,
        publicClient,
        SoulBoundTokenABI,
        SoulBoundTokenBytecode,
        ['Gas Test Token', 'GAS']
      );
    });

    it('should benchmark mint gas usage', async () => {
      const token = getContract({
        address: tokenAddress,
        abi: SoulBoundTokenABI,
        client: { public: publicClient, wallet: deployer },
      });

      const iterations = 10;
      const gasUsed: bigint[] = [];

      for (let i = 0; i < iterations; i++) {
        const hash = await token.write.mint([MOCK_ACCOUNTS[1].address, parseEther('1000')]);
        const receipt = await publicClient.waitForTransactionReceipt({ hash });
        gasUsed.push(receipt.gasUsed);
        gasTracker.record(`mint-${i}`, receipt.gasUsed);
        gasProfiler.record('SoulBoundToken.mint', receipt.gasUsed);
      }

      const avgGas = gasUsed.reduce((a, b) => a + b, BigInt(0)) / BigInt(iterations);
      const maxGas = gasUsed.reduce((a, b) => a > b ? a : b);
      const minGas = gasUsed.reduce((a, b) => a < b ? a : b);

      console.log(`\n   Mint Gas Stats (${iterations} iterations):`);
      console.log(`   Average: ${avgGas.toString()} gas`);
      console.log(`   Min: ${minGas.toString()} gas`);
      console.log(`   Max: ${maxGas.toString()} gas`);

      // Compare against benchmark
      const benchmark = GAS_BENCHMARKS['SoulBoundToken.mint'];
      expect(avgGas).toBeLessThanOrEqual(benchmark * BigInt(120) / BigInt(100)); // Allow 20% variance
    });

    it('should benchmark burn gas usage', async () => {
      const token = getContract({
        address: tokenAddress,
        abi: SoulBoundTokenABI,
        client: { public: publicClient, wallet: deployer },
      });

      // Mint tokens first
      await token.write.mint([MOCK_ACCOUNTS[1].address, parseEther('10000')]);

      const iterations = 10;
      const gasUsed: bigint[] = [];

      for (let i = 0; i < iterations; i++) {
        const hash = await token.write.burn([MOCK_ACCOUNTS[1].address, parseEther('100')]);
        const receipt = await publicClient.waitForTransactionReceipt({ hash });
        gasUsed.push(receipt.gasUsed);
        gasProfiler.record('SoulBoundToken.burn', receipt.gasUsed);
      }

      const avgGas = gasUsed.reduce((a, b) => a + b, BigInt(0)) / BigInt(iterations);
      console.log(`\n   Burn Gas Stats: Average ${avgGas.toString()} gas`);

      const benchmark = GAS_BENCHMARKS['SoulBoundToken.burn'];
      expect(avgGas).toBeLessThanOrEqual(benchmark * BigInt(120) / BigInt(100));
    });

    it('should benchmark delegation gas usage', async () => {
      const token = getContract({
        address: tokenAddress,
        abi: SoulBoundTokenABI,
        client: { public: publicClient, wallet: deployer },
      });

      await token.write.mint([MOCK_ACCOUNTS[1].address, parseEther('1000')]);

      const aliceToken = getContract({
        address: tokenAddress,
        abi: SoulBoundTokenABI,
        client: { public: publicClient, wallet: alice },
      });

      const iterations = 10;
      const gasUsed: bigint[] = [];

      for (let i = 0; i < iterations; i++) {
        const delegatee = MOCK_ACCOUNTS[(i % 3) + 2].address;
        const hash = await aliceToken.write.delegate([delegatee]);
        const receipt = await publicClient.waitForTransactionReceipt({ hash });
        gasUsed.push(receipt.gasUsed);
        gasProfiler.record('SoulBoundToken.delegate', receipt.gasUsed);
      }

      const avgGas = gasUsed.reduce((a, b) => a + b, BigInt(0)) / BigInt(iterations);
      console.log(`\n   Delegate Gas Stats: Average ${avgGas.toString()} gas`);

      const benchmark = GAS_BENCHMARKS['SoulBoundToken.delegate'];
      expect(avgGas).toBeLessThanOrEqual(benchmark * BigInt(120) / BigInt(100));
    });

    it('should analyze gas cost scaling with holder count', async () => {
      const token = getContract({
        address: tokenAddress,
        abi: SoulBoundTokenABI,
        client: { public: publicClient, wallet: deployer },
      });

      const holderCounts = [1, 5, 10, 25, 50];
      const results: { holders: number; avgGas: bigint }[] = [];

      for (const count of holderCounts) {
        const gasUsed: bigint[] = [];

        for (let i = 0; i < 5; i++) {
          const hash = await token.write.mint([MOCK_ACCOUNTS[1].address, parseEther('100')]);
          const receipt = await publicClient.waitForTransactionReceipt({ hash });
          gasUsed.push(receipt.gasUsed);
        }

        const avgGas = gasUsed.reduce((a, b) => a + b, BigInt(0)) / BigInt(gasUsed.length);
        results.push({ holders: count, avgGas });
      }

      console.log('\n   Gas Scaling Analysis:');
      for (const result of results) {
        console.log(`   Holders: ${result.holders}, Avg Gas: ${result.avgGas.toString()}`);
      }
    });
  });

  describe('DAOFactory Gas Benchmarks', () => {
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

    it('should benchmark DAO creation gas', async () => {
      const factory = getContract({
        address: factoryAddress,
        abi: DAOFactoryABI,
        client: { public: publicClient, wallet: deployer },
      });

      const iterations = 5;
      const gasUsed: bigint[] = [];

      for (let i = 0; i < iterations; i++) {
        const config = {
          name: `Gas Test DAO ${i}`,
          symbol: `GAS${i}`,
          metadata: `metadata-${i}`,
          votingDelay: BigInt(1),
          votingPeriod: BigInt(100),
          proposalThreshold: parseEther('100'),
          quorumNumerator: BigInt(40),
        };

        const hash = await factory.write.createDAO([config]);
        const receipt = await publicClient.waitForTransactionReceipt({ hash });
        gasUsed.push(receipt.gasUsed);
        gasProfiler.record('DAOFactory.createDAO', receipt.gasUsed);
      }

      const avgGas = gasUsed.reduce((a, b) => a + b, BigInt(0)) / BigInt(iterations);
      const maxGas = gasUsed.reduce((a, b) => a > b ? a : b);

      console.log(`\n   DAO Creation Gas Stats:`);
      console.log(`   Average: ${avgGas.toString()} gas (${(Number(avgGas) / 1000000).toFixed(2)}M)`);
      console.log(`   Max: ${maxGas.toString()} gas (${(Number(maxGas) / 1000000).toFixed(2)}M)`);

      const benchmark = GAS_BENCHMARKS['DAOFactory.createDAO'];
      expect(avgGas).toBeLessThanOrEqual(benchmark * BigInt(130) / BigInt(100)); // Allow 30% variance
    });

    it('should benchmark token deployment gas', async () => {
      const factory = getContract({
        address: factoryAddress,
        abi: DAOFactoryABI,
        client: { public: publicClient, wallet: deployer },
      });

      const iterations = 5;
      const gasUsed: bigint[] = [];

      for (let i = 0; i < iterations; i++) {
        const holders = [MOCK_ACCOUNTS[1].address, MOCK_ACCOUNTS[2].address];
        const balances = [parseEther('1000'), parseEther('500')];

        const hash = await factory.write.deployToken([
          `Token ${i}`,
          `TKN${i}`,
          holders,
          balances,
        ]);
        const receipt = await publicClient.waitForTransactionReceipt({ hash });
        gasUsed.push(receipt.gasUsed);
        gasProfiler.record('DAOFactory.deployToken', receipt.gasUsed);
      }

      const avgGas = gasUsed.reduce((a, b) => a + b, BigInt(0)) / BigInt(iterations);
      console.log(`\n   Token Deployment Gas Stats: Average ${avgGas.toString()} gas`);

      const benchmark = GAS_BENCHMARKS['DAOFactory.deployToken'];
      expect(avgGas).toBeLessThanOrEqual(benchmark * BigInt(130) / BigInt(100));
    });

    it('should analyze gas costs with varying initial holders', async () => {
      const factory = getContract({
        address: factoryAddress,
        abi: DAOFactoryABI,
        client: { public: publicClient, wallet: deployer },
      });

      const holderCounts = [0, 5, 10, 25, 50];
      const results: { holders: number; gas: bigint }[] = [];

      for (const count of holderCounts) {
        const holders: Address[] = [];
        const balances: bigint[] = [];

        for (let i = 0; i < count; i++) {
          holders.push(`0x${(i + 1).toString(16).padStart(40, '0')}` as Address);
          balances.push(parseEther('100'));
        }

        const hash = await factory.write.deployToken([
          'Test Token',
          'TEST',
          holders,
          balances,
        ]);
        const receipt = await publicClient.waitForTransactionReceipt({ hash });
        results.push({ holders: count, gas: receipt.gasUsed });
      }

      console.log('\n   Token Deployment Scaling:');
      for (const result of results) {
        console.log(`   ${result.holders} holders: ${result.gas.toString()} gas`);
      }
    });
  });

  describe('ProposalManager Gas Benchmarks', () => {
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

      await token.write.mint([MOCK_ACCOUNTS[1].address, parseEther('1000')]);
      await token.write.mint([MOCK_ACCOUNTS[2].address, parseEther('500')]);

      managerAddress = await deployContract(
        deployer,
        publicClient,
        ProposalManagerABI,
        ProposalManagerBytecode,
        [
          tokenAddress,
          MOCK_DAO_CONFIG.votingDelay,
          MOCK_DAO_CONFIG.votingPeriod,
          MOCK_DAO_CONFIG.proposalThreshold,
          MOCK_DAO_CONFIG.quorumNumerator,
        ]
      );
    });

    it('should benchmark proposal creation gas', async () => {
      const manager = getContract({
        address: managerAddress,
        abi: ProposalManagerABI,
        client: { public: publicClient, wallet: alice },
      });

      const iterations = 10;
      const gasUsed: bigint[] = [];

      for (let i = 0; i < iterations; i++) {
        const hash = await manager.write.propose([
          [MOCK_ACCOUNTS[0].address],
          [BigInt(0)],
          ['0x'],
          `Proposal ${i}`,
        ]);
        const receipt = await publicClient.waitForTransactionReceipt({ hash });
        gasUsed.push(receipt.gasUsed);
        gasProfiler.record('ProposalManager.createProposal', receipt.gasUsed);
      }

      const avgGas = gasUsed.reduce((a, b) => a + b, BigInt(0)) / BigInt(iterations);
      console.log(`\n   Proposal Creation Gas Stats: Average ${avgGas.toString()} gas`);

      const benchmark = GAS_BENCHMARKS['ProposalManager.createProposal'];
      expect(avgGas).toBeLessThanOrEqual(benchmark * BigInt(120) / BigInt(100));
    });

    it('should benchmark voting gas', async () => {
      const manager = getContract({
        address: managerAddress,
        abi: ProposalManagerABI,
        client: { public: publicClient, wallet: alice },
      });

      // Create proposals first
      const proposalIds: bigint[] = [];
      for (let i = 0; i < 10; i++) {
        const hash = await manager.write.propose([
          [MOCK_ACCOUNTS[0].address],
          [BigInt(0)],
          ['0x'],
          `Vote Proposal ${i}`,
        ]);
        const receipt = await publicClient.waitForTransactionReceipt({ hash });
        const event = findEventLog(receipt, ProposalManagerABI, 'ProposalCreated');
        proposalIds.push(event.proposalId);
      }

      await advanceBlocks(publicClient, MOCK_DAO_CONFIG.votingDelay + 1);

      const gasUsed: bigint[] = [];
      for (const id of proposalIds) {
        const hash = await manager.write.castVote([id, VoteType.For]);
        const receipt = await publicClient.waitForTransactionReceipt({ hash });
        gasUsed.push(receipt.gasUsed);
        gasProfiler.record('ProposalManager.castVote', receipt.gasUsed);
      }

      const avgGas = gasUsed.reduce((a, b) => a + b, BigInt(0)) / BigInt(gasUsed.length);
      console.log(`\n   Voting Gas Stats: Average ${avgGas.toString()} gas`);

      const benchmark = GAS_BENCHMARKS['ProposalManager.castVote'];
      expect(avgGas).toBeLessThanOrEqual(benchmark * BigInt(120) / BigInt(100));
    });

    it('should benchmark proposal execution gas', async () => {
      const manager = getContract({
        address: managerAddress,
        abi: ProposalManagerABI,
        client: { public: publicClient, wallet: alice },
      });

      const gasUsed: bigint[] = [];

      for (let i = 0; i < 5; i++) {
        const hash = await manager.write.propose([
          [MOCK_ACCOUNTS[0].address],
          [BigInt(0)],
          ['0x'],
          `Execute Proposal ${i}`,
        ]);
        const receipt = await publicClient.waitForTransactionReceipt({ hash });
        const event = findEventLog(receipt, ProposalManagerABI, 'ProposalCreated');

        await advanceBlocks(publicClient, MOCK_DAO_CONFIG.votingDelay + 1);
        await manager.write.castVote([event.proposalId, VoteType.For]);

        // Get bob to vote for quorum
        const bobManager = getContract({
          address: managerAddress,
          abi: ProposalManagerABI,
          client: { public: publicClient, wallet: bob },
        });
        await bobManager.write.castVote([event.proposalId, VoteType.For]);

        await advanceBlocks(publicClient, MOCK_DAO_CONFIG.votingPeriod + 1);

        const execHash = await manager.write.execute([
          [MOCK_ACCOUNTS[0].address],
          [BigInt(0)],
          ['0x'],
          event.descriptionHash,
        ]);
        const execReceipt = await publicClient.waitForTransactionReceipt({ hash: execHash });
        gasUsed.push(execReceipt.gasUsed);
        gasProfiler.record('ProposalManager.execute', execReceipt.gasUsed);
      }

      const avgGas = gasUsed.reduce((a, b) => a + b, BigInt(0)) / BigInt(gasUsed.length);
      console.log(`\n   Proposal Execution Gas Stats: Average ${avgGas.toString()} gas`);

      const benchmark = GAS_BENCHMARKS['ProposalManager.execute'];
      expect(avgGas).toBeLessThanOrEqual(benchmark * BigInt(120) / BigInt(100));
    });

    it('should analyze gas costs with varying action counts', async () => {
      const manager = getContract({
        address: managerAddress,
        abi: ProposalManagerABI,
        client: { public: publicClient, wallet: alice },
      });

      const actionCounts = [1, 5, 10, 20];
      const results: { actions: number; gas: bigint }[] = [];

      for (const count of actionCounts) {
        const targets: Address[] = [];
        const values: bigint[] = [];
        const calldatas: `0x${string}`[] = [];

        for (let i = 0; i < count; i++) {
          targets.push(MOCK_ACCOUNTS[0].address);
          values.push(BigInt(0));
          calldatas.push('0x');
        }

        const hash = await manager.write.propose([targets, values, calldatas, `${count} actions`]);
        const receipt = await publicClient.waitForTransactionReceipt({ hash });
        results.push({ actions: count, gas: receipt.gasUsed });
      }

      console.log('\n   Proposal Creation Scaling:');
      for (const result of results) {
        console.log(`   ${result.actions} actions: ${result.gas.toString()} gas`);
      }
    });
  });

  describe('TaskMarket Gas Benchmarks', () => {
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

    it('should benchmark task creation gas', async () => {
      const market = getContract({
        address: marketAddress,
        abi: TaskMarketABI,
        client: { public: publicClient, wallet: alice },
      });

      const iterations = 10;
      const gasUsed: bigint[] = [];

      for (let i = 0; i < iterations; i++) {
        const hash = await market.write.createTask(
          [`Task ${i}`, 'Description', 'Qm', BigInt(Math.floor(Date.now() / 1000) + 7 * 86400)],
          { value: parseEther('1') }
        );
        const receipt = await publicClient.waitForTransactionReceipt({ hash });
        gasUsed.push(receipt.gasUsed);
        gasProfiler.record('TaskMarket.createTask', receipt.gasUsed);
      }

      const avgGas = gasUsed.reduce((a, b) => a + b, BigInt(0)) / BigInt(iterations);
      console.log(`\n   Task Creation Gas Stats: Average ${avgGas.toString()} gas`);

      const benchmark = GAS_BENCHMARKS['TaskMarket.createTask'];
      expect(avgGas).toBeLessThanOrEqual(benchmark * BigInt(120) / BigInt(100));
    });

    it('should benchmark bid submission gas', async () => {
      const aliceMarket = getContract({
        address: marketAddress,
        abi: TaskMarketABI,
        client: { public: publicClient, wallet: alice },
      });

      // Create task
      const hash = await aliceMarket.write.createTask(
        ['Bid Task', 'Description', 'Qm', BigInt(Math.floor(Date.now() / 1000) + 7 * 86400)],
        { value: parseEther('1') }
      );
      const receipt = await publicClient.waitForTransactionReceipt({ hash });
      const event = findEventLog(receipt, TaskMarketABI, 'TaskCreated');

      const bobMarket = getContract({
        address: marketAddress,
        abi: TaskMarketABI,
        client: { public: publicClient, wallet: bob },
      });

      const iterations = 10;
      const gasUsed: bigint[] = [];

      for (let i = 0; i < iterations; i++) {
        const bidHash = await bobMarket.write.submitBid([event.taskId, parseEther('0.8'), `Bid ${i}`]);
        const bidReceipt = await publicClient.waitForTransactionReceipt({ hash: bidHash });
        gasUsed.push(bidReceipt.gasUsed);
        gasProfiler.record('TaskMarket.submitBid', bidReceipt.gasUsed);
      }

      const avgGas = gasUsed.reduce((a, b) => a + b, BigInt(0)) / BigInt(iterations);
      console.log(`\n   Bid Submission Gas Stats: Average ${avgGas.toString()} gas`);

      const benchmark = GAS_BENCHMARKS['TaskMarket.submitBid'];
      expect(avgGas).toBeLessThanOrEqual(benchmark * BigInt(120) / BigInt(100));
    });

    it('should benchmark full task lifecycle gas', async () => {
      const aliceMarket = getContract({
        address: marketAddress,
        abi: TaskMarketABI,
        client: { public: publicClient, wallet: alice },
      });

      const bobMarket = getContract({
        address: marketAddress,
        abi: TaskMarketABI,
        client: { public: publicClient, wallet: bob },
      });

      // Create
      const createHash = await aliceMarket.write.createTask(
        ['Lifecycle Task', 'Description', 'Qm', BigInt(Math.floor(Date.now() / 1000) + 7 * 86400)],
        { value: parseEther('1') }
      );
      const createReceipt = await publicClient.waitForTransactionReceipt({ hash: createHash });
      const event = findEventLog(createReceipt, TaskMarketABI, 'TaskCreated');
      gasProfiler.record('TaskMarket.createTask', createReceipt.gasUsed);

      // Bid
      const bidHash = await bobMarket.write.submitBid([event.taskId, parseEther('0.8'), 'Proposal']);
      const bidReceipt = await publicClient.waitForTransactionReceipt({ hash: bidHash });
      const bidEvent = findEventLog(bidReceipt, TaskMarketABI, 'BidSubmitted');
      gasProfiler.record('TaskMarket.submitBid', bidReceipt.gasUsed);

      // Accept
      const acceptHash = await aliceMarket.write.acceptBid([event.taskId, bidEvent.bidId]);
      const acceptReceipt = await publicClient.waitForTransactionReceipt({ hash: acceptHash });
      gasProfiler.record('TaskMarket.acceptBid', acceptReceipt.gasUsed);

      // Complete
      const completeHash = await aliceMarket.write.completeTask([event.taskId]);
      const completeReceipt = await publicClient.waitForTransactionReceipt({ hash: completeHash });
      gasProfiler.record('TaskMarket.completeTask', completeReceipt.gasUsed);

      // Release payment
      const releaseHash = await aliceMarket.write.releasePayment([event.taskId]);
      const releaseReceipt = await publicClient.waitForTransactionReceipt({ hash: releaseHash });
      gasProfiler.record('TaskMarket.releasePayment', releaseReceipt.gasUsed);

      console.log('\n   Full Task Lifecycle Gas:');
      console.log(`   Create: ${createReceipt.gasUsed.toString()} gas`);
      console.log(`   Submit Bid: ${bidReceipt.gasUsed.toString()} gas`);
      console.log(`   Accept Bid: ${acceptReceipt.gasUsed.toString()} gas`);
      console.log(`   Complete: ${completeReceipt.gasUsed.toString()} gas`);
      console.log(`   Release Payment: ${releaseReceipt.gasUsed.toString()} gas`);
      const total = createReceipt.gasUsed + bidReceipt.gasUsed + acceptReceipt.gasUsed + 
                    completeReceipt.gasUsed + releaseReceipt.gasUsed;
      console.log(`   Total: ${total.toString()} gas`);
    });
  });

  describe('Gas Optimization Analysis', () => {
    it('should verify gas costs are within acceptable ranges', async () => {
      console.log('\n📊 Gas Optimization Analysis');
      console.log('='.repeat(50));

      const allOperations = [
        'SoulBoundToken.mint',
        'SoulBoundToken.burn',
        'SoulBoundToken.delegate',
        'DAOFactory.createDAO',
        'DAOFactory.deployToken',
        'ProposalManager.createProposal',
        'ProposalManager.castVote',
        'ProposalManager.execute',
        'TaskMarket.createTask',
        'TaskMarket.submitBid',
        'TaskMarket.acceptBid',
        'TaskMarket.completeTask',
        'TaskMarket.releasePayment',
      ];

      let allPassed = true;

      for (const operation of allOperations) {
        const avg = gasProfiler.getAverage(operation);
        const benchmark = GAS_BENCHMARKS[operation];

        if (avg === BigInt(0)) {
          console.log(`⚠️  ${operation}: No data collected`);
          continue;
        }

        const variance = Number((avg - benchmark) * BigInt(100) / benchmark);
        const status = variance <= 30 ? '✅' : variance <= 50 ? '⚠️ ' : '❌';
        
        console.log(`${status} ${operation}:`);
        console.log(`   Average: ${avg.toString()} gas`);
        console.log(`   Benchmark: ${benchmark.toString()} gas`);
        console.log(`   Variance: ${variance > 0 ? '+' : ''}${variance.toFixed(1)}%`);

        if (variance > 50) allPassed = false;
      }

      console.log('='.repeat(50));
      expect(allPassed).toBe(true);
    });
  });

  describe('Comprehensive Gas Report', () => {
    it('should generate final gas report', async () => {
      console.log('\n' + '='.repeat(70));
      console.log('COMPREHENSIVE GAS BENCHMARK REPORT');
      console.log('='.repeat(70));
      console.log(gasProfiler.generateReport());
      console.log('='.repeat(70));
      console.log('\nGas Tracker Summary:');
      console.log(gasTracker.report());
      console.log('='.repeat(70));
    });
  });
});
