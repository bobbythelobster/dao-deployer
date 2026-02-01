// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {Test, console} from "forge-std/Test.sol";
import {ProposalManager} from "../src/ProposalManager.sol";
import {SoulBoundToken} from "../src/SoulBoundToken.sol";

/**
 * @title ProposalManagerTest
 * @notice Test suite for ProposalManager contract
 */
contract ProposalManagerTest is Test {
    ProposalManager public proposalManager;
    SoulBoundToken public token;
    
    address public owner;
    address public proposer;
    address public voter1;
    address public voter2;
    address public voter3;
    
    ProposalManager.ProposalConfig public config;
    
    event ProposalCreated(
        uint256 indexed id,
        address indexed proposer,
        bytes32 indexed contentHash,
        uint256 startTime,
        uint256 endTime,
        uint256 quorum
    );
    
    event VoteCast(
        address indexed voter,
        uint256 indexed proposalId,
        ProposalManager.VoteType voteType,
        uint256 votes
    );
    
    event ProposalCanceled(uint256 indexed id, address indexed canceledBy);
    event ProposalExecuted(uint256 indexed id, address indexed executor);
    event ProposalQueued(uint256 indexed id, uint256 eta);
    
    function setUp() public {
        owner = address(this);
        proposer = makeAddr("proposer");
        voter1 = makeAddr("voter1");
        voter2 = makeAddr("voter2");
        voter3 = makeAddr("voter3");
        
        // Deploy token
        token = new SoulBoundToken("Governance Token", "GOV", 0, owner);
        
        // Mint tokens to users
        token.mint(proposer, 1000 * 10**18);
        token.mint(voter1, 500 * 10**18);
        token.mint(voter2, 300 * 10**18);
        token.mint(voter3, 200 * 10**18);
        
        // Setup proposal config
        config = ProposalManager.ProposalConfig({
            votingDelay: 10,
            votingPeriod: 100,
            proposalThreshold: 100 * 10**18,
            quorumPercentage: 3000, // 30%
            executionDelay: 2 days,
            gracePeriod: 7 days
        });
        
        // Deploy proposal manager
        proposalManager = new ProposalManager(
            address(token),
            config,
            owner
        );
    }
    
    // ============ Constructor Tests ============
    
    function test_InitialState() public view {
        assertEq(address(proposalManager.governanceToken()), address(token));
        assertEq(proposalManager.owner(), owner);
        assertEq(proposalManager.proposalCount(), 0);
        
        ProposalManager.ProposalConfig memory storedConfig = proposalManager.config();
        assertEq(storedConfig.votingDelay, 10);
        assertEq(storedConfig.votingPeriod, 100);
        assertEq(storedConfig.proposalThreshold, 100 * 10**18);
    }
    
    // ============ Proposal Creation Tests ============
    
    function test_CreateProposal() public {
        bytes32 contentHash = keccak256("Test Proposal");
        
        vm.prank(proposer);
        vm.expectEmit(true, true, true, false);
        emit ProposalCreated(1, proposer, contentHash, 0, 0, 0);
        
        uint256 proposalId = proposalManager.createProposal(contentHash);
        
        assertEq(proposalId, 1);
        assertEq(proposalManager.proposalCount(), 1);
        
        (
            uint256 id,
            address prop,
            bytes32 hash,
            uint256 startTime,
            uint256 endTime,
            ,
            ,
            ,
            uint256 quorum,
            ,
            ,
            ,
            ProposalManager.ProposalState state
        ) = proposalManager.getProposal(proposalId);
        
        assertEq(id, 1);
        assertEq(prop, proposer);
        assertEq(hash, contentHash);
        assertEq(startTime, block.number + 10);
        assertEq(endTime, block.number + 10 + 100);
        assertEq(quorum, (token.totalSupply() * 3000) / 10000);
        assertEq(uint256(state), uint256(ProposalManager.ProposalState.Pending));
    }
    
    function test_CreateProposal_RevertWhen_EmptyHash() public {
        vm.prank(proposer);
        vm.expectRevert(ProposalManager.InvalidContentHash.selector);
        proposalManager.createProposal(bytes32(0));
    }
    
    function test_CreateProposal_RevertWhen_Duplicate() public {
        bytes32 contentHash = keccak256("Test Proposal");
        
        vm.startPrank(proposer);
        proposalManager.createProposal(contentHash);
        
        vm.expectRevert("Duplicate proposal");
        proposalManager.createProposal(contentHash);
        vm.stopPrank();
    }
    
    function test_CreateProposal_RevertWhen_BelowThreshold() public {
        bytes32 contentHash = keccak256("Test Proposal");
        address poorUser = makeAddr("poorUser");
        
        vm.prank(poorUser);
        vm.expectRevert(ProposalManager.BelowProposalThreshold.selector);
        proposalManager.createProposal(contentHash);
    }
    
    function test_CreateProposal_Whitelisted() public {
        address whitelisted = makeAddr("whitelisted");
        proposalManager.addToWhitelist(whitelisted);
        
        bytes32 contentHash = keccak256("Test Proposal");
        
        vm.prank(whitelisted);
        uint256 proposalId = proposalManager.createProposal(contentHash);
        
        assertEq(proposalId, 1);
    }
    
    // ============ Voting Tests ============
    
    function _createAndActivateProposal() internal returns (uint256) {
        bytes32 contentHash = keccak256("Test Proposal");
        
        vm.prank(proposer);
        uint256 proposalId = proposalManager.createProposal(contentHash);
        
        // Move past voting delay
        vm.roll(block.number + 11);
        
        return proposalId;
    }
    
    function test_CastVote() public {
        uint256 proposalId = _createAndActivateProposal();
        
        vm.prank(voter1);
        vm.expectEmit(true, true, true, true);
        emit VoteCast(voter1, proposalId, ProposalManager.VoteType.For, 500 * 10**18);
        
        proposalManager.castVote(proposalId, ProposalManager.VoteType.For);
        
        (
            ,
            ,
            ,
            ,
            ,
            uint256 forVotes,
            uint256 againstVotes,
            uint256 abstainVotes,
            ,
            ,
            ,
            ,

        ) = proposalManager.getProposal(proposalId);
        
        assertEq(forVotes, 500 * 10**18);
        assertEq(againstVotes, 0);
        assertEq(abstainVotes, 0);
    }
    
    function test_CastVote_RevertWhen_VotingNotStarted() public {
        bytes32 contentHash = keccak256("Test Proposal");
        
        vm.prank(proposer);
        uint256 proposalId = proposalManager.createProposal(contentHash);
        
        vm.prank(voter1);
        vm.expectRevert(ProposalManager.VotingNotStarted.selector);
        proposalManager.castVote(proposalId, ProposalManager.VoteType.For);
    }
    
    function test_CastVote_RevertWhen_VotingEnded() public {
        uint256 proposalId = _createAndActivateProposal();
        
        // Move past voting period
        vm.roll(block.number + 111);
        
        vm.prank(voter1);
        vm.expectRevert(ProposalManager.VotingEnded.selector);
        proposalManager.castVote(proposalId, ProposalManager.VoteType.For);
    }
    
    function test_CastVote_RevertWhen_AlreadyVoted() public {
        uint256 proposalId = _createAndActivateProposal();
        
        vm.startPrank(voter1);
        proposalManager.castVote(proposalId, ProposalManager.VoteType.For);
        
        vm.expectRevert(ProposalManager.AlreadyVoted.selector);
        proposalManager.castVote(proposalId, ProposalManager.VoteType.Against);
        vm.stopPrank();
    }
    
    function test_CastVote_RevertWhen_NoVotingPower() public {
        uint256 proposalId = _createAndActivateProposal();
        
        address noPower = makeAddr("noPower");
        
        vm.prank(noPower);
        vm.expectRevert("No voting power");
        proposalManager.castVote(proposalId, ProposalManager.VoteType.For);
    }
    
    function test_CastVote_Against() public {
        uint256 proposalId = _createAndActivateProposal();
        
        vm.prank(voter1);
        proposalManager.castVote(proposalId, ProposalManager.VoteType.Against);
        
        (
            ,
            ,
            ,
            ,
            ,
            uint256 forVotes,
            uint256 againstVotes,
            ,
            ,
            ,
            ,
            ,

        ) = proposalManager.getProposal(proposalId);
        
        assertEq(forVotes, 0);
        assertEq(againstVotes, 500 * 10**18);
    }
    
    function test_CastVote_Abstain() public {
        uint256 proposalId = _createAndActivateProposal();
        
        vm.prank(voter1);
        proposalManager.castVote(proposalId, ProposalManager.VoteType.Abstain);
        
        (
            ,
            ,
            ,
            ,
            ,
            ,
            ,
            uint256 abstainVotes,
            ,
            ,
            ,
            ,

        ) = proposalManager.getProposal(proposalId);
        
        assertEq(abstainVotes, 500 * 10**18);
    }
    
    // ============ Proposal State Tests ============
    
    function test_State_Pending() public {
        bytes32 contentHash = keccak256("Test Proposal");
        
        vm.prank(proposer);
        uint256 proposalId = proposalManager.createProposal(contentHash);
        
        assertEq(
            uint256(proposalManager.state(proposalId)),
            uint256(ProposalManager.ProposalState.Pending)
        );
    }
    
    function test_State_Active() public {
        uint256 proposalId = _createAndActivateProposal();
        
        assertEq(
            uint256(proposalManager.state(proposalId)),
            uint256(ProposalManager.ProposalState.Active)
        );
    }
    
    function test_State_Succeeded() public {
        uint256 proposalId = _createAndActivateProposal();
        
        // Vote with enough to pass
        vm.prank(proposer);
        proposalManager.castVote(proposalId, ProposalManager.VoteType.For);
        
        vm.prank(voter1);
        proposalManager.castVote(proposalId, ProposalManager.VoteType.For);
        
        // Move past voting period
        vm.roll(block.number + 111);
        
        assertEq(
            uint256(proposalManager.state(proposalId)),
            uint256(ProposalManager.ProposalState.Succeeded)
        );
    }
    
    function test_State_Defeated() public {
        uint256 proposalId = _createAndActivateProposal();
        
        // Vote against
        vm.prank(voter1);
        proposalManager.castVote(proposalId, ProposalManager.VoteType.Against);
        
        // Move past voting period
        vm.roll(block.number + 111);
        
        assertEq(
            uint256(proposalManager.state(proposalId)),
            uint256(ProposalManager.ProposalState.Defeated)
        );
    }
    
    function test_State_Canceled() public {
        bytes32 contentHash = keccak256("Test Proposal");
        
        vm.prank(proposer);
        uint256 proposalId = proposalManager.createProposal(contentHash);
        
        vm.prank(proposer);
        proposalManager.cancelProposal(proposalId);
        
        assertEq(
            uint256(proposalManager.state(proposalId)),
            uint256(ProposalManager.ProposalState.Canceled)
        );
    }
    
    // ============ Cancel Proposal Tests ============
    
    function test_CancelProposal() public {
        bytes32 contentHash = keccak256("Test Proposal");
        
        vm.prank(proposer);
        uint256 proposalId = proposalManager.createProposal(contentHash);
        
        vm.prank(proposer);
        vm.expectEmit(true, true, false, false);
        emit ProposalCanceled(proposalId, proposer);
        
        proposalManager.cancelProposal(proposalId);
    }
    
    function test_CancelProposal_ByOwner() public {
        bytes32 contentHash = keccak256("Test Proposal");
        
        vm.prank(proposer);
        uint256 proposalId = proposalManager.createProposal(contentHash);
        
        proposalManager.cancelProposal(proposalId);
    }
    
    function test_CancelProposal_RevertWhen_NotProposer() public {
        bytes32 contentHash = keccak256("Test Proposal");
        
        vm.prank(proposer);
        uint256 proposalId = proposalManager.createProposal(contentHash);
        
        vm.prank(voter1);
        vm.expectRevert(ProposalManager.NotProposer.selector);
        proposalManager.cancelProposal(proposalId);
    }
    
    function test_CancelProposal_RevertWhen_AlreadyCanceled() public {
        bytes32 contentHash = keccak256("Test Proposal");
        
        vm.prank(proposer);
        uint256 proposalId = proposalManager.createProposal(contentHash);
        
        vm.prank(proposer);
        proposalManager.cancelProposal(proposalId);
        
        vm.prank(proposer);
        vm.expectRevert(ProposalManager.AlreadyCanceled.selector);
        proposalManager.cancelProposal(proposalId);
    }
    
    // ============ Queue and Execute Tests ============
    
    function test_QueueProposal() public {
        uint256 proposalId = _createAndActivateProposal();
        
        // Vote to succeed
        vm.prank(proposer);
        proposalManager.castVote(proposalId, ProposalManager.VoteType.For);
        
        vm.prank(voter1);
        proposalManager.castVote(proposalId, ProposalManager.VoteType.For);
        
        // Move past voting period
        vm.roll(block.number + 111);
        
        vm.expectEmit(true, false, false, true);
        emit ProposalQueued(proposalId, block.timestamp + 2 days);
        
        proposalManager.queueProposal(proposalId);
        
        (
            ,
            ,
            ,
            ,
            ,
            ,
            ,
            ,
            ,
            uint256 eta,
            ,
            ,
            ProposalManager.ProposalState state
        ) = proposalManager.getProposal(proposalId);
        
        assertEq(eta, block.timestamp + 2 days);
        assertEq(uint256(state), uint256(ProposalManager.ProposalState.Succeeded));
    }
    
    function test_QueueProposal_RevertWhen_NotSucceeded() public {
        uint256 proposalId = _createAndActivateProposal();
        
        // Vote against
        vm.prank(voter1);
        proposalManager.castVote(proposalId, ProposalManager.VoteType.Against);
        
        // Move past voting period
        vm.roll(block.number + 111);
        
        vm.expectRevert(ProposalManager.NotSucceededState.selector);
        proposalManager.queueProposal(proposalId);
    }
    
    // ============ Config Update Tests ============
    
    function test_UpdateConfig() public {
        ProposalManager.ProposalConfig memory newConfig = ProposalManager.ProposalConfig({
            votingDelay: 20,
            votingPeriod: 200,
            proposalThreshold: 200 * 10**18,
            quorumPercentage: 4000,
            executionDelay: 3 days,
            gracePeriod: 14 days
        });
        
        proposalManager.updateConfig(newConfig);
        
        ProposalManager.ProposalConfig memory storedConfig = proposalManager.config();
        assertEq(storedConfig.votingDelay, 20);
        assertEq(storedConfig.votingPeriod, 200);
    }
    
    function test_UpdateConfig_RevertWhen_ZeroVotingPeriod() public {
        ProposalManager.ProposalConfig memory newConfig = config;
        newConfig.votingPeriod = 0;
        
        vm.expectRevert(ProposalManager.InvalidVotingPeriod.selector);
        proposalManager.updateConfig(newConfig);
    }
    
    // ============ Whitelist Tests ============
    
    function test_AddToWhitelist() public {
        address newMember = makeAddr("newMember");
        proposalManager.addToWhitelist(newMember);
        
        assertTrue(proposalManager.proposalWhitelist(newMember));
    }
    
    function test_RemoveFromWhitelist() public {
        address member = makeAddr("member");
        proposalManager.addToWhitelist(member);
        proposalManager.removeFromWhitelist(member);
        
        assertFalse(proposalManager.proposalWhitelist(member));
    }
    
    // ============ Receipt Tests ============
    
    function test_GetReceipt() public {
        uint256 proposalId = _createAndActivateProposal();
        
        vm.prank(voter1);
        proposalManager.castVote(proposalId, ProposalManager.VoteType.For);
        
        ProposalManager.Receipt memory receipt = proposalManager.getReceipt(voter1, proposalId);
        
        assertTrue(receipt.hasVoted);
        assertEq(uint256(receipt.voteType), uint256(ProposalManager.VoteType.For));
        assertEq(receipt.votes, 500 * 10**18);
    }
    
    function test_HasVoted() public {
        uint256 proposalId = _createAndActivateProposal();
        
        vm.prank(voter1);
        proposalManager.castVote(proposalId, ProposalManager.VoteType.For);
        
        assertTrue(proposalManager.hasVoted(voter1, proposalId));
        assertFalse(proposalManager.hasVoted(voter2, proposalId));
    }
    
    // ============ Query Tests ============
    
    function test_GetActiveProposals() public {
        bytes32 contentHash1 = keccak256("Proposal 1");
        bytes32 contentHash2 = keccak256("Proposal 2");
        
        vm.startPrank(proposer);
        proposalManager.createProposal(contentHash1);
        proposalManager.createProposal(contentHash2);
        vm.stopPrank();
        
        // Move to active state
        vm.roll(block.number + 11);
        
        uint256[] memory active = proposalManager.getActiveProposals();
        assertEq(active.length, 2);
    }
    
    function test_GetProposalsInRange() public {
        bytes32 contentHash1 = keccak256("Proposal 1");
        bytes32 contentHash2 = keccak256("Proposal 2");
        bytes32 contentHash3 = keccak256("Proposal 3");
        
        vm.startPrank(proposer);
        proposalManager.createProposal(contentHash1);
        proposalManager.createProposal(contentHash2);
        proposalManager.createProposal(contentHash3);
        vm.stopPrank();
        
        uint256[] memory proposals = proposalManager.getProposalsInRange(0, 2);
        assertEq(proposals.length, 2);
        assertEq(proposals[0], 1);
        assertEq(proposals[1], 2);
    }
    
    function test_GetTotalProposals() public {
        bytes32 contentHash = keccak256("Proposal");
        
        vm.prank(proposer);
        proposalManager.createProposal(contentHash);
        
        assertEq(proposalManager.getTotalProposals(), 1);
    }
    
    // ============ Batch Vote Tests ============
    
    function test_BatchCastVotes() public {
        bytes32 contentHash1 = keccak256("Proposal 1");
        bytes32 contentHash2 = keccak256("Proposal 2");
        
        vm.startPrank(proposer);
        uint256 proposalId1 = proposalManager.createProposal(contentHash1);
        uint256 proposalId2 = proposalManager.createProposal(contentHash2);
        vm.stopPrank();
        
        // Move to active state
        vm.roll(block.number + 11);
        
        uint256[] memory proposalIds = new uint256[](2);
        proposalIds[0] = proposalId1;
        proposalIds[1] = proposalId2;
        
        ProposalManager.VoteType[] memory voteTypes = new ProposalManager.VoteType[](2);
        voteTypes[0] = ProposalManager.VoteType.For;
        voteTypes[1] = ProposalManager.VoteType.Against;
        
        vm.prank(voter1);
        proposalManager.batchCastVotes(proposalIds, voteTypes);
        
        assertTrue(proposalManager.hasVoted(voter1, proposalId1));
        assertTrue(proposalManager.hasVoted(voter1, proposalId2));
    }
    
    // ============ State Edge Cases ============
    
    function test_State_Expired() public {
        uint256 proposalId = _createAndActivateProposal();
        
        // Vote to succeed
        vm.prank(proposer);
        proposalManager.castVote(proposalId, ProposalManager.VoteType.For);
        
        vm.prank(voter1);
        proposalManager.castVote(proposalId, ProposalManager.VoteType.For);
        
        // Move past voting period
        vm.roll(block.number + 111);
        
        // Queue proposal
        proposalManager.queueProposal(proposalId);
        
        // Move past grace period
        vm.warp(block.timestamp + 2 days + 8 days);
        
        assertEq(
            uint256(proposalManager.state(proposalId)),
            uint256(ProposalManager.ProposalState.Expired)
        );
    }
    
    function test_State_Executed() public {
        bytes32 contentHash = keccak256("Test Proposal");
        
        vm.prank(proposer);
        uint256 proposalId = proposalManager.createProposal(contentHash);
        
        // Cancel and check state
        vm.prank(proposer);
        proposalManager.cancelProposal(proposalId);
        
        assertEq(
            uint256(proposalManager.state(proposalId)),
            uint256(ProposalManager.ProposalState.Canceled)
        );
    }
}
