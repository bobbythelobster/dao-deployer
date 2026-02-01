// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {Test, console} from "forge-std/Test.sol";
import {TaskMarket} from "../src/TaskMarket.sol";
import {MockERC20} from "../src/mocks/MockERC20.sol";

/**
 * @title TaskMarketTest
 * @notice Test suite for TaskMarket contract
 */
contract TaskMarketTest is Test {
    TaskMarket public market;
    MockERC20 public rewardToken;
    
    address public owner;
    address public offeror;
    address public acceptor;
    address public resolver;
    address public feeRecipient;
    
    uint256 public constant MIN_REWARD = 0.01 ether;
    uint256 public constant PLATFORM_FEE = 250; // 2.5%
    
    event OfferCreated(
        uint256 indexed offerId,
        uint256 indexed proposalId,
        address indexed offeror,
        uint256 reward,
        address rewardToken,
        uint256 deadline
    );
    
    event OfferAccepted(
        uint256 indexed offerId,
        address indexed acceptor,
        uint256 acceptedAt
    );
    
    event TaskCompleted(
        uint256 indexed offerId,
        bytes32 completionProof,
        uint256 completedAt
    );
    
    event DisputeRaised(
        uint256 indexed disputeId,
        uint256 indexed offerId,
        address indexed initiator,
        string reason
    );
    
    event DisputeResolved(
        uint256 indexed disputeId,
        address indexed resolver,
        bool offerorWins,
        uint256 reward
    );
    
    event RewardDistributed(
        uint256 indexed offerId,
        address indexed recipient,
        uint256 amount,
        address token
    );
    
    event OfferCancelled(
        uint256 indexed offerId,
        address indexed cancelledBy,
        uint256 refundAmount
    );
    
    function setUp() public {
        owner = address(this);
        offeror = makeAddr("offeror");
        acceptor = makeAddr("acceptor");
        resolver = makeAddr("resolver");
        feeRecipient = makeAddr("feeRecipient");
        
        // Deploy reward token
        rewardToken = new MockERC20("Reward Token", "RWD", 18, 1000000 * 10**18);
        
        // Deploy market
        market = new TaskMarket(
            MIN_REWARD,
            PLATFORM_FEE,
            feeRecipient,
            owner
        );
        
        // Setup
        market.authorizeAcceptor(acceptor);
        market.addDisputeResolver(resolver);
        
        // Fund accounts
        vm.deal(offeror, 100 ether);
        rewardToken.transfer(offeror, 10000 * 10**18);
    }
    
    // ============ Constructor Tests ============
    
    function test_InitialState() public view {
        assertEq(market.minReward(), MIN_REWARD);
        assertEq(market.platformFeePercent(), PLATFORM_FEE);
        assertEq(market.feeRecipient(), feeRecipient);
        assertEq(market.owner(), owner);
        assertEq(market.offerCounter(), 0);
        assertTrue(market.authorizedAcceptors(owner));
        assertTrue(market.disputeResolvers(owner));
    }
    
    // ============ Offer Creation Tests ============
    
    function test_CreateOffer_ETH() public {
        uint256 reward = 1 ether;
        uint256 deadline = block.timestamp + 7 days;
        
        vm.prank(offeror);
        vm.expectEmit(true, true, true, true);
        emit OfferCreated(1, 0, offeror, reward, address(0), deadline);
        
        uint256 offerId = market.createOffer{value: reward}(
            0, // proposalId
            "Task description",
            deadline
        );
        
        assertEq(offerId, 1);
        assertEq(market.offerCounter(), 1);
        assertEq(market.escrows(offerId), reward);
        
        TaskMarket.Offer memory offer = market.getOffer(offerId);
        assertEq(offer.offeror, offeror);
        assertEq(offer.reward, reward);
        assertEq(offer.rewardToken, address(0));
        assertEq(uint256(offer.status), uint256(TaskMarket.OfferStatus.Pending));
    }
    
    function test_CreateOffer_Token() public {
        uint256 reward = 1000 * 10**18;
        uint256 deadline = block.timestamp + 7 days;
        
        vm.startPrank(offeror);
        rewardToken.approve(address(market), reward);
        
        uint256 offerId = market.createOfferWithToken(
            0,
            "Task description",
            deadline,
            reward,
            address(rewardToken)
        );
        vm.stopPrank();
        
        assertEq(offerId, 1);
        assertEq(market.escrows(offerId), reward);
        assertEq(rewardToken.balanceOf(address(market)), reward);
    }
    
    function test_CreateOffer_RevertWhen_InsufficientReward() public {
        uint256 reward = 0.001 ether; // Below MIN_REWARD
        uint256 deadline = block.timestamp + 7 days;
        
        vm.prank(offeror);
        vm.expectRevert(TaskMarket.InsufficientReward.selector);
        market.createOffer{value: reward}(0, "Task", deadline);
    }
    
    function test_CreateOffer_RevertWhen_InvalidDeadline() public {
        uint256 reward = 1 ether;
        uint256 deadline = block.timestamp - 1; // Past deadline
        
        vm.prank(offeror);
        vm.expectRevert(TaskMarket.InvalidDeadline.selector);
        market.createOffer{value: reward}(0, "Task", deadline);
    }
    
    function test_CreateOffer_RevertWhen_DeadlineTooFar() public {
        uint256 reward = 1 ether;
        uint256 deadline = block.timestamp + 100 days; // Beyond MAX_DEADLINE_DURATION
        
        vm.prank(offeror);
        vm.expectRevert(TaskMarket.InvalidDeadline.selector);
        market.createOffer{value: reward}(0, "Task", deadline);
    }
    
    // ============ Accept Offer Tests ============
    
    function _createOffer() internal returns (uint256) {
        uint256 reward = 1 ether;
        uint256 deadline = block.timestamp + 7 days;
        
        vm.prank(offeror);
        return market.createOffer{value: reward}(0, "Task", deadline);
    }
    
    function test_AcceptOffer() public {
        uint256 offerId = _createOffer();
        
        vm.prank(acceptor);
        vm.expectEmit(true, true, true, true);
        emit OfferAccepted(offerId, acceptor, block.timestamp);
        
        market.acceptOffer(offerId);
        
        TaskMarket.Offer memory offer = market.getOffer(offerId);
        assertEq(uint256(offer.status), uint256(TaskMarket.OfferStatus.Accepted));
        assertEq(offer.acceptor, acceptor);
        assertEq(offer.acceptedAt, block.timestamp);
    }
    
    function test_AcceptOffer_RevertWhen_NotPending() public {
        uint256 offerId = _createOffer();
        
        vm.prank(acceptor);
        market.acceptOffer(offerId);
        
        vm.prank(acceptor);
        vm.expectRevert(TaskMarket.NotPendingState.selector);
        market.acceptOffer(offerId);
    }
    
    function test_AcceptOffer_RevertWhen_DeadlinePassed() public {
        uint256 offerId = _createOffer();
        
        vm.warp(block.timestamp + 8 days);
        
        vm.prank(acceptor);
        vm.expectRevert(TaskMarket.DeadlinePassed.selector);
        market.acceptOffer(offerId);
    }
    
    function test_AcceptOffer_RevertWhen_Unauthorized() public {
        uint256 offerId = _createOffer();
        
        address unauthorized = makeAddr("unauthorized");
        
        vm.prank(unauthorized);
        vm.expectRevert(TaskMarket.Unauthorized.selector);
        market.acceptOffer(offerId);
    }
    
    // ============ Complete Task Tests ============
    
    function _createAndAcceptOffer() internal returns (uint256) {
        uint256 offerId = _createOffer();
        
        vm.prank(acceptor);
        market.acceptOffer(offerId);
        
        return offerId;
    }
    
    function test_CompleteTask() public {
        uint256 offerId = _createAndAcceptOffer();
        bytes32 proof = keccak256("Completion evidence");
        
        vm.prank(offeror);
        vm.expectEmit(true, false, false, true);
        emit TaskCompleted(offerId, proof, block.timestamp);
        
        market.completeTask(offerId, proof);
        
        TaskMarket.Offer memory offer = market.getOffer(offerId);
        assertEq(uint256(offer.status), uint256(TaskMarket.OfferStatus.Completed));
        assertEq(offer.completionProof, proof);
    }
    
    function test_CompleteTask_RevertWhen_NotAccepted() public {
        uint256 offerId = _createOffer();
        bytes32 proof = keccak256("Proof");
        
        vm.prank(offeror);
        vm.expectRevert(TaskMarket.NotAcceptedState.selector);
        market.completeTask(offerId, proof);
    }
    
    function test_CompleteTask_RevertWhen_NotOfferor() public {
        uint256 offerId = _createAndAcceptOffer();
        bytes32 proof = keccak256("Proof");
        
        vm.prank(acceptor);
        vm.expectRevert(TaskMarket.NotOfferor.selector);
        market.completeTask(offerId, proof);
    }
    
    function test_CompleteTask_RevertWhen_DeadlinePassed() public {
        uint256 offerId = _createAndAcceptOffer();
        bytes32 proof = keccak256("Proof");
        
        vm.warp(block.timestamp + 8 days);
        
        vm.prank(offeror);
        vm.expectRevert(TaskMarket.DeadlinePassed.selector);
        market.completeTask(offerId, proof);
    }
    
    // ============ Confirm and Release Tests ============
    
    function _createAcceptAndComplete() internal returns (uint256) {
        uint256 offerId = _createAndAcceptOffer();
        
        vm.prank(offeror);
        market.completeTask(offerId, keccak256("Proof"));
        
        return offerId;
    }
    
    function test_ConfirmAndRelease_ETH() public {
        uint256 offerId = _createAcceptAndComplete();
        uint256 reward = 1 ether;
        uint256 fee = (reward * PLATFORM_FEE) / 10000;
        uint256 netReward = reward - fee;
        
        uint256 initialBalance = offeror.balance;
        
        vm.prank(acceptor);
        vm.expectEmit(true, true, false, true);
        emit RewardDistributed(offerId, offeror, netReward, address(0));
        
        market.confirmAndRelease(offerId);
        
        assertEq(offeror.balance, initialBalance + netReward);
        assertEq(address(market).balance, 0);
        assertEq(feeRecipient.balance, fee);
        
        TaskMarket.Offer memory offer = market.getOffer(offerId);
        assertTrue(offer.executed);
    }
    
    function test_ConfirmAndRelease_Token() public {
        uint256 reward = 1000 * 10**18;
        uint256 deadline = block.timestamp + 7 days;
        
        vm.startPrank(offeror);
        rewardToken.approve(address(market), reward);
        uint256 offerId = market.createOfferWithToken(0, "Task", deadline, reward, address(rewardToken));
        vm.stopPrank();
        
        vm.prank(acceptor);
        market.acceptOffer(offerId);
        
        vm.prank(offeror);
        market.completeTask(offerId, keccak256("Proof"));
        
        uint256 fee = (reward * PLATFORM_FEE) / 10000;
        uint256 netReward = reward - fee;
        
        vm.prank(acceptor);
        market.confirmAndRelease(offerId);
        
        assertEq(rewardToken.balanceOf(offeror), 10000 * 10**18 - reward + netReward);
        assertEq(rewardToken.balanceOf(feeRecipient), fee);
    }
    
    function test_ConfirmAndRelease_RevertWhen_NotCompleted() public {
        uint256 offerId = _createAndAcceptOffer();
        
        vm.prank(acceptor);
        vm.expectRevert(TaskMarket.NotCompletedState.selector);
        market.confirmAndRelease(offerId);
    }
    
    // ============ Dispute Tests ============
    
    function test_RaiseDispute() public {
        uint256 offerId = _createAcceptAndComplete();
        
        vm.prank(acceptor);
        vm.expectEmit(true, true, true, true);
        emit DisputeRaised(1, offerId, acceptor, "Not satisfied");
        
        market.raiseDispute(offerId, "Not satisfied");
        
        TaskMarket.Offer memory offer = market.getOffer(offerId);
        assertEq(uint256(offer.status), uint256(TaskMarket.OfferStatus.Disputed));
        assertEq(offer.disputeId, 1);
        
        TaskMarket.Dispute memory dispute = market.getDispute(1);
        assertEq(dispute.offerId, offerId);
        assertEq(dispute.initiator, acceptor);
        assertEq(dispute.reason, "Not satisfied");
        assertFalse(dispute.resolved);
    }
    
    function test_RaiseDispute_ByOfferor() public {
        uint256 offerId = _createAndAcceptOffer();
        
        vm.prank(offeror);
        market.raiseDispute(offerId, "Acceptor not responding");
        
        TaskMarket.Offer memory offer = market.getOffer(offerId);
        assertEq(uint256(offer.status), uint256(TaskMarket.OfferStatus.Disputed));
    }
    
    function test_RaiseDispute_RevertWhen_AlreadyDisputed() public {
        uint256 offerId = _createAcceptAndComplete();
        
        vm.prank(acceptor);
        market.raiseDispute(offerId, "First dispute");
        
        vm.prank(offeror);
        vm.expectRevert(TaskMarket.AlreadyDisputed.selector);
        market.raiseDispute(offerId, "Second dispute");
    }
    
    function test_RaiseDispute_RevertWhen_Unauthorized() public {
        uint256 offerId = _createAcceptAndComplete();
        
        address unauthorized = makeAddr("unauthorized");
        
        vm.prank(unauthorized);
        vm.expectRevert(TaskMarket.Unauthorized.selector);
        market.raiseDispute(offerId, "Invalid dispute");
    }
    
    function test_ResolveDispute_OfferorWins() public {
        uint256 offerId = _createAcceptAndComplete();
        
        vm.prank(acceptor);
        market.raiseDispute(offerId, "Dispute");
        
        uint256 reward = 1 ether;
        uint256 fee = (reward * PLATFORM_FEE) / 10000;
        uint256 netReward = reward - fee;
        
        uint256 initialBalance = offeror.balance;
        
        vm.prank(resolver);
        vm.expectEmit(true, true, false, true);
        emit DisputeResolved(1, resolver, true, reward);
        
        market.resolveDispute(1, true);
        
        assertEq(offeror.balance, initialBalance + netReward);
        
        TaskMarket.Dispute memory dispute = market.getDispute(1);
        assertTrue(dispute.resolved);
        assertTrue(dispute.offerorWins);
    }
    
    function test_ResolveDispute_AcceptorWins() public {
        uint256 offerId = _createAcceptAndComplete();
        
        vm.prank(offeror);
        market.raiseDispute(offerId, "Dispute");
        
        uint256 reward = 1 ether;
        uint256 fee = (reward * PLATFORM_FEE) / 10000;
        uint256 netReward = reward - fee;
        
        uint256 initialBalance = acceptor.balance;
        
        vm.prank(resolver);
        market.resolveDispute(1, false);
        
        assertEq(acceptor.balance, initialBalance + netReward);
        
        TaskMarket.Dispute memory dispute = market.getDispute(1);
        assertTrue(dispute.resolved);
        assertFalse(dispute.offerorWins);
    }
    
    function test_ResolveDispute_RevertWhen_NotResolver() public {
        uint256 offerId = _createAcceptAndComplete();
        
        vm.prank(acceptor);
        market.raiseDispute(offerId, "Dispute");
        
        address unauthorized = makeAddr("unauthorized");
        
        vm.prank(unauthorized);
        vm.expectRevert(TaskMarket.Unauthorized.selector);
        market.resolveDispute(1, true);
    }
    
    function test_ResolveDispute_RevertWhen_AlreadyResolved() public {
        uint256 offerId = _createAcceptAndComplete();
        
        vm.prank(acceptor);
        market.raiseDispute(offerId, "Dispute");
        
        vm.prank(resolver);
        market.resolveDispute(1, true);
        
        vm.prank(resolver);
        vm.expectRevert(TaskMarket.DisputeAlreadyResolved.selector);
        market.resolveDispute(1, false);
    }
    
    // ============ Cancel Offer Tests ============
    
    function test_CancelOffer() public {
        uint256 offerId = _createOffer();
        uint256 reward = 1 ether;
        
        uint256 initialBalance = offeror.balance;
        
        vm.prank(offeror);
        vm.expectEmit(true, true, false, true);
        emit OfferCancelled(offerId, offeror, reward);
        
        market.cancelOffer(offerId);
        
        assertEq(offeror.balance, initialBalance + reward);
        
        TaskMarket.Offer memory offer = market.getOffer(offerId);
        assertEq(uint256(offer.status), uint256(TaskMarket.OfferStatus.Cancelled));
    }
    
    function test_CancelOffer_ByOwner() public {
        uint256 offerId = _createOffer();
        uint256 reward = 1 ether;
        
        uint256 initialBalance = offeror.balance;
        
        market.cancelOffer(offerId);
        
        assertEq(offeror.balance, initialBalance + reward);
    }
    
    function test_CancelOffer_RevertWhen_NotPending() public {
        uint256 offerId = _createAndAcceptOffer();
        
        vm.prank(offeror);
        vm.expectRevert(TaskMarket.NotPendingState.selector);
        market.cancelOffer(offerId);
    }
    
    function test_CancelOffer_RevertWhen_NotOfferor() public {
        uint256 offerId = _createOffer();
        
        vm.prank(acceptor);
        vm.expectRevert(TaskMarket.NotOfferor.selector);
        market.cancelOffer(offerId);
    }
    
    // ============ Expire Offer Tests ============
    
    function test_ExpireOffer() public {
        uint256 offerId = _createOffer();
        uint256 reward = 1 ether;
        
        uint256 initialBalance = offeror.balance;
        
        vm.warp(block.timestamp + 8 days);
        
        market.expireOffer(offerId);
        
        assertEq(offeror.balance, initialBalance + reward);
        
        TaskMarket.Offer memory offer = market.getOffer(offerId);
        assertEq(uint256(offer.status), uint256(TaskMarket.OfferStatus.Expired));
    }
    
    function test_ExpireOffer_RevertWhen_NotPending() public {
        uint256 offerId = _createAndAcceptOffer();
        
        vm.warp(block.timestamp + 8 days);
        
        vm.expectRevert(TaskMarket.NotPendingState.selector);
        market.expireOffer(offerId);
    }
    
    function test_ExpireOffer_RevertWhen_DeadlineNotPassed() public {
        uint256 offerId = _createOffer();
        
        vm.expectRevert(TaskMarket.DeadlineNotPassed.selector);
        market.expireOffer(offerId);
    }
    
    // ============ Admin Functions Tests ============
    
    function test_AuthorizeAcceptor() public {
        address newAcceptor = makeAddr("newAcceptor");
        market.authorizeAcceptor(newAcceptor);
        assertTrue(market.authorizedAcceptors(newAcceptor));
    }
    
    function test_RevokeAcceptor() public {
        market.revokeAcceptor(acceptor);
        assertFalse(market.authorizedAcceptors(acceptor));
    }
    
    function test_AddDisputeResolver() public {
        address newResolver = makeAddr("newResolver");
        market.addDisputeResolver(newResolver);
        assertTrue(market.disputeResolvers(newResolver));
    }
    
    function test_RemoveDisputeResolver() public {
        market.removeDisputeResolver(resolver);
        assertFalse(market.disputeResolvers(resolver));
    }
    
    function test_UpdatePlatformFee() public {
        address newFeeRecipient = makeAddr("newFeeRecipient");
        market.updatePlatformFee(500, newFeeRecipient); // 5%
        
        assertEq(market.platformFeePercent(), 500);
        assertEq(market.feeRecipient(), newFeeRecipient);
    }
    
    function test_UpdatePlatformFee_RevertWhen_TooHigh() public {
        vm.expectRevert("Fee too high");
        market.updatePlatformFee(1500, feeRecipient); // 15%
    }
    
    function test_UpdateMinReward() public {
        market.updateMinReward(0.1 ether);
        assertEq(market.minReward(), 0.1 ether);
    }
    
    // ============ Query Functions Tests ============
    
    function test_GetUserStats() public {
        uint256 offerId = _createOffer();
        
        TaskMarket.UserStats memory stats = market.getUserStats(offeror);
        assertEq(stats.offersCreated, 1);
        
        vm.prank(acceptor);
        market.acceptOffer(offerId);
        
        stats = market.getUserStats(acceptor);
        assertEq(stats.offersAccepted, 1);
    }
    
    function test_GetActiveOffers() public {
        _createOffer();
        _createOffer();
        
        uint256[] memory active = market.getActiveOffers();
        assertEq(active.length, 2);
    }
    
    function test_GetOffersByStatus() public {
        uint256 offerId = _createAndAcceptOffer();
        _createOffer();
        
        uint256[] memory accepted = market.getOffersByStatus(TaskMarket.OfferStatus.Accepted);
        assertEq(accepted.length, 1);
        assertEq(accepted[0], offerId);
    }
    
    function test_GetTotalOffers() public {
        _createOffer();
        _createOffer();
        _createOffer();
        
        assertEq(market.getTotalOffers(), 3);
    }
    
    function test_GetTotalDisputes() public {
        uint256 offerId = _createAcceptAndComplete();
        
        vm.prank(acceptor);
        market.raiseDispute(offerId, "Dispute");
        
        assertEq(market.getTotalDisputes(), 1);
    }
    
    // ============ Reputation Tests ============
    
    function test_ReputationUpdate() public {
        uint256 offerId = _createAcceptAndComplete();
        
        vm.prank(acceptor);
        market.confirmAndRelease(offerId);
        
        TaskMarket.UserStats memory stats = market.getUserStats(offeror);
        assertEq(stats.reputation, 100);
        assertEq(stats.tasksCompleted, 1);
    }
    
    // ============ Receive ETH Test ============
    
    function test_ReceiveETH() public {
        (bool success, ) = address(market).call{value: 1 ether}("");
        assertTrue(success);
        assertEq(address(market).balance, 1 ether);
    }
}
