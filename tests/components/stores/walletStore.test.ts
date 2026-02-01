/**
 * Wallet Store Tests
 * Tests for the wallet connection state management store
 */

import { describe, it, expect, beforeEach, vi } from 'bun:test';
import { createWalletStore } from '../../../src/stores/walletStore';

describe('Wallet Store', () => {
  let store: ReturnType<typeof createWalletStore>;

  beforeEach(() => {
    store = createWalletStore();
  });

  it('should initialize with disconnected state', () => {
    expect(store.state.isConnected).toBe(false);
    expect(store.state.address).toBeNull();
    expect(store.state.chainId).toBeNull();
    expect(store.state.balance).toBeNull();
    expect(store.state.connecting).toBe(false);
  });

  it('should set connected state', () => {
    const address = '0x1234567890123456789012345678901234567890';
    const chainId = 8453;
    
    store.connect(address, chainId);
    
    expect(store.state.isConnected).toBe(true);
    expect(store.state.address).toBe(address);
    expect(store.state.chainId).toBe(chainId);
  });

  it('should set disconnect state', () => {
    store.connect('0x1234567890123456789012345678901234567890', 8453);
    expect(store.state.isConnected).toBe(true);
    
    store.disconnect();
    
    expect(store.state.isConnected).toBe(false);
    expect(store.state.address).toBeNull();
    expect(store.state.chainId).toBeNull();
  });

  it('should set connecting state', () => {
    store.setConnecting(true);
    expect(store.state.connecting).toBe(true);
    
    store.setConnecting(false);
    expect(store.state.connecting).toBe(false);
  });

  it('should set balance', () => {
    const balance = '1.5 ETH';
    
    store.setBalance(balance);
    expect(store.state.balance).toBe(balance);
  });

  it('should update chain ID', () => {
    store.connect('0x1234567890123456789012345678901234567890', 8453);
    
    store.setChainId(1);
    expect(store.state.chainId).toBe(1);
  });

  it('should set error state', () => {
    const error = 'User rejected connection';
    
    store.setError(error);
    expect(store.state.error).toBe(error);
  });

  it('should clear error state', () => {
    store.setError('Some error');
    store.clearError();
    expect(store.state.error).toBeNull();
  });

  it('should check if on supported network', () => {
    store.connect('0x1234567890123456789012345678901234567890', 8453); // Base
    expect(store.isSupportedNetwork).toBe(true);
    
    store.setChainId(999); // Unsupported
    expect(store.isSupportedNetwork).toBe(false);
  });

  it('should format address for display', () => {
    const address = '0x1234567890123456789012345678901234567890';
    
    store.connect(address, 8453);
    
    expect(store.formattedAddress).toBe('0x1234...7890');
  });

  it('should return null formatted address when disconnected', () => {
    expect(store.formattedAddress).toBeNull();
  });

  it('should track connection attempts', () => {
    expect(store.connectionAttempts).toBe(0);
    
    store.incrementConnectionAttempts();
    expect(store.connectionAttempts).toBe(1);
    
    store.incrementConnectionAttempts();
    expect(store.connectionAttempts).toBe(2);
  });

  it('should reset connection attempts on successful connection', () => {
    store.incrementConnectionAttempts();
    store.incrementConnectionAttempts();
    expect(store.connectionAttempts).toBe(2);
    
    store.connect('0x1234567890123456789012345678901234567890', 8453);
    expect(store.connectionAttempts).toBe(0);
  });

  it('should get network name', () => {
    store.connect('0x1234567890123456789012345678901234567890', 8453);
    expect(store.networkName).toBe('Base');
    
    store.setChainId(1);
    expect(store.networkName).toBe('Ethereum');
    
    store.setChainId(11155111);
    expect(store.networkName).toBe('Sepolia');
  });

  it('should return unknown for unsupported network', () => {
    store.connect('0x1234567890123456789012345678901234567890', 999);
    expect(store.networkName).toBe('Unknown Network');
  });
});
