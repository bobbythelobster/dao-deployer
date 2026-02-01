/**
 * SoulBoundToken Unit Tests
 * Tests for the soul-bound governance token with voting power
 */

import { describe, it, expect, beforeEach, beforeAll, afterEach } from 'bun:test';
import { type Address, type WalletClient, type PublicClient, parseEther, getContract } from 'viem';
import { getTestContext, GasTracker, takeSnapshot, revertToSnapshot } from '../setup';
import { SoulBoundTokenABI, SoulBoundTokenBytecode } from './abis';
import { MOCK_ACCOUNTS, MOCK_TOKEN_CONFIG, ERROR_SCENARIOS } from '../mocks/data';
import { deployContract, findEventLog, expectTransactionRevert, GasProfiler } from '../utils/helpers';

describe('SoulBoundToken', () => {
  let context: ReturnType<typeof getTestContext>;
  let publicClient: PublicClient;
  let deployer: WalletClient;
  let alice: WalletClient;
  let bob: WalletClient;
  let carol: WalletClient;
  let tokenAddress: Address;
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
    // Take snapshot for test isolation
    snapshotId = await takeSnapshot(publicClient);

    // Deploy SoulBoundToken contract
    tokenAddress = await deployContract(
      deployer,
      publicClient,
      SoulBoundTokenABI,
      SoulBoundTokenBytecode,
      [MOCK_TOKEN_CONFIG.name, MOCK_TOKEN_CONFIG.symbol]
    );

    context.contracts.soulBoundToken = tokenAddress;
  });

  afterEach(async () => {
    // Revert to snapshot after each test
    await revertToSnapshot(publicClient, snapshotId);
  });

  describe('Deployment', () => {
    it('should deploy with correct name and symbol', async () => {
      const token = getContract({
        address: tokenAddress,
        abi: SoulBoundTokenABI,
        client: publicClient,
      });

      const name = await token.read.name();
      const symbol = await token.read.symbol();
      const decimals = await token.read.decimals();

      expect(name).toBe(MOCK_TOKEN_CONFIG.name);
      expect(symbol).toBe(MOCK_TOKEN_CONFIG.symbol);
      expect(decimals).toBe(18);
    });

    it('should set deployer as owner', async () => {
      const token = getContract({
        address: tokenAddress,
        abi: SoulBoundTokenABI,
        client: publicClient,
      });

      const owner = await token.read.owner();
      expect(owner.toLowerCase()).toBe(MOCK_ACCOUNTS[0].address.toLowerCase());
    });

    it('should start with zero total supply', async () => {
      const token = getContract({
        address: tokenAddress,
        abi: SoulBoundTokenABI,
        client: publicClient,
      });

      const totalSupply = await token.read.totalSupply();
      expect(totalSupply).toBe(BigInt(0));
    });
  });

  describe('Minting', () => {
    it('should allow owner to mint tokens', async () => {
      const token = getContract({
        address: tokenAddress,
        abi: SoulBoundTokenABI,
        client: { public: publicClient, wallet: deployer },
      });

      const mintAmount = parseEther('1000');
      const aliceAddress = MOCK_ACCOUNTS[1].address;

      const hash = await token.write.mint([aliceAddress, mintAmount]);
      const receipt = await publicClient.waitForTransactionReceipt({ hash });

      gasTracker.record('mint', receipt.gasUsed);
      gasProfiler.record('SoulBoundToken.mint', receipt.gasUsed);

      expect(receipt.status).toBe('success');

      const balance = await token.read.balanceOf([aliceAddress]);
      expect(balance).toBe(mintAmount);

      const totalSupply = await token.read.totalSupply();
      expect(totalSupply).toBe(mintAmount);

      // Check Mint event
      const mintEvent = findEventLog(receipt, SoulBoundTokenABI, 'Mint');
      expect(mintEvent).toBeDefined();
      expect(mintEvent.to.toLowerCase()).toBe(aliceAddress.toLowerCase());
      expect(mintEvent.amount).toBe(mintAmount);
    });

    it('should not allow non-owner to mint tokens', async () => {
      const token = getContract({
        address: tokenAddress,
        abi: SoulBoundTokenABI,
        client: { public: publicClient, wallet: alice },
      });

      const mintAmount = parseEther('1000');
      const bobAddress = MOCK_ACCOUNTS[2].address;

      await expectTransactionRevert(
        token.write.mint([bobAddress, mintAmount]),
        ERROR_SCENARIOS.soulBound.burnNotAuthorized
      );
    });

    it('should mint multiple times to same address', async () => {
      const token = getContract({
        address: tokenAddress,
        abi: SoulBoundTokenABI,
        client: { public: publicClient, wallet: deployer },
      });

      const aliceAddress = MOCK_ACCOUNTS[1].address;
      const amount1 = parseEther('500');
      const amount2 = parseEther('300');

      await token.write.mint([aliceAddress, amount1]);
      await token.write.mint([aliceAddress, amount2]);

      const balance = await token.read.balanceOf([aliceAddress]);
      expect(balance).toBe(amount1 + amount2);
    });

    it('should mint to multiple addresses', async () => {
      const token = getContract({
        address: tokenAddress,
        abi: SoulBoundTokenABI,
        client: { public: publicClient, wallet: deployer },
      });

      const amount = parseEther('1000');

      await token.write.mint([MOCK_ACCOUNTS[1].address, amount]);
      await token.write.mint([MOCK_ACCOUNTS[2].address, amount]);
      await token.write.mint([MOCK_ACCOUNTS[3].address, amount]);

      const balance1 = await token.read.balanceOf([MOCK_ACCOUNTS[1].address]);
      const balance2 = await token.read.balanceOf([MOCK_ACCOUNTS[2].address]);
      const balance3 = await token.read.balanceOf([MOCK_ACCOUNTS[3].address]);

      expect(balance1).toBe(amount);
      expect(balance2).toBe(amount);
      expect(balance3).toBe(amount);

      const totalSupply = await token.read.totalSupply();
      expect(totalSupply).toBe(amount * BigInt(3));
    });
  });

  describe('Burning', () => {
    beforeEach(async () => {
      // Mint tokens to alice for burning tests
      const token = getContract({
        address: tokenAddress,
        abi: SoulBoundTokenABI,
        client: { public: publicClient, wallet: deployer },
      });

      await token.write.mint([MOCK_ACCOUNTS[1].address, parseEther('1000')]);
    });

    it('should allow owner to burn tokens', async () => {
      const token = getContract({
        address: tokenAddress,
        abi: SoulBoundTokenABI,
        client: { public: publicClient, wallet: deployer },
      });

      const burnAmount = parseEther('300');
      const aliceAddress = MOCK_ACCOUNTS[1].address;

      const initialBalance = await token.read.balanceOf([aliceAddress]);

      const hash = await token.write.burn([aliceAddress, burnAmount]);
      const receipt = await publicClient.waitForTransactionReceipt({ hash });

      gasTracker.record('burn', receipt.gasUsed);
      gasProfiler.record('SoulBoundToken.burn', receipt.gasUsed);

      expect(receipt.status).toBe('success');

      const finalBalance = await token.read.balanceOf([aliceAddress]);
      expect(finalBalance).toBe(initialBalance - burnAmount);

      const totalSupply = await token.read.totalSupply();
      expect(totalSupply).toBe(initialBalance - burnAmount);

      // Check Burn event
      const burnEvent = findEventLog(receipt, SoulBoundTokenABI, 'Burn');
      expect(burnEvent).toBeDefined();
      expect(burnEvent.from.toLowerCase()).toBe(aliceAddress.toLowerCase());
      expect(burnEvent.amount).toBe(burnAmount);
    });

    it('should not allow non-owner to burn tokens', async () => {
      const token = getContract({
        address: tokenAddress,
        abi: SoulBoundTokenABI,
        client: { public: publicClient, wallet: alice },
      });

      const burnAmount = parseEther('100');
      const bobAddress = MOCK_ACCOUNTS[2].address;

      await expectTransactionRevert(
        token.write.burn([bobAddress, burnAmount]),
        ERROR_SCENARIOS.soulBound.burnNotAuthorized
      );
    });

    it('should not burn more than balance', async () => {
      const token = getContract({
        address: tokenAddress,
        abi: SoulBoundTokenABI,
        client: { public: publicClient, wallet: deployer },
      });

      const aliceAddress = MOCK_ACCOUNTS[1].address;
      const balance = await token.read.balanceOf([aliceAddress]);
      const excessiveAmount = balance + parseEther('1');

      await expectTransactionRevert(
        token.write.burn([aliceAddress, excessiveAmount]),
        /insufficient|balance|exceeds/i
      );
    });

    it('should allow burning partial amount', async () => {
      const token = getContract({
        address: tokenAddress,
        abi: SoulBoundTokenABI,
        client: { public: publicClient, wallet: deployer },
      });

      const aliceAddress = MOCK_ACCOUNTS[1].address;
      const initialBalance = await token.read.balanceOf([aliceAddress]);
      const burnAmount = parseEther('100');

      await token.write.burn([aliceAddress, burnAmount]);

      const finalBalance = await token.read.balanceOf([aliceAddress]);
      expect(finalBalance).toBe(initialBalance - burnAmount);
    });
  });

  describe('Transfer Restrictions', () => {
    beforeEach(async () => {
      // Mint tokens to alice for transfer tests
      const token = getContract({
        address: tokenAddress,
        abi: SoulBoundTokenABI,
        client: { public: publicClient, wallet: deployer },
      });

      await token.write.mint([MOCK_ACCOUNTS[1].address, parseEther('1000')]);
    });

    it('should revert on direct transfer', async () => {
      const token = getContract({
        address: tokenAddress,
        abi: SoulBoundTokenABI,
        client: { public: publicClient, wallet: alice },
      });

      const transferAmount = parseEther('100');
      const bobAddress = MOCK_ACCOUNTS[2].address;

      await expectTransactionRevert(
        token.write.transfer([bobAddress, transferAmount]),
        ERROR_SCENARIOS.soulBound.transferNotAllowed
      );
    });

    it('should revert on transferFrom', async () => {
      const token = getContract({
        address: tokenAddress,
        abi: SoulBoundTokenABI,
        client: { public: publicClient, wallet: alice },
      });

      const transferAmount = parseEther('100');
      const bobAddress = MOCK_ACCOUNTS[2].address;
      const carolAddress = MOCK_ACCOUNTS[3].address;

      await expectTransactionRevert(
        token.write.transferFrom([bobAddress, carolAddress, transferAmount]),
        ERROR_SCENARIOS.soulBound.transferNotAllowed
      );
    });

    it('should maintain balance after failed transfer attempt', async () => {
      const token = getContract({
        address: tokenAddress,
        abi: SoulBoundTokenABI,
        client: { public: publicClient, wallet: alice },
      });

      const aliceAddress = MOCK_ACCOUNTS[1].address;
      const initialBalance = await token.read.balanceOf([aliceAddress]);

      const bobAddress = MOCK_ACCOUNTS[2].address;
      const transferAmount = parseEther('100');

      try {
        await token.write.transfer([bobAddress, transferAmount]);
      } catch {
        // Expected to fail
      }

      const finalBalance = await token.read.balanceOf([aliceAddress]);
      expect(finalBalance).toBe(initialBalance);
    });
  });

  describe('Voting Power', () => {
    beforeEach(async () => {
      // Mint tokens to multiple accounts
      const token = getContract({
        address: tokenAddress,
        abi: SoulBoundTokenABI,
        client: { public: publicClient, wallet: deployer },
      });

      await token.write.mint([MOCK_ACCOUNTS[1].address, parseEther('1000')]);
      await token.write.mint([MOCK_ACCOUNTS[2].address, parseEther('500')]);
      await token.write.mint([MOCK_ACCOUNTS[3].address, parseEther('250')]);
    });

    it('should track voting power equal to balance by default', async () => {
      const token = getContract({
        address: tokenAddress,
        abi: SoulBoundTokenABI,
        client: publicClient,
      });

      const aliceAddress = MOCK_ACCOUNTS[1].address;
      const balance = await token.read.balanceOf([aliceAddress]);
      const votes = await token.read.getVotes([aliceAddress]);

      expect(votes).toBe(balance);
    });

    it('should update voting power on mint', async () => {
      const token = getContract({
        address: tokenAddress,
        abi: SoulBoundTokenABI,
        client: { public: publicClient, wallet: deployer },
      });

      const daveAddress = MOCK_ACCOUNTS[4].address;
      const mintAmount = parseEther('750');

      const initialVotes = await token.read.getVotes([daveAddress]);
      expect(initialVotes).toBe(BigInt(0));

      await token.write.mint([daveAddress, mintAmount]);

      const finalVotes = await token.read.getVotes([daveAddress]);
      expect(finalVotes).toBe(mintAmount);
    });

    it('should update voting power on burn', async () => {
      const token = getContract({
        address: tokenAddress,
        abi: SoulBoundTokenABI,
        client: { public: publicClient, wallet: deployer },
      });

      const aliceAddress = MOCK_ACCOUNTS[1].address;
      const burnAmount = parseEther('200');

      const initialVotes = await token.read.getVotes([aliceAddress]);

      await token.write.burn([aliceAddress, burnAmount]);

      const finalVotes = await token.read.getVotes([aliceAddress]);
      expect(finalVotes).toBe(initialVotes - burnAmount);
    });

    it('should support delegation', async () => {
      const token = getContract({
        address: tokenAddress,
        abi: SoulBoundTokenABI,
        client: { public: publicClient, wallet: alice },
      });

      const aliceAddress = MOCK_ACCOUNTS[1].address;
      const bobAddress = MOCK_ACCOUNTS[2].address;

      const hash = await token.write.delegate([bobAddress]);
      const receipt = await publicClient.waitForTransactionReceipt({ hash });

      gasProfiler.record('SoulBoundToken.delegate', receipt.gasUsed);

      expect(receipt.status).toBe('success');

      const delegate = await token.read.delegates([aliceAddress]);
      expect(delegate.toLowerCase()).toBe(bobAddress.toLowerCase());

      // Check DelegateChanged event
      const delegateEvent = findEventLog(receipt, SoulBoundTokenABI, 'DelegateChanged');
      expect(delegateEvent).toBeDefined();
      expect(delegateEvent.delegator.toLowerCase()).toBe(aliceAddress.toLowerCase());
      expect(delegateEvent.toDelegate.toLowerCase()).toBe(bobAddress.toLowerCase());
    });

    it('should transfer voting power on delegation', async () => {
      const token = getContract({
        address: tokenAddress,
        abi: SoulBoundTokenABI,
        client: { public: publicClient, wallet: alice },
      });

      const bobAddress = MOCK_ACCOUNTS[2].address;
      const aliceBalance = await token.read.balanceOf([MOCK_ACCOUNTS[1].address]);

      const initialBobVotes = await token.read.getVotes([bobAddress]);

      await token.write.delegate([bobAddress]);

      const finalBobVotes = await token.read.getVotes([bobAddress]);
      expect(finalBobVotes).toBe(initialBobVotes + aliceBalance);
    });

    it('should track past votes at specific blocks', async () => {
      const token = getContract({
        address: tokenAddress,
        abi: SoulBoundTokenABI,
        client: publicClient,
      });

      const aliceAddress = MOCK_ACCOUNTS[1].address;
      const currentBlock = await publicClient.getBlockNumber();

      const pastVotes = await token.read.getPastVotes([aliceAddress, currentBlock - BigInt(1)]);
      const currentVotes = await token.read.getVotes([aliceAddress]);

      // Past votes should be 0 before minting at that block
      expect(pastVotes).toBe(BigInt(0));
      expect(currentVotes).toBeGreaterThan(BigInt(0));
    });
  });

  describe('Access Control', () => {
    it('should allow owner to renounce ownership', async () => {
      const token = getContract({
        address: tokenAddress,
        abi: SoulBoundTokenABI,
        client: { public: publicClient, wallet: deployer },
      });

      const hash = await token.write.renounceOwnership();
      const receipt = await publicClient.waitForTransactionReceipt({ hash });

      expect(receipt.status).toBe('success');

      const owner = await token.read.owner();
      expect(owner).toBe('0x0000000000000000000000000000000000000000');
    });

    it('should allow owner to transfer ownership', async () => {
      const token = getContract({
        address: tokenAddress,
        abi: SoulBoundTokenABI,
        client: { public: publicClient, wallet: deployer },
      });

      const aliceAddress = MOCK_ACCOUNTS[1].address;

      const hash = await token.write.transferOwnership([aliceAddress]);
      const receipt = await publicClient.waitForTransactionReceipt({ hash });

      expect(receipt.status).toBe('success');

      const owner = await token.read.owner();
      expect(owner.toLowerCase()).toBe(aliceAddress.toLowerCase());
    });

    it('should not allow non-owner to transfer ownership', async () => {
      const token = getContract({
        address: tokenAddress,
        abi: SoulBoundTokenABI,
        client: { public: publicClient, wallet: alice },
      });

      const bobAddress = MOCK_ACCOUNTS[2].address;

      await expectTransactionRevert(
        token.write.transferOwnership([bobAddress]),
        ERROR_SCENARIOS.soulBound.burnNotAuthorized
      );
    });

    it('should not allow non-owner to renounce ownership', async () => {
      const token = getContract({
        address: tokenAddress,
        abi: SoulBoundTokenABI,
        client: { public: publicClient, wallet: alice },
      });

      await expectTransactionRevert(
        token.write.renounceOwnership(),
        ERROR_SCENARIOS.soulBound.burnNotAuthorized
      );
    });
  });

  describe('Gas Benchmarks', () => {
    beforeEach(async () => {
      const token = getContract({
        address: tokenAddress,
        abi: SoulBoundTokenABI,
        client: { public: publicClient, wallet: deployer },
      });

      await token.write.mint([MOCK_ACCOUNTS[1].address, parseEther('1000')]);
    });

    it('should report gas usage for all operations', async () => {
      console.log('\n=== SoulBoundToken Gas Report ===');
      console.log(gasTracker.report());
      console.log(gasProfiler.generateReport());
    });

    it('should mint within gas limits', async () => {
      const mintGas = gasTracker.get('mint');
      expect(mintGas).toBeDefined();
      expect(mintGas!).toBeLessThan(BigInt(100000)); // 100k gas limit
    });

    it('should burn within gas limits', async () => {
      const burnGas = gasTracker.get('burn');
      expect(burnGas).toBeDefined();
      expect(burnGas!).toBeLessThan(BigInt(50000)); // 50k gas limit
    });
  });
});
