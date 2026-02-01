/**
 * ProposalManager Unit Tests
 * Tests for proposal creation, voting, and lifecycle management
 */

import { describe, it, expect, beforeEach, beforeAll } from 'bun:test';
import { type Address, type WalletClient, type PublicClient, parseEther, getContract, keccak256, stringToHex } from 'viem';
import { getTestContext, GasTracker, takeSnapshot, revertToSnapshot } from '../setup';
import { ProposalManagerABI, ProposalManagerBytecode, SoulBoundTokenABI, SoulBoundTokenBytecode } from './abis';
import { MOCK_ACCOUNTS, MOCK_DAO_CONFIG, ProposalState, VoteType, ERROR_SCENARIOS } from '../mocks/data';
import { deployContract, findEventLog, expectTransactionRevert, GasProfiler, advanceBlocks, advanceTime } from '../utils/helpers';

describe('ProposalManager', () => {
  let context: ReturnType<typeof getTestContext>;
  let publicClient: PublicClient;
  let deployer: WalletClient;
  let alice: WalletClient;
  let bob: WalletClient;
  let carol: WalletClient;
  let dave: WalletClient;
  let managerAddress: Address;
  let tokenAddress: Address;
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
    dave = context.walletClients.dave;
    gasTracker = new GasTracker();
    gasProfiler = new GasProfiler();
  });

  beforeEach(async () => {
    snapshotId = await takeSnapshot(publicClient);

    // Deploy token first
    tokenAddress = await deployContract(
      deployer,
      publicClient,
      SoulBoundTokenABI,
      SoulBoundTokenBytecode,
      ['Governance Token', 'GOV']
    );

    // Mint tokens to voters
    const token = getContract({
      address: tokenAddress,
      abi: SoulBoundTokenABI,
      client: { public: publicClient, wallet: deployer },
    });

    await token.write.mint([MOCK_ACCOUNTS[1].address, parseEther('1000')]);
    await token.write.mint([MOCK_ACCOUNTS[2].address, parseEther('500')]);
    await token.write.mint([MOCK_ACCOUNTS[3].address, parseEther('250')]);
    await token.write.mint([MOCK_ACCOUNTS[4].address, parseEther('100')]);

    // Deploy ProposalManager
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

    context.contracts.proposalManager = managerAddress;
  });

  afterEach(async () => {
    await revertToSnapshot(publicClient, snapshotId);
  });

  describe('Deployment', () => {
    it('should deploy with correct token address', async () => {
      const manager = getContract({
        address: managerAddress,
        abi: ProposalManagerABI,
        client: publicClient,
      });

      // Token is set in constructor, verify by checking state
      const threshold = await manager.read.proposalThreshold();
      expect(threshold).toBe(MOCK_DAO_CONFIG.proposalThreshold);
    });

    it('should set correct voting parameters', async () => {
      const manager = getContract({
        address: managerAddress,
        abi: ProposalManagerABI,
        client: publicClient,
      });

      const votingDelay = await manager.read.votingDelay();
      const votingPeriod = await manager.read.votingPeriod();
      const proposalThreshold = await manager.read.proposalThreshold();

      expect(votingDelay).toBe(BigInt(MOCK_DAO_CONFIG.votingDelay));
      expect(votingPeriod).toBe(BigInt(MOCK_DAO_CONFIG.votingPeriod));
      expect(proposalThreshold).toBe(MOCK_DAO_CONFIG.proposalThreshold);
    });

    it('should start with zero proposals', async () => {
      const manager = getContract({
        address: managerAddress,
        abi: ProposalManagerABI,
        client: publicClient,
      });

      const count = await manager.read.proposalCount();
      expect(count).toBe(BigInt(0));
    });
  });

  describe('Proposal Creation', () => {
    it('should create a proposal with sufficient voting power', async () => {
      const manager = getContract({
        address: managerAddress,
        abi: ProposalManagerABI,
        client: { public: publicClient, wallet: alice },
      });

      const targets = [MOCK_ACCOUNTS[0].address];
      const values = [BigInt(0)];
      const calldatas = ['0x' as const];
      const description = 'Test proposal';

      const hash = await manager.write.propose([targets, values, calldatas, description]);
      const receipt = await publicClient.waitForTransactionReceipt({ hash });

      gasTracker.record('createProposal', receipt.gasUsed);
      gasProfiler.record('ProposalManager.createProposal', receipt.gasUsed);

      expect(receipt.status).toBe('success');

      // Check ProposalCreated event
      const event = findEventLog(receipt, ProposalManagerABI, 'ProposalCreated');
      expect(event).toBeDefined();
      expect(event.proposer.toLowerCase()).toBe(MOCK_ACCOUNTS[1].address.toLowerCase());
      expect(event.description).toBe(description);
      expect(event.targets).toHaveLength(1);

      // Verify proposal count
      const count = await manager.read.proposalCount();
      expect(count).toBe(BigInt(1));

      // Verify proposal state
      const proposalId = event.proposalId;
      const state = await manager.read.state([proposalId]);
      expect(state).toBe(ProposalState.Pending);
    });

    it('should calculate correct voting period', async () => {
      const manager = getContract({
        address: managerAddress,
        abi: ProposalManagerABI,
        client: { public: publicClient, wallet: alice },
      });

      const targets = [MOCK_ACCOUNTS[0].address];
      const values = [BigInt(0)];
      const calldatas = ['0x' as const];
      const description = 'Test proposal timing';

      const currentBlock = await publicClient.getBlockNumber();

      const hash = await manager.write.propose([targets, values, calldatas, description]);
      const receipt = await publicClient.waitForTransactionReceipt({ hash });

      const event = findEventLog(receipt, ProposalManagerABI, 'ProposalCreated');
      const startBlock = event.startBlock;
      const endBlock = event.endBlock;

      expect(startBlock).toBe(currentBlock + BigInt(MOCK_DAO_CONFIG.votingDelay) + BigInt(1));
      expect(endBlock).toBe(startBlock + BigInt(MOCK_DAO_CONFIG.votingPeriod));
    });

    it('should reject proposal with insufficient voting power', async () => {
      // Try to create proposal with dave (only 100 tokens, threshold is 1000)
      const manager = getContract({
        address: managerAddress,
        abi: ProposalManagerABI,
        client: { public: publicClient, wallet: dave },
      });

      const targets = [MOCK_ACCOUNTS[0].address];
      const values = [BigInt(0)];
      const calldatas = ['0x' as const];
      const description = 'Insufficient power proposal';

      await expectTransactionRevert(
        manager.write.propose([targets, values, calldatas, description]),
        ERROR_SCENARIOS.proposalManager.insufficientVotingPower
      );
    });

    it('should reject proposal with empty actions', async () => {
      const manager = getContract({
        address: managerAddress,
        abi: ProposalManagerABI,
        client: { public: publicClient, wallet: alice },
      });

      await expectTransactionRevert(
        manager.write.propose([[], [], [], 'Empty proposal']),
        /empty|no actions|invalid/i
      );
    });

    it('should reject proposal with mismatched action arrays', async () => {
      const manager = getContract({
        address: managerAddress,
        abi: ProposalManagerABI,
        client: { public: publicClient, wallet: alice },
      });

      const targets = [MOCK_ACCOUNTS[0].address, MOCK_ACCOUNTS[1].address];
      const values = [BigInt(0)]; // Mismatched length
      const calldatas = ['0x' as const];

      await expectTransactionRevert(
        manager.write.propose([targets, values, calldatas, 'Mismatched proposal']),
        /mismatch|length|array/i
      );
    });

    it('should allow multiple proposals from same proposer', async () => {
      const manager = getContract({
        address: managerAddress,
        abi: ProposalManagerABI,
        client: { public: publicClient, wallet: alice },
      });

      const targets = [MOCK_ACCOUNTS[0].address];
      const values = [BigInt(0)];
      const calldatas = ['0x' as const];

      await manager.write.propose([targets, values, calldatas, 'Proposal 1']);
      await manager.write.propose([targets, values, calldatas, 'Proposal 2']);
      await manager.write.propose([targets, values, calldatas, 'Proposal 3']);

      const count = await manager.read.proposalCount();
      expect(count).toBe(BigInt(3));
    });
  });

  describe('Voting', () => {
    let proposalId: bigint;

    beforeEach(async () => {
      // Create a proposal
      const manager = getContract({
        address: managerAddress,
        abi: ProposalManagerABI,
        client: { public: publicClient, wallet: alice },
      });

      const targets = [MOCK_ACCOUNTS[0].address];
      const values = [BigInt(0)];
      const calldatas = ['0x' as const];

      const hash = await manager.write.propose([targets, values, calldatas, 'Voting test proposal']);
      const receipt = await publicClient.waitForTransactionReceipt({ hash });
      const event = findEventLog(receipt, ProposalManagerABI, 'ProposalCreated');
      proposalId = event.proposalId;

      // Advance to active voting period
      await advanceBlocks(publicClient, MOCK_DAO_CONFIG.votingDelay + 1);
    });

    it('should cast FOR vote during active period', async () => {
      const manager = getContract({
        address: managerAddress,
        abi: ProposalManagerABI,
        client: { public: publicClient, wallet: alice },
      });

      const hash = await manager.write.castVote([proposalId, VoteType.For]);
      const receipt = await publicClient.waitForTransactionReceipt({ hash });

      gasTracker.record('castVote', receipt.gasUsed);
      gasProfiler.record('ProposalManager.castVote', receipt.gasUsed);

      expect(receipt.status).toBe('success');

      // Check VoteCast event
      const event = findEventLog(receipt, ProposalManagerABI, 'VoteCast');
      expect(event).toBeDefined();
      expect(event.voter.toLowerCase()).toBe(MOCK_ACCOUNTS[1].address.toLowerCase());
      expect(event.support).toBe(VoteType.For);

      // Verify hasVoted
      const hasVoted = await manager.read.hasVoted([proposalId, MOCK_ACCOUNTS[1].address]);
      expect(hasVoted).toBe(true);

      // Verify proposal vote counts
      const proposal = await manager.read.proposals([proposalId]);
      expect(proposal.forVotes).toBe(parseEther('1000')); // Alice's full balance
    });

    it('should cast AGAINST vote', async () => {
      const manager = getContract({
        address: managerAddress,
        abi: ProposalManagerABI,
        client: { public: publicClient, wallet: bob },
      });

      await manager.write.castVote([proposalId, VoteType.Against]);

      const proposal = await manager.read.proposals([proposalId]);
      expect(proposal.againstVotes).toBe(parseEther('500')); // Bob's balance
    });

    it('should cast ABSTAIN vote', async () => {
      const manager = getContract({
        address: managerAddress,
        abi: ProposalManagerABI,
        client: { public: publicClient, wallet: carol },
      });

      await manager.write.castVote([proposalId, VoteType.Abstain]);

      const proposal = await manager.read.proposals([proposalId]);
      expect(proposal.abstainVotes).toBe(parseEther('250')); // Carol's balance
    });

    it('should cast vote with reason', async () => {
      const manager = getContract({
        address: managerAddress,
        abi: ProposalManagerABI,
        client: { public: publicClient, wallet: alice },
      });

      const reason = 'I support this proposal because...';
      const hash = await manager.write.castVoteWithReason([proposalId, VoteType.For, reason]);
      const receipt = await publicClient.waitForTransactionReceipt({ hash });

      const event = findEventLog(receipt, ProposalManagerABI, 'VoteCast');
      expect(event.reason).toBe(reason);
    });

    it('should reject voting twice', async () => {
      const manager = getContract({
        address: managerAddress,
        abi: ProposalManagerABI,
        client: { public: publicClient, wallet: alice },
      });

      await manager.write.castVote([proposalId, VoteType.For]);

      await expectTransactionRevert(
        manager.write.castVote([proposalId, VoteType.Against]),
        ERROR_SCENARIOS.proposalManager.alreadyVoted
      );
    });

    it('should reject voting before voting period', async () => {
      // Create new proposal without advancing blocks
      const manager = getContract({
        address: managerAddress,
        abi: ProposalManagerABI,
        client: { public: publicClient, wallet: alice },
      });

      const targets = [MOCK_ACCOUNTS[0].address];
      const values = [BigInt(0)];
      const calldatas = ['0x' as const];

      const hash = await manager.write.propose([targets, values, calldatas, 'New proposal']);
      const receipt = await publicClient.waitForTransactionReceipt({ hash });
      const event = findEventLog(receipt, ProposalManagerABI, 'ProposalCreated');
      const newProposalId = event.proposalId;

      await expectTransactionRevert(
        manager.write.castVote([newProposalId, VoteType.For]),
        ERROR_SCENARIOS.proposalManager.votingClosed
      );
    });

    it('should reject voting after voting period', async () => {
      // Advance past voting period
      await advanceBlocks(publicClient, MOCK_DAO_CONFIG.votingPeriod + 10);

      const manager = getContract({
        address: managerAddress,
        abi: ProposalManagerABI,
        client: { public: publicClient, wallet: alice },
      });

      await expectTransactionRevert(
        manager.write.castVote([proposalId, VoteType.For]),
        ERROR_SCENARIOS.proposalManager.votingClosed
      );
    });

    it('should allow multiple voters', async () => {
      const aliceManager = getContract({
        address: managerAddress,
        abi: ProposalManagerABI,
        client: { public: publicClient, wallet: alice },
      });

      const bobManager = getContract({
        address: managerAddress,
        abi: ProposalManagerABI,
        client: { public: publicClient, wallet: bob },
      });

      const carolManager = getContract({
        address: managerAddress,
        abi: ProposalManagerABI,
        client: { public: publicClient, wallet: carol },
      });

      await aliceManager.write.castVote([proposalId, VoteType.For]);
      await bobManager.write.castVote([proposalId, VoteType.For]);
      await carolManager.write.castVote([proposalId, VoteType.Against]);

      const proposal = await managerAddress.read.proposals([proposalId]);
      expect(proposal.forVotes).toBe(parseEther('1500')); // Alice + Bob
      expect(proposal.againstVotes).toBe(parseEther('250')); // Carol
    });
  });

  describe('Proposal Lifecycle', () => {
    it('should transition from Pending to Active', async () => {
      const manager = getContract({
        address: managerAddress,
        abi: ProposalManagerABI,
        client: { public: publicClient, wallet: alice },
      });

      const targets = [MOCK_ACCOUNTS[0].address];
      const values = [BigInt(0)];
      const calldatas = ['0x' as const];

      const hash = await manager.write.propose([targets, values, calldatas, 'Lifecycle test']);
      const receipt = await publicClient.waitForTransactionReceipt({ hash });
      const event = findEventLog(receipt, ProposalManagerABI, 'ProposalCreated');
      const propId = event.proposalId;

      // Initially pending
      let state = await manager.read.state([propId]);
      expect(state).toBe(ProposalState.Pending);

      // Advance to active
      await advanceBlocks(publicClient, MOCK_DAO_CONFIG.votingDelay + 1);

      state = await manager.read.state([propId]);
      expect(state).toBe(ProposalState.Active);
    });

    it('should succeed with majority FOR votes', async () => {
      const manager = getContract({
        address: managerAddress,
        abi: ProposalManagerABI,
        client: { public: publicClient, wallet: alice },
      });

      const targets = [MOCK_ACCOUNTS[0].address];
      const values = [BigInt(0)];
      const calldatas = ['0x' as const];

      const hash = await manager.write.propose([targets, values, calldatas, 'Success test']);
      const receipt = await publicClient.waitForTransactionReceipt({ hash });
      const event = findEventLog(receipt, ProposalManagerABI, 'ProposalCreated');
      const propId = event.proposalId;

      await advanceBlocks(publicClient, MOCK_DAO_CONFIG.votingDelay + 1);

      // Cast sufficient FOR votes to reach quorum
      await manager.write.castVote([propId, VoteType.For]);

      await advanceBlocks(publicClient, MOCK_DAO_CONFIG.votingPeriod + 1);

      const state = await manager.read.state([propId]);
      expect(state).toBe(ProposalState.Succeeded);
    });

    it('should fail with majority AGAINST votes', async () => {
      const proposerManager = getContract({
        address: managerAddress,
        abi: ProposalManagerABI,
        client: { public: publicClient, wallet: alice },
      });

      const bobManager = getContract({
        address: managerAddress,
        abi: ProposalManagerABI,
        client: { public: publicClient, wallet: bob },
      });

      const targets = [MOCK_ACCOUNTS[0].address];
      const values = [BigInt(0)];
      const calldatas = ['0x' as const];

      const hash = await proposerManager.write.propose([targets, values, calldatas, 'Fail test']);
      const receipt = await publicClient.waitForTransactionReceipt({ hash });
      const event = findEventLog(receipt, ProposalManagerABI, 'ProposalCreated');
      const propId = event.proposalId;

      await advanceBlocks(publicClient, MOCK_DAO_CONFIG.votingDelay + 1);

      // Alice votes for, Bob votes against with more votes
      await proposerManager.write.castVote([propId, VoteType.For]);
      await bobManager.write.castVote([propId, VoteType.Against]);

      await advanceBlocks(publicClient, MOCK_DAO_CONFIG.votingPeriod + 1);

      const state = await manager.read.state([propId]);
      expect(state).toBe(ProposalState.Defeated);
    });

    it('should fail without quorum', async () => {
      const daveManager = getContract({
        address: managerAddress,
        abi: ProposalManagerABI,
        client: { public: publicClient, wallet: dave },
      });

      const targets = [MOCK_ACCOUNTS[0].address];
      const values = [BigInt(0)];
      const calldatas = ['0x' as const];

      const hash = await daveManager.write.propose([targets, values, calldatas, 'No quorum test']);
      const receipt = await publicClient.waitForTransactionReceipt({ hash });
      const event = findEventLog(receipt, ProposalManagerABI, 'ProposalCreated');
      const propId = event.proposalId;

      await advanceBlocks(publicClient, MOCK_DAO_CONFIG.votingDelay + 1);

      // Dave votes but doesn't have enough for quorum
      await daveManager.write.castVote([propId, VoteType.For]);

      await advanceBlocks(publicClient, MOCK_DAO_CONFIG.votingPeriod + 1);

      const state = await manager.read.state([propId]);
      expect(state).toBe(ProposalState.Defeated);
    });

    it('should execute succeeded proposal', async () => {
      const manager = getContract({
        address: managerAddress,
        abi: ProposalManagerABI,
        client: { public: publicClient, wallet: alice },
      });

      const targets = [MOCK_ACCOUNTS[0].address];
      const values = [BigInt(0)];
      const calldatas = ['0x' as const];
      const description = 'Execute test';

      const hash = await manager.write.propose([targets, values, calldatas, description]);
      const receipt = await publicClient.waitForTransactionReceipt({ hash });
      const event = findEventLog(receipt, ProposalManagerABI, 'ProposalCreated');
      const propId = event.proposalId;

      await advanceBlocks(publicClient, MOCK_DAO_CONFIG.votingDelay + 1);

      // Vote for
      await manager.write.castVote([propId, VoteType.For]);

      // Get bob and carol to vote to reach quorum
      const bobManager = getContract({
        address: managerAddress,
        abi: ProposalManagerABI,
        client: { public: publicClient, wallet: bob },
      });
      const carolManager = getContract({
        address: managerAddress,
        abi: ProposalManagerABI,
        client: { public: publicClient, wallet: carol },
      });
      await bobManager.write.castVote([propId, VoteType.For]);
      await carolManager.write.castVote([propId, VoteType.For]);

      await advanceBlocks(publicClient, MOCK_DAO_CONFIG.votingPeriod + 1);

      // Execute
      const descriptionHash = keccak256(stringToHex(description));
      const execHash = await manager.write.execute([targets, values, calldatas, descriptionHash]);
      const execReceipt = await publicClient.waitForTransactionReceipt({ hash: execHash });

      gasTracker.record('execute', execReceipt.gasUsed);
      gasProfiler.record('ProposalManager.execute', execReceipt.gasUsed);

      expect(execReceipt.status).toBe('success');

      // Verify executed state
      const execEvent = findEventLog(execReceipt, ProposalManagerABI, 'ProposalExecuted');
      expect(execEvent.proposalId).toBe(propId);

      const proposal = await manager.read.proposals([propId]);
      expect(proposal.executed).toBe(true);
    });

    it('should cancel proposal', async () => {
      const manager = getContract({
        address: managerAddress,
        abi: ProposalManagerABI,
        client: { public: publicClient, wallet: alice },
      });

      const targets = [MOCK_ACCOUNTS[0].address];
      const values = [BigInt(0)];
      const calldatas = ['0x' as const];
      const description = 'Cancel test';

      const hash = await manager.write.propose([targets, values, calldatas, description]);
      const receipt = await publicClient.waitForTransactionReceipt({ hash });
      const event = findEventLog(receipt, ProposalManagerABI, 'ProposalCreated');
      const propId = event.proposalId;

      // Cancel
      const descriptionHash = keccak256(stringToHex(description));
      const cancelHash = await manager.write.cancel([targets, values, calldatas, descriptionHash]);
      const cancelReceipt = await publicClient.waitForTransactionReceipt({ hash: cancelHash });

      expect(cancelReceipt.status).toBe('success');

      const cancelEvent = findEventLog(cancelReceipt, ProposalManagerABI, 'ProposalCanceled');
      expect(cancelEvent.proposalId).toBe(propId);

      const state = await manager.read.state([propId]);
      expect(state).toBe(ProposalState.Canceled);
    });

    it('should reject executing defeated proposal', async () => {
      const manager = getContract({
        address: managerAddress,
        abi: ProposalManagerABI,
        client: { public: publicClient, wallet: alice },
      });

      const bobManager = getContract({
        address: managerAddress,
        abi: ProposalManagerABI,
        client: { public: publicClient, wallet: bob },
      });

      const targets = [MOCK_ACCOUNTS[0].address];
      const values = [BigInt(0)];
      const calldatas = ['0x' as const];
      const description = 'Defeated execute test';

      const hash = await manager.write.propose([targets, values, calldatas, description]);
      const receipt = await publicClient.waitForTransactionReceipt({ hash });
      const event = findEventLog(receipt, ProposalManagerABI, 'ProposalCreated');
      const propId = event.proposalId;

      await advanceBlocks(publicClient, MOCK_DAO_CONFIG.votingDelay + 1);

      // Vote against
      await manager.write.castVote([propId, VoteType.For]);
      await bobManager.write.castVote([propId, VoteType.Against]);

      await advanceBlocks(publicClient, MOCK_DAO_CONFIG.votingPeriod + 1);

      const descriptionHash = keccak256(stringToHex(description));
      await expectTransactionRevert(
        manager.write.execute([targets, values, calldatas, descriptionHash]),
        ERROR_SCENARIOS.proposalManager.proposalNotExecutable
      );
    });
  });

  describe('Threshold Requirements', () => {
    it('should enforce proposal threshold', async () => {
      const manager = getContract({
        address: managerAddress,
        abi: ProposalManagerABI,
        client: publicClient,
      });

      const threshold = await manager.read.proposalThreshold();
      expect(threshold).toBe(MOCK_DAO_CONFIG.proposalThreshold);
    });

    it('should calculate correct quorum', async () => {
      const manager = getContract({
        address: managerAddress,
        abi: ProposalManagerABI,
        client: publicClient,
      });

      // Get total supply
      const token = getContract({
        address: tokenAddress,
        abi: SoulBoundTokenABI,
        client: publicClient,
      });
      const totalSupply = await token.read.totalSupply();

      const currentBlock = await publicClient.getBlockNumber();
      const quorum = await manager.read.quorum([currentBlock - BigInt(1)]);

      // Quorum should be 40% of total supply
      const expectedQuorum = (totalSupply * BigInt(40)) / BigInt(100);
      expect(quorum).toBe(expectedQuorum);
    });
  });

  describe('Time Intervals', () => {
    it('should enforce voting delay', async () => {
      const manager = getContract({
        address: managerAddress,
        abi: ProposalManagerABI,
        client: publicClient,
      });

      const votingDelay = await manager.read.votingDelay();
      expect(votingDelay).toBe(BigInt(MOCK_DAO_CONFIG.votingDelay));
    });

    it('should enforce voting period', async () => {
      const manager = getContract({
        address: managerAddress,
        abi: ProposalManagerABI,
        client: publicClient,
      });

      const votingPeriod = await manager.read.votingPeriod();
      expect(votingPeriod).toBe(BigInt(MOCK_DAO_CONFIG.votingPeriod));
    });

    it('should calculate correct start and end blocks', async () => {
      const manager = getContract({
        address: managerAddress,
        abi: ProposalManagerABI,
        client: { public: publicClient, wallet: alice },
      });

      const targets = [MOCK_ACCOUNTS[0].address];
      const values = [BigInt(0)];
      const calldatas = ['0x' as const];

      const currentBlock = await publicClient.getBlockNumber();

      const hash = await manager.write.propose([targets, values, calldatas, 'Time test']);
      const receipt = await publicClient.waitForTransactionReceipt({ hash });
      const event = findEventLog(receipt, ProposalManagerABI, 'ProposalCreated');

      const expectedStart = currentBlock + BigInt(MOCK_DAO_CONFIG.votingDelay) + BigInt(1);
      const expectedEnd = expectedStart + BigInt(MOCK_DAO_CONFIG.votingPeriod);

      expect(event.startBlock).toBe(expectedStart);
      expect(event.endBlock).toBe(expectedEnd);
    });
  });

  describe('Gas Benchmarks', () => {
    it('should report gas usage for all operations', async () => {
      console.log('\n=== ProposalManager Gas Report ===');
      console.log(gasTracker.report());
      console.log(gasProfiler.generateReport());
    });

    it('should create proposal within gas limits', async () => {
      const createGas = gasTracker.get('createProposal');
      if (createGas) {
        expect(createGas).toBeLessThan(BigInt(250000)); // 250k gas limit
      }
    });

    it('should cast vote within gas limits', async () => {
      const voteGas = gasTracker.get('castVote');
      if (voteGas) {
        expect(voteGas).toBeLessThan(BigInt(100000)); // 100k gas limit
      }
    });

    it('should execute proposal within gas limits', async () => {
      const executeGas = gasTracker.get('execute');
      if (executeGas) {
        expect(executeGas).toBeLessThan(BigInt(200000)); // 200k gas limit
      }
    });
  });
});
