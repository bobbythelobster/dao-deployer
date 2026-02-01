/**
 * TaskCard Component Tests
 * Tests for the task marketplace card component
 */

import { describe, it, expect, beforeEach, vi } from 'bun:test';
import { render, fireEvent, screen, cleanup } from '@solidjs/testing-library';
import { TaskCard } from '../../src/components/TaskCard';
import { TaskState } from '../../src/types';

describe('TaskCard Component', () => {
  const mockTask = {
    id: '1',
    title: 'Build Smart Contract',
    description: 'Create a DeFi protocol smart contract',
    budget: BigInt('2000000000000000000'), // 2 ETH
    deadline: Date.now() + 7 * 86400000, // 7 days
    state: TaskState.Open,
    creator: '0x1234567890123456789012345678901234567890',
    assignee: null,
    bidCount: 3,
    createdAt: Date.now() - 86400000,
  };

  const mockOnBid = vi.fn();
  const mockOnView = vi.fn();

  beforeEach(() => {
    cleanup();
    vi.clearAllMocks();
  });

  it('should render task title and description', () => {
    render(() => (
      <TaskCard 
        task={mockTask}
        onBid={mockOnBid}
        onView={mockOnView}
      />
    ));
    
    expect(screen.getByText('Build Smart Contract')).toBeDefined();
    expect(screen.getByText('Create a DeFi protocol smart contract')).toBeDefined();
  });

  it('should display budget in ETH', () => {
    render(() => (
      <TaskCard 
        task={mockTask}
        onBid={mockOnBid}
        onView={mockOnView}
      />
    ));
    
    expect(screen.getByText('2.0 ETH')).toBeDefined();
  });

  it('should display deadline', () => {
    render(() => (
      <TaskCard 
        task={mockTask}
        onBid={mockOnBid}
        onView={mockOnView}
      />
    ));
    
    expect(screen.getByText(/7 days/i)).toBeDefined();
  });

  it('should show bid count', () => {
    render(() => (
      <TaskCard 
        task={mockTask}
        onBid={mockOnBid}
        onView={mockOnView}
      />
    ));
    
    expect(screen.getByText('3')).toBeDefined();
    expect(screen.getByText(/bids/i)).toBeDefined();
  });

  it('should show Open state badge', () => {
    render(() => (
      <TaskCard 
        task={mockTask}
        onBid={mockOnBid}
        onView={mockOnView}
      />
    ));
    
    expect(screen.getByText('Open')).toBeDefined();
  });

  it('should show different state badges', () => {
    const { rerender } = render(() => (
      <TaskCard 
        task={{ ...mockTask, state: TaskState.Assigned }}
        onBid={mockOnBid}
        onView={mockOnView}
      />
    ));
    
    expect(screen.getByText('Assigned')).toBeDefined();

    rerender(() => (
      <TaskCard 
        task={{ ...mockTask, state: TaskState.Completed }}
        onBid={mockOnBid}
        onView={mockOnView}
      />
    ));
    
    expect(screen.getByText('Completed')).toBeDefined();
  });

  it('should show bid button for open tasks', () => {
    render(() => (
      <TaskCard 
        task={mockTask}
        onBid={mockOnBid}
        onView={mockOnView}
      />
    ));
    
    expect(screen.getByText('Place Bid')).toBeDefined();
  });

  it('should call onBid when bid button clicked', async () => {
    render(() => (
      <TaskCard 
        task={mockTask}
        onBid={mockOnBid}
        onView={mockOnView}
      />
    ));
    
    const bidButton = screen.getByText('Place Bid');
    await fireEvent.click(bidButton);
    
    expect(mockOnBid).toHaveBeenCalledWith('1');
  });

  it('should call onView when card clicked', async () => {
    render(() => (
      <TaskCard 
        task={mockTask}
        onBid={mockOnBid}
        onView={mockOnView}
      />
    ));
    
    const card = screen.getByText('Build Smart Contract').closest('.task-card');
    await fireEvent.click(card!);
    
    expect(mockOnView).toHaveBeenCalledWith('1');
  });

  it('should hide bid button for assigned tasks', () => {
    render(() => (
      <TaskCard 
        task={{ ...mockTask, state: TaskState.Assigned }}
        onBid={mockOnBid}
        onView={mockOnView}
      />
    ));
    
    expect(screen.queryByText('Place Bid')).toBeNull();
  });

  it('should hide bid button for completed tasks', () => {
    render(() => (
      <TaskCard 
        task={{ ...mockTask, state: TaskState.Completed }}
        onBid={mockOnBid}
        onView={mockOnView}
      />
    ));
    
    expect(screen.queryByText('Place Bid')).toBeNull();
  });

  it('should show creator address truncated', () => {
    render(() => (
      <TaskCard 
        task={mockTask}
        onBid={mockOnBid}
        onView={mockOnView}
      />
    ));
    
    expect(screen.getByText(/0x1234.*7890/)).toBeDefined();
  });

  it('should show assignee when assigned', () => {
    const assignedTask = {
      ...mockTask,
      state: TaskState.Assigned,
      assignee: '0xabcdefabcdefabcdefabcdefabcdefabcdefabcd',
    };
    
    render(() => (
      <TaskCard 
        task={assignedTask}
        onBid={mockOnBid}
        onView={mockOnView}
      />
    ));
    
    expect(screen.getByText(/Assigned to/i)).toBeDefined();
    expect(screen.getByText(/0xabcd.*efabcd/)).toBeDefined();
  });

  it('should show creation date', () => {
    render(() => (
      <TaskCard 
        task={mockTask}
        onBid={mockOnBid}
        onView={mockOnView}
      />
    ));
    
    expect(screen.getByText(/Posted 1 day ago/i)).toBeDefined();
  });

  it('should handle expired deadline', () => {
    const expiredTask = {
      ...mockTask,
      deadline: Date.now() - 86400000, // 1 day ago
    };
    
    render(() => (
      <TaskCard 
        task={expiredTask}
        onBid={mockOnBid}
        onView={mockOnView}
      />
    ));
    
    expect(screen.getByText(/Expired/i)).toBeDefined();
  });
});
