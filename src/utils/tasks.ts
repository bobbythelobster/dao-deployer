/**
 * DAO Deployer - Task/Bid Operations
 * 
 * Task market operations including task creation, bid submission,
 * bid acceptance, task completion, and payment release.
 */

import {
  type PublicClient,
  type WalletClient,
  encodeFunctionData,
} from 'viem';
import {
  TaskMarketABI,
  type Task,
  type Bid,
  TaskStatus,
  BidStatus,
  type ContractAddress,
} from './contracts.ts';
import {
  TaskError,
  TaskNotFoundError,
  TaskCreationError,
  BidError,
  BidNotFoundError,
  TransactionError,
  ContractReadError,
  ContractWriteError,
  InsufficientFundsError,
} from './errors.ts';
import { waitForTransaction } from './viem.ts';
import { TASK_CONFIG } from './constants.ts';
import { getTokenBalance } from './tokens.ts';

// ============================================================================
// TYPES
// ============================================================================

export interface CreateTaskParams {
  title: string;
  description: string;
  budget: bigint;
  token: ContractAddress;
  deadline: bigint; // Unix timestamp
}

export interface SubmitBidParams {
  taskId: bigint;
  amount: bigint;
  timeline: bigint; // Hours
  description: string;
}

export interface AcceptBidParams {
  taskId: bigint;
  bidId: bigint;
}

export interface CompleteTaskParams {
  taskId: bigint;
  deliverablesCID?: string;
}

export interface ReleasePaymentParams {
  taskId: bigint;
}

// ============================================================================
// TASK CREATION
// ============================================================================

/**
 * Create a new task
 */
export async function createTask(
  publicClient: PublicClient,
  walletClient: WalletClient,
  taskMarketAddress: ContractAddress,
  params: CreateTaskParams
): Promise<{
  taskId: bigint;
  transactionHash: `0x${string}`;
  blockNumber: bigint;
}> {
  try {
    // Validate task parameters
    validateTaskParams(params);

    // Check creator has sufficient balance for budget
    const creator = walletClient.account?.address;
    if (!creator) {
      throw new TaskCreationError('No wallet connected');
    }

    const balance = await getTokenBalance(
      publicClient,
      params.token,
      creator as ContractAddress
    );

    if (balance < params.budget) {
      throw new InsufficientFundsError(params.budget, balance);
    }

    // Encode task creation
    const data = encodeFunctionData({
      abi: TaskMarketABI,
      functionName: 'createTask',
      args: [
        params.title,
        params.description,
        params.budget,
        params.token,
        params.deadline,
      ],
    });

    const hash = await walletClient.sendTransaction({
      to: taskMarketAddress,
      data,
      account: walletClient.account!,
      chain: walletClient.chain,
    });

    const receipt = await waitForTransaction(publicClient, hash);

    if (receipt.status === 'reverted') {
      throw new TransactionError(
        'Task creation transaction reverted',
        'TASK_CREATION_REVERTED',
        hash,
        receipt
      );
    }

    // Parse task ID from event logs
    // In real implementation, would parse the TaskCreated event
    const taskId = 1n;

    return {
      taskId,
      transactionHash: hash,
      blockNumber: receipt.blockNumber,
    };
  } catch (error) {
    if (error instanceof TaskError || error instanceof TransactionError || error instanceof InsufficientFundsError) {
      throw error;
    }
    throw new TaskCreationError(
      error instanceof Error ? error.message : 'Task creation failed',
      error instanceof Error ? error : undefined
    );
  }
}

/**
 * Validate task creation parameters
 */
