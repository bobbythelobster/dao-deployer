/**
 * DAO Lifecycle Integration Test
 * Full flow: Create DAO → Create proposal → Vote → Execute
 */

import { describe, it, expect, beforeAll, beforeEach } from 'bun:test';
import { type Address, type WalletClient, type PublicClient, parseEther, getContract, keccak256, stringToHex } from 'viem';
import { getTestContext, takeSnapshot, revertToSnapshot } from '../setup';
import { 
  DAOFactoryABI, DAOFactoryBytecode,
  ProposalManagerABI, ProposalManagerBytecode,
  SoulBoundTokenABI, SoulBoundTokenBytecode
} from '../contracts/abis';
import { MOCK_ACCOUNTS, MOCK_DAO_CONFIG, ProposalState, VoteType } from '../mocks/data';
import { deployContract, findEventLog, advanceBlocks } from '../utils/helpers';

describe('DAO Lifecycle Integration', () => {
  let context: ReturnType<typeof getTestContext>;
  let publicClient: PublicClient;
  let deployer: WalletClient;
  let alice: WalletClient;
  let bob: WalletClient;
  let carol: WalletClient;
  let snapshotId: string;

  // Contract addresses
  let factoryAddress: Address;
  let daoAddress: Address;
  let tokenAddress: Address;
  let managerAddress: Address;

  beforeAll(async () => {
    context = getTestContext();
    publicClient = context.publicClient;
    deployer = context.walletClients.deployer;
    alice = context.walletClients.alice;
    bob = context.walletClients.bob;
    carol = context.walletClients.carol;
  });

  beforeEach(async () => {
    snapshotId = await takeSnapshot(publicClient);
  });

  afterEach(async () => {
    await revertToSnapshot(publicClient, snapshotId);
  });

  describe('Complete DAO Lifecycle', () => {
    it('should execute full lifecycle: create → propose → vote → execute', async () => {
      // ============ STEP 1: Deploy DAO Factory ============
      console.log('\n📋 Step 1: Deploying DAO Factory...');
      
      factoryAddress = await deployContract(
        deployer,
        publicClient,
        DAOFactoryABI,
        DAOFactoryBytecode,
        ['0x1234567890123456789012345678901234567890'] // Mock Aragon repo
      );

      expect(factoryAddress).toBeDefined();
      console.log(`   ✓ DAO Factory deployed at ${factoryAddress}`);

      // ============ STEP 2: Create DAO with Token ============
      console.log('\n📋 Step 2: Creating DAO with governance token...');

      const factory = getContract({
        address: factoryAddress,
        abi: DAOFactoryABI,
        client: { public: publicClient, wallet: deployer },
      });

      const daoConfig = {
        name: 'Integration Test DAO',
        symbol: 'ITDAO',
        metadata: 'ipfs://QmDAOMetadata',
        votingDelay: BigInt(1),
        votingPeriod: BigInt(100),
        proposalThreshold: parseEther('100'),
        quorumNumerator: BigInt(40),
      };

      const createDAOHash = await factory.write.createDAO([daoConfig]);
      const createDAOReceipt = await publicClient.waitForTransactionReceipt({ hash: createDAOHash });

      expect(createDAOReceipt.status).toBe('success');

      const daoCreatedEvent = findEventLog(createDAOReceipt, DAOFactoryABI, 'DAOCreated');
      expect(daoCreatedEvent).toBeDefined();

      daoAddress = daoCreatedEvent.daoAddress;
      tokenAddress = daoCreatedEvent.tokenAddress;

      console.log(`   ✓ DAO created at ${daoAddress}`);
      console.log(`   ✓ Token deployed at ${tokenAddress}`);

      // ============ STEP 3: Distribute Tokens to Members ============
      console.log('\n📋 Step 3: Distributing governance tokens...');

      const token = getContract({
        address: tokenAddress,
        abi: SoulBoundTokenABI,
        client: { public: publicClient, wallet: deployer },
      });

      // Mint tokens to voters
      await token.write.mint([MOCK_ACCOUNTS[1].address, parseEther('1000')]);
      await token.write.mint([MOCK_ACCOUNTS[2].address, parseEther('500')]);
      await token.write.mint([MOCK_ACCOUNTS[3].address, parseEther('250')]);

      // Verify balances
      const aliceBalance = await token.read.balanceOf([MOCK_ACCOUNTS[1].address]);
      const bobBalance = await token.read.balanceOf([MOCK_ACCOUNTS[2].address]);
      const carolBalance = await token.read.balanceOf([MOCK_ACCOUNTS[3].address]);

      expect(aliceBalance).toBe(parseEther('1000'));
      expect(bobBalance).toBe(parseEther('500'));
      expect(carolBalance).toBe(parseEther('250'));

      console.log(`   ✓ Alice: ${aliceBalance.toString()} tokens`);
      console.log(`   ✓ Bob: ${bobBalance.toString()} tokens`);
      console.log(`   ✓ Carol: ${carolBalance.toString()} tokens`);

      // ============ STEP 4: Deploy Proposal Manager ============
      console.log('\n📋 Step 4: Deploying Proposal Manager...');

      managerAddress = await deployContract(
        deployer,
        publicClient,
        ProposalManagerABI,
        ProposalManagerBytecode,
        [
          tokenAddress,
          daoConfig.votingDelay,
          daoConfig.votingPeriod,
          daoConfig.proposalThreshold,
          daoConfig.quorumNumerator,
        ]
      );

      expect(managerAddress).toBeDefined();
      console.log(`   ✓ Proposal Manager deployed at ${managerAddress}`);

      // ============ STEP 5: Create Proposal ============
      console.log('\n📋 Step 5: Creating governance proposal...');

      const manager = getContract({
        address: managerAddress,
        abi: ProposalManagerABI,
        client: { public: publicClient, wallet: alice },
      });

      const proposalTargets = [daoAddress];
      const proposalValues = [BigInt(0)];
      const proposalCalldatas = ['0x' as const];
      const proposalDescription = 'Transfer 100 ETH to treasury';

      const proposeHash = await manager.write.propose([
        proposalTargets,
        proposalValues,
        proposalCalldatas,
        proposalDescription,
      ]);

      const proposeReceipt = await publicClient.waitForTransactionReceipt({ hash: proposeHash });
      expect(proposeReceipt.status).toBe('success');

      const proposalCreatedEvent = findEventLog(proposeReceipt, ProposalManagerABI, 'ProposalCreated');
      expect(proposalCreatedEvent).toBeDefined();

      const proposalId = proposalCreatedEvent.proposalId;

      console.log(`   ✓ Proposal #${proposalId.toString()} created`);
      console.log(`   ✓ Description: ${proposalDescription}`);
      console.log(`   ✓ Voting starts at block ${proposalCreatedEvent.startBlock.toString()}`);
      console.log(`   ✓ Voting ends at block ${proposalCreatedEvent.endBlock.toString()}`);

      // Verify initial state
      let state = await manager.read.state([proposalId]);
      expect(state).toBe(ProposalState.Pending);

      // ============ STEP 6: Advance to Voting Period ============
      console.log('\n📋 Step 6: Advancing to voting period...');

      await advanceBlocks(publicClient, Number(daoConfig.votingDelay) + 1);

      state = await manager.read.state([proposalId]);
      expect(state).toBe(ProposalState.Active);

      console.log(`   ✓ Voting is now active`);

      // ============ STEP 7: Cast Votes ============
      console.log('\n📋 Step 7: Casting votes...');

      // Alice votes FOR
      const aliceManager = getContract({
        address: managerAddress,
        abi: ProposalManagerABI,
        client: { public: publicClient, wallet: alice },
      });

      const aliceVoteHash = await aliceManager.write.castVote([proposalId, VoteType.For]);
      const aliceVoteReceipt = await publicClient.waitForTransactionReceipt({ hash: aliceVoteHash });
      expect(aliceVoteReceipt.status).toBe('success');

      console.log(`   ✓ Alice voted FOR with ${parseEther('1000').toString()} votes`);

      // Bob votes FOR
      const bobManager = getContract({
        address: managerAddress,
        abi: ProposalManagerABI,
        client: { public: publicClient, wallet: bob },
      });

      const bobVoteHash = await bobManager.write.castVote([proposalId, VoteType.For]);
      const bobVoteReceipt = await publicClient.waitForTransactionReceipt({ hash: bobVoteHash });
      expect(bobVoteReceipt.status).toBe('success');

      console.log(`   ✓ Bob voted FOR with ${parseEther('500').toString()} votes`);

      // Carol votes AGAINST
      const carolManager = getContract({
        address: managerAddress,
        abi: ProposalManagerABI,
        client: { public: publicClient, wallet: carol },
      });

      const carolVoteHash = await carolManager.write.castVote([proposalId, VoteType.Against]);
      const carolVoteReceipt = await publicClient.waitForTransactionReceipt({ hash: carolVoteHash });
      expect(carolVoteReceipt.status).toBe('success');

      console.log(`   ✓ Carol voted AGAINST with ${parseEther('250').toString()} votes`);

      // Verify vote counts
      const proposal = await manager.read.proposals([proposalId]);
      expect(proposal.forVotes).toBe(parseEther('1500')); // Alice + Bob
      expect(proposal.againstVotes).toBe(parseEther('250')); // Carol
      expect(proposal.abstainVotes).toBe(BigInt(0));

      console.log(`   ✓ Total FOR: ${proposal.forVotes.toString()}`);
      console.log(`   ✓ Total AGAINST: ${proposal.againstVotes.toString()}`);

      // ============ STEP 8: Advance Past Voting Period ============
      console.log('\n📋 Step 8: Advancing past voting period...');

      await advanceBlocks(publicClient, Number(daoConfig.votingPeriod) + 1);

      state = await manager.read.state([proposalId]);
      expect(state).toBe(ProposalState.Succeeded);

      console.log(`   ✓ Proposal succeeded (FOR > AGAINST && quorum reached)`);

      // ============ STEP 9: Execute Proposal ============
      console.log('\n📋 Step 9: Executing proposal...');

      const descriptionHash = keccak256(stringToHex(proposalDescription));

      const executeHash = await manager.write.execute([
        proposalTargets,
        proposalValues,
        proposalCalldatas,
        descriptionHash,
      ]);

      const executeReceipt = await publicClient.waitForTransactionReceipt({ hash: executeHash });
      expect(executeReceipt.status).toBe('success');

      const executedEvent = findEventLog(executeReceipt, ProposalManagerABI, 'ProposalExecuted');
      expect(executedEvent.proposalId).toBe(proposalId);

      // Verify executed state
      const executedProposal = await manager.read.proposals([proposalId]);
      expect(executedProposal.executed).toBe(true);

      state = await manager.read.state([proposalId]);
      expect(state).toBe(ProposalState.Executed);

      console.log(`   ✓ Proposal #${proposalId.toString()} executed successfully`);
      console.log('\n🎉 DAO lifecycle completed successfully!');
    });

    it('should handle defeated proposal lifecycle', async () => {
      // Deploy and setup DAO
      factoryAddress = await deployContract(
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

      const daoConfig = {
        name: 'Defeated Test DAO',
        symbol: 'DTDAO',
        metadata: 'ipfs://QmTest',
        votingDelay: BigInt(1),
        votingPeriod: BigInt(50),
        proposalThreshold: parseEther('100'),
        quorumNumerator: BigInt(40),
      };

      const createHash = await factory.write.createDAO([daoConfig]);
      const createReceipt = await publicClient.waitForTransactionReceipt({ hash: createHash });
      const daoEvent = findEventLog(createReceipt, DAOFactoryABI, 'DAOCreated');
      
      tokenAddress = daoEvent.tokenAddress;

      // Mint tokens
      const token = getContract({
        address: tokenAddress,
        abi: SoulBoundTokenABI,
        client: { public: publicClient, wallet: deployer },
      });

      await token.write.mint([MOCK_ACCOUNTS[1].address, parseEther('100')]);
      await token.write.mint([MOCK_ACCOUNTS[2].address, parseEther('1000')]);

      // Deploy manager
      managerAddress = await deployContract(
        deployer,
        publicClient,
        ProposalManagerABI,
        ProposalManagerBytecode,
        [
          tokenAddress,
          daoConfig.votingDelay,
          daoConfig.votingPeriod,
          daoConfig.proposalThreshold,
          daoConfig.quorumNumerator,
        ]
      );

      // Create proposal
      const manager = getContract({
        address: managerAddress,
        abi: ProposalManagerABI,
        client: { public: publicClient, wallet: alice },
      });

      const hash = await manager.write.propose([
        [daoEvent.daoAddress],
        [BigInt(0)],
        ['0x'],
        'Defeated proposal',
      ]);
      const receipt = await publicClient.waitForTransactionReceipt({ hash });
      const event = findEventLog(receipt, ProposalManagerABI, 'ProposalCreated');
      const proposalId = event.proposalId;

      // Advance to voting
      await advanceBlocks(publicClient, Number(daoConfig.votingDelay) + 1);

      // Alice votes FOR (not enough to defeat Bob)
      await manager.write.castVote([proposalId, VoteType.For]);

      // Bob votes AGAINST with more power
      const bobManager = getContract({
        address: managerAddress,
        abi: ProposalManagerABI,
        client: { public: publicClient, wallet: bob },
      });
      await bobManager.write.castVote([proposalId, VoteType.Against]);

      // Advance past voting
      await advanceBlocks(publicClient, Number(daoConfig.votingPeriod) + 1);

      // Proposal should be defeated
      const state = await manager.read.state([proposalId]);
      expect(state).toBe(ProposalState.Defeated);
    });

    it('should handle multiple proposals in parallel', async () => {
      // Deploy and setup
      factoryAddress = await deployContract(
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

      const daoConfig = {
        name: 'Multi Proposal DAO',
        symbol: 'MPDAO',
        metadata: 'ipfs://QmTest',
        votingDelay: BigInt(1),
        votingPeriod: BigInt(50),
        proposalThreshold: parseEther('100'),
        quorumNumerator: BigInt(40),
      };

      const createHash = await factory.write.createDAO([daoConfig]);
      const createReceipt = await publicClient.waitForTransactionReceipt({ hash: createHash });
      const daoEvent = findEventLog(createReceipt, DAOFactoryABI, 'DAOCreated');
      
      tokenAddress = daoEvent.tokenAddress;

      // Mint tokens
      const token = getContract({
        address: tokenAddress,
        abi: SoulBoundTokenABI,
        client: { public: publicClient, wallet: deployer },
      });

      await token.write.mint([MOCK_ACCOUNTS[1].address, parseEther('1000')]);
      await token.write.mint([MOCK_ACCOUNTS[2].address, parseEther('500')]);

      // Deploy manager
      managerAddress = await deployContract(
        deployer,
        publicClient,
        ProposalManagerABI,
        ProposalManagerBytecode,
        [
          tokenAddress,
          daoConfig.votingDelay,
          daoConfig.votingPeriod,
          daoConfig.proposalThreshold,
          daoConfig.quorumNumerator,
        ]
      );

      const manager = getContract({
        address: managerAddress,
        abi: ProposalManagerABI,
        client: { public: publicClient, wallet: alice },
      });

      // Create 3 proposals
      const proposal1Hash = await manager.write.propose([
        [daoEvent.daoAddress], [BigInt(0)], ['0x'], 'Proposal 1'
      ]);
      const proposal2Hash = await manager.write.propose([
        [daoEvent.daoAddress], [BigInt(0)], ['0x'], 'Proposal 2'
      ]);
      const proposal3Hash = await manager.write.propose([
        [daoEvent.daoAddress], [BigInt(0)], ['0x'], 'Proposal 3'
      ]);

      const receipt1 = await publicClient.waitForTransactionReceipt({ hash: proposal1Hash });
      const receipt2 = await publicClient.waitForTransactionReceipt({ hash: proposal2Hash });
      const receipt3 = await publicClient.waitForTransactionReceipt({ hash: proposal3Hash });

      const event1 = findEventLog(receipt1, ProposalManagerABI, 'ProposalCreated');
      const event2 = findEventLog(receipt2, ProposalManagerABI, 'ProposalCreated');
      const event3 = findEventLog(receipt3, ProposalManagerABI, 'ProposalCreated');

      // Verify all proposals exist
      expect(event1.proposalId).toBe(BigInt(1));
      expect(event2.proposalId).toBe(BigInt(2));
      expect(event3.proposalId).toBe(BigInt(3));

      // Verify proposal count
      const count = await manager.read.proposalCount();
      expect(count).toBe(BigInt(3));

      // All should be pending
      const state1 = await manager.read.state([BigInt(1)]);
      const state2 = await manager.read.state([BigInt(2)]);
      const state3 = await manager.read.state([BigInt(3)]);

      expect(state1).toBe(ProposalState.Pending);
      expect(state2).toBe(ProposalState.Pending);
      expect(state3).toBe(ProposalState.Pending);
    });
  });
});
