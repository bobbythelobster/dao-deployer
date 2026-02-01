// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import {SoulBoundToken} from "./SoulBoundToken.sol";

/**
 * @title ProposalManager
 * @author DAO Deployer
 * @notice Manages the full lifecycle of DAO proposals with off-chain content storage
 * @dev This contract handles proposal creation, voting, and lifecycle management.
 *      Proposal content (title, description, etc.) is stored off-chain with only
 *      the content hash stored on-chain for gas efficiency and verification.
 */
contract ProposalManager is Ownable, ReentrancyGuard {
    
    /// @notice Enum representing proposal states
    enum ProposalState {
        Pending,        // 0: Created but voting not started
        Active,         // 1: Voting is active
        Canceled,       // 2: Canceled by proposer
        Defeated,       // 3: Voting ended, didn't pass
        Succeeded,      // 4: Voting ended, passed
        Queued,         // 5: Passed and queued for execution
        Executed,       // 6: Successfully executed
        Expired         // 7: Queued but expired before execution
    }
    
    /// @notice Structure for proposal data
    struct Proposal {
        uint256 id;
        address proposer;
        bytes32 contentHash;           // IPFS hash or similar for off-chain content
        uint256 startTime;
        uint256 endTime;
        uint256 forVotes;
        uint256 againstVotes;
        uint256 abstainVotes;
        uint256 quorum;
        uint256 eta;                   // Estimated time of arrival for execution
        bool executed;
        bool canceled;
        mapping(address => bool) hasVoted;
        mapping(address => VoteType) voteType;
    }
    
    /// @notice Structure for proposal configuration
    struct ProposalConfig {
        uint256 votingDelay;           // Blocks before voting starts
        uint256 votingPeriod;          // Blocks voting is active
        uint256 proposalThreshold;     // Minimum votes to create proposal
        uint256 quorumPercentage;      // Percentage of total supply needed (basis points)
        uint256 executionDelay;        // Delay before execution after success
        uint256 gracePeriod;           // Time to execute after success
    }
    
    /// @notice Enum for vote types
    enum VoteType {
        Against,    // 0
        For,        // 1
        Abstain     // 2
    }
    
    /// @notice Structure for vote receipt
    struct Receipt {
        bool hasVoted;
        VoteType voteType;
        uint256 votes;
    }
    
    /// @notice Error thrown when proposal doesn't exist
    error ProposalNotFound();
    
    /// @notice Error thrown when voting period hasn't started
    error VotingNotStarted();
    
    /// @notice Error thrown when voting period has ended
    error VotingEnded();
    
    /// @notice Error thrown when proposal threshold not met
    error BelowProposalThreshold();
    
    /// @notice Error thrown when already voted
    error AlreadyVoted();
    
    /// @notice Error thrown when not in active state
    error NotActiveState();
    
    /// @notice Error thrown when not in succeeded state
    error NotSucceededState();
    
    /// @notice Error thrown when not proposer
    error NotProposer();
    
    /// @notice Error thrown when proposal already executed
    error AlreadyExecuted();
    
    /// @notice Error thrown when proposal already canceled
    error AlreadyCanceled();
    
    /// @notice Error thrown when invalid content hash
    error InvalidContentHash();
    
    /// @notice Error thrown when execution failed
    error ExecutionFailed();
    
    /// @notice Error thrown when grace period expired
    error GracePeriodExpired();
    
    /// @notice Error thrown when execution delay not met
    error ExecutionDelayNotMet();
    
    /// @notice Error thrown when invalid voting period
    error InvalidVotingPeriod();
    
    /// @notice Emitted when a new proposal is created
    /// @param id Proposal ID
    /// @param proposer Address that created the proposal
    /// @param contentHash Hash of off-chain content
    /// @param startTime When voting starts
    /// @param endTime When voting ends
    /// @param quorum Required quorum for the proposal
    event ProposalCreated(
        uint256 indexed id,
        address indexed proposer,
        bytes32 indexed contentHash,
        uint256 startTime,
        uint256 endTime,
        uint256 quorum
    );
    
    /// @notice Emitted when a vote is cast
    /// @param voter Address that voted
    /// @param proposalId Proposal being voted on
    /// @param voteType Type of vote (For/Against/Abstain)
    /// @param votes Amount of voting power used
    event VoteCast(
        address indexed voter,
        uint256 indexed proposalId,
        VoteType voteType,
        uint256 votes
    );
    
    /// @notice Emitted when a proposal is canceled
    /// @param id Proposal ID
    /// @param canceledBy Address that canceled
    event ProposalCanceled(
        uint256 indexed id,
        address indexed canceledBy
    );
    
    /// @notice Emitted when a proposal is executed
    /// @param id Proposal ID
    /// @param executor Address that executed
    event ProposalExecuted(
        uint256 indexed id,
        address indexed executor
    );
    
    /// @notice Emitted when a proposal is queued
    /// @param id Proposal ID
    /// @param eta Estimated time of execution
    event ProposalQueued(
        uint256 indexed id,
        uint256 eta
    );
    
    /// @notice Emitted when proposal configuration is updated
    /// @param oldConfig Previous configuration
    /// @param newConfig New configuration
    event ProposalConfigUpdated(
        ProposalConfig oldConfig,
        ProposalConfig newConfig
    );
    
    /// @notice Emitted when proposal state changes
    /// @param proposalId Proposal ID
    /// @param previousState Previous state
    /// @param newState New state
    event ProposalStateChanged(
        uint256 indexed proposalId,
        ProposalState previousState,
        ProposalState newState
    );
    
    /// @notice The governance token contract
    SoulBoundToken public governanceToken;
    
    /// @notice Proposal configuration
    ProposalConfig public config;
    
    /// @notice Counter for proposal IDs
    uint256 public proposalCount;
    
    /// @notice Mapping of proposal ID to proposal data
    mapping(uint256 => Proposal) public proposals;
    
    /// @notice Mapping of voter address to proposal ID to receipt
    mapping(address => mapping(uint256 => Receipt)) public receipts;
    
    /// @notice Mapping of content hash to proposal ID (prevents duplicate proposals)
    mapping(bytes32 => uint256) public contentHashToProposal;
    
    /// @notice Array of all proposal IDs
    uint256[] public allProposalIds;
    
    /// @notice Whitelist of addresses that can create proposals without threshold
    mapping(address => bool) public proposalWhitelist;
    
    /// @notice Modifier to check if proposal exists
    modifier proposalExists(uint256 proposalId) {
        if (proposalId == 0 || proposalId > proposalCount) revert ProposalNotFound();
        _;
    }
    
    /**
     * @notice Constructor to initialize the proposal manager
     * @param _governanceToken Address of the governance token
     * @param _config Initial proposal configuration
     * @param initialOwner Address of the initial owner
     */
    constructor(
        address _governanceToken,
        ProposalConfig memory _config,
        address initialOwner
    ) Ownable(initialOwner) {
        governanceToken = SoulBoundToken(_governanceToken);
        config = _config;
        
        // Validate config
        if (_config.votingPeriod == 0) revert InvalidVotingPeriod();
    }
    
    /**
     * @notice Create a new proposal
     * @param contentHash Hash of the off-chain proposal content (IPFS, etc.)
     * @return proposalId The ID of the created proposal
     */
    function createProposal(
        bytes32 contentHash
    ) external returns (uint256 proposalId) {
        if (contentHash == bytes32(0)) revert InvalidContentHash();
        if (contentHashToProposal[contentHash] != 0) revert("Duplicate proposal");
        
        // Check proposal threshold
        uint256 proposerVotes = governanceToken.getVotingPower(msg.sender);
        if (!proposalWhitelist[msg.sender] && proposerVotes < config.proposalThreshold) {
            revert BelowProposalThreshold();
        }
        
        proposalCount++;
        proposalId = proposalCount;
        
        Proposal storage newProposal = proposals[proposalId];
        newProposal.id = proposalId;
        newProposal.proposer = msg.sender;
        newProposal.contentHash = contentHash;
        newProposal.startTime = block.number + config.votingDelay;
        newProposal.endTime = block.number + config.votingDelay + config.votingPeriod;
        
        // Calculate quorum based on total supply at proposal creation
        uint256 totalSupply = governanceToken.totalSupply();
        newProposal.quorum = (totalSupply * config.quorumPercentage) / 10000;
        
        contentHashToProposal[contentHash] = proposalId;
        allProposalIds.push(proposalId);
        
        emit ProposalCreated(
            proposalId,
            msg.sender,
            contentHash,
            newProposal.startTime,
            newProposal.endTime,
            newProposal.quorum
        );
        
        return proposalId;
    }
    
    /**
     * @notice Cast a vote on a proposal
     * @param proposalId The ID of the proposal
     * @param voteType The type of vote (For/Against/Abstain)
     */
    function castVote(
        uint256 proposalId,
        VoteType voteType
    ) external proposalExists(proposalId) {
        Proposal storage proposal = proposals[proposalId];
        
        // Check voting period
        if (block.number < proposal.startTime) revert VotingNotStarted();
        if (block.number > proposal.endTime) revert VotingEnded();
        
        // Check if already voted
        if (proposal.hasVoted[msg.sender]) revert AlreadyVoted();
        
        // Get voting power
        uint256 votes = governanceToken.getVotingPower(msg.sender);
        if (votes == 0) revert("No voting power");
        
        // Record vote
        proposal.hasVoted[msg.sender] = true;
        proposal.voteType[msg.sender] = voteType;
        
        // Update vote counts
        if (voteType == VoteType.For) {
            proposal.forVotes += votes;
        } else if (voteType == VoteType.Against) {
            proposal.againstVotes += votes;
        } else {
            proposal.abstainVotes += votes;
        }
        
        // Store receipt
        receipts[msg.sender][proposalId] = Receipt({
            hasVoted: true,
            voteType: voteType,
            votes: votes
        });
        
        emit VoteCast(msg.sender, proposalId, voteType, votes);
    }
    
    /**
     * @notice Cast a vote with a reason (for off-chain tracking)
     * @param proposalId The ID of the proposal
     * @param voteType The type of vote
     * @param reason The reason for the vote (not stored on-chain)
     */
    function castVoteWithReason(
        uint256 proposalId,
        VoteType voteType,
        string calldata reason
    ) external {
        castVote(proposalId, voteType);
        // Reason is emitted in event for off-chain indexing
        emit VoteCastWithReason(msg.sender, proposalId, reason);
    }
    
    /// @notice Event for vote with reason
    event VoteCastWithReason(
        address indexed voter,
        uint256 indexed proposalId,
        string reason
    );
    
    /**
     * @notice Cancel a proposal (only proposer can cancel, and only if not executed)
     * @param proposalId The ID of the proposal to cancel
     */
    function cancelProposal(
        uint256 proposalId
    ) external proposalExists(proposalId) {
        Proposal storage proposal = proposals[proposalId];
        
        if (msg.sender != proposal.proposer && msg.sender != owner()) {
            revert NotProposer();
        }
        if (proposal.executed) revert AlreadyExecuted();
        if (proposal.canceled) revert AlreadyCanceled();
        
        proposal.canceled = true;
        
        emit ProposalCanceled(proposalId, msg.sender);
        
        ProposalState oldState = state(proposalId);
        emit ProposalStateChanged(proposalId, oldState, ProposalState.Canceled);
    }
    
    /**
     * @notice Queue a successful proposal for execution
     * @param proposalId The ID of the proposal to queue
     */
    function queueProposal(
        uint256 proposalId
    ) external proposalExists(proposalId) {
        ProposalState currentState = state(proposalId);
        if (currentState != ProposalState.Succeeded) revert NotSucceededState();
        
        Proposal storage proposal = proposals[proposalId];
        proposal.eta = block.timestamp + config.executionDelay;
        
        emit ProposalQueued(proposalId, proposal.eta);
        emit ProposalStateChanged(proposalId, currentState, ProposalState.Queued);
    }
    
    /**
     * @notice Execute a queued proposal
     * @param proposalId The ID of the proposal to execute
     * @param targets Target addresses for calls
     * @param values ETH values for calls
     * @param calldatas Calldata for calls
     */
    function executeProposal(
        uint256 proposalId,
        address[] calldata targets,
        uint256[] calldata values,
        bytes[] calldata calldatas
    ) external nonReentrant proposalExists(proposalId) {
        Proposal storage proposal = proposals[proposalId];
        
        if (state(proposalId) != ProposalState.Queued) revert NotSucceededState();
        if (proposal.executed) revert AlreadyExecuted();
        if (block.timestamp < proposal.eta) revert ExecutionDelayNotMet();
        if (block.timestamp > proposal.eta + config.gracePeriod) {
            revert GracePeriodExpired();
        }
        
        proposal.executed = true;
        
        // Execute actions
        uint256 length = targets.length;
        for (uint256 i = 0; i < length; i++) {
            (bool success, ) = targets[i].call{value: values[i]}(calldatas[i]);
            if (!success) revert ExecutionFailed();
        }
        
        emit ProposalExecuted(proposalId, msg.sender);
        emit ProposalStateChanged(proposalId, ProposalState.Queued, ProposalState.Executed);
    }
    
    /**
     * @notice Get the current state of a proposal
     * @param proposalId The ID of the proposal
     * @return The current state
     */
    function state(uint256 proposalId) public view returns (ProposalState) {
        if (proposalId == 0 || proposalId > proposalCount) {
            revert ProposalNotFound();
        }
        
        Proposal storage proposal = proposals[proposalId];
        
        if (proposal.canceled) return ProposalState.Canceled;
        if (proposal.executed) return ProposalState.Executed;
        
        if (block.number <= proposal.startTime) {
            return ProposalState.Pending;
        }
        
        if (block.number <= proposal.endTime) {
            return ProposalState.Active;
        }
        
        // Voting ended - check results
        if (proposal.forVotes <= proposal.againstVotes || 
            proposal.forVotes + proposal.abstainVotes < proposal.quorum) {
            return ProposalState.Defeated;
        }
        
        if (proposal.eta == 0) {
            return ProposalState.Succeeded;
        }
        
        if (block.timestamp > proposal.eta + config.gracePeriod) {
            return ProposalState.Expired;
        }
        
        return ProposalState.Queued;
    }
    
    /**
     * @notice Get proposal details
     * @param proposalId The ID of the proposal
     * @return All proposal details
     */
    function getProposal(
        uint256 proposalId
    ) 
        external 
        view 
        proposalExists(proposalId) 
        returns (
            uint256 id,
            address proposer,
            bytes32 contentHash,
            uint256 startTime,
            uint256 endTime,
            uint256 forVotes,
            uint256 againstVotes,
            uint256 abstainVotes,
            uint256 quorum,
            uint256 eta,
            bool executed,
            bool canceled,
            ProposalState currentState
        ) 
    {
        Proposal storage p = proposals[proposalId];
        return (
            p.id,
            p.proposer,
            p.contentHash,
            p.startTime,
            p.endTime,
            p.forVotes,
            p.againstVotes,
            p.abstainVotes,
            p.quorum,
            p.eta,
            p.executed,
            p.canceled,
            state(proposalId)
        );
    }
    
    /**
     * @notice Get vote receipt for a voter on a proposal
     * @param voter The address of the voter
     * @param proposalId The ID of the proposal
     * @return The receipt
     */
    function getReceipt(
        address voter,
        uint256 proposalId
    ) external view returns (Receipt memory) {
        return receipts[voter][proposalId];
    }
    
    /**
     * @notice Check if an address has voted on a proposal
     * @param voter The address to check
     * @param proposalId The ID of the proposal
     * @return True if voted
     */
    function hasVoted(
        address voter,
        uint256 proposalId
    ) external view returns (bool) {
        return proposals[proposalId].hasVoted[voter];
    }
    
    /**
     * @notice Update proposal configuration
     * @param newConfig The new configuration
     */
    function updateConfig(
        ProposalConfig calldata newConfig
    ) external onlyOwner {
        if (newConfig.votingPeriod == 0) revert InvalidVotingPeriod();
        
        ProposalConfig memory oldConfig = config;
        config = newConfig;
        
        emit ProposalConfigUpdated(oldConfig, newConfig);
    }
    
    /**
     * @notice Add address to proposal whitelist
     * @param account The address to whitelist
     */
    function addToWhitelist(address account) external onlyOwner {
        proposalWhitelist[account] = true;
    }
    
    /**
     * @notice Remove address from proposal whitelist
     * @param account The address to remove
     */
    function removeFromWhitelist(address account) external onlyOwner {
        proposalWhitelist[account] = false;
    }
    
    /**
     * @notice Get all active proposals
     * @return Array of active proposal IDs
     */
    function getActiveProposals() external view returns (uint256[] memory) {
        uint256[] memory active = new uint256[](allProposalIds.length);
        uint256 count = 0;
        
        for (uint256 i = 0; i < allProposalIds.length; i++) {
            if (state(allProposalIds[i]) == ProposalState.Active) {
                active[count] = allProposalIds[i];
                count++;
            }
        }
        
        // Resize array
        uint256[] memory result = new uint256[](count);
        for (uint256 i = 0; i < count; i++) {
            result[i] = active[i];
        }
        
        return result;
    }
    
    /**
     * @notice Get proposal IDs in a range
     * @param start Start index
     * @param end End index (exclusive)
     * @return Array of proposal IDs
     */
    function getProposalsInRange(
        uint256 start,
        uint256 end
    ) external view returns (uint256[] memory) {
        require(start < end, "Invalid range");
        require(end <= allProposalIds.length, "End out of bounds");
        
        uint256 length = end - start;
        uint256[] memory result = new uint256[](length);
        
        for (uint256 i = 0; i < length; i++) {
            result[i] = allProposalIds[start + i];
        }
        
        return result;
    }
    
    /**
     * @notice Get total number of proposals
     * @return Total count
     */
    function getTotalProposals() external view returns (uint256) {
        return proposalCount;
    }
    
    /**
     * @notice Batch vote on multiple proposals
     * @param proposalIds Array of proposal IDs
     * @param voteTypes Array of vote types
     */
    function batchCastVotes(
        uint256[] calldata proposalIds,
        VoteType[] calldata voteTypes
    ) external {
        require(proposalIds.length == voteTypes.length, "Array length mismatch");
        
        for (uint256 i = 0; i < proposalIds.length; i++) {
            castVote(proposalIds[i], voteTypes[i]);
        }
    }
}
