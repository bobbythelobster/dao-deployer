/**
 * DAOCard Component Tests
 * Tests for the DAO display card component
 */

import { describe, it, expect, beforeEach, vi } from 'bun:test';
import { render, fireEvent, screen, cleanup } from '@solidjs/testing-library';
import { DAOCard } from '../../src/components/DAOCard';

describe('DAOCard Component', () => {
  const mockDAO = {
    address: '0x1234567890123456789012345678901234567890',
    name: 'Test DAO',
    description: 'A test decentralized organization',
    memberCount: 150,
    proposalCount: 42,
    tokenAddress: '0xabcdefabcdefabcdefabcdefabcdefabcdefabcd',
    tokenSymbol: 'TEST',
    votingPower: BigInt('1000000000000000000000'),
    createdAt: Date.now() - 86400000 * 30, // 30 days ago
    imageUrl: 'https://example.com/dao.png',
  };

  const mockOnClick = vi.fn();

  beforeEach(() => {
    cleanup();
    vi.clearAllMocks();
  });

  it('should render DAO name and description', () => {
    render(() => (
      <DAOCard 
        dao={mockDAO}
        onClick={mockOnClick}
      />
    ));
    
    expect(screen.getByText('Test DAO')).toBeDefined();
    expect(screen.getByText('A test decentralized organization')).toBeDefined();
  });

  it('should display member count', () => {
    render(() => (
      <DAOCard 
        dao={mockDAO}
        onClick={mockOnClick}
      />
    ));
    
    expect(screen.getByText('150')).toBeDefined();
    expect(screen.getByText(/members/i)).toBeDefined();
  });

  it('should display proposal count', () => {
    render(() => (
      <DAOCard 
        dao={mockDAO}
        onClick={mockOnClick}
      />
    ));
    
    expect(screen.getByText('42')).toBeDefined();
    expect(screen.getByText(/proposals/i)).toBeDefined();
  });

  it('should display token symbol', () => {
    render(() => (
      <DAOCard 
        dao={mockDAO}
        onClick={mockOnClick}
      />
    ));
    
    expect(screen.getByText('TEST')).toBeDefined();
  });

  it('should call onClick when clicked', async () => {
    render(() => (
      <DAOCard 
        dao={mockDAO}
        onClick={mockOnClick}
      />
    ));
    
    const card = screen.getByText('Test DAO').closest('.dao-card');
    await fireEvent.click(card!);
    
    expect(mockOnClick).toHaveBeenCalledWith(mockDAO.address);
  });

  it('should render with image', () => {
    render(() => (
      <DAOCard 
        dao={mockDAO}
        onClick={mockOnClick}
      />
    ));
    
    const img = screen.getByAltText('Test DAO');
    expect(img).toBeDefined();
    expect(img.getAttribute('src')).toBe('https://example.com/dao.png');
  });

  it('should render placeholder when no image', () => {
    const daoWithoutImage = { ...mockDAO, imageUrl: undefined };
    
    render(() => (
      <DAOCard 
        dao={daoWithoutImage}
        onClick={mockOnClick}
      />
    ));
    
    expect(screen.getByTestId('dao-placeholder')).toBeDefined();
  });

  it('should display voting power when available', () => {
    render(() => (
      <DAOCard 
        dao={mockDAO}
        onClick={mockOnClick}
      />
    ));
    
    expect(screen.getByText(/1,000/)).toBeDefined(); // Formatted voting power
    expect(screen.getByText('TEST')).toBeDefined();
  });

  it('should show created date', () => {
    render(() => (
      <DAOCard 
        dao={mockDAO}
        onClick={mockOnClick}
      />
    ));
    
    expect(screen.getByText(/30 days ago|1 month ago/i)).toBeDefined();
  });

  it('should render as link when href provided', () => {
    render(() => (
      <DAOCard 
        dao={mockDAO}
        href={`/dao/${mockDAO.address}`}
      />
    ));
    
    const link = screen.getByText('Test DAO').closest('a');
    expect(link).toBeDefined();
    expect(link?.getAttribute('href')).toBe(`/dao/${mockDAO.address}`);
  });

  it('should show active proposals indicator', () => {
    const daoWithActiveProposals = { ...mockDAO, activeProposalCount: 5 };
    
    render(() => (
      <DAOCard 
        dao={daoWithActiveProposals}
        onClick={mockOnClick}
      />
    ));
    
    expect(screen.getByText('5')).toBeDefined();
    expect(screen.getByText(/active/i)).toBeDefined();
  });
});
