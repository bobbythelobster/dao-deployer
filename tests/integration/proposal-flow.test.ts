/**
 * Proposal Flow Integration Test
 * Create proposal with IPFS content → Vote → Check results → Execute
 */

import { describe, it, expect, beforeAll, beforeEach } from 'bun:test';
import { type Address, type WalletClient, type PublicClient, parseEther, getContract, keccak256, stringToHex } from 'viem';
import { getTestContext, takeSnapshot, revertToSnapshot } from '../setup';
import { 
  DAOFactoryABI, DAOFactoryBytecode,
  ProposalManagerABI, ProposalManagerBytecode,
  SoulBoundTokenABI, SoulBoundTokenBytecode
} from '../contracts/abis';
import { MOCK_ACCOUNTS, MOCK_DAO_CONFIG, ProposalState, VoteType, generateIPFSMetadata, mockIPFSUpload } from '../mocks/data';
import { deployContract, findEventLog, advanceBlocks, mockIPFSDownload } from '../utils/helpers';

describe('Proposal Flow with IPFS', () => {
  let context: ReturnType<typeof getTestContext>;
  let publicClient: PublicClient;
  let deployer: WalletClient;
  let alice: WalletClient;
  let bob: WalletClient;
  let carol: WalletClient;
  let snapshotId: string;

  let factoryAddress: Address;
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

  describe('IPFS Content Integration', () => {
    it('should create proposal with IPFS metadata', async () => {
      // Setup DAO
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
        name: 'IPFS DAO',
        symbol: 'IPDAO',
        metadata: 'ipfs://QmDAOMetadata',
        votingDelay: BigInt(1),
        votingPeriod: BigInt(100),
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
      await token.write.mint([MOCK_ACCOUNTS[3].address, parseEther('250')]);

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

      // Upload proposal metadata to IPFS
      const proposalMetadata = generateIPFSMetadata(
        'Treasury Allocation Proposal',
        'This proposal allocates funds for Q1 development'
      );
      proposalMetadata.resources = [
        { name: 'Budget Breakdown', url: 'https://example.com/budget' },
        { name: 'Roadmap', url: 'https://example.com/roadmap' },
      ];

      const ipfsHash = await mockIPFSUpload(proposalMetadata);
      console.log(`   📄 Proposal metadata uploaded to IPFS: ${ipfsHash}`);

      // Create proposal with IPFS reference
      const manager = getContract({
        address: managerAddress,
        abi: ProposalManagerABI,
        client: { public: publicClient, wallet: alice },
      });

      const targets = [daoEvent.daoAddress];
      const values = [BigInt(0)];
      const calldatas = ['0x' as const];
      const description = `Allocate treasury funds [IPFS: ${ipfsHash}]`;

      const hash = await manager.write.propose([
        targets,
        values,
        calldatas,
        description,
      ]);

      const receipt = await publicClient.waitForTransactionReceipt({ hash });
      const event = findEventLog(receipt, ProposalManagerABI, 'ProposalCreated');
      const proposalId = event.proposalId;

      expect(receipt.status).toBe('success');
      console.log(`   ✓ Proposal #${proposalId.toString()} created with IPFS content`);

      // Verify proposal can be retrieved with IPFS hash
      const proposal = await manager.read.proposals([proposalId]);
      expect(proposal.id).toBe(proposalId);

      // Simulate fetching IPFS content
      const fetchedMetadata = await mockIPFSDownload(ipfsHash);
      expect(fetchedMetadata.title).toBe(proposalMetadata.title);
      expect(fetchedMetadata.description).toBe(proposalMetadata.description);
      console.log(`   ✓ IPFS content verified: ${fetchedMetadata.title}`);
    });

    it('should vote on proposal and track results', async () => {
      // Setup
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
        name: 'Voting Test DAO',
        symbol: 'VTDAO',
        metadata: 'ipfs://QmTest',
        votingDelay: BigInt(1),
        votingPeriod: BigInt(100),
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
      await token.write.mint([MOCK_ACCOUNTS[3].address, parseEther('250')]);

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
        'Voting test proposal',
      ]);

      const receipt = await publicClient.waitForTransactionReceipt({ hash });
      const event = findEventLog(receipt, ProposalManagerABI, 'ProposalCreated');
      const proposalId = event.proposalId;

      // Advance to voting
      await advanceBlocks(publicClient, Number(daoConfig.votingDelay) + 1);

      // Cast votes
      console.log('\n🗳️  Voting Phase:');

      // Alice votes FOR
      const aliceManager = getContract({
        address: managerAddress,
        abi: ProposalManagerABI,
        client: { public: publicClient, wallet: alice },
      });

      await aliceManager.write.castVote([proposalId, VoteType.For]);
      console.log(`   ✓ Alice voted FOR (1000 votes)`);

      // Bob votes FOR
      const bobManager = getContract({
        address: managerAddress,
        abi: ProposalManagerABI,
        client: { public: publicClient, wallet: bob },
      });

      await bobManager.write.castVote([proposalId, VoteType.For]);
      console.log(`   ✓ Bob voted FOR (500 votes)`);

      // Carol votes AGAINST
      const carolManager = getContract({
        address: managerAddress,
        abi: ProposalManagerABI,
        client: { public: publicClient, wallet: carol },
      });

      await carolManager.write.castVote([proposalId, VoteType.Against]);
      console.log(`   ✓ Carol voted AGAINST (250 votes)`);

      // Check results
      const proposal = await manager.read.proposals([proposalId]);
      
      console.log('\n📊 Voting Results:');
      console.log(`   FOR: ${proposal.forVotes.toString()} votes (${Number(proposal.forVotes) / 1750 * 100}%)`);
      console.log(`   AGAINST: ${proposal.againstVotes.toString()} votes (${Number(proposal.againstVotes) / 1750 * 100}%)`);
      console.log(`   ABSTAIN: ${proposal.abstainVotes.toString()} votes`);

      expect(proposal.forVotes).toBe(parseEther('1500'));
      expect(proposal.againstVotes).toBe(parseEther('250'));
      expect(proposal.abstainVotes).toBe(BigInt(0));

      // Check individual votes
      const aliceVoted = await manager.read.hasVoted([proposalId, MOCK_ACCOUNTS[1].address]);
      const bobVoted = await manager.read.hasVoted([proposalId, MOCK_ACCOUNTS[2].address]);
      const carolVoted = await manager.read.hasVoted([proposalId, MOCK_ACCOUNTS[3].address]);

      expect(aliceVoted).toBe(true);
      expect(bobVoted).toBe(true);
      expect(carolVoted).toBe(true);

      // Verify quorum
      const currentBlock = await publicClient.getBlockNumber();
      const quorum = await manager.read.quorum([currentBlock - BigInt(1)]);
      const totalVotes = proposal.forVotes + proposal.againstVotes + proposal.abstainVotes;
      
      console.log(`   Quorum required: ${quorum.toString()} votes`);
      console.log(`   Total votes cast: ${totalVotes.toString()}`);
      
      expect(totalVotes).toBeGreaterThanOrEqual(quorum);
    });

    it('should execute passed proposal', async () => {
      // Setup
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
        name: 'Execution Test DAO',
        symbol: 'ETDAO',
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
      await token.write.mint([MOCK_ACCOUNTS[3].address, parseEther('250')]);

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

      const description = 'Execute this proposal';
      const hash = await manager.write.propose([
        [daoEvent.daoAddress],
        [BigInt(0)],
        ['0x'],
        description,
      ]);

      const receipt = await publicClient.waitForTransactionReceipt({ hash });
      const event = findEventLog(receipt, ProposalManagerABI, 'ProposalCreated');
      const proposalId = event.proposalId;

      // Advance to voting
      await advanceBlocks(publicClient, Number(daoConfig.votingDelay) + 1);

      // Cast votes to pass
      await manager.write.castVote([proposalId, VoteType.For]);

      const bobManager = getContract({
        address: managerAddress,
        abi: ProposalManagerABI,
        client: { public: publicClient, wallet: bob },
      });
      await bobManager.write.castVote([proposalId, VoteType.For]);

      const carolManager = getContract({
        address: managerAddress,
        abi: ProposalManagerABI,
        client: { public: publicClient, wallet: carol },
      });
      await carolManager.write.castVote([proposalId, VoteType.For]);

      // Advance past voting
      await advanceBlocks(publicClient, Number(daoConfig.votingPeriod) + 1);

      // Check state before execution
      let state = await manager.read.state([proposalId]);
      expect(state).toBe(ProposalState.Succeeded);
      console.log('\n✅ Proposal passed and ready for execution');

      // Execute
      const descriptionHash = keccak256(stringToHex(description));
      const executeHash = await manager.write.execute([
        [daoEvent.daoAddress],
        [BigInt(0)],
        ['0x'],
        descriptionHash,
      ]);

      const executeReceipt = await publicClient.waitForTransactionReceipt({ hash: executeHash });
      expect(executeReceipt.status).toBe('success');

      // Verify executed
      state = await manager.read.state([proposalId]);
      expect(state).toBe(ProposalState.Executed);

      const proposal = await manager.read.proposals([proposalId]);
      expect(proposal.executed).toBe(true);

      console.log('🎉 Proposal executed successfully!');
    });

    it('should not execute defeated proposal', async () => {
      // Setup
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
        name: 'Defeat Test DAO',
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

      const description = 'Defeated proposal';
      const hash = await manager.write.propose([
        [daoEvent.daoAddress],
        [BigInt(0)],
        ['0x'],
        description,
      ]);

      const receipt = await publicClient.waitForTransactionReceipt({ hash });
      const event = findEventLog(receipt, ProposalManagerABI, 'ProposalCreated');
      const proposalId = event.proposalId;

      // Advance to voting
      await advanceBlocks(publicClient, Number(daoConfig.votingDelay) + 1);

      // Alice votes FOR (not enough)
      await manager.write.castVote([proposalId, VoteType.For]);

      // Bob votes AGAINST (more votes)
      const bobManager = getContract({
        address: managerAddress,
        abi: ProposalManagerABI,
        client: { public: publicClient, wallet: bob },
      });
      await bobManager.write.castVote([proposalId, VoteType.Against]);

      // Advance past voting
      await advanceBlocks(publicClient, Number(daoConfig.votingPeriod) + 1);

      // Check state - should be defeated
      const state = await manager.read.state([proposalId]);
      expect(state).toBe(ProposalState.Defeated);
      console.log('\n❌ Proposal defeated');

      // Try to execute - should fail
      const descriptionHash = keccak256(stringToHex(description));
      
      let executionFailed = false;
      try {
        await manager.write.execute([
          [daoEvent.daoAddress],
          [BigInt(0)],
          ['0x'],
          descriptionHash,
        ]);
      } catch (error) {
        executionFailed = true;
        console.log('   ✓ Execution correctly rejected');
      }

      expect(executionFailed).toBe(true);
    });
  });
});
