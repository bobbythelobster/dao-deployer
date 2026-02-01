/**
 * ConnectWallet Component Tests
 * Tests for wallet connection component
 */

import { describe, it, expect, beforeEach, vi } from 'bun:test';
import { render, fireEvent, screen, cleanup } from '@solidjs/testing-library';
import { ConnectWallet } from '../../src/components/ConnectWallet';

describe('ConnectWallet Component', () => {
  const mockConnect = vi.fn();
  const mockDisconnect = vi.fn();

  beforeEach(() => {
    cleanup();
    vi.clearAllMocks();
  });

  it('should render connect button when not connected', () => {
    render(() => (
      <ConnectWallet 
        isConnected={false}
        onConnect={mockConnect}
        onDisconnect={mockDisconnect}
      />
    ));
    
    expect(screen.getByText('Connect Wallet')).toBeDefined();
  });

  it('should render address when connected', () => {
    const address = '0x1234567890123456789012345678901234567890';
    
    render(() => (
      <ConnectWallet 
        isConnected={true}
        address={address}
        onConnect={mockConnect}
        onDisconnect={mockDisconnect}
      />
    ));
    
    // Should show truncated address
    expect(screen.getByText('0x1234...7890')).toBeDefined();
  });

  it('should call onConnect when connect button clicked', async () => {
    render(() => (
      <ConnectWallet 
        isConnected={false}
        onConnect={mockConnect}
        onDisconnect={mockDisconnect}
      />
    ));
    
    const button = screen.getByText('Connect Wallet');
    await fireEvent.click(button);
    
    expect(mockConnect).toHaveBeenCalled();
  });

  it('should call onDisconnect when disconnect clicked', async () => {
    const address = '0x1234567890123456789012345678901234567890';
    
    render(() => (
      <ConnectWallet 
        isConnected={true}
        address={address}
        onConnect={mockConnect}
        onDisconnect={mockDisconnect}
      />
    ));
    
    const disconnectButton = screen.getByText('Disconnect');
    await fireEvent.click(disconnectButton);
    
    expect(mockDisconnect).toHaveBeenCalled();
  });

  it('should show loading state while connecting', () => {
    render(() => (
      <ConnectWallet 
        isConnected={false}
        isConnecting={true}
        onConnect={mockConnect}
        onDisconnect={mockDisconnect}
      />
    ));
    
    expect(screen.getByText('Connecting...')).toBeDefined();
    expect(screen.getByTestId('loading-spinner')).toBeDefined();
  });

  it('should show error state', () => {
    const error = 'User rejected connection';
    
    render(() => (
      <ConnectWallet 
        isConnected={false}
        error={error}
        onConnect={mockConnect}
        onDisconnect={mockDisconnect}
      />
    ));
    
    expect(screen.getByText(error)).toBeDefined();
  });

  it('should show chain information when connected', () => {
    const address = '0x1234567890123456789012345678901234567890';
    const chainName = 'Base';
    
    render(() => (
      <ConnectWallet 
        isConnected={true}
        address={address}
        chainName={chainName}
        onConnect={mockConnect}
        onDisconnect={mockDisconnect}
      />
    ));
    
    expect(screen.getByText(chainName)).toBeDefined();
  });

  it('should show balance when connected', () => {
    const address = '0x1234567890123456789012345678901234567890';
    const balance = '1.5 ETH';
    
    render(() => (
      <ConnectWallet 
        isConnected={true}
        address={address}
        balance={balance}
        onConnect={mockConnect}
        onDisconnect={mockDisconnect}
      />
    ));
    
    expect(screen.getByText(balance)).toBeDefined();
  });

  it('should handle unsupported network', () => {
    render(() => (
      <ConnectWallet 
        isConnected={true}
        address="0x1234567890123456789012345678901234567890"
        isUnsupportedNetwork={true}
        onConnect={mockConnect}
        onDisconnect={mockDisconnect}
      />
    ));
    
    expect(screen.getByText('Unsupported Network')).toBeDefined();
  });

  it('should render wallet options modal', async () => {
    render(() => (
      <ConnectWallet 
        isConnected={false}
        onConnect={mockConnect}
        onDisconnect={mockDisconnect}
        wallets={[
          { id: 'metamask', name: 'MetaMask', icon: '/metamask.png' },
          { id: 'walletconnect', name: 'WalletConnect', icon: '/wc.png' },
        ]}
      />
    ));
    
    const button = screen.getByText('Connect Wallet');
    await fireEvent.click(button);
    
    expect(screen.getByText('MetaMask')).toBeDefined();
    expect(screen.getByText('WalletConnect')).toBeDefined();
  });
});
