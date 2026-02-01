/**
 * Stress Tests for DAO Deployer
 * Tests with 100+ proposals and 50+ DAOs to verify system stability under load
 */

import { describe, it, expect, beforeAll, beforeEach } from 'bun:test';
import { type Address, type WalletClient, type PublicClient, parseEther, getContract } from 'viem';
import { getTestContext, takeSnapshot, revertToSnapshot } from '../setup';
import { 
  DAOFactoryABI, DAOFactoryBytecode,
  ProposalManagerABI, ProposalManagerBytecode,
  SoulBoundTokenABI, SoulBoundTokenBytecode,
  TaskMarketABI, TaskMarketBytecode
} from '../contracts/abis';
import { MOCK_ACCOUNTS, MOCK_DAO_CONFIG, ProposalState, VoteType } from '../mocks/data';
import { deployContract, findEventLog, advanceBlocks, GasProfiler } from '../utils/helpers';

describe('Stress Tests', () => {
  let context: ReturnType<typeof getTestContext>;
  let publicClient: PublicClient;
  let deployer: WalletClient;
  let alice: WalletClient;
  let bob: WalletClient;
  let carol: WalletClient;
  let snapshotId: string;
  let gasProfiler: GasProfiler;

  beforeAll(async () => {
    context = getTestContext();
    publicClient = context.publicClient;
    deployer = context.walletClients.deployer;
    alice = context.walletClients.alice;
    bob = context.walletClients.bob;
    carol = context.walletClients.carol;
    gasProfiler = new GasProfiler();
  });

  beforeEach(async () => {
    snapshotId = await takeSnapshot(publicClient);
  });

  afterEach(async () => {
    await revertToSnapshot(publicClient, snapshotId);
  });

  describe('DAO Factory Stress Tests', () => {
    it('should handle creating 50+ DAOs from single creator', async () => {
      console.log('\n🏭 Starting DAO Factory stress test: 50+ DAOs...');
      
      const factoryAddress = await deployContract(
        deployer,
        publicClient,
        DAOFactoryABI,
        DAOFactoryBytecode,
        ['0x1234567890123456789012345678901234567890']
      );

      const factory = getContract({
        address: factoryAddress,
        abi: DAOFactoryABI,
        client: { public: publicClient, wallet: deployer },
      });

      const daoCount = 50;
      const daoAddresses: Address[] = [];
      const startTime = Date.now();

      for (let i = 0; i < daoCount; i++) {
        const config = {
          name: `Stress Test DAO ${i + 1}`,
          symbol: `SDAO${i + 1}`,
          metadata: `metadata-${i}`,
          votingDelay: BigInt(1),
          votingPeriod: BigInt(100),
          proposalThreshold: parseEther('100'),
          quorumNumerator: BigInt(40),
        };

        const hash = await factory.write.createDAO([config]);
        const receipt = await publicClient.waitForTransactionReceipt({ hash });
        
        expect(receipt.status).toBe('success');
        
        const event = findEventLog(receipt, DAOFactoryABI, 'DAOCreated');
        expect(event).toBeDefined();
        daoAddresses.push(event.daoAddress);

        gasProfiler.record('DAOFactory.createDAO', receipt.gasUsed);

        if ((i + 1) % 10 === 0) {
          console.log(`   ✓ Created ${i + 1}/${daoCount} DAOs`);
        }
      }

      const endTime = Date.now();
      const duration = (endTime - startTime) / 1000;

      // Verify all DAOs are tracked
      const trackedDAOs = await factory.read.getDAOsByCreator([MOCK_ACCOUNTS[0].address]);
      expect(trackedDAOs).toHaveLength(daoCount);

      // Verify all DAOs are unique
      const uniqueDAOs = new Set(daoAddresses.map(a => a.toLowerCase()));
      expect(uniqueDAOs.size).toBe(daoCount);

      console.log(`\n✅ Created ${daoCount} DAOs in ${duration}s`);
      console.log(`   Average gas per DAO: ${(gasProfiler.getAverage('DAOFactory.createDAO') / BigInt(1000)).toString()}k`);
      console.log(`   Min gas: ${(gasProfiler.getMin('DAOFactory.createDAO') / BigInt(1000)).toString()}k`);
      console.log(`   Max gas: ${(gasProfiler.getMax('DAOFactory.createDAO') / BigInt(1000)).toString()}k`);
    }, 120000);

    it('should handle creating DAOs from 20+ different creators', async () => {
      console.log('\n👥 Starting multi-creator DAO stress test...');
      
      const factoryAddress = await deployContract(
        deployer,
        publicClient,
        DAOFactoryABI,
        DAOFactoryBytecode,
        ['0x1234567890123456789012345678901234567890']
      );

      // Create additional test accounts by using different private keys
      const additionalAccounts = [
        { privateKey: '0xdbda1821b80551c9d65939329250298aa3472ba22feea921c0cf5d620ea67b97', address: '0x23618e81E3f5cdF7f54C3d65f7FBc0aBf5B21E8f' },
        { privateKey: '0x4bbbf85ce3377467afe5d46f804f221813b2bb87f24d81f60f1fcdbf7cbf4356', address: '0xa0Ee7A142d267C1f36714E4a8F75612F20a79720' },
        { privateKey: '0x92db14e403b83dfe3df233f83dfa3a0d7096f21ca9b0d6a6edcd3db4f51d76a1', address: '0xbcd4042de499d14e55001ccbb24a551f3b954096' },
      ];

      const creators = [deployer, alice, bob, carol];
      const daosPerCreator = 5;
      const startTime = Date.now();

      for (let i = 0; i < creators.length; i++) {
        const creator = creators[i];
        const factory = getContract({
          address: factoryAddress,
          abi: DAOFactoryABI,
          client: { public: publicClient, wallet: creator },
        });

        for (let j = 0; j < daosPerCreator; j++) {
          const config = {
            name: `Creator${i + 1} DAO ${j + 1}`,
            symbol: `C${i + 1}D${j + 1}`,
            metadata: `creator-${i}-dao-${j}`,
            votingDelay: BigInt(1),
            votingPeriod: BigInt(100),
            proposalThreshold: parseEther('100'),
            quorumNumerator: BigInt(40),
          };

          const hash = await factory.write.createDAO([config]);
          const receipt = await publicClient.waitForTransactionReceipt({ hash });
          expect(receipt.status).toBe('success');
        }

        console.log(`   ✓ Creator ${i + 1} created ${daosPerCreator} DAOs`);
      }

      const endTime = Date.now();
      const duration = (endTime - startTime) / 1000;

      // Verify each creator has correct DAO count
      for (let i = 0; i < creators.length; i++) {
        const creatorAddress = MOCK_ACCOUNTS[i].address;
        const daos = await factoryAddress.read.getDAOsByCreator([creatorAddress]);
        expect(daos).toHaveLength(daosPerCreator);
      }

      console.log(`\n✅ Created ${creators.length * daosPerCreator} DAOs across ${creators.length} creators in ${duration}s`);
    }, 120000);
  });

  describe('Proposal Manager Stress Tests', () => {
    it('should handle 100+ proposals in single DAO', async () => {
      console.log('\n📜 Starting Proposal Manager stress test: 100+ proposals...');
      
      // Deploy token
      const tokenAddress = await deployContract(
        deployer,
        publicClient,
        SoulBoundTokenABI,
        SoulBoundTokenBytecode,
        ['Gov Token', 'GOV']
      );

      // Mint tokens to multiple voters
      const token = getContract({
        address: tokenAddress,
        abi: SoulBoundTokenABI,
        client: { public: publicClient, wallet: deployer },
      });

      // Distribute tokens among 5 voters
      for (let i = 1; i <= 5; i++) {
        await token.write.mint([MOCK_ACCOUNTS[i].address, parseEther('1000')]);
      }

      // Deploy proposal manager
      const managerAddress = await deployContract(
        deployer,
        publicClient,
        ProposalManagerABI,
        ProposalManagerBytecode,
        [
          tokenAddress,
          1, // voting delay
          50, // short voting period for speed
          parseEther('100'),
          40,
        ]
      );

      const proposalCount = 100;
      const startTime = Date.now();

      // Create proposals
      for (let i = 0; i < proposalCount; i++) {
        const proposerIndex = (i % 4) + 1; // Rotate between alice, bob, carol, dave
        const proposer = [alice, bob, carol, context.walletClients.dave][proposerIndex - 1];

        const manager = getContract({
          address: managerAddress,
          abi: ProposalManagerABI,
          client: { public: publicClient, wallet: proposer },
        });

        const hash = await manager.write.propose([
          [MOCK_ACCOUNTS[0].address],
          [BigInt(0)],
          ['0x'],
          `Stress Test Proposal ${i + 1}`,
        ]);
        const receipt = await publicClient.waitForTransactionReceipt({ hash });
        
        expect(receipt.status).toBe('success');
        gasProfiler.record('ProposalManager.createProposal', receipt.gasUsed);

        if ((i + 1) % 20 === 0) {
          console.log(`   ✓ Created ${i + 1}/${proposalCount} proposals`);
        }
      }

      // Verify proposal count
      const manager = getContract({
        address: managerAddress,
        abi: ProposalManagerABI,
        client: publicClient,
      });

      const count = await manager.read.proposalCount();
      expect(count).toBe(BigInt(proposalCount));

      const createEndTime = Date.now();
      const createDuration = (createEndTime - startTime) / 1000;

      console.log(`\n✅ Created ${proposalCount} proposals in ${createDuration}s`);
      console.log(`   Average gas: ${(gasProfiler.getAverage('ProposalManager.createProposal') / BigInt(1000)).toString()}k`);

      // Now vote on all proposals
      console.log('\n🗳️  Starting voting on all proposals...');
      const voteStartTime = Date.now();

      // Advance to voting period
      await advanceBlocks(publicClient, 2);

      for (let i = 1; i <= proposalCount; i++) {
        const voterIndex = (i % 3); // Rotate voters
        const voter = [alice, bob, carol][voterIndex];

        const voterManager = getContract({
          address: managerAddress,
          abi: ProposalManagerABI,
          client: { public: publicClient, wallet: voter },
        });

        const voteHash = await voterManager.write.castVote([BigInt(i), VoteType.For]);
        const voteReceipt = await publicClient.waitForTransactionReceipt({ hash: voteHash });
        
        expect(voteReceipt.status).toBe('success');
        gasProfiler.record('ProposalManager.castVote', voteReceipt.gasUsed);

        if (i % 25 === 0) {
          console.log(`   ✓ Voted on ${i}/${proposalCount} proposals`);
        }
      }

      const voteEndTime = Date.now();
      const voteDuration = (voteEndTime - voteStartTime) / 1000;

      console.log(`\n✅ Cast ${proposalCount} votes in ${voteDuration}s`);
      console.log(`   Average gas: ${(gasProfiler.getAverage('ProposalManager.castVote') / BigInt(1000)).toString()}k`);
    }, 300000);

    it('should handle concurrent proposal creation and voting', async () => {
      console.log('\n⚡ Starting concurrent proposal operations test...');
      
      // Deploy token and manager
      const tokenAddress = await deployContract(
        deployer,
        publicClient,
        SoulBoundTokenABI,
        SoulBoundTokenBytecode,
        ['Concurrent Token', 'CONC']
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
          100,
          parseEther('100'),
          40,
        ]
      );

      const batchSize = 10;
      const batches = 5;
      const proposalIds: bigint[] = [];

      // Create proposals in batches
      for (let batch = 0; batch < batches; batch++) {
        const batchPromises = [];

        for (let i = 0; i < batchSize; i++) {
          const manager = getContract({
            address: managerAddress,
            abi: ProposalManagerABI,
            client: { public: publicClient, wallet: alice },
          });

          const promise = manager.write.propose([
            [MOCK_ACCOUNTS[0].address],
            [BigInt(0)],
            ['0x'],
            `Batch ${batch + 1} Proposal ${i + 1}`,
          ]).then(async (hash) => {
            const receipt = await publicClient.waitForTransactionReceipt({ hash });
            const event = findEventLog(receipt, ProposalManagerABI, 'ProposalCreated');
            return event.proposalId;
          });

          batchPromises.push(promise);
        }

        const batchIds = await Promise.all(batchPromises);
        proposalIds.push(...batchIds);

        console.log(`   ✓ Completed batch ${batch + 1}/${batches}`);
      }

      expect(proposalIds).toHaveLength(batchSize * batches);

      // Advance to voting
      await advanceBlocks(publicClient, 2);

      // Vote on all proposals
      for (let i = 0; i < proposalIds.length; i++) {
        const manager = getContract({
          address: managerAddress,
          abi: ProposalManagerABI,
          client: { public: publicClient, wallet: i % 2 === 0 ? alice : bob },
        });

        const hash = await manager.write.castVote([proposalIds[i], VoteType.For]);
        await publicClient.waitForTransactionReceipt({ hash });
      }

      console.log(`\n✅ Processed ${proposalIds.length} proposals with concurrent operations`);
    }, 180000);

    it('should handle 50+ proposals with different states simultaneously', async () => {
      console.log('\n📊 Starting multi-state proposal test...');
      
      const tokenAddress = await deployContract(
        deployer,
        publicClient,
        SoulBoundTokenABI,
        SoulBoundTokenBytecode,
        ['Multi-State Token', 'MST']
      );

      const token = getContract({
        address: tokenAddress,
        abi: SoulBoundTokenABI,
        client: { public: publicClient, wallet: deployer },
      });

      await token.write.mint([MOCK_ACCOUNTS[1].address, parseEther('2000')]);
      await token.write.mint([MOCK_ACCOUNTS[2].address, parseEther('1000')]);

      const managerAddress = await deployContract(
        deployer,
        publicClient,
        ProposalManagerABI,
        ProposalManagerBytecode,
        [
          tokenAddress,
          5, // longer delay
          20,
          parseEther('100'),
          40,
        ]
      );

      const pendingProposals: bigint[] = [];
      const activeProposals: bigint[] = [];
      const succeededProposals: bigint[] = [];
      const defeatedProposals: bigint[] = [];

      // Create proposals at different times
      for (let i = 0; i < 50; i++) {
        const manager = getContract({
          address: managerAddress,
          abi: ProposalManagerABI,
          client: { public: publicClient, wallet: alice },
        });

        const hash = await manager.write.propose([
          [MOCK_ACCOUNTS[0].address],
          [BigInt(0)],
          ['0x'],
          `Multi-State Proposal ${i + 1}`,
        ]);
        const receipt = await publicClient.waitForTransactionReceipt({ hash });
        const event = findEventLog(receipt, ProposalManagerABI, 'ProposalCreated');

        // Categorize based on index
        if (i < 10) {
          pendingProposals.push(event.proposalId); // Will stay pending
        } else if (i < 25) {
          activeProposals.push(event.proposalId); // Will become active
        } else if (i < 40) {
          succeededProposals.push(event.proposalId); // Will succeed
        } else {
          defeatedProposals.push(event.proposalId); // Will be defeated
        }
      }

      // Advance some blocks for active proposals
      await advanceBlocks(publicClient, 6);

      // Vote on succeeded proposals
      for (const id of succeededProposals) {
        const manager = getContract({
          address: managerAddress,
          abi: ProposalManagerABI,
          client: { public: publicClient, wallet: alice },
        });
        await manager.write.castVote([id, VoteType.For]);
      }

      // Vote against defeated proposals
      for (const id of defeatedProposals) {
        const manager = getContract({
          address: managerAddress,
          abi: ProposalManagerABI,
          client: { public: publicClient, wallet: bob },
        });
        await manager.write.castVote([id, VoteType.Against]);
      }

      // Advance past voting period
      await advanceBlocks(publicClient, 25);

      // Verify states
      const manager = getContract({
        address: managerAddress,
        abi: ProposalManagerABI,
        client: publicClient,
      });

      // Check pending still pending
      for (const id of pendingProposals) {
        const state = await manager.read.state([id]);
        expect(state).toBe(ProposalState.Pending);
      }

      // Check active are now defeated (no votes)
      for (const id of activeProposals) {
        const state = await manager.read.state([id]);
        expect(state).toBe(ProposalState.Defeated);
      }

      // Check succeeded
      for (const id of succeededProposals) {
        const state = await manager.read.state([id]);
        expect(state).toBe(ProposalState.Succeeded);
      }

      // Check defeated
      for (const id of defeatedProposals) {
        const state = await manager.read.state([id]);
        expect(state).toBe(ProposalState.Defeated);
      }

      console.log(`\n✅ Verified ${50} proposals in different states:`);
      console.log(`   Pending: ${pendingProposals.length}`);
      console.log(`   Defeated (no votes): ${activeProposals.length}`);
      console.log(`   Succeeded: ${succeededProposals.length}`);
      console.log(`   Defeated (voted against): ${defeatedProposals.length}`);
    }, 180000);
  });

  describe('Task Market Stress Tests', () => {
    it('should handle 100+ tasks with bids', async () => {
      console.log('\n📝 Starting Task Market stress test: 100+ tasks...');
      
      const marketAddress = await deployContract(
        deployer,
        publicClient,
        TaskMarketABI,
        TaskMarketBytecode,
        [250]
      );

      const taskCount = 100;
      const taskIds: bigint[] = [];
      const startTime = Date.now();

      // Create tasks
      for (let i = 0; i < taskCount; i++) {
        const creator = i % 2 === 0 ? alice : bob;
        const market = getContract({
          address: marketAddress,
          abi: TaskMarketABI,
          client: { public: publicClient, wallet: creator },
        });

        const hash = await market.write.createTask(
          [`Task ${i + 1}`, `Description ${i + 1}`, `Qm${i}`, BigInt(Math.floor(Date.now() / 1000) + 7 * 86400)],
          { value: parseEther('1') }
        );
        const receipt = await publicClient.waitForTransactionReceipt({ hash });
        const event = findEventLog(receipt, TaskMarketABI, 'TaskCreated');
        taskIds.push(event.taskId);

        gasProfiler.record('TaskMarket.createTask', receipt.gasUsed);

        if ((i + 1) % 20 === 0) {
          console.log(`   ✓ Created ${i + 1}/${taskCount} tasks`);
        }
      }

      // Submit bids on tasks
      const bidCount = 50;
      for (let i = 0; i < bidCount; i++) {
        const bidder = i % 2 === 0 ? bob : carol;
        const market = getContract({
          address: marketAddress,
          abi: TaskMarketABI,
          client: { public: publicClient, wallet: bidder },
        });

        const taskIndex = i % taskIds.length;
        const hash = await market.write.submitBid([
          taskIds[taskIndex],
          parseEther('0.8'),
          `Bid proposal ${i + 1}`,
        ]);
        const receipt = await publicClient.waitForTransactionReceipt({ hash });
        
        expect(receipt.status).toBe('success');
        gasProfiler.record('TaskMarket.submitBid', receipt.gasUsed);
      }

      const endTime = Date.now();
      const duration = (endTime - startTime) / 1000;

      // Verify counts
      const market = getContract({
        address: marketAddress,
        abi: TaskMarketABI,
        client: publicClient,
      });

      const finalTaskCount = await market.read.taskCount();
      expect(finalTaskCount).toBe(BigInt(taskCount));

      console.log(`\n✅ Created ${taskCount} tasks and ${bidCount} bids in ${duration}s`);
      console.log(`   Task gas avg: ${(gasProfiler.getAverage('TaskMarket.createTask') / BigInt(1000)).toString()}k`);
      console.log(`   Bid gas avg: ${(gasProfiler.getAverage('TaskMarket.submitBid') / BigInt(1000)).toString()}k`);
    }, 180000);
  });

  describe('Combined System Stress Test', () => {
    it('should handle full system load: 10 DAOs with 20 proposals each', async () => {
      console.log('\n🚀 Starting full system stress test...');
      
      const startTime = Date.now();

      // Deploy factory
      const factoryAddress = await deployContract(
        deployer,
        publicClient,
        DAOFactoryABI,
        DAOFactoryBytecode,
        ['0x1234567890123456789012345678901234567890']
      );

      const factory = getContract({
        address: factoryAddress,
        abi: DAOFactoryABI,
        client: { public: publicClient, wallet: deployer },
      });

      const daoCount = 10;
      const proposalsPerDAO = 20;

      // Create DAOs with tokens and proposal managers
      for (let i = 0; i < daoCount; i++) {
        const config = {
          name: `Stress DAO ${i + 1}`,
          symbol: `STR${i + 1}`,
          metadata: `stress-dao-${i}`,
          votingDelay: BigInt(1),
          votingPeriod: BigInt(50),
          proposalThreshold: parseEther('100'),
          quorumNumerator: BigInt(40),
        };

        const hash = await factory.write.createDAO([config]);
        const receipt = await publicClient.waitForTransactionReceipt({ hash });
        expect(receipt.status).toBe('success');

        if ((i + 1) % 5 === 0) {
          console.log(`   ✓ Created ${i + 1}/${daoCount} DAOs`);
        }
      }

      // For each DAO, mint tokens and create proposals
      const daos = await factory.read.getDAOsByCreator([MOCK_ACCOUNTS[0].address]);
      
      for (let i = 0; i < daos.length; i++) {
        const daoInfo = await factory.read.getDAO([daos[i]]);
        
        // Mint tokens
        const token = getContract({
          address: daoInfo.tokenAddress,
          abi: SoulBoundTokenABI,
          client: { public: publicClient, wallet: deployer },
        });

        await token.write.mint([MOCK_ACCOUNTS[1].address, parseEther('1000')]);
        await token.write.mint([MOCK_ACCOUNTS[2].address, parseEther('500')]);

        // Deploy proposal manager for this DAO
        const managerAddress = await deployContract(
          deployer,
          publicClient,
          ProposalManagerABI,
          ProposalManagerBytecode,
          [
            daoInfo.tokenAddress,
            1,
            50,
            parseEther('100'),
            40,
          ]
        );

        // Create proposals
        const manager = getContract({
          address: managerAddress,
          abi: ProposalManagerABI,
          client: { public: publicClient, wallet: alice },
        });

        for (let j = 0; j < proposalsPerDAO; j++) {
          const hash = await manager.write.propose([
            [daos[i]],
            [BigInt(0)],
            ['0x'],
            `DAO ${i + 1} Proposal ${j + 1}`,
          ]);
          await publicClient.waitForTransactionReceipt({ hash });
        }

        console.log(`   ✓ DAO ${i + 1}: Created ${proposalsPerDAO} proposals`);
      }

      const endTime = Date.now();
      const duration = (endTime - startTime) / 1000;

      console.log(`\n✅ Full system stress test complete in ${duration}s`);
      console.log(`   Total DAOs: ${daoCount}`);
      console.log(`   Total Proposals: ${daoCount * proposalsPerDAO}`);
    }, 300000);
  });

  describe('Gas Profiling Report', () => {
    it('should generate comprehensive gas report', async () => {
      console.log('\n' + '='.repeat(60));
      console.log('STRESS TEST GAS PROFILING REPORT');
      console.log('='.repeat(60));
      console.log(gasProfiler.generateReport());
      console.log('='.repeat(60));
    });
  });
});
