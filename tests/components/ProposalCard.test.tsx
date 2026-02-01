/**
 * ProposalCard Component Tests
 * Tests for the proposal display card component
 */

import { describe, it, expect, beforeEach, vi } from 'bun:test';
import { render, fireEvent, screen, cleanup } from '@solidjs/testing-library';
import { ProposalCard } from '../../src/components/ProposalCard';
import { ProposalState } from '../../src/types';

describe('ProposalCard Component', () => {
  const mockProposal = {
    id: '1',
    title: 'Increase Treasury Allocation',
    description: 'Allocate more funds to development',
    state: ProposalState.Active,
    forVotes: BigInt('1500000000000000000000'),
    againstVotes: BigInt('500000000000000000000'),
    abstainVotes: BigInt('100000000000000000000'),
    startTime: Date.now() - 86400000, // 1 day ago
    endTime: Date.now() + 86400000, // 1 day from now
    proposer: '0x1234567890123456789012345678901234567890',
    quorum: BigInt('1000000000000000000000'),
    executed: false,
  };

  const mockOnVote = vi.fn();
  const mockOnExecute = vi.fn();

  beforeEach(() => {
    cleanup();
    vi.clearAllMocks();
  });

  it('should render proposal title and description', () => {
    render(() => (
      <ProposalCard 
        proposal={mockProposal}
        onVote={mockOnVote}
        onExecute={mockOnExecute}
      />
    ));
    
    expect(screen.getByText('Increase Treasury Allocation')).toBeDefined();
    expect(screen.getByText('Allocate more funds to development')).toBeDefined();
  });

  it('should display correct vote counts', () => {
    render(() => (
      <ProposalCard 
        proposal={mockProposal}
        onVote={mockOnVote}
        onExecute={mockOnExecute}
      />
    ));
    
    // Should show formatted vote counts
    expect(screen.getByText(/1,500/)).toBeDefined(); // FOR votes
    expect(screen.getByText(/500/)).toBeDefined();   // AGAINST votes
  });

  it('should show active state badge', () => {
    render(() => (
      <ProposalCard 
        proposal={mockProposal}
        onVote={mockOnVote}
        onExecute={mockOnExecute}
      />
    ));
    
    expect(screen.getByText('Active')).toBeDefined();
  });

  it('should show different state badges', () => {
    const { rerender } = render(() => (
      <ProposalCard 
        proposal={{ ...mockProposal, state: ProposalState.Pending }}
        onVote={mockOnVote}
        onExecute={mockOnExecute}
      />
    ));
    
    expect(screen.getByText('Pending')).toBeDefined();

    rerender(() => (
      <ProposalCard 
        proposal={{ ...mockProposal, state: ProposalState.Succeeded }}
        onVote={mockOnVote}
        onExecute={mockOnExecute}
      />
    ));
    
    expect(screen.getByText('Succeeded')).toBeDefined();

    rerender(() => (
      <ProposalCard 
        proposal={{ ...mockProposal, state: ProposalState.Executed }}
        onVote={mockOnVote}
        onExecute={mockOnExecute}
      />
    ));
    
    expect(screen.getByText('Executed')).toBeDefined();
  });

  it('should show voting buttons when active', () => {
    render(() => (
      <ProposalCard 
        proposal={mockProposal}
        onVote={mockOnVote}
        onExecute={mockOnExecute}
      />
    ));
    
    expect(screen.getByText('Vote For')).toBeDefined();
    expect(screen.getByText('Vote Against')).toBeDefined();
    expect(screen.getByText('Abstain')).toBeDefined();
  });

  it('should call onVote with correct support value', async () => {
    render(() => (
      <ProposalCard 
        proposal={mockProposal}
        onVote={mockOnVote}
        onExecute={mockOnExecute}
      />
    ));
    
    const voteForButton = screen.getByText('Vote For');
    await fireEvent.click(voteForButton);
    
    expect(mockOnVote).toHaveBeenCalledWith('1', 1); // 1 = FOR
  });

  it('should show execute button when succeeded', () => {
    render(() => (
      <ProposalCard 
        proposal={{ ...mockProposal, state: ProposalState.Succeeded }}
        onVote={mockOnVote}
        onExecute={mockOnExecute}
      />
    ));
    
    expect(screen.getByText('Execute')).toBeDefined();
  });

  it('should call onExecute when execute button clicked', async () => {
    render(() => (
      <ProposalCard 
        proposal={{ ...mockProposal, state: ProposalState.Succeeded }}
        onVote={mockOnVote}
        onExecute={mockOnExecute}
      />
    ));
    
    const executeButton = screen.getByText('Execute');
    await fireEvent.click(executeButton);
    
    expect(mockOnExecute).toHaveBeenCalledWith('1');
  });

  it('should hide voting buttons when voting ended', () => {
    render(() => (
      <ProposalCard 
        proposal={{ ...mockProposal, state: ProposalState.Defeated }}
        onVote={mockOnVote}
        onExecute={mockOnExecute}
      />
    ));
    
    expect(screen.queryByText('Vote For')).toBeNull();
    expect(screen.queryByText('Vote Against')).toBeNull();
  });

  it('should show time remaining when active', () => {
    render(() => (
      <ProposalCard 
        proposal={mockProposal}
        onVote={mockOnVote}
        onExecute={mockOnExecute}
      />
    ));
    
    expect(screen.getByText(/remaining/i)).toBeDefined();
  });

  it('should show proposer address truncated', () => {
    render(() => (
      <ProposalCard 
        proposal={mockProposal}
        onVote={mockOnVote}
        onExecute={mockOnExecute}
      />
    ));
    
    expect(screen.getByText(/0x1234.*7890/)).toBeDefined();
  });

  it('should show quorum progress bar', () => {
    render(() => (
      <ProposalCard 
        proposal={mockProposal}
        onVote={mockOnVote}
        onExecute={mockOnExecute}
      />
    ));
    
    const progressBar = screen.getByTestId('quorum-progress');
    expect(progressBar).toBeDefined();
  });

  it('should handle hasVoted state', () => {
    render(() => (
      <ProposalCard 
        proposal={mockProposal}
        hasVoted={true}
        userVote={1}
        onVote={mockOnVote}
        onExecute={mockOnExecute}
      />
    ));
    
    expect(screen.getByText('You voted FOR')).toBeDefined();
  });
});
