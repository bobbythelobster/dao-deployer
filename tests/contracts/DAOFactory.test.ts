/**
 * DAOFactory Unit Tests
 * Tests for DAO creation, token deployment, and plugin installation
 */

import { describe, it, expect, beforeEach, beforeAll } from 'bun:test';
import { type Address, type WalletClient, type PublicClient, parseEther, getContract } from 'viem';
import { getTestContext, GasTracker, takeSnapshot, revertToSnapshot } from '../setup';
import { DAOFactoryABI, DAOFactoryBytecode } from './abis';
import { MOCK_ACCOUNTS, MOCK_DAO_CONFIG, MOCK_TOKEN_CONFIG, ARAGON_PLUGIN_ADDRESSES } from '../mocks/data';
import { deployContract, findEventLog, expectTransactionRevert, GasProfiler, expectAddress } from '../utils/helpers';

describe('DAOFactory', () => {
  let context: ReturnType<typeof getTestContext>;
  let publicClient: PublicClient;
  let deployer: WalletClient;
  let alice: WalletClient;
  let factoryAddress: Address;
  let snapshotId: string;
  let gasTracker: GasTracker;
  let gasProfiler: GasProfiler;

  beforeAll(async () => {
    context = getTestContext();
    publicClient = context.publicClient;
    deployer = context.walletClients.deployer;
    alice = context.walletClients.alice;
    gasTracker = new GasTracker();
    gasProfiler = new GasProfiler();
  });

  beforeEach(async () => {
    snapshotId = await takeSnapshot(publicClient);

    // Deploy DAOFactory contract
    factoryAddress = await deployContract(
      deployer,
      publicClient,
      DAOFactoryABI,
      DAOFactoryBytecode,
      [ARAGON_PLUGIN_ADDRESSES.tokenVoting] // Aragon repo address
    );

    context.contracts.daoFactory = factoryAddress;
  });

  afterEach(async () => {
    await revertToSnapshot(publicClient, snapshotId);
  });

  describe('Deployment', () => {
    it('should deploy with correct aragon repo address', async () => {
      const factory = getContract({
        address: factoryAddress,
        abi: DAOFactoryABI,
        client: publicClient,
      });

      const aragonRepo = await factory.read.aragonRepo();
      expect(aragonRepo.toLowerCase()).toBe(ARAGON_PLUGIN_ADDRESSES.tokenVoting.toLowerCase());
    });

    it('should start with zero DAOs', async () => {
      const factory = getContract({
        address: factoryAddress,
        abi: DAOFactoryABI,
        client: publicClient,
      });

      const daos = await factory.read.getDAOsByCreator([MOCK_ACCOUNTS[0].address]);
      expect(daos).toHaveLength(0);
    });
  });

  describe('DAO Creation', () => {
    it('should create a DAO with governance token', async () => {
      const factory = getContract({
        address: factoryAddress,
        abi: DAOFactoryABI,
        client: { public: publicClient, wallet: deployer },
      });

      const config = {
        name: MOCK_DAO_CONFIG.name,
        symbol: MOCK_TOKEN_CONFIG.symbol,
        metadata: MOCK_DAO_CONFIG.metadata,
        votingDelay: BigInt(MOCK_DAO_CONFIG.votingDelay),
        votingPeriod: BigInt(MOCK_DAO_CONFIG.votingPeriod),
        proposalThreshold: MOCK_DAO_CONFIG.proposalThreshold,
        quorumNumerator: BigInt(MOCK_DAO_CONFIG.quorumNumerator),
      };

      const hash = await factory.write.createDAO([config]);
      const receipt = await publicClient.waitForTransactionReceipt({ hash });

      gasTracker.record('createDAO', receipt.gasUsed);
      gasProfiler.record('DAOFactory.createDAO', receipt.gasUsed);

      expect(receipt.status).toBe('success');

      // Check DAOCreated event
      const daoCreatedEvent = findEventLog(receipt, DAOFactoryABI, 'DAOCreated');
      expect(daoCreatedEvent).toBeDefined();
      expectAddress(daoCreatedEvent.daoAddress);
      expectAddress(daoCreatedEvent.tokenAddress);
      expect(daoCreatedEvent.name).toBe(MOCK_DAO_CONFIG.name);

      // Verify DAO is tracked
      const daos = await factory.read.getDAOsByCreator([MOCK_ACCOUNTS[0].address]);
      expect(daos).toHaveLength(1);
      expect(daos[0].toLowerCase()).toBe(daoCreatedEvent.daoAddress.toLowerCase());

      // Verify DAO info
      const daoInfo = await factory.read.getDAO([daoCreatedEvent.daoAddress]);
      expect(daoInfo.name).toBe(MOCK_DAO_CONFIG.name);
      expect(daoInfo.tokenAddress.toLowerCase()).toBe(daoCreatedEvent.tokenAddress.toLowerCase());
      expect(daoInfo.active).toBe(true);
    });

    it('should create multiple DAOs for same creator', async () => {
      const factory = getContract({
        address: factoryAddress,
        abi: DAOFactoryABI,
        client: { public: publicClient, wallet: deployer },
      });

      const config1 = {
        name: 'DAO One',
        symbol: 'DAO1',
        metadata: 'metadata1',
        votingDelay: BigInt(1),
        votingPeriod: BigInt(100),
        proposalThreshold: parseEther('100'),
        quorumNumerator: BigInt(40),
      };

      const config2 = {
        name: 'DAO Two',
        symbol: 'DAO2',
        metadata: 'metadata2',
        votingDelay: BigInt(2),
        votingPeriod: BigInt(200),
        proposalThreshold: parseEther('200'),
        quorumNumerator: BigInt(50),
      };

      await factory.write.createDAO([config1]);
      await factory.write.createDAO([config2]);

      const daos = await factory.read.getDAOsByCreator([MOCK_ACCOUNTS[0].address]);
      expect(daos).toHaveLength(2);
    });

    it('should create DAOs for different creators', async () => {
      const deployerFactory = getContract({
        address: factoryAddress,
        abi: DAOFactoryABI,
        client: { public: publicClient, wallet: deployer },
      });

      const aliceFactory = getContract({
        address: factoryAddress,
        abi: DAOFactoryABI,
        client: { public: publicClient, wallet: alice },
      });

      const config = {
        name: MOCK_DAO_CONFIG.name,
        symbol: MOCK_TOKEN_CONFIG.symbol,
        metadata: MOCK_DAO_CONFIG.metadata,
        votingDelay: BigInt(MOCK_DAO_CONFIG.votingDelay),
        votingPeriod: BigInt(MOCK_DAO_CONFIG.votingPeriod),
        proposalThreshold: MOCK_DAO_CONFIG.proposalThreshold,
        quorumNumerator: BigInt(MOCK_DAO_CONFIG.quorumNumerator),
      };

      await deployerFactory.write.createDAO([config]);
      await aliceFactory.write.createDAO([{ ...config, name: 'Alice DAO' }]);

      const deployerDAOs = await deployerFactory.read.getDAOsByCreator([MOCK_ACCOUNTS[0].address]);
      const aliceDAOs = await aliceFactory.read.getDAOsByCreator([MOCK_ACCOUNTS[1].address]);

      expect(deployerDAOs).toHaveLength(1);
      expect(aliceDAOs).toHaveLength(1);
      expect(deployerDAOs[0]).not.toBe(aliceDAOs[0]);
    });

    it('should reject invalid DAO configuration', async () => {
      const factory = getContract({
        address: factoryAddress,
        abi: DAOFactoryABI,
        client: { public: publicClient, wallet: deployer },
      });

      const invalidConfig = {
        name: '', // Empty name
        symbol: MOCK_TOKEN_CONFIG.symbol,
        metadata: MOCK_DAO_CONFIG.metadata,
        votingDelay: BigInt(MOCK_DAO_CONFIG.votingDelay),
        votingPeriod: BigInt(MOCK_DAO_CONFIG.votingPeriod),
        proposalThreshold: MOCK_DAO_CONFIG.proposalThreshold,
        quorumNumerator: BigInt(MOCK_DAO_CONFIG.quorumNumerator),
      };

      await expectTransactionRevert(
        factory.write.createDAO([invalidConfig]),
        /invalid|empty|name/i
      );
    });

    it('should reject zero voting period', async () => {
      const factory = getContract({
        address: factoryAddress,
        abi: DAOFactoryABI,
        client: { public: publicClient, wallet: deployer },
      });

      const invalidConfig = {
        name: MOCK_DAO_CONFIG.name,
        symbol: MOCK_TOKEN_CONFIG.symbol,
        metadata: MOCK_DAO_CONFIG.metadata,
        votingDelay: BigInt(1),
        votingPeriod: BigInt(0), // Zero voting period
        proposalThreshold: MOCK_DAO_CONFIG.proposalThreshold,
        quorumNumerator: BigInt(MOCK_DAO_CONFIG.quorumNumerator),
      };

      await expectTransactionRevert(
        factory.write.createDAO([invalidConfig]),
        /invalid|zero|voting period/i
      );
    });

    it('should reject quorum > 100%', async () => {
      const factory = getContract({
        address: factoryAddress,
        abi: DAOFactoryABI,
        client: { public: publicClient, wallet: deployer },
      });

      const invalidConfig = {
        name: MOCK_DAO_CONFIG.name,
        symbol: MOCK_TOKEN_CONFIG.symbol,
        metadata: MOCK_DAO_CONFIG.metadata,
        votingDelay: BigInt(1),
        votingPeriod: BigInt(100),
        proposalThreshold: MOCK_DAO_CONFIG.proposalThreshold,
        quorumNumerator: BigInt(101), // > 100%
      };

      await expectTransactionRevert(
        factory.write.createDAO([invalidConfig]),
        /invalid|quorum|exceeds/i
      );
    });
  });

  describe('Token Deployment', () => {
    it('should deploy token with initial distribution', async () => {
      const factory = getContract({
        address: factoryAddress,
        abi: DAOFactoryABI,
        client: { public: publicClient, wallet: deployer },
      });

      const initialHolders = [
        MOCK_ACCOUNTS[1].address,
        MOCK_ACCOUNTS[2].address,
        MOCK_ACCOUNTS[3].address,
      ];

      const initialBalances = [
        parseEther('1000'),
        parseEther('500'),
        parseEther('250'),
      ];

      const hash = await factory.write.deployToken([
        MOCK_TOKEN_CONFIG.name,
        MOCK_TOKEN_CONFIG.symbol,
        initialHolders,
        initialBalances,
      ]);

      const receipt = await publicClient.waitForTransactionReceipt({ hash });

      gasTracker.record('deployToken', receipt.gasUsed);
      gasProfiler.record('DAOFactory.deployToken', receipt.gasUsed);

      expect(receipt.status).toBe('success');

      // Check TokenDeployed event
      const tokenEvent = findEventLog(receipt, DAOFactoryABI, 'TokenDeployed');
      expect(tokenEvent).toBeDefined();
      expectAddress(tokenEvent.tokenAddress);
      expect(tokenEvent.name).toBe(MOCK_TOKEN_CONFIG.name);
      expect(tokenEvent.symbol).toBe(MOCK_TOKEN_CONFIG.symbol);
    });

    it('should deploy token with empty initial distribution', async () => {
      const factory = getContract({
        address: factoryAddress,
        abi: DAOFactoryABI,
        client: { public: publicClient, wallet: deployer },
      });

      const hash = await factory.write.deployToken([
        MOCK_TOKEN_CONFIG.name,
        MOCK_TOKEN_CONFIG.symbol,
        [],
        [],
      ]);

      const receipt = await publicClient.waitForTransactionReceipt({ hash });
      expect(receipt.status).toBe('success');

      const tokenEvent = findEventLog(receipt, DAOFactoryABI, 'TokenDeployed');
      expect(tokenEvent).toBeDefined();
    });

    it('should reject mismatched holders and balances arrays', async () => {
      const factory = getContract({
        address: factoryAddress,
        abi: DAOFactoryABI,
        client: { public: publicClient, wallet: deployer },
      });

      const holders = [MOCK_ACCOUNTS[1].address, MOCK_ACCOUNTS[2].address];
      const balances = [parseEther('1000')]; // Mismatched length

      await expectTransactionRevert(
        factory.write.deployToken([
          MOCK_TOKEN_CONFIG.name,
          MOCK_TOKEN_CONFIG.symbol,
          holders,
          balances,
        ]),
        /mismatch|length|array/i
      );
    });

    it('should reject empty token name', async () => {
      const factory = getContract({
        address: factoryAddress,
        abi: DAOFactoryABI,
        client: { public: publicClient, wallet: deployer },
      });

      await expectTransactionRevert(
        factory.write.deployToken(['', 'SYM', [], []]),
        /invalid|empty|name/i
      );
    });

    it('should reject empty token symbol', async () => {
      const factory = getContract({
        address: factoryAddress,
        abi: DAOFactoryABI,
        client: { public: publicClient, wallet: deployer },
      });

      await expectTransactionRevert(
        factory.write.deployToken(['Name', '', [], []]),
        /invalid|empty|symbol/i
      );
    });
  });

  describe('Plugin Installation', () => {
    let daoAddress: Address;

    beforeEach(async () => {
      // Create a DAO first
      const factory = getContract({
        address: factoryAddress,
        abi: DAOFactoryABI,
        client: { public: publicClient, wallet: deployer },
      });

      const config = {
        name: MOCK_DAO_CONFIG.name,
        symbol: MOCK_TOKEN_CONFIG.symbol,
        metadata: MOCK_DAO_CONFIG.metadata,
        votingDelay: BigInt(MOCK_DAO_CONFIG.votingDelay),
        votingPeriod: BigInt(MOCK_DAO_CONFIG.votingPeriod),
        proposalThreshold: MOCK_DAO_CONFIG.proposalThreshold,
        quorumNumerator: BigInt(MOCK_DAO_CONFIG.quorumNumerator),
      };

      const hash = await factory.write.createDAO([config]);
      const receipt = await publicClient.waitForTransactionReceipt({ hash });
      const event = findEventLog(receipt, DAOFactoryABI, 'DAOCreated');
      daoAddress = event.daoAddress;
    });

    it('should install plugin to DAO', async () => {
      const factory = getContract({
        address: factoryAddress,
        abi: DAOFactoryABI,
        client: { public: publicClient, wallet: deployer },
      });

      const pluginAddress = ARAGON_PLUGIN_ADDRESSES.multisig;
      const pluginData = '0x' as const;

      const hash = await factory.write.installPlugin([daoAddress, pluginAddress, pluginData]);
      const receipt = await publicClient.waitForTransactionReceipt({ hash });

      expect(receipt.status).toBe('success');

      // Check PluginInstalled event
      const pluginEvent = findEventLog(receipt, DAOFactoryABI, 'PluginInstalled');
      expect(pluginEvent).toBeDefined();
      expect(pluginEvent.daoAddress.toLowerCase()).toBe(daoAddress.toLowerCase());
      expect(pluginEvent.pluginAddress.toLowerCase()).toBe(pluginAddress.toLowerCase());
    });

    it('should reject plugin installation to non-existent DAO', async () => {
      const factory = getContract({
        address: factoryAddress,
        abi: DAOFactoryABI,
        client: { public: publicClient, wallet: deployer },
      });

      const fakeDAO = '0x1234567890123456789012345678901234567890' as Address;
      const pluginAddress = ARAGON_PLUGIN_ADDRESSES.multisig;

      await expectTransactionRevert(
        factory.write.installPlugin([fakeDAO, pluginAddress, '0x']),
        /not found|invalid|dao/i
      );
    });

    it('should reject plugin installation with zero address', async () => {
      const factory = getContract({
        address: factoryAddress,
        abi: DAOFactoryABI,
        client: { public: publicClient, wallet: deployer },
      });

      const zeroAddress = '0x0000000000000000000000000000000000000000' as Address;

      await expectTransactionRevert(
        factory.write.installPlugin([daoAddress, zeroAddress, '0x']),
        /invalid|zero|address/i
      );
    });

    it('should allow multiple plugins on same DAO', async () => {
      const factory = getContract({
        address: factoryAddress,
        abi: DAOFactoryABI,
        client: { public: publicClient, wallet: deployer },
      });

      const plugin1 = ARAGON_PLUGIN_ADDRESSES.tokenVoting;
      const plugin2 = ARAGON_PLUGIN_ADDRESSES.multisig;

      await factory.write.installPlugin([daoAddress, plugin1, '0x']);
      await factory.write.installPlugin([daoAddress, plugin2, '0x']);

      // Both should succeed
      const daoInfo = await factory.read.getDAO([daoAddress]);
      expect(daoInfo.active).toBe(true);
    });
  });

  describe('DAO Querying', () => {
    it('should return correct DAO info', async () => {
      const factory = getContract({
        address: factoryAddress,
        abi: DAOFactoryABI,
        client: { public: publicClient, wallet: deployer },
      });

      const config = {
        name: 'Test DAO Query',
        symbol: 'TDQ',
        metadata: 'test metadata',
        votingDelay: BigInt(1),
        votingPeriod: BigInt(100),
        proposalThreshold: parseEther('50'),
        quorumNumerator: BigInt(30),
      };

      const hash = await factory.write.createDAO([config]);
      const receipt = await publicClient.waitForTransactionReceipt({ hash });
      const event = findEventLog(receipt, DAOFactoryABI, 'DAOCreated');

      const daoInfo = await factory.read.getDAO([event.daoAddress]);

      expect(daoInfo.name).toBe(config.name);
      expect(daoInfo.active).toBe(true);
      expect(daoInfo.createdAt).toBeGreaterThan(BigInt(0));
      expectAddress(daoInfo.tokenAddress);
    });

    it('should return empty for non-existent DAO', async () => {
      const factory = getContract({
        address: factoryAddress,
        abi: DAOFactoryABI,
        client: publicClient,
      });

      const fakeDAO = '0x1234567890123456789012345678901234567890' as Address;

      await expectTransactionRevert(
        factory.read.getDAO([fakeDAO]),
        /not found|invalid|dao/i
      );
    });

    it('should track creator DAOs correctly', async () => {
      const factory = getContract({
        address: factoryAddress,
        abi: DAOFactoryABI,
        client: { public: publicClient, wallet: deployer },
      });

      const config = {
        name: MOCK_DAO_CONFIG.name,
        symbol: MOCK_TOKEN_CONFIG.symbol,
        metadata: MOCK_DAO_CONFIG.metadata,
        votingDelay: BigInt(MOCK_DAO_CONFIG.votingDelay),
        votingPeriod: BigInt(MOCK_DAO_CONFIG.votingPeriod),
        proposalThreshold: MOCK_DAO_CONFIG.proposalThreshold,
        quorumNumerator: BigInt(MOCK_DAO_CONFIG.quorumNumerator),
      };

      // Create 3 DAOs
      await factory.write.createDAO([{ ...config, name: 'DAO 1' }]);
      await factory.write.createDAO([{ ...config, name: 'DAO 2' }]);
      await factory.write.createDAO([{ ...config, name: 'DAO 3' }]);

      const daos = await factory.read.getDAOsByCreator([MOCK_ACCOUNTS[0].address]);
      expect(daos).toHaveLength(3);

      // All should be unique
      const uniqueDAOs = new Set(daos.map(a => a.toLowerCase()));
      expect(uniqueDAOs.size).toBe(3);
    });
  });

  describe('Gas Benchmarks', () => {
    it('should report gas usage for all operations', async () => {
      console.log('\n=== DAOFactory Gas Report ===');
      console.log(gasTracker.report());
      console.log(gasProfiler.generateReport());
    });

    it('should create DAO within gas limits', async () => {
      const factory = getContract({
        address: factoryAddress,
        abi: DAOFactoryABI,
        client: { public: publicClient, wallet: deployer },
      });

      const config = {
        name: MOCK_DAO_CONFIG.name,
        symbol: MOCK_TOKEN_CONFIG.symbol,
        metadata: MOCK_DAO_CONFIG.metadata,
        votingDelay: BigInt(MOCK_DAO_CONFIG.votingDelay),
        votingPeriod: BigInt(MOCK_DAO_CONFIG.votingPeriod),
        proposalThreshold: MOCK_DAO_CONFIG.proposalThreshold,
        quorumNumerator: BigInt(MOCK_DAO_CONFIG.quorumNumerator),
      };

      const hash = await factory.write.createDAO([config]);
      const receipt = await publicClient.waitForTransactionReceipt({ hash });

      expect(receipt.gasUsed).toBeLessThan(BigInt(3000000)); // 3M gas limit
    });

    it('should deploy token within gas limits', async () => {
      const factory = getContract({
        address: factoryAddress,
        abi: DAOFactoryABI,
        client: { public: publicClient, wallet: deployer },
      });

      const hash = await factory.write.deployToken([
        MOCK_TOKEN_CONFIG.name,
        MOCK_TOKEN_CONFIG.symbol,
        [],
        [],
      ]);

      const receipt = await publicClient.waitForTransactionReceipt({ hash });

      expect(receipt.gasUsed).toBeLessThan(BigInt(1500000)); // 1.5M gas limit
    });
  });
});