function validateTaskParams(params: CreateTaskParams): void {
  if (!params.title || params.title.length < 5) {
    throw new TaskCreationError('Title must be at least 5 characters');
  }

  if (!params.description || params.description.length < 20) {
    throw new TaskCreationError('Description must be at least 20 characters');
  }

  if (params.budget < TASK_CONFIG.minBudget) {
    throw new TaskCreationError(`Budget must be at least ${TASK_CONFIG.minBudget}`);
  }

  if (params.budget > TASK_CONFIG.maxBudget) {
    throw new TaskCreationError(`Budget must not exceed ${TASK_CONFIG.maxBudget}`);
  }

  const now = BigInt(Math.floor(Date.now() / 1000));
  const minDeadline = now + BigInt(TASK_CONFIG.minDeadlineHours * 3600);
  const maxDeadline = now + BigInt(TASK_CONFIG.maxDeadlineDays * 86400);

  if (params.deadline < minDeadline) {
    throw new TaskCreationError(`Deadline must be at least ${TASK_CONFIG.minDeadlineHours} hours from now`);
  }

  if (params.deadline > maxDeadline) {
    throw new TaskCreationError(`Deadline must not exceed ${TASK_CONFIG.maxDeadlineDays} days from now`);
  }
}

// ============================================================================
// TASK QUERIES
// ============================================================================

/**
 * Get task by ID
 */
export async function getTask(
  publicClient: PublicClient,
  taskMarketAddress: ContractAddress,
  taskId: bigint
): Promise<Task> {
  try {
    const taskData = await publicClient.readContract({
      address: taskMarketAddress,
      abi: TaskMarketABI,
      functionName: 'getTask',
      args: [taskId],
    });

    return {
      id: taskData.id,
      creator: taskData.creator,
      title: taskData.title,
      description: taskData.description,
      budget: taskData.budget,
      token: taskData.token,
      deadline: taskData.deadline,
      status: taskData.status as TaskStatus,
      assignee: taskData.assignee || undefined,
      deliverablesCID: taskData.deliverablesCID || undefined,
      createdAt: taskData.createdAt,
      completedAt: taskData.completedAt || undefined,
    };
  } catch (error) {
    throw new ContractReadError(
      taskMarketAddress,
      'getTask',
      [taskId],
      error instanceof Error ? error : undefined
    );
  }
}

/**
 * Get all tasks
 */
export async function getAllTasks(
  publicClient: PublicClient,
  taskMarketAddress: ContractAddress
): Promise<Task[]> {
  try {
    const count = await publicClient.readContract({
      address: taskMarketAddress,
      abi: TaskMarketABI,
      functionName: 'taskCount',
    });

    const tasks: Task[] = [];
    for (let i = 1n; i <= count; i++) {
      try {
        const task = await getTask(publicClient, taskMarketAddress, i);
        tasks.push(task);
      } catch {
        // Skip tasks that can't be fetched
      }
    }

    return tasks;
  } catch (error) {
    throw new ContractReadError(
      taskMarketAddress,
      'getAllTasks',
      [],
      error instanceof Error ? error : undefined
    );
  }
}

/**
 * Get tasks by status
 */
export async function getTasksByStatus(
  publicClient: PublicClient,
  taskMarketAddress: ContractAddress,
  status: TaskStatus
): Promise<Task[]> {
  const allTasks = await getAllTasks(publicClient, taskMarketAddress);
  return allTasks.filter(task => task.status === status);
}

/**
 * Get tasks created by an address
 */
export async function getTasksByCreator(
  publicClient: PublicClient,
  taskMarketAddress: ContractAddress,
  creator: ContractAddress
): Promise<Task[]> {
  const allTasks = await getAllTasks(publicClient, taskMarketAddress);
  return allTasks.filter(task => task.creator.toLowerCase() === creator.toLowerCase());
}

/**
 * Get tasks assigned to an address
 */
export async function getTasksByAssignee(
  publicClient: PublicClient,
  taskMarketAddress: ContractAddress,
  assignee: ContractAddress
): Promise<Task[]> {
  const allTasks = await getAllTasks(publicClient, taskMarketAddress);
  return allTasks.filter(
    task => task.assignee?.toLowerCase() === assignee.toLowerCase()
  );
}

/**
 * Check if task is open for bidding
 */
