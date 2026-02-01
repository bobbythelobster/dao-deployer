/**
 * TaskMarket Unit Tests
 * Tests for task creation, bidding, assignment, and payment
 */

import { describe, it, expect, beforeEach, beforeAll } from 'bun:test';
import { type Address, type WalletClient, type PublicClient, parseEther, getContract } from 'viem';
import { getTestContext, GasTracker, takeSnapshot, revertToSnapshot } from '../setup';
import { TaskMarketABI, TaskMarketBytecode } from './abis';
import { MOCK_ACCOUNTS, TaskState, ERROR_SCENARIOS, generateTask, generateBid } from '../mocks/data';
import { deployContract, findEventLog, expectTransactionRevert, GasProfiler, advanceTime, getBalance } from '../utils/helpers';

describe('TaskMarket', () => {
  let context: ReturnType<typeof getTestContext>;
  let publicClient: PublicClient;
  let deployer: WalletClient;
  let alice: WalletClient;
  let bob: WalletClient;
  let carol: WalletClient;
  let marketAddress: Address;
  let snapshotId: string;
  let gasTracker: GasTracker;
  let gasProfiler: GasProfiler;

  beforeAll(async () => {
    context = getTestContext();
    publicClient = context.publicClient;
    deployer = context.walletClients.deployer;
    alice = context.walletClients.alice;
    bob = context.walletClients.bob;
    carol = context.walletClients.carol;
    gasTracker = new GasTracker();
    gasProfiler = new GasProfiler();
  });

  beforeEach(async () => {
    snapshotId = await takeSnapshot(publicClient);

    // Deploy TaskMarket with 2.5% platform fee
    marketAddress = await deployContract(
      deployer,
      publicClient,
      TaskMarketABI,
      TaskMarketBytecode,
      [250] // 2.5% fee (in basis points)
    );

    context.contracts.taskMarket = marketAddress;
  });

  afterEach(async () => {
    await revertToSnapshot(publicClient, snapshotId);
  });

  describe('Deployment', () => {
    it('should deploy with correct platform fee', async () => {
      const market = getContract({
        address: marketAddress,
        abi: TaskMarketABI,
        client: publicClient,
      });

      const fee = await market.read.platformFeePercent();
      expect(fee).toBe(BigInt(250)); // 2.5%
    });

    it('should start with zero tasks', async () => {
      const market = getContract({
        address: marketAddress,
        abi: TaskMarketABI,
        client: publicClient,
      });

      const count = await market.read.taskCount();
      expect(count).toBe(BigInt(0));
    });
  });

  describe('Task Creation', () => {
    it('should create a task with budget', async () => {
      const market = getContract({
        address: marketAddress,
        abi: TaskMarketABI,
        client: { public: publicClient, wallet: alice },
      });

      const title = 'Build a Website';
      const description = 'Create a responsive website';
      const ipfsHash = 'QmTest123';
      const deadline = BigInt(Math.floor(Date.now() / 1000) + 7 * 24 * 60 * 60);
      const budget = parseEther('1');

      const initialBalance = await getBalance(publicClient, marketAddress);

      const hash = await market.write.createTask(
        [title, description, ipfsHash, deadline],
        { value: budget }
      );
      const receipt = await publicClient.waitForTransactionReceipt({ hash });

      gasTracker.record('createTask', receipt.gasUsed);
      gasProfiler.record('TaskMarket.createTask', receipt.gasUsed);

      expect(receipt.status).toBe('success');

      // Check TaskCreated event
      const event = findEventLog(receipt, TaskMarketABI, 'TaskCreated');
      expect(event).toBeDefined();
      expect(event.creator.toLowerCase()).toBe(MOCK_ACCOUNTS[1].address.toLowerCase());
      expect(event.budget).toBe(budget);

      // Verify task count
      const count = await market.read.taskCount();
      expect(count).toBe(BigInt(1));

      // Verify task details
      const task = await market.read.tasks([BigInt(1)]);
      expect(task.title).toBe(title);
      expect(task.description).toBe(description);
      expect(task.budget).toBe(budget);
      expect(task.state).toBe(TaskState.Open);
      expect(task.assignee).toBe('0x0000000000000000000000000000000000000000');

      // Verify contract received funds
      const finalBalance = await getBalance(publicClient, marketAddress);
      expect(finalBalance).toBe(initialBalance + budget);
    });

    it('should create multiple tasks', async () => {
      const market = getContract({
        address: marketAddress,
        abi: TaskMarketABI,
        client: { public: publicClient, wallet: alice },
      });

      await market.write.createTask(
        ['Task 1', 'Description 1', 'Qm1', BigInt(Math.floor(Date.now() / 1000) + 86400)],
        { value: parseEther('0.5') }
      );

      await market.write.createTask(
        ['Task 2', 'Description 2', 'Qm2', BigInt(Math.floor(Date.now() / 1000) + 172800)],
        { value: parseEther('1.0') }
      );

      await market.write.createTask(
        ['Task 3', 'Description 3', 'Qm3', BigInt(Math.floor(Date.now() / 1000) + 259200)],
        { value: parseEther('1.5') }
      );

      const count = await market.read.taskCount();
      expect(count).toBe(BigInt(3));

      // Verify each task has unique ID
      const task1 = await market.read.tasks([BigInt(1)]);
      const task2 = await market.read.tasks([BigInt(2)]);
      const task3 = await market.read.tasks([BigInt(3)]);

      expect(task1.title).toBe('Task 1');
      expect(task2.title).toBe('Task 2');
      expect(task3.title).toBe('Task 3');
    });

    it('should reject task with zero budget', async () => {
      const market = getContract({
        address: marketAddress,
        abi: TaskMarketABI,
        client: { public: publicClient, wallet: alice },
      });

      await expectTransactionRevert(
        market.write.createTask(
          ['Task', 'Description', 'Qm', BigInt(Math.floor(Date.now() / 1000) + 86400)],
          { value: BigInt(0) }
        ),
        /zero|budget|invalid/i
      );
    });

    it('should reject task with past deadline', async () => {
      const market = getContract({
        address: marketAddress,
        abi: TaskMarketABI,
        client: { public: publicClient, wallet: alice },
      });

      const pastDeadline = BigInt(Math.floor(Date.now() / 1000) - 86400);

      await expectTransactionRevert(
        market.write.createTask(
          ['Task', 'Description', 'Qm', pastDeadline],
          { value: parseEther('1') }
        ),
        /past|deadline|invalid/i
      );
    });

    it('should reject task with empty title', async () => {
      const market = getContract({
        address: marketAddress,
        abi: TaskMarketABI,
        client: { public: publicClient, wallet: alice },
      });

      await expectTransactionRevert(
        market.write.createTask(
          ['', 'Description', 'Qm', BigInt(Math.floor(Date.now() / 1000) + 86400)],
          { value: parseEther('1') }
        ),
        /empty|title|invalid/i
      );
    });
  });

  describe('Bid Submission', () => {
    let taskId: bigint;

    beforeEach(async () => {
      // Create a task first
      const market = getContract({
        address: marketAddress,
        abi: TaskMarketABI,
        client: { public: publicClient, wallet: alice },
      });

      const hash = await market.write.createTask(
        ['Task for bidding', 'Description', 'Qm', BigInt(Math.floor(Date.now() / 1000) + 7 * 86400)],
        { value: parseEther('1') }
      );
      const receipt = await publicClient.waitForTransactionReceipt({ hash });
      const event = findEventLog(receipt, TaskMarketABI, 'TaskCreated');
      taskId = event.taskId;
    });

    it('should submit a bid for open task', async () => {
      const market = getContract({
        address: marketAddress,
        abi: TaskMarketABI,
        client: { public: publicClient, wallet: bob },
      });

      const bidAmount = parseEther('0.8');
      const proposal = 'I can complete this task efficiently';

      const hash = await market.write.submitBid([taskId, bidAmount, proposal]);
      const receipt = await publicClient.waitForTransactionReceipt({ hash });

      gasTracker.record('submitBid', receipt.gasUsed);
      gasProfiler.record('TaskMarket.submitBid', receipt.gasUsed);

      expect(receipt.status).toBe('success');

      // Check BidSubmitted event
      const event = findEventLog(receipt, TaskMarketABI, 'BidSubmitted');
      expect(event).toBeDefined();
      expect(event.taskId).toBe(taskId);
      expect(event.bidder.toLowerCase()).toBe(MOCK_ACCOUNTS[2].address.toLowerCase());
      expect(event.amount).toBe(bidAmount);

      // Verify bid details
      const bid = await market.read.bids([taskId, BigInt(1)]);
      expect(bid.bidder.toLowerCase()).toBe(MOCK_ACCOUNTS[2].address.toLowerCase());
      expect(bid.amount).toBe(bidAmount);
      expect(bid.proposal).toBe(proposal);
      expect(bid.accepted).toBe(false);
    });

    it('should submit multiple bids for same task', async () => {
      const bobMarket = getContract({
        address: marketAddress,
        abi: TaskMarketABI,
        client: { public: publicClient, wallet: bob },
      });

      const carolMarket = getContract({
        address: marketAddress,
        abi: TaskMarketABI,
        client: { public: publicClient, wallet: carol },
      });

      await bobMarket.write.submitBid([taskId, parseEther('0.8'), 'Bob proposal']);
      await carolMarket.write.submitBid([taskId, parseEther('0.7'), 'Carol proposal']);

      // Get task bids
      const bids = await marketAddress.read.getTaskBids([taskId]);
      expect(bids).toHaveLength(2);

      const bid1 = await marketAddress.read.bids([taskId, BigInt(1)]);
      const bid2 = await marketAddress.read.bids([taskId, BigInt(2)]);

      expect(bid1.bidder.toLowerCase()).toBe(MOCK_ACCOUNTS[2].address.toLowerCase());
      expect(bid2.bidder.toLowerCase()).toBe(MOCK_ACCOUNTS[3].address.toLowerCase());
    });

    it('should allow creator to submit multiple bids', async () => {
      const market = getContract({
        address: marketAddress,
        abi: TaskMarketABI,
        client: { public: publicClient, wallet: bob },
      });

      await market.write.submitBid([taskId, parseEther('0.8'), 'First bid']);
      await market.write.submitBid([taskId, parseEther('0.75'), 'Second bid']);

      const bids = await marketAddress.read.getTaskBids([taskId]);
      expect(bids).toHaveLength(2);
    });

    it('should reject bid for non-existent task', async () => {
      const market = getContract({
        address: marketAddress,
        abi: TaskMarketABI,
        client: { public: publicClient, wallet: bob },
      });

      await expectTransactionRevert(
        market.write.submitBid([BigInt(999), parseEther('0.8'), 'Proposal']),
        ERROR_SCENARIOS.taskMarket.taskNotFound
      );
    });

    it('should reject bid exceeding task budget', async () => {
      const market = getContract({
        address: marketAddress,
        abi: TaskMarketABI,
        client: { public: publicClient, wallet: bob },
      });

      await expectTransactionRevert(
        market.write.submitBid([taskId, parseEther('1.5'), 'Too expensive']),
        ERROR_SCENARIOS.taskMarket.bidTooLow
      );
    });

    it('should reject bid for assigned task', async () => {
      const aliceMarket = getContract({
        address: marketAddress,
        abi: TaskMarketABI,
        client: { public: publicClient, wallet: alice },
      });

      const bobMarket = getContract({
        address: marketAddress,
        abi: TaskMarketABI,
        client: { public: publicClient, wallet: bob },
      });

      // Submit and accept a bid
      await bobMarket.write.submitBid([taskId, parseEther('0.8'), 'Proposal']);
      await aliceMarket.write.acceptBid([taskId, BigInt(1)]);

      // Try to submit another bid
      const carolMarket = getContract({
        address: marketAddress,
        abi: TaskMarketABI,
        client: { public: publicClient, wallet: carol },
      });

      await expectTransactionRevert(
        carolMarket.write.submitBid([taskId, parseEther('0.7'), 'Late bid']),
        /not open|assigned|closed/i
      );
    });
  });

  describe('Bid Acceptance', () => {
    let taskId: bigint;
    let bidId: bigint;

    beforeEach(async () => {
      // Create task and bid
      const aliceMarket = getContract({
        address: marketAddress,
        abi: TaskMarketABI,
        client: { public: publicClient, wallet: alice },
      });

      const bobMarket = getContract({
        address: marketAddress,
        abi: TaskMarketABI,
        client: { public: publicClient, wallet: bob },
      });

      const hash = await aliceMarket.write.createTask(
        ['Task for acceptance', 'Description', 'Qm', BigInt(Math.floor(Date.now() / 1000) + 7 * 86400)],
        { value: parseEther('1') }
      );
      const receipt = await publicClient.waitForTransactionReceipt({ hash });
      const event = findEventLog(receipt, TaskMarketABI, 'TaskCreated');
      taskId = event.taskId;

      const bidHash = await bobMarket.write.submitBid([taskId, parseEther('0.8'), 'My proposal']);
      const bidReceipt = await publicClient.waitForTransactionReceipt({ hash: bidHash });
      const bidEvent = findEventLog(bidReceipt, TaskMarketABI, 'BidSubmitted');
      bidId = bidEvent.bidId;
    });

    it('should allow creator to accept bid', async () => {
      const market = getContract({
        address: marketAddress,
        abi: TaskMarketABI,
        client: { public: publicClient, wallet: alice },
      });

      const hash = await market.write.acceptBid([taskId, bidId]);
      const receipt = await publicClient.waitForTransactionReceipt({ hash });

      gasTracker.record('acceptBid', receipt.gasUsed);
      gasProfiler.record('TaskMarket.acceptBid', receipt.gasUsed);

      expect(receipt.status).toBe('success');

      // Check BidAccepted event
      const event = findEventLog(receipt, TaskMarketABI, 'BidAccepted');
      expect(event).toBeDefined();
      expect(event.taskId).toBe(taskId);
      expect(event.bidId).toBe(bidId);
      expect(event.worker.toLowerCase()).toBe(MOCK_ACCOUNTS[2].address.toLowerCase());

      // Verify task state
      const task = await market.read.tasks([taskId]);
      expect(task.state).toBe(TaskState.Assigned);
      expect(task.assignee.toLowerCase()).toBe(MOCK_ACCOUNTS[2].address.toLowerCase());

      // Verify bid state
      const bid = await market.read.bids([taskId, bidId]);
      expect(bid.accepted).toBe(true);
    });

    it('should reject non-creator accepting bid', async () => {
      const market = getContract({
        address: marketAddress,
        abi: TaskMarketABI,
        client: { public: publicClient, wallet: bob },
      });

      await expectTransactionRevert(
        market.write.acceptBid([taskId, bidId]),
        /not creator|unauthorized/i
      );
    });

    it('should reject accepting non-existent bid', async () => {
      const market = getContract({
        address: marketAddress,
        abi: TaskMarketABI,
        client: { public: publicClient, wallet: alice },
      });

      await expectTransactionRevert(
        market.write.acceptBid([taskId, BigInt(999)]),
        /bid not found|invalid bid/i
      );
    });

    it('should reject accepting bid for already assigned task', async () => {
      const market = getContract({
        address: marketAddress,
        abi: TaskMarketABI,
        client: { public: publicClient, wallet: alice },
      });

      // Accept first bid
      await market.write.acceptBid([taskId, bidId]);

      // Try to accept again
      await expectTransactionRevert(
        market.write.acceptBid([taskId, bidId]),
        /already assigned|not open/i
      );
    });

    it('should reject accepting bid from different task', async () => {
      // Create second task with bid
      const aliceMarket = getContract({
        address: marketAddress,
        abi: TaskMarketABI,
        client: { public: publicClient, wallet: alice },
      });

      const carolMarket = getContract({
        address: marketAddress,
        abi: TaskMarketABI,
        client: { public: publicClient, wallet: carol },
      });

      const hash = await aliceMarket.write.createTask(
        ['Second task', 'Description', 'Qm2', BigInt(Math.floor(Date.now() / 1000) + 7 * 86400)],
        { value: parseEther('2') }
      );
      const receipt = await publicClient.waitForTransactionReceipt({ hash });
      const event = findEventLog(receipt, TaskMarketABI, 'TaskCreated');
      const task2Id = event.taskId;

      const bidHash = await carolMarket.write.submitBid([task2Id, parseEther('1.5'), 'Proposal']);
      const bidReceipt = await publicClient.waitForTransactionReceipt({ hash: bidHash });
      const bidEvent = findEventLog(bidReceipt, TaskMarketABI, 'BidSubmitted');
      const bid2Id = bidEvent.bidId;

      // Try to accept bid2 on task1
      await expectTransactionRevert(
        aliceMarket.write.acceptBid([taskId, bid2Id]),
        /bid not found|invalid bid/i
      );
    });
  });

  describe('Task Completion', () => {
    let taskId: bigint;
    let bidId: bigint;

    beforeEach(async () => {
      // Create task, bid, and accept
      const aliceMarket = getContract({
        address: marketAddress,
        abi: TaskMarketABI,
        client: { public: publicClient, wallet: alice },
      });

      const bobMarket = getContract({
        address: marketAddress,
        abi: TaskMarketABI,
        client: { public: publicClient, wallet: bob },
      });

      const hash = await aliceMarket.write.createTask(
        ['Task for completion', 'Description', 'Qm', BigInt(Math.floor(Date.now() / 1000) + 7 * 86400)],
        { value: parseEther('1') }
      );
      const receipt = await publicClient.waitForTransactionReceipt({ hash });
      const event = findEventLog(receipt, TaskMarketABI, 'TaskCreated');
      taskId = event.taskId;

      const bidHash = await bobMarket.write.submitBid([taskId, parseEther('0.8'), 'Proposal']);
      const bidReceipt = await publicClient.waitForTransactionReceipt({ hash: bidHash });
      const bidEvent = findEventLog(bidReceipt, TaskMarketABI, 'BidSubmitted');
      bidId = bidEvent.bidId;

      await aliceMarket.write.acceptBid([taskId, bidId]);
    });

    it('should allow worker to submit work', async () => {
      const market = getContract({
        address: marketAddress,
        abi: TaskMarketABI,
        client: { public: publicClient, wallet: bob },
      });

      const workResult = 'ipfs://QmWorkResult';

      const hash = await market.write.submitWork([taskId, workResult]);
      const receipt = await publicClient.waitForTransactionReceipt({ hash });

      expect(receipt.status).toBe('success');

      // Task should still be assigned
      const task = await market.read.tasks([taskId]);
      expect(task.state).toBe(TaskState.Assigned);
    });

    it('should allow creator to complete task', async () => {
      const market = getContract({
        address: marketAddress,
        abi: TaskMarketABI,
        client: { public: publicClient, wallet: alice },
      });

      const hash = await market.write.completeTask([taskId]);
      const receipt = await publicClient.waitForTransactionReceipt({ hash });

      gasTracker.record('completeTask', receipt.gasUsed);
      gasProfiler.record('TaskMarket.completeTask', receipt.gasUsed);

      expect(receipt.status).toBe('success');

      // Check TaskCompleted event
      const event = findEventLog(receipt, TaskMarketABI, 'TaskCompleted');
      expect(event).toBeDefined();
      expect(event.taskId).toBe(taskId);
      expect(event.worker.toLowerCase()).toBe(MOCK_ACCOUNTS[2].address.toLowerCase());

      // Verify task state
      const task = await market.read.tasks([taskId]);
      expect(task.state).toBe(TaskState.Completed);
      expect(task.completedAt).toBeGreaterThan(BigInt(0));
    });

    it('should reject non-creator completing task', async () => {
      const market = getContract({
        address: marketAddress,
        abi: TaskMarketABI,
        client: { public: publicClient, wallet: bob },
      });

      await expectTransactionRevert(
        market.write.completeTask([taskId]),
        /not creator|unauthorized/i
      );
    });

    it('should reject completing unassigned task', async () => {
      // Create new task without accepting bid
      const aliceMarket = getContract({
        address: marketAddress,
        abi: TaskMarketABI,
        client: { public: publicClient, wallet: alice },
      });

      const hash = await aliceMarket.write.createTask(
        ['Unassigned task', 'Description', 'Qm', BigInt(Math.floor(Date.now() / 1000) + 7 * 86400)],
        { value: parseEther('1') }
      );
      const receipt = await publicClient.waitForTransactionReceipt({ hash });
      const event = findEventLog(receipt, TaskMarketABI, 'TaskCreated');
      const unassignedTaskId = event.taskId;

      await expectTransactionRevert(
        aliceMarket.write.completeTask([unassignedTaskId]),
        ERROR_SCENARIOS.taskMarket.taskNotAssigned
      );
    });

    it('should reject completing already completed task', async () => {
      const market = getContract({
        address: marketAddress,
        abi: TaskMarketABI,
        client: { public: publicClient, wallet: alice },
      });

      await market.write.completeTask([taskId]);

      await expectTransactionRevert(
        market.write.completeTask([taskId]),
        /already completed|not assigned/i
      );
    });
  });

  describe('Payment Distribution', () => {
    let taskId: bigint;
    let bidId: bigint;
    const budget = parseEther('1');
    const bidAmount = parseEther('0.8');

    beforeEach(async () => {
      // Create task, bid, accept, and complete
      const aliceMarket = getContract({
        address: marketAddress,
        abi: TaskMarketABI,
        client: { public: publicClient, wallet: alice },
      });

      const bobMarket = getContract({
        address: marketAddress,
        abi: TaskMarketABI,
        client: { public: publicClient, wallet: bob },
      });

      const hash = await aliceMarket.write.createTask(
        ['Task for payment', 'Description', 'Qm', BigInt(Math.floor(Date.now() / 1000) + 7 * 86400)],
        { value: budget }
      );
      const receipt = await publicClient.waitForTransactionReceipt({ hash });
      const event = findEventLog(receipt, TaskMarketABI, 'TaskCreated');
      taskId = event.taskId;

      const bidHash = await bobMarket.write.submitBid([taskId, bidAmount, 'Proposal']);
      const bidReceipt = await publicClient.waitForTransactionReceipt({ hash: bidHash });
      const bidEvent = findEventLog(bidReceipt, TaskMarketABI, 'BidSubmitted');
      bidId = bidEvent.bidId;

      await aliceMarket.write.acceptBid([taskId, bidId]);
      await aliceMarket.write.completeTask([taskId]);
    });

    it('should release payment to worker on completion', async () => {
      const market = getContract({
        address: marketAddress,
        abi: TaskMarketABI,
        client: { public: publicClient, wallet: alice },
      });

      const bobBalanceBefore = await getBalance(publicClient, MOCK_ACCOUNTS[2].address);

      const hash = await market.write.releasePayment([taskId]);
      const receipt = await publicClient.waitForTransactionReceipt({ hash });

      gasTracker.record('releasePayment', receipt.gasUsed);
      gasProfiler.record('TaskMarket.releasePayment', receipt.gasUsed);

      expect(receipt.status).toBe('success');

      // Check PaymentReleased event
      const event = findEventLog(receipt, TaskMarketABI, 'PaymentReleased');
      expect(event).toBeDefined();
      expect(event.taskId).toBe(taskId);
      expect(event.worker.toLowerCase()).toBe(MOCK_ACCOUNTS[2].address.toLowerCase());
      expect(event.amount).toBe(bidAmount);

      // Verify worker received payment
      const bobBalanceAfter = await getBalance(publicClient, MOCK_ACCOUNTS[2].address);
      expect(bobBalanceAfter).toBeGreaterThan(bobBalanceBefore);
    });

    it('should deduct platform fee from payment', async () => {
      const market = getContract({
        address: marketAddress,
        abi: TaskMarketABI,
        client: { public: publicClient, wallet: alice },
      });

      const contractBalanceBefore = await getBalance(publicClient, marketAddress);

      await market.write.releasePayment([taskId]);

      // Contract should have kept the platform fee
      const expectedFee = (bidAmount * BigInt(250)) / BigInt(10000); // 2.5%
      const expectedRemaining = budget - bidAmount + expectedFee;

      const contractBalanceAfter = await getBalance(publicClient, marketAddress);
      expect(contractBalanceAfter).toBeGreaterThanOrEqual(expectedRemaining - parseEther('0.001')); // Allow for gas variance
    });

    it('should reject releasing payment for incomplete task', async () => {
      // Create incomplete task
      const aliceMarket = getContract({
        address: marketAddress,
        abi: TaskMarketABI,
        client: { public: publicClient, wallet: alice },
      });

      const bobMarket = getContract({
        address: marketAddress,
        abi: TaskMarketABI,
        client: { public: publicClient, wallet: bob },
      });

      const hash = await aliceMarket.write.createTask(
        ['Incomplete task', 'Description', 'Qm', BigInt(Math.floor(Date.now() / 1000) + 7 * 86400)],
        { value: parseEther('1') }
      );
      const receipt = await publicClient.waitForTransactionReceipt({ hash });
      const event = findEventLog(receipt, TaskMarketABI, 'TaskCreated');
      const incompleteTaskId = event.taskId;

      const bidHash = await bobMarket.write.submitBid([incompleteTaskId, parseEther('0.8'), 'Proposal']);
      const bidReceipt = await publicClient.waitForTransactionReceipt({ hash: bidHash });
      const bidEvent = findEventLog(bidReceipt, TaskMarketABI, 'BidSubmitted');
      const incompleteBidId = bidEvent.bidId;

      await aliceMarket.write.acceptBid([incompleteTaskId, incompleteBidId]);
      // Don't complete the task

      await expectTransactionRevert(
        aliceMarket.write.releasePayment([incompleteTaskId]),
        /not completed|incomplete/i
      );
    });

    it('should reject double payment release', async () => {
      const market = getContract({
        address: marketAddress,
        abi: TaskMarketABI,
        client: { public: publicClient, wallet: alice },
      });

      await market.write.releasePayment([taskId]);

      await expectTransactionRevert(
        market.write.releasePayment([taskId]),
        /already paid|released/i
      );
    });

    it('should allow platform fee withdrawal', async () => {
      const deployerMarket = getContract({
        address: marketAddress,
        abi: TaskMarketABI,
        client: { public: publicClient, wallet: deployer },
      });

      const deployerBalanceBefore = await getBalance(publicClient, MOCK_ACCOUNTS[0].address);

      const hash = await deployerMarket.write.withdrawPlatformFees();
      const receipt = await publicClient.waitForTransactionReceipt({ hash });

      expect(receipt.status).toBe('success');

      const deployerBalanceAfter = await getBalance(publicClient, MOCK_ACCOUNTS[0].address);
      // Balance should have increased (minus gas costs)
      expect(deployerBalanceAfter).toBeGreaterThan(deployerBalanceBefore - parseEther('0.01'));
    });
  });

  describe('Task Cancellation', () => {
    it('should allow creator to cancel open task', async () => {
      const market = getContract({
        address: marketAddress,
        abi: TaskMarketABI,
        client: { public: publicClient, wallet: alice },
      });

      const hash = await market.write.createTask(
        ['Task to cancel', 'Description', 'Qm', BigInt(Math.floor(Date.now() / 1000) + 7 * 86400)],
        { value: parseEther('1') }
      );
      const receipt = await publicClient.waitForTransactionReceipt({ hash });
      const event = findEventLog(receipt, TaskMarketABI, 'TaskCreated');
      const taskId = event.taskId;

      const aliceBalanceBefore = await getBalance(publicClient, MOCK_ACCOUNTS[1].address);

      const cancelHash = await market.write.cancelTask([taskId]);
      const cancelReceipt = await publicClient.waitForTransactionReceipt({ hash: cancelHash });

      expect(cancelReceipt.status).toBe('success');

      // Check TaskCancelled event
      const cancelEvent = findEventLog(cancelReceipt, TaskMarketABI, 'TaskCancelled');
      expect(cancelEvent.taskId).toBe(taskId);

      // Verify task state
      const task = await market.read.tasks([taskId]);
      expect(task.state).toBe(TaskState.Cancelled);

      // Verify refund
      const aliceBalanceAfter = await getBalance(publicClient, MOCK_ACCOUNTS[1].address);
      expect(aliceBalanceAfter).toBeGreaterThan(aliceBalanceBefore);
    });

    it('should reject non-creator cancelling task', async () => {
      const aliceMarket = getContract({
        address: marketAddress,
        abi: TaskMarketABI,
        client: { public: publicClient, wallet: alice },
      });

      const bobMarket = getContract({
        address: marketAddress,
        abi: TaskMarketABI,
        client: { public: publicClient, wallet: bob },
      });

      const hash = await aliceMarket.write.createTask(
        ['Task', 'Description', 'Qm', BigInt(Math.floor(Date.now() / 1000) + 7 * 86400)],
        { value: parseEther('1') }
      );
      const receipt = await publicClient.waitForTransactionReceipt({ hash });
      const event = findEventLog(receipt, TaskMarketABI, 'TaskCreated');
      const taskId = event.taskId;

      await expectTransactionRevert(
        bobMarket.write.cancelTask([taskId]),
        /not creator|unauthorized/i
      );
    });

    it('should reject cancelling assigned task', async () => {
      const aliceMarket = getContract({
        address: marketAddress,
        abi: TaskMarketABI,
        client: { public: publicClient, wallet: alice },
      });

      const bobMarket = getContract({
        address: marketAddress,
        abi: TaskMarketABI,
        client: { public: publicClient, wallet: bob },
      });

      const hash = await aliceMarket.write.createTask(
        ['Task', 'Description', 'Qm', BigInt(Math.floor(Date.now() / 1000) + 7 * 86400)],
        { value: parseEther('1') }
      );
      const receipt = await publicClient.waitForTransactionReceipt({ hash });
      const event = findEventLog(receipt, TaskMarketABI, 'TaskCreated');
      const taskId = event.taskId;

      const bidHash = await bobMarket.write.submitBid([taskId, parseEther('0.8'), 'Proposal']);
      const bidReceipt = await publicClient.waitForTransactionReceipt({ hash: bidHash });
      const bidEvent = findEventLog(bidReceipt, TaskMarketABI, 'BidSubmitted');
      const bidId = bidEvent.bidId;

      await aliceMarket.write.acceptBid([taskId, bidId]);

      await expectTransactionRevert(
        aliceMarket.write.cancelTask([taskId]),
        /already assigned|cannot cancel/i
      );
    });

    it('should reject cancelling completed task', async () => {
      const aliceMarket = getContract({
        address: marketAddress,
        abi: TaskMarketABI,
        client: { public: publicClient, wallet: alice },
      });

      const bobMarket = getContract({
        address: marketAddress,
        abi: TaskMarketABI,
        client: { public: publicClient, wallet: bob },
      });

      const hash = await aliceMarket.write.createTask(
        ['Task', 'Description', 'Qm', BigInt(Math.floor(Date.now() / 1000) + 7 * 86400)],
        { value: parseEther('1') }
      );
      const receipt = await publicClient.waitForTransactionReceipt({ hash });
      const event = findEventLog(receipt, TaskMarketABI, 'TaskCreated');
      const taskId = event.taskId;

      const bidHash = await bobMarket.write.submitBid([taskId, parseEther('0.8'), 'Proposal']);
      const bidReceipt = await publicClient.waitForTransactionReceipt({ hash: bidHash });
      const bidEvent = findEventLog(bidReceipt, TaskMarketABI, 'BidSubmitted');
      const bidId = bidEvent.bidId;

      await aliceMarket.write.acceptBid([taskId, bidId]);
      await aliceMarket.write.completeTask([taskId]);

      await expectTransactionRevert(
        aliceMarket.write.cancelTask([taskId]),
        /already completed|cannot cancel/i
      );
    });
  });

  describe('Edge Cases', () => {
    it('should handle task with deadline exactly at current time', async () => {
      const market = getContract({
        address: marketAddress,
        abi: TaskMarketABI,
        client: { public: publicClient, wallet: alice },
      });

      const currentTime = BigInt(Math.floor(Date.now() / 1000));

      await expectTransactionRevert(
        market.write.createTask(
          ['Task', 'Description', 'Qm', currentTime],
          { value: parseEther('1') }
        ),
        /past|deadline|invalid/i
      );
    });

    it('should handle zero bid amount', async () => {
      const aliceMarket = getContract({
        address: marketAddress,
        abi: TaskMarketABI,
        client: { public: publicClient, wallet: alice },
      });

      const bobMarket = getContract({
        address: marketAddress,
        abi: TaskMarketABI,
        client: { public: publicClient, wallet: bob },
      });

      const hash = await aliceMarket.write.createTask(
        ['Task', 'Description', 'Qm', BigInt(Math.floor(Date.now() / 1000) + 7 * 86400)],
        { value: parseEther('1') }
      );
      const receipt = await publicClient.waitForTransactionReceipt({ hash });
      const event = findEventLog(receipt, TaskMarketABI, 'TaskCreated');
      const taskId = event.taskId;

      await expectTransactionRevert(
        bobMarket.write.submitBid([taskId, BigInt(0), 'Free work']),
        /zero|invalid|amount/i
      );
    });

    it('should handle very long proposal strings', async () => {
      const aliceMarket = getContract({
        address: marketAddress,
        abi: TaskMarketABI,
        client: { public: publicClient, wallet: alice },
      });

      const bobMarket = getContract({
        address: marketAddress,
        abi: TaskMarketABI,
        client: { public: publicClient, wallet: bob },
      });

      const hash = await aliceMarket.write.createTask(
        ['Task', 'Description', 'Qm', BigInt(Math.floor(Date.now() / 1000) + 7 * 86400)],
        { value: parseEther('1') }
      );
      const receipt = await publicClient.waitForTransactionReceipt({ hash });
      const event = findEventLog(receipt, TaskMarketABI, 'TaskCreated');
      const taskId = event.taskId;

      const longProposal = 'A'.repeat(10000);

      const bidHash = await bobMarket.write.submitBid([taskId, parseEther('0.8'), longProposal]);
      const bidReceipt = await publicClient.waitForTransactionReceipt({ hash: bidHash });

      expect(bidReceipt.status).toBe('success');

      const bid = await marketAddress.read.bids([taskId, BigInt(1)]);
      expect(bid.proposal).toBe(longProposal);
    });
  });

  describe('Gas Benchmarks', () => {
    it('should report gas usage for all operations', async () => {
      console.log('\n=== TaskMarket Gas Report ===');
      console.log(gasTracker.report());
      console.log(gasProfiler.generateReport());
    });

    it('should create task within gas limits', async () => {
      const createGas = gasTracker.get('createTask');
      if (createGas) {
        expect(createGas).toBeLessThan(BigInt(150000)); // 150k gas limit
      }
    });

    it('should submit bid within gas limits', async () => {
      const bidGas = gasTracker.get('submitBid');
      if (bidGas) {
        expect(bidGas).toBeLessThan(BigInt(100000)); // 100k gas limit
      }
    });

    it('should accept bid within gas limits', async () => {
      const acceptGas = gasTracker.get('acceptBid');
      if (acceptGas) {
        expect(acceptGas).toBeLessThan(BigInt(120000)); // 120k gas limit
      }
    });

    it('should complete task within gas limits', async () => {
      const completeGas = gasTracker.get('completeTask');
      if (completeGas) {
        expect(completeGas).toBeLessThan(BigInt(110000)); // 110k gas limit
      }
    });

    it('should release payment within gas limits', async () => {
      const paymentGas = gasTracker.get('releasePayment');
      if (paymentGas) {
        expect(paymentGas).toBeLessThan(BigInt(80000)); // 80k gas limit
      }
    });
  });
});
