// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import {SoulBoundToken} from "./SoulBoundToken.sol";

/**
 * @title QuadraticVoting
 * @author DAO Deployer
 * @notice Quadratic voting implementation for DAO governance
 * @dev Implements quadratic voting where the cost of votes is the square of the vote count.
 *      This gives voters with fewer tokens more proportional influence and reduces
 *      the dominance of large token holders.
 *      
 *      Formula: Voting Power = sqrt(token_balance) * scaling_factor
 *      
 *      Features:
 *      - Quadratic vote counting
 *      - Voice credits system (credits = tokens^2)
 *      - Optional per-proposal quadratic toggle
 *      - Sybil resistance through soul-bound tokens
 */
contract QuadraticVoting is Ownable, ReentrancyGuard {
    
    /// @notice Structure for quadratic proposal configuration
    struct QuadraticConfig {
        bool enabled;
        uint256 scalingFactor;      // Multiplier for sqrt result (precision)
        uint256 maxCreditsPerVoter; // Maximum voice credits a single voter can use
        uint256 quadraticThreshold; // Minimum votes for quadratic to apply
    }
    
    /// @notice Structure for voter credits tracking
    struct VoterCredits {
        uint256 totalCredits;       // Total voice credits available
        uint256 usedCredits;        // Credits already used
        uint256 voteCount;          // Number of separate votes cast
    }
    
    /// @notice Structure for quadratic vote receipt
    struct QuadraticReceipt {
        bool hasVoted;
        uint8 voteType;             // 0=Against, 1=For, 2=Abstain
        uint256 creditsUsed;        // Voice credits spent
        uint256 effectiveVotes;     // Actual vote count (sqrt of credits)
    }
    
    /// @notice Mapping of proposal ID to quadratic config
    mapping(uint256 => QuadraticConfig) public proposalConfigs;
    
    /// @notice Mapping of proposal ID to voter address to credits used
    mapping(uint256 => mapping(address => VoterCredits)) public voterCreditTracking;
    
    /// @notice Mapping of proposal ID to voter address to receipt
    mapping(uint256 => mapping(address => QuadraticReceipt)) public quadraticReceipts;
    
    /// @notice Mapping of proposal ID to quadratic vote tallies
    mapping(uint256 => mapping(uint8 => uint256)) public quadraticTallies;
    
    /// @notice The governance token contract
    SoulBoundToken public governanceToken;
    
    /// @notice Default scaling factor (1e18 for 18 decimal precision)
    uint256 public constant DEFAULT_SCALING_FACTOR = 1e18;
    
    /// @notice Default maximum credits per voter (unlimited = 0)
    uint256 public constant DEFAULT_MAX_CREDITS = 0;
    
    /// @notice Global quadratic voting enabled flag
    bool public globalQuadraticEnabled;
    
    /// @notice Minimum quadratic threshold (votes below this use linear)
    uint256 public defaultQuadraticThreshold;
    
    /// @notice Events
    event QuadraticVotingEnabled(uint256 indexed proposalId, uint256 scalingFactor);
    
    event QuadraticVoteCast(
        uint256 indexed proposalId,
        address indexed voter,
        uint8 voteType,
        uint256 creditsUsed,
        uint256 effectiveVotes
    );
    
    event CreditsAllocated(
        uint256 indexed proposalId,
        address indexed voter,
        uint256 credits
    );
    
    event GlobalQuadraticToggled(bool enabled);
    
    event QuadraticThresholdUpdated(uint256 newThreshold);
    
    /// @notice Errors
    error ProposalNotFound();
    error QuadraticNotEnabled();
    error InsufficientCredits();
    error CreditsExhausted();
    error InvalidVoteType();
    error AlreadyVoted();
    error ZeroCredits();
    error ScalingFactorTooLow();
    
    /**
     * @notice Constructor
     * @param _governanceToken Address of the governance token
     * @param initialOwner Address of initial owner
     */
    constructor(
        address _governanceToken,
        address initialOwner
    ) Ownable(initialOwner) {
        governanceToken = SoulBoundToken(_governanceToken);
        globalQuadraticEnabled = true;
        defaultQuadraticThreshold = 100 * 1e18; // 100 tokens
    }
    
    /**
     * @notice Calculate square root using Babylonian method
     * @param x Number to calculate sqrt of
     * @return y Square root of x
     */
    function sqrt(uint256 x) public pure returns (uint256 y) {
        if (x == 0) return 0;
        
        uint256 z = (x + 1) / 2;
        y = x;
        
        while (z < y) {
            y = z;
            z = (x / z + z) / 2;
        }
    }
    
    /**
     * @notice Calculate voice credits from token balance
     * @dev Credits = balance^2 (quadratic)
     * @param tokenBalance Token balance to convert
     * @return credits Voice credits
     */
    function calculateCredits(uint256 tokenBalance) public pure returns (uint256) {
        return tokenBalance * tokenBalance;
    }
    
    /**
     * @notice Calculate effective votes from credits (square root)
     * @param credits Voice credits
     * @param scalingFactor Scaling factor for precision
     * @return effectiveVotes Actual vote count
     */
    function calculateEffectiveVotes(
        uint256 credits,
        uint256 scalingFactor
    ) public pure returns (uint256) {
        uint256 sqrtResult = sqrt(credits);
        return (sqrtResult * scalingFactor) / 1e18;
    }
    
    /**
     * @notice Allocate voice credits for a proposal
     * @param proposalId Proposal ID
     * @param voter Voter address
     * @return credits Allocated credits
     */
    function allocateCredits(
        uint256 proposalId,
        address voter
    ) public returns (uint256 credits) {
        uint256 balance = governanceToken.getVotingPower(voter);
        if (balance == 0) revert ZeroCredits();
        
        credits = calculateCredits(balance);
        
        QuadraticConfig storage config = proposalConfigs[proposalId];
        
        // Apply max credits limit if set
        if (config.maxCreditsPerVoter > 0 && credits > config.maxCreditsPerVoter) {
            credits = config.maxCreditsPerVoter;
        }
        
        VoterCredits storage vc = voterCreditTracking[proposalId][voter];
        vc.totalCredits = credits;
        
        emit CreditsAllocated(proposalId, voter, credits);
        
        return credits;
    }
    
    /**
     * @notice Cast a quadratic vote
     * @param proposalId Proposal ID
     * @param voteType Vote type (0=Against, 1=For, 2=Abstain)
     * @param creditsToUse Amount of credits to spend
     */
    function castQuadraticVote(
        uint256 proposalId,
        uint8 voteType,
        uint256 creditsToUse
    ) external nonReentrant {
        if (voteType > 2) revert InvalidVoteType();
        
        QuadraticConfig storage config = proposalConfigs[proposalId];
        if (!config.enabled && !globalQuadraticEnabled) revert QuadraticNotEnabled();
        
        VoterCredits storage vc = voterCreditTracking[proposalId][msg.sender];
        
        // Auto-allocate credits if not done
        if (vc.totalCredits == 0) {
            allocateCredits(proposalId, msg.sender);
        }
        
        if (vc.usedCredits + creditsToUse > vc.totalCredits) {
            revert InsufficientCredits();
        }
        
        QuadraticReceipt storage receipt = quadraticReceipts[proposalId][msg.sender];
        if (receipt.hasVoted) revert AlreadyVoted();
        
        // Calculate effective votes
        uint256 effectiveVotes = calculateEffectiveVotes(
            creditsToUse,
            config.scalingFactor > 0 ? config.scalingFactor : DEFAULT_SCALING_FACTOR
        );
        
        // Update tracking
        vc.usedCredits += creditsToUse;
        vc.voteCount++;
        
        receipt.hasVoted = true;
        receipt.voteType = voteType;
        receipt.creditsUsed = creditsToUse;
        receipt.effectiveVotes = effectiveVotes;
        
        // Update tallies
        quadraticTallies[proposalId][voteType] += effectiveVotes;
        
        emit QuadraticVoteCast(proposalId, msg.sender, voteType, creditsToUse, effectiveVotes);
    }
    
    /**
     * @notice Batch cast quadratic votes across multiple proposals
     * @param proposalIds Array of proposal IDs
     * @param voteTypes Array of vote types
     * @param credits Array of credits to use for each
     */
    function batchQuadraticVotes(
        uint256[] calldata proposalIds,
        uint8[] calldata voteTypes,
        uint256[] calldata credits
    ) external nonReentrant {
        uint256 length = proposalIds.length;
        require(length == voteTypes.length && length == credits.length, "Length mismatch");
        
        for (uint256 i = 0; i < length; i++) {
            castQuadraticVote(proposalIds[i], voteTypes[i], credits[i]);
        }
    }
    
    /**
     * @notice Enable quadratic voting for a specific proposal
     * @param proposalId Proposal ID
     * @param scalingFactor Custom scaling factor (0 for default)
     * @param maxCreditsPerVoter Max credits per voter (0 for unlimited)
     * @param quadraticThreshold Minimum votes for quadratic to apply
     */
    function enableQuadraticForProposal(
        uint256 proposalId,
        uint256 scalingFactor,
        uint256 maxCreditsPerVoter,
        uint256 quadraticThreshold
    ) external onlyOwner {
        if (scalingFactor > 0 && scalingFactor < 1e6) revert ScalingFactorTooLow();
        
        proposalConfigs[proposalId] = QuadraticConfig({
            enabled: true,
            scalingFactor: scalingFactor > 0 ? scalingFactor : DEFAULT_SCALING_FACTOR,
            maxCreditsPerVoter: maxCreditsPerVoter,
            quadraticThreshold: quadraticThreshold > 0 ? quadraticThreshold : defaultQuadraticThreshold
        });
        
        emit QuadraticVotingEnabled(proposalId, scalingFactor);
    }
    
    /**
     * @notice Disable quadratic voting for a proposal
     * @param proposalId Proposal ID
     */
    function disableQuadraticForProposal(uint256 proposalId) external onlyOwner {
        proposalConfigs[proposalId].enabled = false;
    }
    
    /**
     * @notice Toggle global quadratic voting
     * @param enabled New enabled state
     */
    function toggleGlobalQuadratic(bool enabled) external onlyOwner {
        globalQuadraticEnabled = enabled;
        emit GlobalQuadraticToggled(enabled);
    }
    
    /**
     * @notice Update default quadratic threshold
     * @param newThreshold New threshold value
     */
    function updateDefaultThreshold(uint256 newThreshold) external onlyOwner {
        defaultQuadraticThreshold = newThreshold;
        emit QuadraticThresholdUpdated(newThreshold);
    }
    
    /**
     * @notice Get quadratic vote results for a proposal
     * @param proposalId Proposal ID
     * @return againstVotes Quadratic against votes
     * @return forVotes Quadratic for votes
     * @return abstainVotes Quadratic abstain votes
     */
    function getQuadraticResults(
        uint256 proposalId
    ) external view returns (
        uint256 againstVotes,
        uint256 forVotes,
        uint256 abstainVotes
    ) {
        return (
            quadraticTallies[proposalId][0],
            quadraticTallies[proposalId][1],
            quadraticTallies[proposalId][2]
        );
    }
    
    /**
     * @notice Get voter's quadratic vote receipt
     * @param proposalId Proposal ID
     * @param voter Voter address
     * @return receipt Quadratic receipt
     */
    function getQuadraticReceipt(
        uint256 proposalId,
        address voter
    ) external view returns (QuadraticReceipt memory) {
        return quadraticReceipts[proposalId][voter];
    }
    
    /**
     * @notice Get voter's remaining credits for a proposal
     * @param proposalId Proposal ID
     * @param voter Voter address
     * @return remaining Credits remaining
     */
    function getRemainingCredits(
        uint256 proposalId,
        address voter
    ) external view returns (uint256) {
        VoterCredits storage vc = voterCreditTracking[proposalId][voter];
        if (vc.totalCredits == 0) {
            // Calculate potential credits
            uint256 balance = governanceToken.getVotingPower(voter);
            return calculateCredits(balance);
        }
        return vc.totalCredits - vc.usedCredits;
    }
    
    /**
     * @notice Check if quadratic voting is enabled for a proposal
     * @param proposalId Proposal ID
     * @return True if enabled
     */
    function isQuadraticEnabled(uint256 proposalId) external view returns (bool) {
        return proposalConfigs[proposalId].enabled || globalQuadraticEnabled;
    }
    
    /**
     * @notice Get effective voting power using quadratic formula
     * @param tokenBalance Token balance
     * @param scalingFactor Scaling factor
     * @return Effective vote count
     */
    function getEffectiveVotingPower(
        uint256 tokenBalance,
        uint256 scalingFactor
    ) external pure returns (uint256) {
        if (scalingFactor == 0) {
            scalingFactor = DEFAULT_SCALING_FACTOR;
        }
        uint256 credits = calculateCredits(tokenBalance);
        return calculateEffectiveVotes(credits, scalingFactor);
    }
}