export async function isTaskOpen(
  publicClient: PublicClient,
  taskMarketAddress: ContractAddress,
  taskId: bigint
): Promise<boolean> {
  const task = await getTask(publicClient, taskMarketAddress, taskId);
  return task.status === TaskStatus.Open;
}

// ============================================================================
// BID OPERATIONS
// ============================================================================

/**
 * Submit a bid on a task
 */
export async function submitBid(
  publicClient: PublicClient,
  walletClient: WalletClient,
  taskMarketAddress: ContractAddress,
  params: SubmitBidParams
): Promise<{
  bidId: bigint;
  transactionHash: `0x${string}`;
  blockNumber: bigint;
}> {
  try {
    // Validate bid
    const task = await getTask(publicClient, taskMarketAddress, params.taskId);

    if (task.status !== TaskStatus.Open) {
      throw new BidError('Task is not open for bidding', 'TASK_NOT_OPEN', params.taskId);
    }

    if (params.amount > task.budget) {
      throw new BidError(
        'Bid amount exceeds task budget',
        'BID_AMOUNT_TOO_HIGH',
        params.taskId,
        undefined,
        { amount: params.amount, budget: task.budget }
      );
    }

    // Encode bid submission
    const data = encodeFunctionData({
      abi: TaskMarketABI,
      functionName: 'submitBid',
      args: [
        params.taskId,
        params.amount,
        params.timeline,
        params.description,
      ],
    });

    const hash = await walletClient.sendTransaction({
      to: taskMarketAddress,
      data,
      account: walletClient.account!,
      chain: walletClient.chain,
    });

    const receipt = await waitForTransaction(publicClient, hash);

    if (receipt.status === 'reverted') {
      throw new TransactionError(
        'Bid submission transaction reverted',
        'BID_REVERTED',
        hash,
        receipt
      );
    }

    // Parse bid ID from event logs
    const bidId = 1n;

    return {
      bidId,
      transactionHash: hash,
      blockNumber: receipt.blockNumber,
    };
  } catch (error) {
    if (error instanceof TaskError || error instanceof TransactionError) {
      throw error;
    }
    throw new BidError(
      error instanceof Error ? error.message : 'Bid submission failed',
      'BID_SUBMISSION_ERROR',
      params.taskId,
      undefined,
      error instanceof Error ? error : undefined
    );
  }
}

/**
 * Get bid by ID
 */
export async function getBid(
  publicClient: PublicClient,
  taskMarketAddress: ContractAddress,
  taskId: bigint,
  bidId: bigint
): Promise<Bid> {
  try {
    const bidData = await publicClient.readContract({
      address: taskMarketAddress,
      abi: TaskMarketABI,
      functionName: 'getBid',
      args: [taskId, bidId],
    });

    return {
      id: bidData.id,
      taskId: bidData.taskId,
      bidder: bidData.bidder,
      amount: bidData.amount,
      timeline: bidData.timeline,
      description: bidData.description,
      status: bidData.status as BidStatus,
      createdAt: bidData.createdAt,
    };
  } catch (error) {
    throw new ContractReadError(
      taskMarketAddress,
      'getBid',
      [taskId, bidId],
      error instanceof Error ? error : undefined
    );
  }
}

/**
 * Get all bids for a task
 */
export async function getTaskBids(
  publicClient: PublicClient,
  taskMarketAddress: ContractAddress,
  taskId: bigint
): Promise<Bid[]> {
  try {
    const bidIds = await publicClient.readContract({
      address: taskMarketAddress,
      abi: TaskMarketABI,
      functionName: 'getTaskBids',
      args: [taskId],
    });

    const bids: Bid[] = [];
    for (const bidId of bidIds) {
      try {
        const bid = await getBid(publicClient, taskMarketAddress, taskId, bidId);
        bids.push(bid);
      } catch {
        // Skip bids that can't be fetched
      }
    }

    return bids;
  } catch (error) {
    throw new ContractReadError(
      taskMarketAddress,
      'getTaskBids',
      [taskId],
      error instanceof Error ? error : undefined
    );
  }
}

