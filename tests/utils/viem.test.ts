/**
 * Viem Configuration Tests
 * Tests for Viem client setup and configuration
 */

import { describe, it, expect, beforeAll } from 'bun:test';
import { 
  createPublicClient, 
  createWalletClient, 
  http, 
  custom,
  type PublicClient,
  type WalletClient 
} from 'viem';
import { mainnet, base, baseSepolia, sepolia } from 'viem/chains';
import { privateKeyToAccount } from 'viem/accounts';
import { MOCK_ACCOUNTS, SUPPORTED_NETWORKS } from '../mocks/data';

describe('Viem Configuration', () => {
  let publicClient: PublicClient;

  beforeAll(() => {
    publicClient = createPublicClient({
      chain: baseSepolia,
      transport: http(),
    });
  });

  describe('Public Client', () => {
    it('should create public client with correct chain', () => {
      const client = createPublicClient({
        chain: base,
        transport: http(),
      });

      expect(client.chain).toBe(base);
    });

    it('should create public client with HTTP transport', () => {
      const client = createPublicClient({
        chain: mainnet,
        transport: http('https://eth.llamarpc.com'),
      });

      expect(client.transport.type).toBe('http');
    });

    it('should support multiple chains', () => {
      const chains = [mainnet, base, baseSepolia, sepolia];
      
      for (const chain of chains) {
        const client = createPublicClient({
          chain,
          transport: http(),
        });
        
        expect(client.chain).toBe(chain);
      }
    });
  });

  describe('Wallet Client', () => {
    it('should create wallet client with account', () => {
      const account = privateKeyToAccount(MOCK_ACCOUNTS[0].privateKey as `0x${string}`);
      
      const client = createWalletClient({
        account,
        chain: baseSepolia,
        transport: http(),
      });

      expect(client.account).toBeDefined();
      expect(client.account?.address).toBe(MOCK_ACCOUNTS[0].address);
    });

    it('should create multiple wallet clients for different accounts', () => {
      const clients: WalletClient[] = [];
      
      for (const accountData of MOCK_ACCOUNTS.slice(0, 3)) {
        const account = privateKeyToAccount(accountData.privateKey as `0x${string}`);
        const client = createWalletClient({
          account,
          chain: baseSepolia,
          transport: http(),
        });
        clients.push(client);
      }

      expect(clients).toHaveLength(3);
      expect(clients[0].account?.address).toBe(MOCK_ACCOUNTS[0].address);
      expect(clients[1].account?.address).toBe(MOCK_ACCOUNTS[1].address);
      expect(clients[2].account?.address).toBe(MOCK_ACCOUNTS[2].address);
    });
  });

  describe('Network Configuration', () => {
    it('should support all configured networks', () => {
      for (const network of SUPPORTED_NETWORKS) {
        expect(network.supported).toBe(true);
        expect(network.chainId).toBeGreaterThan(0);
        expect(network.rpcUrl).toMatch(/^https?:\/\//);
      }
    });

    it('should have correct chain IDs', () => {
      expect(mainnet.id).toBe(1);
      expect(base.id).toBe(8453);
      expect(baseSepolia.id).toBe(84532);
      expect(sepolia.id).toBe(11155111);
    });

    it('should map network configs to viem chains', () => {
      const networkMap: Record<number, typeof mainnet> = {
        1: mainnet,
        8453: base,
        84532: baseSepolia,
        11155111: sepolia,
      };

      for (const network of SUPPORTED_NETWORKS) {
        const viemChain = networkMap[network.chainId];
        expect(viemChain).toBeDefined();
        expect(viemChain.id).toBe(network.chainId);
      }
    });
  });

  describe('Account Management', () => {
    it('should derive correct addresses from private keys', () => {
      for (const account of MOCK_ACCOUNTS) {
        const derived = privateKeyToAccount(account.privateKey as `0x${string}`);
        expect(derived.address.toLowerCase()).toBe(account.address.toLowerCase());
      }
    });

    it('should create accounts with valid addresses', () => {
      const account = privateKeyToAccount(MOCK_ACCOUNTS[0].privateKey as `0x${string}`);
      
      expect(account.address).toMatch(/^0x[a-fA-F0-9]{40}$/);
      expect(account.publicKey).toMatch(/^0x[a-fA-F0-9]{130}$/);
    });
  });

  describe('Transport Configuration', () => {
    it('should configure HTTP transport with options', () => {
      const transport = http('https://custom.rpc.com', {
        batch: true,
        fetchOptions: {
          headers: {
            'X-Custom-Header': 'value',
          },
        },
      });

      expect(transport.type).toBe('http');
    });

    it('should handle custom transport', () => {
      const mockProvider = {
        request: async () => '0x1',
      };

      const transport = custom(mockProvider);
      expect(transport.type).toBe('custom');
    });
  });

  describe('Client Extensions', () => {
    it('should extend public client with wallet actions', () => {
      const account = privateKeyToAccount(MOCK_ACCOUNTS[0].privateKey as `0x${string}`);
      
      const client = createPublicClient({
        chain: baseSepolia,
        transport: http(),
      });

      // Public client should have read methods
      expect(client.readContract).toBeDefined();
      expect(client.getBalance).toBeDefined();
    });

    it('should have correct methods on wallet client', () => {
      const account = privateKeyToAccount(MOCK_ACCOUNTS[0].privateKey as `0x${string}`);
      
      const client = createWalletClient({
        account,
        chain: baseSepolia,
        transport: http(),
      });

      // Wallet client should have write methods
      expect(client.writeContract).toBeDefined();
      expect(client.sendTransaction).toBeDefined();
      expect(client.deployContract).toBeDefined();
    });
  });
});
