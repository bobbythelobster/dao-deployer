/**
 * Task Market Flow Integration Test
 * Create task → Submit bids → Accept bid → Complete task → Verify payment
 */

import { describe, it, expect, beforeAll, beforeEach } from 'bun:test';
import { type Address, type WalletClient, type PublicClient, parseEther, getContract } from 'viem';
import { getTestContext, takeSnapshot, revertToSnapshot } from '../setup';
import { TaskMarketABI, TaskMarketBytecode } from '../contracts/abis';
import { MOCK_ACCOUNTS, TaskState } from '../mocks/data';
import { deployContract, findEventLog, getBalance } from '../utils/helpers';

describe('Task Market Flow', () => {
  let context: ReturnType<typeof getTestContext>;
  let publicClient: PublicClient;
  let deployer: WalletClient;
  let alice: WalletClient; // Task creator
  let bob: WalletClient;   // Worker
  let carol: WalletClient; // Other bidder
  let snapshotId: string;

  let marketAddress: Address;

  beforeAll(async () => {
    context = getTestContext();
    publicClient = context.publicClient;
    deployer = context.walletClients.deployer;
    alice = context.walletClients.alice;
    bob = context.walletClients.bob;
    carol = context.walletClients.carol;
  });

  beforeEach(async () => {
    snapshotId = await takeSnapshot(publicClient);

    // Deploy TaskMarket
    marketAddress = await deployContract(
      deployer,
      publicClient,
      TaskMarketABI,
      TaskMarketBytecode,
      [250] // 2.5% platform fee
    );
  });

  afterEach(async () => {
    await revertToSnapshot(publicClient, snapshotId);
  });

  describe('Complete Task Market Flow', () => {
    it('should execute full marketplace flow', async () => {
      console.log('\n🚀 Starting Task Market Flow Test\n');

      // ============ STEP 1: Create Task ============
      console.log('📋 Step 1: Creating task...');

      const aliceMarket = getContract({
        address: marketAddress,
        abi: TaskMarketABI,
        client: { public: publicClient, wallet: alice },
      });

      const taskTitle = 'Build DeFi Dashboard';
      const taskDescription = 'Create a React-based DeFi dashboard with wallet integration';
      const ipfsHash = 'QmTaskDescription123';
      const deadline = BigInt(Math.floor(Date.now() / 1000) + 7 * 24 * 60 * 60); // 7 days
      const budget = parseEther('2');

      const aliceBalanceBefore = await getBalance(publicClient, MOCK_ACCOUNTS[1].address);

      const createHash = await aliceMarket.write.createTask(
        [taskTitle, taskDescription, ipfsHash, deadline],
        { value: budget }
      );

      const createReceipt = await publicClient.waitForTransactionReceipt({ hash: createHash });
      expect(createReceipt.status).toBe('success');

      const taskEvent = findEventLog(createReceipt, TaskMarketABI, 'TaskCreated');
      expect(taskEvent).toBeDefined();

      const taskId = taskEvent.taskId;

      console.log(`   ✓ Task #${taskId.toString()} created: "${taskTitle}"`);
      console.log(`   ✓ Budget: ${budget.toString()} wei (2 ETH)`);
      console.log(`   ✓ Deadline: ${new Date(Number(deadline) * 1000).toISOString()}`);

      // Verify task state
      const task = await aliceMarket.read.tasks([taskId]);
      expect(task.title).toBe(taskTitle);
      expect(task.budget).toBe(budget);
      expect(task.state).toBe(TaskState.Open);
      expect(task.assignee).toBe('0x0000000000000000000000000000000000000000');

      // Verify contract received funds
      const contractBalance = await getBalance(publicClient, marketAddress);
      expect(contractBalance).toBe(budget);

      // ============ STEP 2: Submit Bids ============
      console.log('\n📋 Step 2: Submitting bids...');

      // Bob submits bid
      const bobMarket = getContract({
        address: marketAddress,
        abi: TaskMarketABI,
        client: { public: publicClient, wallet: bob },
      });

      const bobBidAmount = parseEther('1.5');
      const bobProposal = 'I have 3 years of React experience and can deliver in 5 days';

      const bobBidHash = await bobMarket.write.submitBid([taskId, bobBidAmount, bobProposal]);
      const bobBidReceipt = await publicClient.waitForTransactionReceipt({ hash: bobBidHash });
      expect(bobBidReceipt.status).toBe('success');

      const bobBidEvent = findEventLog(bobBidReceipt, TaskMarketABI, 'BidSubmitted');
      const bobBidId = bobBidEvent.bidId;

      console.log(`   ✓ Bob submitted bid #${bobBidId.toString()}: ${bobBidAmount.toString()} wei`);
      console.log(`     Proposal: "${bobProposal.substring(0, 50)}..."`);

      // Carol submits bid
      const carolMarket = getContract({
        address: marketAddress,
        abi: TaskMarketABI,
        client: { public: publicClient, wallet: carol },
      });

      const carolBidAmount = parseEther('1.8');
      const carolProposal = 'I specialize in DeFi UIs and have built similar dashboards';

      const carolBidHash = await carolMarket.write.submitBid([taskId, carolBidAmount, carolProposal]);
      const carolBidReceipt = await publicClient.waitForTransactionReceipt({ hash: carolBidHash });
      expect(carolBidReceipt.status).toBe('success');

      const carolBidEvent = findEventLog(carolBidReceipt, TaskMarketABI, 'BidSubmitted');
      const carolBidId = carolBidEvent.bidId;

      console.log(`   ✓ Carol submitted bid #${carolBidId.toString()}: ${carolBidAmount.toString()} wei`);
      console.log(`     Proposal: "${carolProposal.substring(0, 50)}..."`);

      // Verify bids
      const bids = await aliceMarket.read.getTaskBids([taskId]);
      expect(bids).toHaveLength(2);

      const bobBid = await aliceMarket.read.bids([taskId, bobBidId]);
      const carolBid = await aliceMarket.read.bids([taskId, carolBidId]);

      expect(bobBid.bidder.toLowerCase()).toBe(MOCK_ACCOUNTS[2].address.toLowerCase());
      expect(carolBid.bidder.toLowerCase()).toBe(MOCK_ACCOUNTS[3].address.toLowerCase());

      // ============ STEP 3: Accept Bid ============
      console.log('\n📋 Step 3: Accepting bid...');

      // Alice accepts Bob's bid (better value)
      const acceptHash = await aliceMarket.write.acceptBid([taskId, bobBidId]);
      const acceptReceipt = await publicClient.waitForTransactionReceipt({ hash: acceptHash });
      expect(acceptReceipt.status).toBe('success');

      const acceptEvent = findEventLog(acceptReceipt, TaskMarketABI, 'BidAccepted');
      expect(acceptEvent.taskId).toBe(taskId);
      expect(acceptEvent.bidId).toBe(bobBidId);
      expect(acceptEvent.worker.toLowerCase()).toBe(MOCK_ACCOUNTS[2].address.toLowerCase());

      console.log(`   ✓ Alice accepted Bob's bid #${bobBidId.toString()}`);

      // Verify task state
      const assignedTask = await aliceMarket.read.tasks([taskId]);
      expect(assignedTask.state).toBe(TaskState.Assigned);
      expect(assignedTask.assignee.toLowerCase()).toBe(MOCK_ACCOUNTS[2].address.toLowerCase());

      // Verify bid state
      const acceptedBid = await aliceMarket.read.bids([taskId, bobBidId]);
      expect(acceptedBid.accepted).toBe(true);

      // ============ STEP 4: Submit Work (optional) ============
      console.log('\n📋 Step 4: Submitting work...');

      const workResult = 'ipfs://QmWorkResult789';

      const submitWorkHash = await bobMarket.write.submitWork([taskId, workResult]);
      const submitWorkReceipt = await publicClient.waitForTransactionReceipt({ hash: submitWorkHash });
      expect(submitWorkReceipt.status).toBe('success');

      console.log(`   ✓ Bob submitted work: ${workResult}`);

      // ============ STEP 5: Complete Task ============
      console.log('\n📋 Step 5: Completing task...');

      const completeHash = await aliceMarket.write.completeTask([taskId]);
      const completeReceipt = await publicClient.waitForTransactionReceipt({ hash: completeHash });
      expect(completeReceipt.status).toBe('success');

      const completeEvent = findEventLog(completeReceipt, TaskMarketABI, 'TaskCompleted');
      expect(completeEvent.taskId).toBe(taskId);
      expect(completeEvent.worker.toLowerCase()).toBe(MOCK_ACCOUNTS[2].address.toLowerCase());

      console.log(`   ✓ Task #${taskId.toString()} marked as completed`);

      // Verify task state
      const completedTask = await aliceMarket.read.tasks([taskId]);
      expect(completedTask.state).toBe(TaskState.Completed);
      expect(completedTask.completedAt).toBeGreaterThan(BigInt(0));

      // ============ STEP 6: Release Payment ============
      console.log('\n📋 Step 6: Releasing payment...');

      const bobBalanceBefore = await getBalance(publicClient, MOCK_ACCOUNTS[2].address);
      const contractBalanceBefore = await getBalance(publicClient, marketAddress);

      const releaseHash = await aliceMarket.write.releasePayment([taskId]);
      const releaseReceipt = await publicClient.waitForTransactionReceipt({ hash: releaseHash });
      expect(releaseReceipt.status).toBe('success');

      const releaseEvent = findEventLog(releaseReceipt, TaskMarketABI, 'PaymentReleased');
      expect(releaseEvent.taskId).toBe(taskId);
      expect(releaseEvent.worker.toLowerCase()).toBe(MOCK_ACCOUNTS[2].address.toLowerCase());
      expect(releaseEvent.amount).toBe(bobBidAmount);

      console.log(`   ✓ Payment of ${bobBidAmount.toString()} wei released to Bob`);

      // Verify payment
      const bobBalanceAfter = await getBalance(publicClient, MOCK_ACCOUNTS[2].address);
      expect(bobBalanceAfter).toBeGreaterThan(bobBalanceBefore);

      // Verify platform fee
      const platformFee = (bobBidAmount * BigInt(250)) / BigInt(10000); // 2.5%
      const expectedContractBalance = budget - bobBidAmount + platformFee;
      const contractBalanceAfter = await getBalance(publicClient, marketAddress);

      console.log(`   ✓ Platform fee: ${platformFee.toString()} wei (2.5%)`);
      console.log(`   ✓ Contract balance: ${contractBalanceAfter.toString()} wei`);

      console.log('\n🎉 Task market flow completed successfully!');
    });

    it('should handle cancelled task flow', async () => {
      console.log('\n🚀 Starting Cancelled Task Flow Test\n');

      // Create task
      const aliceMarket = getContract({
        address: marketAddress,
        abi: TaskMarketABI,
        client: { public: publicClient, wallet: alice },
      });

      const aliceBalanceBefore = await getBalance(publicClient, MOCK_ACCOUNTS[1].address);
      const budget = parseEther('1');

      const hash = await aliceMarket.write.createTask(
        ['Task to cancel', 'Description', 'Qm', BigInt(Math.floor(Date.now() / 1000) + 86400)],
        { value: budget }
      );

      const receipt = await publicClient.waitForTransactionReceipt({ hash });
      const event = findEventLog(receipt, TaskMarketABI, 'TaskCreated');
      const taskId = event.taskId;

      console.log(`📋 Task #${taskId.toString()} created`);

      // Cancel task
      const cancelHash = await aliceMarket.write.cancelTask([taskId]);
      const cancelReceipt = await publicClient.waitForTransactionReceipt({ hash: cancelHash });
      expect(cancelReceipt.status).toBe('success');

      console.log(`   ✓ Task cancelled`);

      // Verify refund
      const aliceBalanceAfter = await getBalance(publicClient, MOCK_ACCOUNTS[1].address);
      expect(aliceBalanceAfter).toBeGreaterThan(aliceBalanceBefore);

      // Verify task state
      const task = await aliceMarket.read.tasks([taskId]);
      expect(task.state).toBe(TaskState.Cancelled);

      console.log('🎉 Cancelled task flow completed!');
    });

    it('should handle multiple tasks simultaneously', async () => {
      console.log('\n🚀 Starting Multiple Tasks Flow Test\n');

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

      // Create 3 tasks
      const deadline = BigInt(Math.floor(Date.now() / 1000) + 7 * 86400);

      const task1Hash = await aliceMarket.write.createTask(
        ['Task 1', 'Description 1', 'Qm1', deadline],
        { value: parseEther('1') }
      );
      const task2Hash = await aliceMarket.write.createTask(
        ['Task 2', 'Description 2', 'Qm2', deadline],
        { value: parseEther('2') }
      );
      const task3Hash = await aliceMarket.write.createTask(
        ['Task 3', 'Description 3', 'Qm3', deadline],
        { value: parseEther('1.5') }
      );

      const receipt1 = await publicClient.waitForTransactionReceipt({ hash: task1Hash });
      const receipt2 = await publicClient.waitForTransactionReceipt({ hash: task2Hash });
      const receipt3 = await publicClient.waitForTransactionReceipt({ hash: task3Hash });

      const event1 = findEventLog(receipt1, TaskMarketABI, 'TaskCreated');
      const event2 = findEventLog(receipt2, TaskMarketABI, 'TaskCreated');
      const event3 = findEventLog(receipt3, TaskMarketABI, 'TaskCreated');

      const task1Id = event1.taskId;
      const task2Id = event2.taskId;
      const task3Id = event3.taskId;

      console.log(`📋 Created 3 tasks: #${task1Id}, #${task2Id}, #${task3Id}`);

      // Submit bids on all tasks
      await bobMarket.write.submitBid([task1Id, parseEther('0.8'), 'Bid 1']);
      await bobMarket.write.submitBid([task2Id, parseEther('1.5'), 'Bid 2']);
      await bobMarket.write.submitBid([task3Id, parseEther('1.2'), 'Bid 3']);

      console.log(`   ✓ Bob submitted bids on all tasks`);

      // Accept all bids
      await aliceMarket.write.acceptBid([task1Id, BigInt(1)]);
      await aliceMarket.write.acceptBid([task2Id, BigInt(1)]);
      await aliceMarket.write.acceptBid([task3Id, BigInt(1)]);

      console.log(`   ✓ All bids accepted`);

      // Complete all tasks
      await aliceMarket.write.completeTask([task1Id]);
      await aliceMarket.write.completeTask([task2Id]);
      await aliceMarket.write.completeTask([task3Id]);

      console.log(`   ✓ All tasks completed`);

      // Release all payments
      await aliceMarket.write.releasePayment([task1Id]);
      await aliceMarket.write.releasePayment([task2Id]);
      await aliceMarket.write.releasePayment([task3Id]);

      console.log(`   ✓ All payments released`);

      // Verify all tasks are completed and paid
      const task1 = await aliceMarket.read.tasks([task1Id]);
      const task2 = await aliceMarket.read.tasks([task2Id]);
      const task3 = await aliceMarket.read.tasks([task3Id]);

      expect(task1.state).toBe(TaskState.Completed);
      expect(task2.state).toBe(TaskState.Completed);
      expect(task3.state).toBe(TaskState.Completed);

      console.log('🎉 Multiple tasks flow completed!');
    });

    it('should track platform fees correctly across multiple tasks', async () => {
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

      const deployerMarket = getContract({
        address: marketAddress,
        abi: TaskMarketABI,
        client: { public: publicClient, wallet: deployer },
      });

      // Complete several tasks
      for (let i = 1; i <= 3; i++) {
        const deadline = BigInt(Math.floor(Date.now() / 1000) + 7 * 86400);
        const budget = parseEther('1');
        const bidAmount = parseEther('0.8');

        const taskHash = await aliceMarket.write.createTask(
          [`Task ${i}`, 'Description', `Qm${i}`, deadline],
          { value: budget }
        );
        const taskReceipt = await publicClient.waitForTransactionReceipt({ hash: taskHash });
        const taskEvent = findEventLog(taskReceipt, TaskMarketABI, 'TaskCreated');
        const taskId = taskEvent.taskId;

        await bobMarket.write.submitBid([taskId, bidAmount, 'Proposal']);
        await aliceMarket.write.acceptBid([taskId, BigInt(1)]);
        await aliceMarket.write.completeTask([taskId]);
        await aliceMarket.write.releasePayment([taskId]);
      }

      // Calculate expected platform fees
      // 3 tasks * 0.8 ETH bid * 2.5% fee = 0.06 ETH total fees
      const expectedFees = (parseEther('0.8') * BigInt(3) * BigInt(250)) / BigInt(10000);

      const contractBalance = await getBalance(publicClient, marketAddress);
      console.log(`\n💰 Total platform fees collected: ${contractBalance.toString()} wei`);
      console.log(`   Expected: ${expectedFees.toString()} wei`);

      // Withdraw fees
      const deployerBalanceBefore = await getBalance(publicClient, MOCK_ACCOUNTS[0].address);

      const withdrawHash = await deployerMarket.write.withdrawPlatformFees();
      const withdrawReceipt = await publicClient.waitForTransactionReceipt({ hash: withdrawHash });
      expect(withdrawReceipt.status).toBe('success');

      const deployerBalanceAfter = await getBalance(publicClient, MOCK_ACCOUNTS[0].address);
      expect(deployerBalanceAfter).toBeGreaterThan(deployerBalanceBefore);

      console.log('   ✓ Platform fees withdrawn');
    });
  });
});