/**
 * Accept a bid
 */
export async function acceptBid(
  publicClient: PublicClient,
  walletClient: WalletClient,
  taskMarketAddress: ContractAddress,
  params: AcceptBidParams
): Promise<{
  transactionHash: `0x${string}`;
  blockNumber: bigint;
}> {
  try {
    // Verify task is open
    const task = await getTask(publicClient, taskMarketAddress, params.taskId);

    if (task.status !== TaskStatus.Open) {
      throw new BidError(
        'Task is not open for bid acceptance',
        'TASK_NOT_OPEN',
        params.taskId,
        params.bidId
      );
    }

    // Verify caller is task creator
    const caller = walletClient.account?.address;
    if (caller?.toLowerCase() !== task.creator.toLowerCase()) {
      throw new BidError(
        'Only task creator can accept bids',
        'NOT_CREATOR',
        params.taskId,
        params.bidId
      );
    }

    // Encode bid acceptance
    const data = encodeFunctionData({
      abi: TaskMarketABI,
      functionName: 'acceptBid',
      args: [params.taskId, params.bidId],
    });

    const hash = await walletClient.sendTransaction({
      to: taskMarketAddress,
      data,
      account: walletClient.account!,
      chain: walletClient.chain,
    });

    const receipt = await waitForTransaction(publicClient, hash);

    if (receipt.status === 'reverted') {
      throw new TransactionError(
        'Bid acceptance transaction reverted',
        'ACCEPT_BID_REVERTED',
        hash,
        receipt
      );
    }

    return {
      transactionHash: hash,
      blockNumber: receipt.blockNumber,
    };
  } catch (error) {
    if (error instanceof BidError || error instanceof TransactionError) {
      throw error;
    }
    throw new BidError(
      error instanceof Error ? error.message : 'Bid acceptance failed',
      'ACCEPT_BID_ERROR',
      params.taskId,
      params.bidId,
      error instanceof Error ? error : undefined
    );
  }
}

// ============================================================================
// TASK COMPLETION
// ============================================================================

/**
 * Mark task as complete
 */
export async function markTaskComplete(
  publicClient: PublicClient,
  walletClient: WalletClient,
  taskMarketAddress: ContractAddress,
  params: CompleteTaskParams
): Promise<{
  transactionHash: `0x${string}`;
  blockNumber: bigint;
}> {
  try {
    // Verify task is assigned
    const task = await getTask(publicClient, taskMarketAddress, params.taskId);

    if (task.status !== TaskStatus.Assigned) {
      throw new TaskError(
        'Task must be assigned before completion',
        'TASK_NOT_ASSIGNED',
        params.taskId
      );
    }

    // Verify caller is assignee
    const caller = walletClient.account?.address;
    if (caller?.toLowerCase() !== task.assignee?.toLowerCase()) {
      throw new TaskError(
        'Only assignee can mark task complete',
        'NOT_ASSIGNEE',
        params.taskId
      );
    }

    // Encode task completion
    const data = encodeFunctionData({
      abi: TaskMarketABI,
      functionName: 'markComplete',
      args: [params.taskId],
    });

    const hash = await walletClient.sendTransaction({
      to: taskMarketAddress,
      data,
      account: walletClient.account!,
      chain: walletClient.chain,
    });

    const receipt = await waitForTransaction(publicClient, hash);

    if (receipt.status === 'reverted') {
      throw new TransactionError(
        'Task completion transaction reverted',
        'COMPLETE_TASK_REVERTED',
        hash,
        receipt
      );
    }

    return {
      transactionHash: hash,
      blockNumber: receipt.blockNumber,
    };
  } catch (error) {
    if (error instanceof TaskError || error instanceof TransactionError) {
      throw error;
    }
    throw new TaskError(
      error instanceof Error ? error.message : 'Task completion failed',
      'COMPLETE_TASK_ERROR',
      params.taskId,
      undefined,
      error instanceof Error ? error : undefined
    );
  }
}

