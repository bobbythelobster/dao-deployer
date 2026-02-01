/**
 * Proposal Store Tests
 * Tests for the proposal state management store
 */

import { describe, it, expect, beforeEach } from 'bun:test';
import { createProposalStore } from '../../../src/stores/proposalStore';
import { ProposalState } from '../../../src/types';

describe('Proposal Store', () => {
  let store: ReturnType<typeof createProposalStore>;
  const mockProposal = {
    id: '1',
    title: 'Test Proposal',
    description: 'Test description',
    state: ProposalState.Active,
    forVotes: BigInt('1000'),
    againstVotes: BigInt('500'),
    abstainVotes: BigInt('100'),
    startTime: Date.now() - 86400000,
    endTime: Date.now() + 86400000,
    proposer: '0x1234567890123456789012345678901234567890',
    executed: false,
  };

  beforeEach(() => {
    store = createProposalStore();
  });

  it('should initialize with empty state', () => {
    expect(store.state.proposals).toEqual([]);
    expect(store.state.selectedProposal).toBeNull();
    expect(store.state.loading).toBe(false);
    expect(store.state.voting).toBe(false);
  });

  it('should set proposals list', () => {
    const proposals = [mockProposal, { ...mockProposal, id: '2', title: 'Second Proposal' }];
    
    store.setProposals(proposals);
    
    expect(store.state.proposals).toHaveLength(2);
    expect(store.state.proposals[0].title).toBe('Test Proposal');
    expect(store.state.proposals[1].title).toBe('Second Proposal');
  });

  it('should add proposal', () => {
    store.addProposal(mockProposal);
    
    expect(store.state.proposals).toHaveLength(1);
    expect(store.state.proposals[0].id).toBe('1');
  });

  it('should update proposal', () => {
    store.addProposal(mockProposal);
    
    const updated = { ...mockProposal, forVotes: BigInt('2000') };
    store.updateProposal(updated);
    
    expect(store.state.proposals[0].forVotes).toBe(BigInt('2000'));
  });

  it('should remove proposal', () => {
    store.addProposal(mockProposal);
    store.addProposal({ ...mockProposal, id: '2' });
    
    store.removeProposal('1');
    
    expect(store.state.proposals).toHaveLength(1);
    expect(store.state.proposals[0].id).toBe('2');
  });

  it('should select proposal', () => {
    store.selectProposal(mockProposal);
    
    expect(store.state.selectedProposal).toBeDefined();
    expect(store.state.selectedProposal?.id).toBe('1');
  });

  it('should clear selected proposal', () => {
    store.selectProposal(mockProposal);
    store.clearSelectedProposal();
    
    expect(store.state.selectedProposal).toBeNull();
  });

  it('should set loading state', () => {
    store.setLoading(true);
    expect(store.state.loading).toBe(true);
    
    store.setLoading(false);
    expect(store.state.loading).toBe(false);
  });

  it('should set voting state', () => {
    store.setVoting(true);
    expect(store.state.voting).toBe(true);
    
    store.setVoting(false);
    expect(store.state.voting).toBe(false);
  });

  it('should get active proposals', () => {
    store.addProposal(mockProposal);
    store.addProposal({ ...mockProposal, id: '2', state: ProposalState.Succeeded });
    store.addProposal({ ...mockProposal, id: '3', state: ProposalState.Active });
    
    const active = store.getActiveProposals();
    expect(active).toHaveLength(2);
  });

  it('should get proposal by ID', () => {
    store.addProposal(mockProposal);
    
    const found = store.getProposalById('1');
    expect(found).toBeDefined();
    expect(found?.title).toBe('Test Proposal');
  });

  it('should return null for non-existent proposal', () => {
    const found = store.getProposalById('999');
    expect(found).toBeNull();
  });

  it('should track if user has voted', () => {
    store.addProposal(mockProposal);
    
    store.setUserVote('1', true, 1);
    
    expect(store.hasUserVoted('1')).toBe(true);
    expect(store.getUserVote('1')).toBe(1);
  });

  it('should get proposals by state', () => {
    store.addProposal(mockProposal);
    store.addProposal({ ...mockProposal, id: '2', state: ProposalState.Pending });
    store.addProposal({ ...mockProposal, id: '3', state: ProposalState.Succeeded });
    
    const pending = store.getProposalsByState(ProposalState.Pending);
    expect(pending).toHaveLength(1);
    expect(pending[0].id).toBe('2');
  });

  it('should calculate total votes', () => {
    store.addProposal(mockProposal);
    
    const total = store.getTotalVotes('1');
    expect(total).toBe(BigInt('1600')); // 1000 + 500 + 100
  });

  it('should get vote percentage', () => {
    store.addProposal(mockProposal);
    
    const forPercentage = store.getVotePercentage('1', 'for');
    expect(forPercentage).toBe(62.5); // 1000 / 1600 * 100
  });

  it('should check if proposal is executable', () => {
    const succeededProposal = { ...mockProposal, state: ProposalState.Succeeded, executed: false };
    store.addProposal(succeededProposal);
    
    expect(store.isExecutable('1')).toBe(true);
  });

  it('should not allow execution of non-succeeded proposals', () => {
    store.addProposal(mockProposal); // Active state
    
    expect(store.isExecutable('1')).toBe(false);
  });

  it('should sort proposals by creation time', () => {
    const oldProposal = { ...mockProposal, id: '1', createdAt: Date.now() - 86400000 * 2 };
    const newProposal = { ...mockProposal, id: '2', createdAt: Date.now() };
    
    store.addProposal(oldProposal);
    store.addProposal(newProposal);
    
    store.sortBy('createdAt', 'desc');
    
    expect(store.state.proposals[0].id).toBe('2');
    expect(store.state.proposals[1].id).toBe('1');
  });
});
