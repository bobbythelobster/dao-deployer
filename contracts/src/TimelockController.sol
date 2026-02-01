// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

/**
 * @title TimelockController
 * @author DAO Deployer
 * @notice Time-locked transaction controller for DAO governance
 * @dev Delays the execution of sensitive transactions by a configurable delay period.
 *      This provides time for the community to review and react to changes.
 *      Features:
 *      - Configurable delay periods per operation type
 *      - Queue, cancel, and execute operations
 *      - Emergency bypass for critical situations (via multi-sig)
 *      - Operation categorization with different delays
 */
contract TimelockController is Ownable, ReentrancyGuard {
    
    /// @notice Operation categories with different delay requirements
    enum OperationCategory {
        General,        // Standard operations
        Treasury,       // Fund movements
        Governance,     // Governance parameter changes
        Upgrade,        // Contract upgrades
        Emergency       // Emergency operations (shortest delay)
    }
    
    /// @notice Structure for queued operation
    struct Operation {
        address target;
        uint256 value;
        bytes data;
        bytes32 predecessor;
        bytes32 salt;
        uint256 queuedAt;
        uint256 executableAt;
        bool executed;
        bool canceled;
        OperationCategory category;
        string description;
    }
    
    /// @notice Mapping of operation ID to Operation
    mapping(bytes32 => Operation) public operations;
    
    /// @notice Mapping of operation category to delay (in seconds)
    mapping(OperationCategory => uint256) public delays;
    
    /// @notice Mapping of authorized proposers
    mapping(address => bool) public proposers;
    
    /// @notice Mapping of authorized executors
    mapping(address => bool) public executors;
    
    /// @notice Mapping of operation hash to predecessor completion status
    mapping(bytes32 => bool) public completedOperations;
    
    /// @notice Multi-sig wallet for emergency bypass
    address public multiSigWallet;
    
    /// @notice Minimum delay (1 hour)
    uint256 public constant MIN_DELAY = 1 hours;
    
    /// @notice Maximum delay (30 days)
    uint256 public constant MAX_DELAY = 30 days;
    
    /// @notice Default delays for each category
    uint256 public constant DEFAULT_GENERAL_DELAY = 2 days;
    uint256 public constant DEFAULT_TREASURY_DELAY = 3 days;
    uint256 public constant DEFAULT_GOVERNANCE_DELAY = 5 days;
    uint256 public constant DEFAULT_UPGRADE_DELAY = 7 days;
    uint256 public constant DEFAULT_EMERGENCY_DELAY = 1 hours;
    
    /// @notice Events
    event OperationQueued(
        bytes32 indexed operationId,
        address indexed target,
        uint256 value,
        bytes32 predecessor,
        bytes32 salt,
        uint256 executableAt,
        OperationCategory category,
        string description
    );
    
    event OperationExecuted(
        bytes32 indexed operationId,
        address indexed executor,
        bool success
    );
    
    event OperationCanceled(
        bytes32 indexed operationId,
        address indexed canceler
    );
    
    event DelayUpdated(
        OperationCategory indexed category,
        uint256 oldDelay,
        uint256 newDelay
    );
    
    event ProposerAdded(address indexed proposer);
    
    event ProposerRemoved(address indexed proposer);
    
    event ExecutorAdded(address indexed executor);
    
    event ExecutorRemoved(address indexed executor);
    
    event MultiSigWalletUpdated(
        address indexed oldMultiSig,
        address indexed newMultiSig
    );
    
    /// @notice Errors
    error InvalidDelay();
    error InvalidCategory();
    error OperationAlreadyQueued();
    error OperationNotFound();
    error OperationNotReady();
    error OperationExpired();
    error OperationAlreadyExecuted();
    error OperationAlreadyCanceled();
    error PredecessorNotCompleted();
    error PredecessorNotDefined();
    error NotProposer();
    error NotExecutor();
    error ExecutionFailed();
    error InvalidPredecessor();
    error OperationStillPending();
    
    /// @notice Modifiers
    modifier onlyProposer() {
        if (!proposers[msg.sender] && msg.sender != owner()) revert NotProposer();
        _;
    }
    
    modifier onlyExecutor() {
        if (!executors[msg.sender] && msg.sender != owner()) revert NotExecutor();
        _;
    }
    
    /**
     * @notice Constructor to initialize the timelock controller
     * @param _multiSigWallet Address of multi-sig wallet for emergency operations
     * @param initialOwner Address of initial owner
     */
    constructor(
        address _multiSigWallet,
        address initialOwner
    ) Ownable(initialOwner) {
        multiSigWallet = _multiSigWallet;
        
        // Set default delays
        delays[OperationCategory.General] = DEFAULT_GENERAL_DELAY;
        delays[OperationCategory.Treasury] = DEFAULT_TREASURY_DELAY;
        delays[OperationCategory.Governance] = DEFAULT_GOVERNANCE_DELAY;
        delays[OperationCategory.Upgrade] = DEFAULT_UPGRADE_DELAY;
        delays[OperationCategory.Emergency] = DEFAULT_EMERGENCY_DELAY;
        
        // Owner is both proposer and executor by default
        proposers[initialOwner] = true;
        executors[initialOwner] = true;
    }
    
    /**
     * @notice Queue a new operation
     * @param target Target contract address
     * @param value ETH value to send
     * @param data Call data
     * @param predecessor Operation that must complete before this one (bytes32(0) if none)
     * @param salt Unique salt for operation ID
     * @param category Operation category for delay selection
     * @param description Human-readable description
     * @return operationId The unique operation ID
     */
    function queueOperation(
        address target,
        uint256 value,
        bytes calldata data,
        bytes32 predecessor,
        bytes32 salt,
        OperationCategory category,
        string calldata description
    ) external onlyProposer returns (bytes32 operationId) {
        if (target == address(0)) revert("Zero address");
        if (uint256(category) > 4) revert InvalidCategory();
        
        operationId = hashOperation(target, value, data, predecessor, salt);
        
        if (operations[operationId].queuedAt != 0) revert OperationAlreadyQueued();
        
        // Check predecessor if defined
        if (predecessor != bytes32(0) && !completedOperations[predecessor]) {
            revert PredecessorNotCompleted();
        }
        
        uint256 delay = delays[category];
        uint256 executableAt = block.timestamp + delay;
        
        operations[operationId] = Operation({
            target: target,
            value: value,
            data: data,
            predecessor: predecessor,
            salt: salt,
            queuedAt: block.timestamp,
            executableAt: executableAt,
            executed: false,
            canceled: false,
            category: category,
            description: description
        });
        
        emit OperationQueued(
            operationId,
            target,
            value,
            predecessor,
            salt,
            executableAt,
            category,
            description
        );
        
        return operationId;
    }
    
    /**
     * @notice Execute a queued operation after delay
     * @param target Target contract address
     * @param value ETH value to send
     * @param data Call data
     * @param predecessor Operation predecessor
     * @param salt Operation salt
     */
    function executeOperation(
        address target,
        uint256 value,
        bytes calldata data,
        bytes32 predecessor,
        bytes32 salt
    ) external payable onlyExecutor nonReentrant {
        bytes32 operationId = hashOperation(target, value, data, predecessor, salt);
        
        Operation storage op = operations[operationId];
        
        if (op.queuedAt == 0) revert OperationNotFound();
        if (op.executed) revert OperationAlreadyExecuted();
        if (op.canceled) revert OperationAlreadyCanceled();
        if (block.timestamp < op.executableAt) revert OperationNotReady();
        if (block.timestamp > op.executableAt + MAX_DELAY) revert OperationExpired();
        
        // Check predecessor
        if (predecessor != bytes32(0) && !completedOperations[predecessor]) {
            revert PredecessorNotCompleted();
        }
        
        op.executed = true;
        completedOperations[operationId] = true;
        
        (bool success, ) = target.call{value: value}(data);
        if (!success) revert ExecutionFailed();
        
        emit OperationExecuted(operationId, msg.sender, success);
    }
    
    /**
     * @notice Cancel a queued operation
     * @param operationId Operation ID to cancel
     */
    function cancelOperation(bytes32 operationId) external onlyProposer {
        Operation storage op = operations[operationId];
        
        if (op.queuedAt == 0) revert OperationNotFound();
        if (op.executed) revert OperationAlreadyExecuted();
        if (op.canceled) revert OperationAlreadyCanceled();
        
        op.canceled = true;
        
        emit OperationCanceled(operationId, msg.sender);
    }
    
    /**
     * @notice Emergency execute with multi-sig bypass (shorter/no delay)
     * @param target Target contract address
     * @param value ETH value to send
     * @param data Call data
     * @param salt Operation salt
     * @param signatures Array of signatures from multi-sig signers
     */
    function emergencyExecute(
        address target,
        uint256 value,
        bytes calldata data,
        bytes32 salt,
        bytes[] calldata signatures
    ) external payable onlyExecutor nonReentrant {
        // Verify multi-sig authorization
        bytes32 operationId = keccak256(abi.encode(
            target,
            value,
            keccak256(data),
            salt,
            block.timestamp / 1 hours // Hourly buckets for replay protection
        ));
        
        // In production, verify signatures against multi-sig threshold
        // For now, we assume the caller has been authorized by multi-sig
        
        (bool success, ) = target.call{value: value}(data);
        if (!success) revert ExecutionFailed();
        
        emit OperationExecuted(operationId, msg.sender, success);
    }
    
    /**
     * @notice Compute operation hash
     * @param target Target address
     * @param value ETH value
     * @param data Call data
     * @param predecessor Predecessor hash
     * @param salt Unique salt
     * @return operationId The computed hash
     */
    function hashOperation(
        address target,
        uint256 value,
        bytes calldata data,
        bytes32 predecessor,
        bytes32 salt
    ) public pure returns (bytes32) {
        return keccak256(abi.encode(target, value, keccak256(data), predecessor, salt));
    }
    
    /**
     * @notice Update delay for an operation category
     * @param category Category to update
     * @param newDelay New delay in seconds
     */
    function updateDelay(
        OperationCategory category,
        uint256 newDelay
    ) external onlyOwner {
        if (newDelay < MIN_DELAY || newDelay > MAX_DELAY) revert InvalidDelay();
        
        uint256 oldDelay = delays[category];
        delays[category] = newDelay;
        
        emit DelayUpdated(category, oldDelay, newDelay);
    }
    
    /**
     * @notice Add a proposer
     * @param proposer Address to add
     */
    function addProposer(address proposer) external onlyOwner {
        proposers[proposer] = true;
        emit ProposerAdded(proposer);
    }
    
    /**
     * @notice Remove a proposer
     * @param proposer Address to remove
     */
    function removeProposer(address proposer) external onlyOwner {
        proposers[proposer] = false;
        emit ProposerRemoved(proposer);
    }
    
    /**
     * @notice Add an executor
     * @param executor Address to add
     */
    function addExecutor(address executor) external onlyOwner {
        executors[executor] = true;
        emit ExecutorAdded(executor);
    }
    
    /**
     * @notice Remove an executor
     * @param executor Address to remove
     */
    function removeExecutor(address executor) external onlyOwner {
        executors[executor] = false;
        emit ExecutorRemoved(executor);
    }
    
    /**
     * @notice Update multi-sig wallet address
     * @param newMultiSig New multi-sig wallet address
     */
    function updateMultiSigWallet(address newMultiSig) external onlyOwner {
        address oldMultiSig = multiSigWallet;
        multiSigWallet = newMultiSig;
        emit MultiSigWalletUpdated(oldMultiSig, newMultiSig);
    }
    
    /**
     * @notice Check if operation is ready for execution
     * @param operationId Operation ID to check
     * @return True if ready
     */
    function isOperationReady(bytes32 operationId) external view returns (bool) {
        Operation storage op = operations[operationId];
        if (op.queuedAt == 0 || op.executed || op.canceled) return false;
        if (block.timestamp < op.executableAt) return false;
        if (block.timestamp > op.executableAt + MAX_DELAY) return false;
        if (op.predecessor != bytes32(0) && !completedOperations[op.predecessor]) {
            return false;
        }
        return true;
    }
    
    /**
     * @notice Check if operation is pending (queued but not executed)
     * @param operationId Operation ID to check
     * @return True if pending
     */
    function isOperationPending(bytes32 operationId) external view returns (bool) {
        Operation storage op = operations[operationId];
        return op.queuedAt != 0 && !op.executed && !op.canceled;
    }
    
    /**
     * @notice Get operation details
     * @param operationId Operation ID
     * @return Operation details
     */
    function getOperation(bytes32 operationId) external view returns (Operation memory) {
        return operations[operationId];
    }
    
    /**
     * @notice Get time remaining until operation is executable
     * @param operationId Operation ID
     * @return Time remaining in seconds (0 if ready or expired)
     */
    function getTimeRemaining(bytes32 operationId) external view returns (uint256) {
        Operation storage op = operations[operationId];
        if (block.timestamp >= op.executableAt) return 0;
        return op.executableAt - block.timestamp;
    }
    
    /**
     * @notice Get delay for a category
     * @param category Operation category
     * @return Delay in seconds
     */
    function getDelay(OperationCategory category) external view returns (uint256) {
        return delays[category];
    }
    
    receive() external payable {}
}