// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {SoulBoundToken} from "./SoulBoundToken.sol";

/**
 * @title TaskMarket
 * @author DAO Deployer
 * @notice Decentralized marketplace for completing DAO proposals/tasks
 * @dev This contract manages a bid/offer system where users can:
 *      - Create offers to complete tasks/proposals
 *      - Accept offers (by DAO or authorized addresses)
 *      - Track task completion status
 *      - Distribute rewards upon successful completion
 *      Integrates with ProposalManager for task verification
 */
contract TaskMarket is Ownable, ReentrancyGuard {
    using SafeERC20 for IERC20;
    
    /// @notice Enum for offer status
    enum OfferStatus {
        Pending,        // 0: Created, waiting for acceptance
        Accepted,       // 1: Accepted, work in progress
        Completed,      // 2: Work completed, pending verification
        Disputed,       // 3: Dispute raised
        Resolved,       // 4: Dispute resolved
        Cancelled,      // 5: Cancelled by offeror or DAO
        Expired         // 6: Offer expired without acceptance
    }
    
    /// @notice Structure for task offers
    struct Offer {
        uint256 id;
        uint256 proposalId;         // Related proposal ID (0 if standalone task)
        address offeror;            // Address making the offer
        address acceptor;           // Address that accepted (DAO or delegate)
        string taskDescription;     // Off-chain task description hash/IPFS
        uint256 reward;             // Reward amount
        address rewardToken;        // Token for reward (address(0) for ETH)
        uint256 deadline;           // Deadline for completion
        uint256 createdAt;
        uint256 acceptedAt;
        uint256 completedAt;
        OfferStatus status;
        bytes32 completionProof;    // Hash of completion evidence
        uint256 disputeId;          // Associated dispute ID (if any)
    }
    
    /// @notice Structure for disputes
    struct Dispute {
        uint256 id;
        uint256 offerId;
        address initiator;
        string reason;
        uint256 createdAt;
        bool resolved;
        address resolver;
        uint256 resolvedAt;
        bool offerorWins;           // True if offeror wins dispute
    }
    
    /// @notice Structure for user statistics
    struct UserStats {
        uint256 offersCreated;
        uint256 offersAccepted;
        uint256 tasksCompleted;
        uint256 totalEarned;
        uint256 reputation;         // Reputation score (0-10000)
    }
    
    /// @notice Error thrown when offer not found
    error OfferNotFound();
    
    /// @notice Error thrown when insufficient reward
    error InsufficientReward();
    
    /// @notice Error thrown when not offeror
    error NotOfferor();
    
    /// @notice Error thrown when not acceptor
    error NotAcceptor();
    
    /// @notice Error thrown when invalid deadline
    error InvalidDeadline();
    
    /// @notice Error thrown when offer not in pending state
    error NotPendingState();
    
    /// @notice Error thrown when offer not in accepted state
    error NotAcceptedState();
    
    /// @notice Error thrown when offer not in completed state
    error NotCompletedState();
    
    /// @notice Error thrown when deadline passed
    error DeadlinePassed();
    
    /// @notice Error thrown when deadline not passed
    error DeadlineNotPassed();
    
    /// @notice Error thrown when already disputed
    error AlreadyDisputed();
    
    /// @notice Error thrown when dispute not found
    error DisputeNotFound();
    
    /// @notice Error thrown when dispute already resolved
    error DisputeAlreadyResolved();
    
    /// @notice Error thrown when unauthorized action
    error Unauthorized();
    
    /// @notice Error thrown when reward transfer failed
    error RewardTransferFailed();
    
    /// @notice Error thrown when invalid status transition
    error InvalidStatusTransition();
    
    /// @notice Error thrown when escrow not found
    error EscrowNotFound();
    
    /// @notice Emitted when a new offer is created
    /// @param offerId ID of the offer
    /// @param proposalId Related proposal ID
    /// @param offeror Address making the offer
    /// @param reward Reward amount
    /// @param rewardToken Token address (0 for ETH)
    /// @param deadline Completion deadline
    event OfferCreated(
        uint256 indexed offerId,
        uint256 indexed proposalId,
        address indexed offeror,
        uint256 reward,
        address rewardToken,
        uint256 deadline
    );
    
    /// @notice Emitted when an offer is accepted
    /// @param offerId ID of the offer
    /// @param acceptor Address accepting the offer
    /// @param acceptedAt Timestamp of acceptance
    event OfferAccepted(
        uint256 indexed offerId,
        address indexed acceptor,
        uint256 acceptedAt
    );
    
    /// @notice Emitted when a task is marked complete
    /// @param offerId ID of the offer
    /// @param completionProof Hash of completion evidence
    /// @param completedAt Timestamp of completion
    event TaskCompleted(
        uint256 indexed offerId,
        bytes32 completionProof,
        uint256 completedAt
    );
    
    /// @notice Emitted when a dispute is raised
    /// @param disputeId ID of the dispute
    /// @param offerId ID of the related offer
    /// @param initiator Address raising the dispute
    /// @param reason Dispute reason
    event DisputeRaised(
        uint256 indexed disputeId,
        uint256 indexed offerId,
        address indexed initiator,
        string reason
    );
    
    /// @notice Emitted when a dispute is resolved
    /// @param disputeId ID of the dispute
    /// @param resolver Address resolving the dispute
    /// @param offerorWins Whether offeror wins
    /// @param reward Distributed reward amount
    event DisputeResolved(
        uint256 indexed disputeId,
        address indexed resolver,
        bool offerorWins,
        uint256 reward
    );
    
    /// @notice Emitted when rewards are distributed
    /// @param offerId ID of the offer
    /// @param recipient Address receiving the reward
    /// @param amount Reward amount
    /// @param token Token address (0 for ETH)
    event RewardDistributed(
        uint256 indexed offerId,
        address indexed recipient,
        uint256 amount,
        address token
    );
    /// @notice Emitted when an offer is cancelled
    /// @param offerId ID of the offer
    /// @param cancelledBy Address that cancelled
    /// @param refundAmount Refunded amount
    event OfferCancelled(
        uint256 indexed offerId,
        address indexed cancelledBy,
        uint256 refundAmount
    );
    
    /// @notice Emitted when an offer expires
    /// @param offerId ID of the offer
    /// @param expiredAt Expiration timestamp
    event OfferExpired(
        uint256 indexed offerId,
        uint256 expiredAt
    );
    
    /// @notice Emitted when reputation is updated
    /// @param user User address
    /// @param newReputation New reputation score
    /// @param oldReputation Old reputation score
    event ReputationUpdated(
        address indexed user,
        uint256 newReputation,
        uint256 oldReputation
    );
    
    /// @notice Counter for offer IDs
    uint256 public offerCounter;
    
    /// @notice Counter for dispute IDs
    uint256 public disputeCounter;
    
    /// @notice Mapping of offer ID to offer data
    mapping(uint256 => Offer) public offers;
    
    /// @notice Mapping of dispute ID to dispute data
    mapping(uint256 => Dispute) public disputes;
    
    /// @notice Mapping of user address to user stats
    mapping(address => UserStats) public userStats;
    
    /// @notice Mapping of authorized acceptors (DAO contracts, etc.)
    mapping(address => bool) public authorizedAcceptors;
    
    /// @notice Mapping of dispute resolvers
    mapping(address => bool) public disputeResolvers;
    
    /// @notice Mapping of offer ID to escrowed funds
    mapping(uint256 => uint256) public escrows;
    
    /// @notice Array of all offer IDs
    uint256[] public allOfferIds;
    
    /// @notice Mapping of proposal ID to accepted offer ID
    mapping(uint256 => uint256) public proposalToAcceptedOffer;
    
    /// @notice Minimum reward amount
    uint256 public minReward;
    
    /// @notice Platform fee percentage (basis points)
    uint256 public platformFeePercent;
    
    /// @notice Platform fee recipient
    address public feeRecipient;
    
    /// @notice Default deadline duration (7 days)
    uint256 public constant DEFAULT_DEADLINE_DURATION = 7 days;
    
    /// @notice Maximum deadline duration (90 days)
    uint256 public constant MAX_DEADLINE_DURATION = 90 days;
    
    /// @notice Basis points denominator
    uint256 public constant BPS_DENOMINATOR = 10000;
    
    /// @notice Modifier to check if offer exists
    modifier offerExists(uint256 offerId) {
        if (offerId == 0 || offerId > offerCounter) revert OfferNotFound();
        _;
    }
    
    /// @notice Modifier to restrict to authorized acceptors
    modifier onlyAuthorizedAcceptor() {
        if (!authorizedAcceptors[msg.sender] && msg.sender != owner()) {
            revert Unauthorized();
        }
        _;
    }
    
    /// @notice Modifier to restrict to dispute resolvers
    modifier onlyDisputeResolver() {
        if (!disputeResolvers[msg.sender] && msg.sender != owner()) {
            revert Unauthorized();
        }
        _;
    }
    
    /**
     * @notice Constructor to initialize the task market
     * @param _minReward Minimum reward amount
     * @param _platformFeePercent Platform fee in basis points
     * @param _feeRecipient Platform fee recipient address
     * @param initialOwner Address of the initial owner
     */
    constructor(
        uint256 _minReward,
        uint256 _platformFeePercent,
        address _feeRecipient,
        address initialOwner
    ) Ownable(initialOwner) {
        minReward = _minReward;
        platformFeePercent = _platformFeePercent;
        feeRecipient = _feeRecipient;
        
        // Authorize owner
        authorizedAcceptors[initialOwner] = true;
        disputeResolvers[initialOwner] = true;
    }
    
    /**
     * @notice Create a new task offer
     * @param proposalId Related proposal ID (0 for standalone tasks)
     * @param taskDescription IPFS hash or description identifier
     * @param deadline Completion deadline timestamp
     * @return offerId The ID of the created offer
     */
    function createOffer(
        uint256 proposalId,
        string calldata taskDescription,
        uint256 deadline
    ) external payable returns (uint256 offerId) {
        return _createOfferWithReward(
            proposalId,
            taskDescription,
            deadline,
            msg.value,
            address(0)
        );
    }
    
    /**
     * @notice Create a new task offer with ERC20 reward
     * @param proposalId Related proposal ID
     * @param taskDescription IPFS hash or description identifier
     * @param deadline Completion deadline timestamp
     * @param reward Reward amount
     * @param rewardToken ERC20 token address
     * @return offerId The ID of the created offer
     */
    function createOfferWithToken(
        uint256 proposalId,
        string calldata taskDescription,
        uint256 deadline,
        uint256 reward,
        address rewardToken
    ) external returns (uint256 offerId) {
        if (rewardToken == address(0)) revert("Use createOffer for ETH");
        
        // Transfer tokens to escrow
        IERC20(rewardToken).safeTransferFrom(msg.sender, address(this), reward);
        
        return _createOfferWithReward(
            proposalId,
            taskDescription,
            deadline,
            reward,
            rewardToken
        );
    }
    
    /**
     * @notice Internal function to create offer
     */
    function _createOfferWithReward(
        uint256 proposalId,
        string calldata taskDescription,
        uint256 deadline,
        uint256 reward,
        address rewardToken
    ) internal returns (uint256 offerId) {
        if (reward < minReward) revert InsufficientReward();
        if (deadline <= block.timestamp) revert InvalidDeadline();
        if (deadline > block.timestamp + MAX_DEADLINE_DURATION) {
            revert InvalidDeadline();
        }
        
        offerCounter++;
        offerId = offerCounter;
        
        Offer storage newOffer = offers[offerId];
        newOffer.id = offerId;
        newOffer.proposalId = proposalId;
        newOffer.offeror = msg.sender;
        newOffer.taskDescription = taskDescription;
        newOffer.reward = reward;
        newOffer.rewardToken = rewardToken;
        newOffer.deadline = deadline;
        newOffer.createdAt = block.timestamp;
        newOffer.status = OfferStatus.Pending;
        
        // Store in escrow
        escrows[offerId] = reward;
        
        // Update user stats
        userStats[msg.sender].offersCreated++;
        
        allOfferIds.push(offerId);
        
        emit OfferCreated(
            offerId,
            proposalId,
            msg.sender,
            reward,
            rewardToken,
            deadline
        );
        
        return offerId;
    }
    
    /**
     * @notice Accept a pending offer
     * @param offerId ID of the offer to accept
     */
    function acceptOffer(
        uint256 offerId
    ) external onlyAuthorizedAcceptor offerExists(offerId) {
        Offer storage offer = offers[offerId];
        
        if (offer.status != OfferStatus.Pending) revert NotPendingState();
        if (block.timestamp > offer.deadline) revert DeadlinePassed();
        
        offer.status = OfferStatus.Accepted;
        offer.acceptor = msg.sender;
        offer.acceptedAt = block.timestamp;
        
        // Track proposal to offer mapping
        if (offer.proposalId > 0) {
            proposalToAcceptedOffer[offer.proposalId] = offerId;
        }
        
        // Update user stats
        userStats[msg.sender].offersAccepted++;
        
        emit OfferAccepted(offerId, msg.sender, block.timestamp);
    }
    
    /**
     * @notice Mark a task as completed and submit proof
     * @param offerId ID of the offer
     * @param completionProof Hash of completion evidence (IPFS, etc.)
     */
    function completeTask(
        uint256 offerId,
        bytes32 completionProof
    ) external offerExists(offerId) {
        Offer storage offer = offers[offerId];
        
        if (offer.status != OfferStatus.Accepted) revert NotAcceptedState();
        if (msg.sender != offer.offeror) revert NotOfferor();
        if (block.timestamp > offer.deadline) revert DeadlinePassed();
        if (completionProof == bytes32(0)) revert("Invalid proof");
        
        offer.status = OfferStatus.Completed;
        offer.completionProof = completionProof;
        offer.completedAt = block.timestamp;
        
        emit TaskCompleted(offerId, completionProof, block.timestamp);
    }
    
    /**
     * @notice Confirm task completion and release reward
     * @param offerId ID of the offer
     */
    function confirmAndRelease(
        uint256 offerId
    ) external nonReentrant offerExists(offerId) {
        Offer storage offer = offers[offerId];
        
        if (offer.status != OfferStatus.Completed) revert NotCompletedState();
        if (msg.sender != offer.acceptor && msg.sender != owner()) {
            revert NotAcceptor();
        }
        
        _releaseReward(offerId, offer.offeror);
        
        // Update stats
        userStats[offer.offeror].tasksCompleted++;
        userStats[offer.offeror].totalEarned += offer.reward;
        _updateReputation(offer.offeror, true);
    }
    
    /**
     * @notice Raise a dispute for an offer
     * @param offerId ID of the offer
     * @param reason Reason for the dispute
     */
    function raiseDispute(
        uint256 offerId,
        string calldata reason
    ) external offerExists(offerId) {
        Offer storage offer = offers[offerId];
        
        if (offer.status != OfferStatus.Completed && 
            offer.status != OfferStatus.Accepted) {
            revert InvalidStatusTransition();
        }
        if (msg.sender != offer.offeror && msg.sender != offer.acceptor) {
            revert Unauthorized();
        }
        if (offer.status == OfferStatus.Disputed) revert AlreadyDisputed();
        
        disputeCounter++;
        uint256 disputeId = disputeCounter;
        
        disputes[disputeId] = Dispute({
            id: disputeId,
            offerId: offerId,
            initiator: msg.sender,
            reason: reason,
            createdAt: block.timestamp,
            resolved: false,
            resolver: address(0),
            resolvedAt: 0,
            offerorWins: false
        });
        
        offer.status = OfferStatus.Disputed;
        offer.disputeId = disputeId;
        
        emit DisputeRaised(disputeId, offerId, msg.sender, reason);
    }
    
    /**
     * @notice Resolve a dispute
     * @param disputeId ID of the dispute
     * @param offerorWins Whether the offeror wins the dispute
     */
    function resolveDispute(
        uint256 disputeId,
        bool offerorWins
    ) external onlyDisputeResolver {
        Dispute storage dispute = disputes[disputeId];
        
        if (dispute.id == 0) revert DisputeNotFound();
        if (dispute.resolved) revert DisputeAlreadyResolved();
        
        Offer storage offer = offers[dispute.offerId];
        
        dispute.resolved = true;
        dispute.resolver = msg.sender;
        dispute.resolvedAt = block.timestamp;
        dispute.offerorWins = offerorWins;
        
        offer.status = OfferStatus.Resolved;
        
        // Distribute reward based on resolution
        if (offerorWins) {
            _releaseReward(dispute.offerId, offer.offeror);
            userStats[offer.offeror].tasksCompleted++;
            _updateReputation(offer.offeror, true);
            _updateReputation(offer.acceptor, false);
        } else {
            _releaseReward(dispute.offerId, offer.acceptor);
            _updateReputation(offer.offeror, false);
        }
        
        emit DisputeResolved(disputeId, msg.sender, offerorWins, offer.reward);
    }
    
    /**
     * @notice Cancel a pending offer (only by offeror)
     * @param offerId ID of the offer to cancel
     */
    function cancelOffer(
        uint256 offerId
    ) external nonReentrant offerExists(offerId) {
        Offer storage offer = offers[offerId];
        
        if (offer.status != OfferStatus.Pending) revert NotPendingState();
        if (msg.sender != offer.offeror && msg.sender != owner()) {
            revert NotOfferor();
        }
        
        offer.status = OfferStatus.Cancelled;
        
        // Refund escrow
        uint256 refundAmount = escrows[offerId];
        delete escrows[offerId];
        
        _transferReward(offerId, offer.offeror, refundAmount, offer.rewardToken);
        
        emit OfferCancelled(offerId, msg.sender, refundAmount);
    }
    
    /**
     * @notice Expire an offer that passed deadline without acceptance
     * @param offerId ID of the offer to expire
     */
    function expireOffer(
        uint256 offerId
    ) external nonReentrant offerExists(offerId) {
        Offer storage offer = offers[offerId];
        
        if (offer.status != OfferStatus.Pending) revert NotPendingState();
        if (block.timestamp <= offer.deadline) revert DeadlineNotPassed();
        
        offer.status = OfferStatus.Expired;
        
        // Refund escrow
        uint256 refundAmount = escrows[offerId];
        delete escrows[offerId];
        
        _transferReward(offerId, offer.offeror, refundAmount, offer.rewardToken);
        
        emit OfferExpired(offerId, block.timestamp);
    }
    
    /**
     * @notice Internal function to release reward
     */
    function _releaseReward(
        uint256 offerId,
        address recipient
    ) internal {
        Offer storage offer = offers[offerId];
        
        uint256 reward = escrows[offerId];
        if (reward == 0) revert EscrowNotFound();
        
        delete escrows[offerId];
        
        // Calculate platform fee
        uint256 fee = (reward * platformFeePercent) / BPS_DENOMINATOR;
        uint256 netReward = reward - fee;
        
        // Transfer fee
        if (fee > 0 && feeRecipient != address(0)) {
            _transferReward(offerId, feeRecipient, fee, offer.rewardToken);
        }
        
        // Transfer net reward
        _transferReward(offerId, recipient, netReward, offer.rewardToken);
        
        emit RewardDistributed(offerId, recipient, netReward, offer.rewardToken);
    }
    
    /**
     * @notice Internal function to transfer reward
     */
    function _transferReward(
        uint256 offerId,
        address recipient,
        uint256 amount,
        address token
    ) internal {
        if (token == address(0)) {
            (bool success, ) = recipient.call{value: amount}("");
            if (!success) revert RewardTransferFailed();
        } else {
            IERC20(token).safeTransfer(recipient, amount);
        }
    }
    
    /**
     * @notice Update user reputation
     */
    function _updateReputation(address user, bool positive) internal {
        UserStats storage stats = userStats[user];
        uint256 oldReputation = stats.reputation;
        
        if (positive) {
            // Increase reputation (max 10000)
            stats.reputation = uint256(
                stats.reputation + 100 > 10000 ? 10000 : stats.reputation + 100
            );
        } else {
            // Decrease reputation (min 0)
            stats.reputation = stats.reputation > 100 ? stats.reputation - 100 : 0;
        }
        
        if (stats.reputation != oldReputation) {
            emit ReputationUpdated(user, stats.reputation, oldReputation);
        }
    }
    
    /**
     * @notice Get offer details
     */
    function getOffer(
        uint256 offerId
    ) 
        external 
        view 
        offerExists(offerId) 
        returns (Offer memory) 
    {
        return offers[offerId];
    }
    
    /**
     * @notice Get dispute details
     */
    function getDispute(
        uint256 disputeId
    ) external view returns (Dispute memory) {
        if (disputeId == 0 || disputeId > disputeCounter) revert DisputeNotFound();
        return disputes[disputeId];
    }
    
    /**
     * @notice Get user statistics
     */
    function getUserStats(
        address user
    ) external view returns (UserStats memory) {
        return userStats[user];
    }
    
    /**
     * @notice Get all active offers
     */
    function getActiveOffers() external view returns (uint256[] memory) {
        uint256[] memory active = new uint256[](allOfferIds.length);
        uint256 count = 0;
        
        for (uint256 i = 0; i < allOfferIds.length; i++) {
            if (offers[allOfferIds[i]].status == OfferStatus.Pending) {
                active[count] = allOfferIds[i];
                count++;
            }
        }
        
        uint256[] memory result = new uint256[](count);
        for (uint256 i = 0; i < count; i++) {
            result[i] = active[i];
        }
        
        return result;
    }
    
    /**
     * @notice Get offers by status
     */
    function getOffersByStatus(
        OfferStatus status
    ) external view returns (uint256[] memory) {
        uint256[] memory matching = new uint256[](allOfferIds.length);
        uint256 count = 0;
        
        for (uint256 i = 0; i < allOfferIds.length; i++) {
            if (offers[allOfferIds[i]].status == status) {
                matching[count] = allOfferIds[i];
                count++;
            }
        }
        
        uint256[] memory result = new uint256[](count);
        for (uint256 i = 0; i < count; i++) {
            result[i] = matching[i];
        }
        
        return result;
    }
    
    /**
     * @notice Authorize an address to accept offers
     */
    function authorizeAcceptor(address acceptor) external onlyOwner {
        authorizedAcceptors[acceptor] = true;
    }
    
    /**
     * @notice Revoke acceptor authorization
     */
    function revokeAcceptor(address acceptor) external onlyOwner {
        authorizedAcceptors[acceptor] = false;
    }
    
    /**
     * @notice Add dispute resolver
     */
    function addDisputeResolver(address resolver) external onlyOwner {
        disputeResolvers[resolver] = true;
    }
    
    /**
     * @notice Remove dispute resolver
     */
    function removeDisputeResolver(address resolver) external onlyOwner {
        disputeResolvers[resolver] = false;
    }
    
    /**
     * @notice Update platform fee
     */
    function updatePlatformFee(
        uint256 newFeePercent,
        address newFeeRecipient
    ) external onlyOwner {
        require(newFeePercent <= 1000, "Fee too high"); // Max 10%
        platformFeePercent = newFeePercent;
        feeRecipient = newFeeRecipient;
    }
    
    /**
     * @notice Update minimum reward
     */
    function updateMinReward(uint256 newMinReward) external onlyOwner {
        minReward = newMinReward;
    }
    
    /**
     * @notice Get total offers count
     */
    function getTotalOffers() external view returns (uint256) {
        return offerCounter;
    }
    
    /**
     * @notice Get total disputes count
     */
    function getTotalDisputes() external view returns (uint256) {
        return disputeCounter;
    }
    
    /**
     * @notice Receive ETH
     */
    receive() external payable {}
}