/**
 * Release payment for completed task
 */
export async function releasePayment(
  publicClient: PublicClient,
  walletClient: WalletClient,
  taskMarketAddress: ContractAddress,
  params: ReleasePaymentParams
): Promise<{
  transactionHash: `0x${string}`;
  blockNumber: bigint;
  amount: bigint;
}> {
  try {
    // Verify task is completed
    const task = await getTask(publicClient, taskMarketAddress, params.taskId);

    if (task.status !== TaskStatus.Completed) {
      throw new TaskError(
        'Task must be completed before releasing payment',
        'TASK_NOT_COMPLETED',
        params.taskId
      );
    }

    // Verify caller is task creator
    const caller = walletClient.account?.address;
    if (caller?.toLowerCase() !== task.creator.toLowerCase()) {
      throw new TaskError(
        'Only task creator can release payment',
        'NOT_CREATOR',
        params.taskId
      );
    }

    // Encode payment release
    const data = encodeFunctionData({
      abi: TaskMarketABI,
      functionName: 'releasePayment',
      args: [params.taskId],
    });

    const hash = await walletClient.sendTransaction({
      to: taskMarketAddress,
      data,
      account: walletClient.account!,
      chain: walletClient.chain,
    });

    const receipt = await waitForTransaction(publicClient, hash);

    if (receipt.status === 'reverted') {
      throw new TransactionError(
        'Payment release transaction reverted',
        'RELEASE_PAYMENT_REVERTED',
        hash,
        receipt
      );
    }

    return {
      transactionHash: hash,
      blockNumber: receipt.blockNumber,
      amount: task.budget,
    };
  } catch (error) {
    if (error instanceof TaskError || error instanceof TransactionError) {
      throw error;
    }
    throw new TaskError(
      error instanceof Error ? error.message : 'Payment release failed',
      'RELEASE_PAYMENT_ERROR',
      params.taskId,
      undefined,
      error instanceof Error ? error : undefined
    );
  }
}

/**
 * Cancel a task (only by creator, only if open)
 */
export async function cancelTask(
  publicClient: PublicClient,
  walletClient: WalletClient,
  taskMarketAddress: ContractAddress,
  taskId: bigint
): Promise<{
  transactionHash: `0x${string}`;
  blockNumber: bigint;
}> {
  try {
    // Verify task is open
    const task = await getTask(publicClient, taskMarketAddress, taskId);

    if (task.status !== TaskStatus.Open) {
      throw new TaskError(
        'Only open tasks can be cancelled',
        'TASK_NOT_OPEN',
        taskId
      );
    }

    // Verify caller is task creator
    const caller = walletClient.account?.address;
    if (caller?.toLowerCase() !== task.creator.toLowerCase()) {
      throw new TaskError(
        'Only task creator can cancel task',
        'NOT_CREATOR',
        taskId
      );
    }

    // Encode task cancellation
    const data = encodeFunctionData({
      abi: TaskMarketABI,
      functionName: 'cancelTask',
      args: [taskId],
    });

    const hash = await walletClient.sendTransaction({
      to: taskMarketAddress,
      data,
      account: walletClient.account!,
      chain: walletClient.chain,
    });

    const receipt = await waitForTransaction(publicClient, hash);

    if (receipt.status === 'reverted') {
      throw new TransactionError(
        'Task cancellation transaction reverted',
        'CANCEL_TASK_REVERTED',
        hash,
        receipt
      );
    }

    return {
      transactionHash: hash,
      blockNumber: receipt.blockNumber,
    };
  } catch (error) {
    if (error instanceof TaskError || error instanceof TransactionError) {
      throw error;
    }
    throw new TaskError(
      error instanceof Error ? error.message : 'Task cancellation failed',
      'CANCEL_TASK_ERROR',
      taskId,
      undefined,
      error instanceof Error ? error : undefined
    );
  }
}

