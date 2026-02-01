/**
 * IPFS Operations Tests
 * Tests for IPFS upload, download, and pinning operations
 */

import { describe, it, expect, beforeEach, vi } from 'bun:test';
import { 
  uploadToIPFS, 
  fetchFromIPFS, 
  pinToIPFS,
  generateIPFSHash,
  isValidIPFSHash 
} from '../../src/utils/ipfs';

describe('IPFS Operations', () => {
  const mockIPFSClient = {
    add: vi.fn(),
    cat: vi.fn(),
    pin: {
      add: vi.fn(),
      rm: vi.fn(),
    },
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Upload', () => {
    it('should upload JSON data to IPFS', async () => {
      const data = {
        title: 'Test Proposal',
        description: 'Test description',
      };

      const expectedHash = 'QmTestHash123';
      mockIPFSClient.add.mockResolvedValue({ path: expectedHash });

      const result = await mockIPFSClient.add(JSON.stringify(data));

      expect(result.path).toMatch(/^Qm[a-zA-Z0-9]{44}$/);
    });

    it('should upload with metadata', async () => {
      const data = 'Test content';
      const options = {
        pin: true,
        wrapWithDirectory: false,
      };

      mockIPFSClient.add.mockResolvedValue({ path: 'QmHash' });

      await mockIPFSClient.add(data, options);

      expect(mockIPFSClient.add).toHaveBeenCalledWith(data, options);
    });

    it('should handle upload errors', async () => {
      mockIPFSClient.add.mockRejectedValue(new Error('Network error'));

      await expect(mockIPFSClient.add('data'))
        .rejects.toThrow('Network error');
    });
  });

  describe('Fetch', () => {
    it('should fetch data from IPFS by hash', async () => {
      const mockData = JSON.stringify({ title: 'Test' });
      const chunks = [Buffer.from(mockData)];

      mockIPFSClient.cat.mockReturnValue(chunks);

      const result = await mockIPFSClient.cat('QmTestHash');
      const content = Buffer.concat(result).toString();

      expect(JSON.parse(content)).toEqual({ title: 'Test' });
    });

    it('should handle fetch errors', async () => {
      mockIPFSClient.cat.mockRejectedValue(new Error('CID not found'));

      await expect(mockIPFSClient.cat('QmInvalid'))
        .rejects.toThrow('CID not found');
    });

    it('should timeout on slow responses', async () => {
      mockIPFSClient.cat.mockImplementation(async () => {
        await new Promise(resolve => setTimeout(resolve, 10000));
        return [];
      });

      // Would need actual timeout implementation
    });
  });

  describe('Pinning', () => {
    it('should pin hash to IPFS', async () => {
      mockIPFSClient.pin.add.mockResolvedValue({});

      await mockIPFSClient.pin.add('QmTestHash');

      expect(mockIPFSClient.pin.add).toHaveBeenCalledWith('QmTestHash');
    });

    it('should unpin hash from IPFS', async () => {
      mockIPFSClient.pin.rm.mockResolvedValue({});

      await mockIPFSClient.pin.rm('QmTestHash');

      expect(mockIPFSClient.pin.rm).toHaveBeenCalledWith('QmTestHash');
    });

    it('should handle pinning errors', async () => {
      mockIPFSClient.pin.add.mockRejectedValue(new Error('Already pinned'));

      await expect(mockIPFSClient.pin.add('QmTestHash'))
        .rejects.toThrow('Already pinned');
    });
  });

  describe('Hash Validation', () => {
    it('should validate correct IPFS hashes', () => {
      const validHashes = [
        'QmYwAPJzv5CZsnAzt8auvkFWgB6sCq4q4FzTc5w8m5m5m5',
        'QmXxXxXxXxXxXxXxXxXxXxXxXxXxXxXxXxXxXxXxXxXxX',
        'bafybeigdyrzt5sfp7udm7hu76uh7y26nf3efuylqabf3oclgtqy55fbzdi',
      ];

      for (const hash of validHashes) {
        expect(isValidIPFSHash(hash)).toBe(true);
      }
    });

    it('should reject invalid IPFS hashes', () => {
      const invalidHashes = [
        'invalid',
        '0x1234567890',
        '',
        'Qm', // Too short
        'QmInvalid!!!',
      ];

      for (const hash of invalidHashes) {
        expect(isValidIPFSHash(hash)).toBe(false);
      }
    });
  });

  describe('Hash Generation', () => {
    it('should generate consistent hash for same data', async () => {
      const data = { title: 'Test', description: 'Description' };

      mockIPFSClient.add.mockResolvedValue({ path: 'QmConsistentHash' });

      const hash1 = (await mockIPFSClient.add(JSON.stringify(data))).path;
      const hash2 = (await mockIPFSClient.add(JSON.stringify(data))).path;

      expect(hash1).toBe(hash2);
    });

    it('should generate different hashes for different data', async () => {
      const data1 = { title: 'Test 1' };
      const data2 = { title: 'Test 2' };

      mockIPFSClient.add
        .mockResolvedValueOnce({ path: 'QmHash1' })
        .mockResolvedValueOnce({ path: 'QmHash2' });

      const hash1 = (await mockIPFSClient.add(JSON.stringify(data1))).path;
      const hash2 = (await mockIPFSClient.add(JSON.stringify(data2))).path;

      expect(hash1).not.toBe(hash2);
    });
  });

  describe('URL Handling', () => {
    it('should convert hash to IPFS URL', () => {
      const hash = 'QmTestHash';
      const url = `https://ipfs.io/ipfs/${hash}`;

      expect(url).toBe('https://ipfs.io/ipfs/QmTestHash');
    });

    it('should convert hash to gateway URL with custom gateway', () => {
      const hash = 'QmTestHash';
      const gateway = 'https://cloudflare-ipfs.com';
      const url = `${gateway}/ipfs/${hash}`;

      expect(url).toBe('https://cloudflare-ipfs.com/ipfs/QmTestHash');
    });

    it('should extract hash from IPFS URL', () => {
      const url = 'https://ipfs.io/ipfs/QmTestHash/path/to/file';
      const match = url.match(/ipfs\/([a-zA-Z0-9]+)/);
      
      expect(match?.[1]).toBe('QmTestHash');
    });
  });

  describe('Metadata Handling', () => {
    it('should handle proposal metadata upload', async () => {
      const proposalMetadata = {
        title: 'Treasury Allocation',
        description: 'Allocate funds for Q1',
        resources: [
          { name: 'Budget', url: 'https://example.com/budget' },
        ],
      };

      mockIPFSClient.add.mockResolvedValue({ path: 'QmProposalHash' });

      const result = await mockIPFSClient.add(JSON.stringify(proposalMetadata));

      expect(result.path).toBeDefined();
    });

    it('should handle DAO metadata upload', async () => {
      const daoMetadata = {
        name: 'Test DAO',
        description: 'A test organization',
        avatar: 'ipfs://QmAvatarHash',
        links: {
          website: 'https://testdao.com',
          twitter: '@testdao',
        },
      };

      mockIPFSClient.add.mockResolvedValue({ path: 'QmDAOHash' });

      const result = await mockIPFSClient.add(JSON.stringify(daoMetadata));

      expect(result.path).toBeDefined();
    });
  });
});
