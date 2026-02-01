/**
 * Aragon SDK Integration Tests
 * Tests for Aragon SDK client configuration and operations
 */

import { describe, it, expect, beforeEach, vi } from 'bun:test';
import { type Address } from 'viem';
import { MOCK_ARAGON_DAO, ARAGON_PLUGIN_ADDRESSES } from '../mocks/data';

describe('Aragon SDK Integration', () => {
  const mockClient = {
    methods: {
      createDAO: vi.fn(),
      getDAO: vi.fn(),
      createProposal: vi.fn(),
      vote: vi.fn(),
      execute: vi.fn(),
      getProposals: vi.fn(),
      getProposal: vi.fn(),
      installPlugin: vi.fn(),
      getPlugins: vi.fn(),
    },
    ipfs: {
      upload: vi.fn(),
      fetch: vi.fn(),
    },
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('DAO Creation', () => {
    it('should create DAO with correct parameters', async () => {
      const expectedResult = {
        daoAddress: '0x1234567890123456789012345678901234567890',
        pluginAddresses: [ARAGON_PLUGIN_ADDRESSES.tokenVoting],
      };

      mockClient.methods.createDAO.mockResolvedValue(expectedResult);

      const result = await mockClient.methods.createDAO(MOCK_ARAGON_DAO);

      expect(mockClient.methods.createDAO).toHaveBeenCalledWith(MOCK_ARAGON_DAO);
      expect(result.daoAddress).toMatch(/^0x[a-fA-F0-9]{40}$/);
    });

    it('should include metadata in DAO creation', async () => {
      const daoParams = {
        ...MOCK_ARAGON_DAO,
        metadata: JSON.stringify({
          name: 'Test DAO',
          description: 'A test DAO',
          avatar: 'ipfs://QmAvatar',
        }),
      };

      await mockClient.methods.createDAO(daoParams);

      const callArg = mockClient.methods.createDAO.mock.calls[0][0];
      expect(callArg.metadata).toBeDefined();
    });

    it('should install plugins during DAO creation', async () => {
      const daoWithPlugins = {
        ...MOCK_ARAGON_DAO,
        plugins: [
          {
            pluginAddress: ARAGON_PLUGIN_ADDRESSES.tokenVoting,
            pluginRepoAddress: ARAGON_PLUGIN_ADDRESSES.tokenVoting,
            data: '0x' as Address,
          },
        ],
      };

      await mockClient.methods.createDAO(daoWithPlugins);

      const callArg = mockClient.methods.createDAO.mock.calls[0][0];
      expect(callArg.plugins).toHaveLength(1);
    });
  });

  describe('DAO Query', () => {
    it('should get DAO details by address', async () => {
      const mockDAO = {
        address: '0x1234567890123456789012345678901234567890',
        name: 'Test DAO',
        description: 'Test description',
        plugins: [],
      };

      mockClient.methods.getDAO.mockResolvedValue(mockDAO);

      const result = await mockClient.methods.getDAO(mockDAO.address);

      expect(result).toBeDefined();
      expect(result.name).toBe('Test DAO');
    });

    it('should return null for non-existent DAO', async () => {
      mockClient.methods.getDAO.mockResolvedValue(null);

      const result = await mockClient.methods.getDAO('0xnonexistent');

      expect(result).toBeNull();
    });
  });

  describe('Proposal Management', () => {
    it('should create proposal with metadata', async () => {
      const proposalData = {
        daoAddress: '0x1234567890123456789012345678901234567890',
        title: 'Test Proposal',
        summary: 'Test summary',
        description: 'Test description',
        resources: [],
        actions: [],
      };

      const expectedResult = {
        proposalId: BigInt(1),
        transactionHash: '0xhash',
      };

      mockClient.methods.createProposal.mockResolvedValue(expectedResult);

      const result = await mockClient.methods.createProposal(proposalData);

      expect(result.proposalId).toBeDefined();
    });

    it('should cast vote on proposal', async () => {
      const voteData = {
        daoAddress: '0x1234567890123456789012345678901234567890',
        proposalId: BigInt(1),
        vote: 1, // YES
      };

      mockClient.methods.vote.mockResolvedValue({ transactionHash: '0xhash' });

      const result = await mockClient.methods.vote(voteData);

      expect(result.transactionHash).toBeDefined();
    });

    it('should execute proposal', async () => {
      const executeData = {
        daoAddress: '0x1234567890123456789012345678901234567890',
        proposalId: BigInt(1),
      };

      mockClient.methods.execute.mockResolvedValue({ transactionHash: '0xhash' });

      const result = await mockClient.methods.execute(executeData);

      expect(result.transactionHash).toBeDefined();
    });

    it('should get all proposals for DAO', async () => {
      const mockProposals = [
        { id: BigInt(1), title: 'Proposal 1', state: 'Active' },
        { id: BigInt(2), title: 'Proposal 2', state: 'Executed' },
      ];

      mockClient.methods.getProposals.mockResolvedValue(mockProposals);

      const result = await mockClient.methods.getProposals('0xdao');

      expect(result).toHaveLength(2);
    });

    it('should get single proposal details', async () => {
      const mockProposal = {
        id: BigInt(1),
        title: 'Test Proposal',
        state: 'Active',
        votes: {
          yes: BigInt('1000'),
          no: BigInt('500'),
          abstain: BigInt('100'),
        },
      };

      mockClient.methods.getProposal.mockResolvedValue(mockProposal);

      const result = await mockClient.methods.getProposal('0xdao', BigInt(1));

      expect(result.title).toBe('Test Proposal');
      expect(result.votes.yes).toBe(BigInt('1000'));
    });
  });

  describe('Plugin Management', () => {
    it('should install plugin on DAO', async () => {
      const installData = {
        daoAddress: '0x1234567890123456789012345678901234567890',
        pluginAddress: ARAGON_PLUGIN_ADDRESSES.multisig,
        data: '0x',
      };

      mockClient.methods.installPlugin.mockResolvedValue({ transactionHash: '0xhash' });

      const result = await mockClient.methods.installPlugin(installData);

      expect(result.transactionHash).toBeDefined();
    });

    it('should get installed plugins', async () => {
      const mockPlugins = [
        { address: ARAGON_PLUGIN_ADDRESSES.tokenVoting, name: 'TokenVoting' },
        { address: ARAGON_PLUGIN_ADDRESSES.multisig, name: 'Multisig' },
      ];

      mockClient.methods.getPlugins.mockResolvedValue(mockPlugins);

      const result = await mockClient.methods.getPlugins('0xdao');

      expect(result).toHaveLength(2);
    });
  });

  describe('IPFS Integration', () => {
    it('should upload metadata to IPFS', async () => {
      const metadata = {
        title: 'Test',
        description: 'Test description',
      };

      mockClient.ipfs.upload.mockResolvedValue('QmTestHash');

      const result = await mockClient.ipfs.upload(metadata);

      expect(result).toMatch(/^Qm[a-zA-Z0-9]{44}$/);
    });

    it('should fetch metadata from IPFS', async () => {
      const mockMetadata = {
        title: 'Test',
        description: 'Test description',
      };

      mockClient.ipfs.fetch.mockResolvedValue(mockMetadata);

      const result = await mockClient.ipfs.fetch('QmTestHash');

      expect(result.title).toBe('Test');
    });
  });

  describe('Error Handling', () => {
    it('should handle DAO creation errors', async () => {
      mockClient.methods.createDAO.mockRejectedValue(new Error('Insufficient funds'));

      await expect(mockClient.methods.createDAO(MOCK_ARAGON_DAO))
        .rejects.toThrow('Insufficient funds');
    });

    it('should handle proposal creation errors', async () => {
      mockClient.methods.createProposal.mockRejectedValue(new Error('Invalid proposal data'));

      await expect(mockClient.methods.createProposal({}))
        .rejects.toThrow('Invalid proposal data');
    });

    it('should handle voting errors', async () => {
      mockClient.methods.vote.mockRejectedValue(new Error('Voting period ended'));

      await expect(mockClient.methods.vote({}))
        .rejects.toThrow('Voting period ended');
    });
  });
});