// ============================================================================
// TASK MARKET CLASS
// ============================================================================

export class TaskMarket {
  private publicClient: PublicClient;
  private walletClient?: WalletClient;
  private address: ContractAddress;

  constructor(
    publicClient: PublicClient,
    taskMarketAddress: ContractAddress,
    walletClient?: WalletClient
  ) {
    this.publicClient = publicClient;
    this.address = taskMarketAddress;
    this.walletClient = walletClient;
  }

  async getTask(taskId: bigint): Promise<Task> {
    return getTask(this.publicClient, this.address, taskId);
  }

  async getAllTasks(): Promise<Task[]> {
    return getAllTasks(this.publicClient, this.address);
  }

  async getTasksByStatus(status: TaskStatus): Promise<Task[]> {
    return getTasksByStatus(this.publicClient, this.address, status);
  }

  async getTasksByCreator(creator: ContractAddress): Promise<Task[]> {
    return getTasksByCreator(this.publicClient, this.address, creator);
  }

  async getTasksByAssignee(assignee: ContractAddress): Promise<Task[]> {
    return getTasksByAssignee(this.publicClient, this.address, assignee);
  }

  async isTaskOpen(taskId: bigint): Promise<boolean> {
    return isTaskOpen(this.publicClient, this.address, taskId);
  }

  async createTask(params: CreateTaskParams): Promise<{
    taskId: bigint;
    transactionHash: `0x${string}`;
    blockNumber: bigint;
  }> {
    if (!this.walletClient) {
      throw new TaskError('Wallet client required', 'WALLET_REQUIRED');
    }
    return createTask(this.publicClient, this.walletClient, this.address, params);
  }

  async submitBid(params: SubmitBidParams): Promise<{
    bidId: bigint;
    transactionHash: `0x${string}`;
    blockNumber: bigint;
  }> {
    if (!this.walletClient) {
      throw new BidError('Wallet client required', 'WALLET_REQUIRED', params.taskId);
    }
    return submitBid(this.publicClient, this.walletClient, this.address, params);
  }

  async getBid(taskId: bigint, bidId: bigint): Promise<Bid> {
    return getBid(this.publicClient, this.address, taskId, bidId);
  }

  async getTaskBids(taskId: bigint): Promise<Bid[]> {
    return getTaskBids(this.publicClient, this.address, taskId);
  }

  async acceptBid(params: AcceptBidParams): Promise<{
    transactionHash: `0x${string}`;
    blockNumber: bigint;
  }> {
    if (!this.walletClient) {
      throw new BidError('Wallet client required', 'WALLET_REQUIRED', params.taskId, params.bidId);
    }
    return acceptBid(this.publicClient, this.walletClient, this.address, params);
  }

  async markComplete(params: CompleteTaskParams): Promise<{
    transactionHash: `0x${string}`;
    blockNumber: bigint;
  }> {
    if (!this.walletClient) {
      throw new TaskError('Wallet client required', 'WALLET_REQUIRED', params.taskId);
    }
    return markTaskComplete(this.publicClient, this.walletClient, this.address, params);
  }

  async releasePayment(params: ReleasePaymentParams): Promise<{
    transactionHash: `0x${string}`;
    blockNumber: bigint;
    amount: bigint;
  }> {
    if (!this.walletClient) {
      throw new TaskError('Wallet client required', 'WALLET_REQUIRED', params.taskId);
    }
    return releasePayment(this.publicClient, this.walletClient, this.address, params);
  }

  async cancelTask(taskId: bigint): Promise<{
    transactionHash: `0x${string}`;
    blockNumber: bigint;
  }> {
    if (!this.walletClient) {
      throw new TaskError('Wallet client required', 'WALLET_REQUIRED', taskId);
    }
    return cancelTask(this.publicClient, this.walletClient, this.address, taskId);
  }
}

// ============================================================================
// EXPORTS
// ============================================================================

export {
  TaskMarketABI,
  TaskStatus,
  BidStatus,
};
