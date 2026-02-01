// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

/**
 * @title MultiSigWallet
 * @author DAO Deployer
 * @notice Multi-signature wallet for critical DAO operations
 * @dev Requires multiple signatures to execute sensitive operations like:
 *      - Contract upgrades
 *      - Emergency actions
 *      - Large fund transfers
 *      - Parameter changes
 *      Uses a threshold-based approval system with configurable signers.
 */
contract MultiSigWallet is Ownable, ReentrancyGuard {
    
    /// @notice Structure for a transaction waiting for signatures
    struct Transaction {
        address to;
        uint256 value;
        bytes data;
        bool executed;
        uint256 confirmations;
        uint256 createdAt;
        uint256 expiresAt;
        string description;
    }
    
    /// @notice Structure for signer information
    struct SignerInfo {
        bool isSigner;
        uint256 addedAt;
        string role;      // e.g., "admin", "guardian", "treasury"
    }
    
    /// @notice Mapping of transaction ID to Transaction
    mapping(uint256 => Transaction) public transactions;
    
    /// @notice Mapping of transaction ID to signer address to confirmation status
    mapping(uint256 => mapping(address => bool)) public confirmations;
    
    /// @notice Mapping of signer address to their info
    mapping(address => SignerInfo) public signers;
    
    /// @notice Array of all signer addresses for iteration
    address[] public signerAddresses;
    
    /// @notice Number of required confirmations for execution
    uint256 public requiredConfirmations;
    
    /// @notice Transaction counter for ID generation
    uint256 public transactionCount;
    
    /// @notice Maximum time for a transaction to be executed (7 days)
    uint256 public constant MAX_TRANSACTION_LIFETIME = 7 days;
    
    /// @notice Minimum number of signers allowed
    uint256 public constant MIN_SIGNERS = 2;
    
    /// @notice Maximum number of signers allowed
    uint256 public constant MAX_SIGNERS = 20;
    
    /// @notice Emergency mode flag - when active, only emergency signers can execute
    bool public emergencyMode;
    
    /// @notice Mapping of emergency signers (subset with higher privileges)
    mapping(address => bool) public emergencySigners;
    
    /// @notice Events
    event TransactionSubmitted(
        uint256 indexed txId,
        address indexed submitter,
        address indexed to,
        uint256 value,
        string description
    );
    
    event TransactionConfirmed(
        uint256 indexed txId,
        address indexed signer
    );
    
    event TransactionRevoked(
        uint256 indexed txId,
        address indexed signer
    );
    
    event TransactionExecuted(
        uint256 indexed txId,
        address indexed executor,
        bool success
    );
    
    event SignerAdded(
        address indexed signer,
        string role,
        address addedBy
    );
    
    event SignerRemoved(
        address indexed signer,
        address removedBy
    );
    
    event RequiredConfirmationsChanged(
        uint256 oldRequired,
        uint256 newRequired
    );
    
    event EmergencyModeToggled(
        bool enabled,
        address toggledBy
    );
    
    event EmergencySignerAdded(
        address indexed signer
    );
    
    event EmergencySignerRemoved(
        address indexed signer
    );
    
    /// @notice Errors
    error NotSigner();
    error AlreadySigner();
    error NotEmergencySigner();
    error InvalidThreshold();
    error TransactionNotFound();
    error AlreadyConfirmed();
    error NotConfirmed();
    error AlreadyExecuted();
    error TransactionExpired();
    error InsufficientConfirmations();
    error ExecutionFailed();
    error TooManySigners();
    error TooFewSigners();
    error CannotRemoveSelf();
    error EmergencyModeActive();
    error InvalidExpiration();
    error SignerNotFound();
    
    /// @notice Modifiers
    modifier onlySigner() {
        if (!signers[msg.sender].isSigner) revert NotSigner();
        _;
    }
    
    modifier onlyEmergencySigner() {
        if (!emergencySigners[msg.sender]) revert NotEmergencySigner();
        _;
    }
    
    modifier transactionExists(uint256 txId) {
        if (txId == 0 || txId > transactionCount) revert TransactionNotFound();
        _;
    }
    
    modifier notExecuted(uint256 txId) {
        if (transactions[txId].executed) revert AlreadyExecuted();
        _;
    }
    
    modifier notExpired(uint256 txId) {
        if (block.timestamp > transactions[txId].expiresAt) {
            revert TransactionExpired();
        }
        _;
    }
    
    /**
     * @notice Constructor to initialize the multi-sig wallet
     * @param _signers Array of initial signer addresses
     * @param _roles Array of roles for each signer
     * @param _requiredConfirmations Number of confirmations required
     * @param _emergencySigners Array of emergency signer addresses
     * @param initialOwner Address of the initial owner
     */
    constructor(
        address[] memory _signers,
        string[] memory _roles,
        uint256 _requiredConfirmations,
        address[] memory _emergencySigners,
        address initialOwner
    ) Ownable(initialOwner) {
        uint256 signerCount = _signers.length;
        
        if (signerCount < MIN_SIGNERS) revert TooFewSigners();
        if (signerCount > MAX_SIGNERS) revert TooManySigners();
        if (_requiredConfirmations == 0 || _requiredConfirmations > signerCount) {
            revert InvalidThreshold();
        }
        if (_roles.length != signerCount) revert("Role count mismatch");
        
        // Add signers
        for (uint256 i = 0; i < signerCount; i++) {
            address signer = _signers[i];
            if (signer == address(0)) revert("Zero address");
            if (signers[signer].isSigner) revert AlreadySigner();
            
            signers[signer] = SignerInfo({
                isSigner: true,
                addedAt: block.timestamp,
                role: _roles[i]
            });
            signerAddresses.push(signer);
        }
        
        requiredConfirmations = _requiredConfirmations;
        
        // Set emergency signers (must be subset of signers)
        for (uint256 i = 0; i < _emergencySigners.length; i++) {
            address emSigner = _emergencySigners[i];
            if (!signers[emSigner].isSigner) revert SignerNotFound();
            emergencySigners[emSigner] = true;
        }
    }
    
    /**
     * @notice Submit a new transaction for approval
     * @param to Destination address
     * @param value ETH value to send
     * @param data Call data
     * @param description Human-readable description
     * @param expirationDays Days until transaction expires (0 for default)
     * @return txId The transaction ID
     */
    function submitTransaction(
        address to,
        uint256 value,
        bytes calldata data,
        string calldata description,
        uint256 expirationDays
    ) external onlySigner returns (uint256 txId) {
        if (to == address(0)) revert("Zero address");
        
        uint256 expiration = expirationDays == 0 
            ? MAX_TRANSACTION_LIFETIME 
            : expirationDays * 1 days;
            
        if (expiration > MAX_TRANSACTION_LIFETIME) revert InvalidExpiration();
        
        transactionCount++;
        txId = transactionCount;
        
        transactions[txId] = Transaction({
            to: to,
            value: value,
            data: data,
            executed: false,
            confirmations: 0,
            createdAt: block.timestamp,
            expiresAt: block.timestamp + expiration,
            description: description
        });
        
        emit TransactionSubmitted(txId, msg.sender, to, value, description);
        
        // Auto-confirm for submitter
        _confirmTransaction(txId);
        
        return txId;
    }
    
    /**
     * @notice Confirm a pending transaction
     * @param txId Transaction ID to confirm
     */
    function confirmTransaction(
        uint256 txId
    ) external onlySigner transactionExists(txId) notExecuted(txId) notExpired(txId) {
        _confirmTransaction(txId);
    }
    
    /**
     * @notice Internal function to confirm transaction
     */
    function _confirmTransaction(uint256 txId) internal {
        if (confirmations[txId][msg.sender]) revert AlreadyConfirmed();
        
        confirmations[txId][msg.sender] = true;
        transactions[txId].confirmations++;
        
        emit TransactionConfirmed(txId, msg.sender);
    }
    
    /**
     * @notice Revoke a previous confirmation
     * @param txId Transaction ID to revoke
     */
    function revokeConfirmation(
        uint256 txId
    ) external onlySigner transactionExists(txId) notExecuted(txId) {
        if (!confirmations[txId][msg.sender]) revert NotConfirmed();
        
        confirmations[txId][msg.sender] = false;
        transactions[txId].confirmations--;
        
        emit TransactionRevoked(txId, msg.sender);
    }
    
    /**
     * @notice Execute a confirmed transaction
     * @param txId Transaction ID to execute
     */
    function executeTransaction(
        uint256 txId
    ) 
        external 
        onlySigner 
        transactionExists(txId) 
        notExecuted(txId) 
        notExpired(txId) 
        nonReentrant 
    {
        Transaction storage txn = transactions[txId];
        
        if (txn.confirmations < requiredConfirmations) {
            revert InsufficientConfirmations();
        }
        
        // In emergency mode, only emergency signers can execute
        if (emergencyMode && !emergencySigners[msg.sender]) {
            revert NotEmergencySigner();
        }
        
        txn.executed = true;
        
        (bool success, ) = txn.to.call{value: txn.value}(txn.data);
        if (!success) revert ExecutionFailed();
        
        emit TransactionExecuted(txId, msg.sender, success);
    }
    
    /**
     * @notice Add a new signer (requires multi-sig)
     * @param newSigner Address of new signer
     * @param role Role of the signer
     */
    function addSigner(
        address newSigner,
        string calldata role
    ) external onlyOwner {
        if (newSigner == address(0)) revert("Zero address");
        if (signers[newSigner].isSigner) revert AlreadySigner();
        if (signerAddresses.length >= MAX_SIGNERS) revert TooManySigners();
        
        signers[newSigner] = SignerInfo({
            isSigner: true,
            addedAt: block.timestamp,
            role: role
        });
        signerAddresses.push(newSigner);
        
        emit SignerAdded(newSigner, role, msg.sender);
    }
    
    /**
     * @notice Remove a signer (requires multi-sig via submitTransaction)
     * @param signerToRemove Address of signer to remove
     */
    function removeSigner(address signerToRemove) external onlyOwner {
        if (!signers[signerToRemove].isSigner) revert NotSigner();
        if (signerAddresses.length <= MIN_SIGNERS) revert TooFewSigners();
        if (signerToRemove == msg.sender) revert CannotRemoveSelf();
        
        // Remove from mapping
        delete signers[signerToRemove];
        delete emergencySigners[signerToRemove];
        
        // Remove from array
        for (uint256 i = 0; i < signerAddresses.length; i++) {
            if (signerAddresses[i] == signerToRemove) {
                signerAddresses[i] = signerAddresses[signerAddresses.length - 1];
                signerAddresses.pop();
                break;
            }
        }
        
        // Adjust required confirmations if necessary
        if (requiredConfirmations > signerAddresses.length) {
            uint256 oldRequired = requiredConfirmations;
            requiredConfirmations = signerAddresses.length;
            emit RequiredConfirmationsChanged(oldRequired, requiredConfirmations);
        }
        
        emit SignerRemoved(signerToRemove, msg.sender);
    }
    
    /**
     * @notice Change required confirmations
     * @param newRequired New number of required confirmations
     */
    function changeRequiredConfirmations(uint256 newRequired) external onlyOwner {
        if (newRequired == 0 || newRequired > signerAddresses.length) {
            revert InvalidThreshold();
        }
        
        uint256 oldRequired = requiredConfirmations;
        requiredConfirmations = newRequired;
        
        emit RequiredConfirmationsChanged(oldRequired, newRequired);
    }
    
    /**
     * @notice Toggle emergency mode
     * @dev In emergency mode, only emergency signers can execute transactions
     */
    function toggleEmergencyMode() external onlyEmergencySigner {
        emergencyMode = !emergencyMode;
        emit EmergencyModeToggled(emergencyMode, msg.sender);
    }
    
    /**
     * @notice Add an emergency signer
     * @param signer Address to add as emergency signer
     */
    function addEmergencySigner(address signer) external onlyOwner {
        if (!signers[signer].isSigner) revert NotSigner();
        emergencySigners[signer] = true;
        emit EmergencySignerAdded(signer);
    }
    
    /**
     * @notice Remove an emergency signer
     * @param signer Address to remove from emergency signers
     */
    function removeEmergencySigner(address signer) external onlyOwner {
        emergencySigners[signer] = false;
        emit EmergencySignerRemoved(signer);
    }
    
    /**
     * @notice Get transaction details
     * @param txId Transaction ID
     * @return Transaction details
     */
    function getTransaction(uint256 txId) external view returns (Transaction memory) {
        return transactions[txId];
    }
    
    /**
     * @notice Check if a signer has confirmed a transaction
     * @param txId Transaction ID
     * @param signer Signer address
     * @return True if confirmed
     */
    function isConfirmed(uint256 txId, address signer) external view returns (bool) {
        return confirmations[txId][signer];
    }
    
    /**
     * @notice Get all signer addresses
     * @return Array of signer addresses
     */
    function getSigners() external view returns (address[] memory) {
        return signerAddresses;
    }
    
    /**
     * @notice Get number of signers
     * @return Count of signers
     */
    function getSignerCount() external view returns (uint256) {
        return signerAddresses.length;
    }
    
    /**
     * @notice Get pending transactions
     * @return Array of pending transaction IDs
     */
    function getPendingTransactions() external view returns (uint256[] memory) {
        uint256[] memory pending = new uint256[](transactionCount);
        uint256 count = 0;
        
        for (uint256 i = 1; i <= transactionCount; i++) {
            if (!transactions[i].executed && block.timestamp <= transactions[i].expiresAt) {
                pending[count] = i;
                count++;
            }
        }
        
        uint256[] memory result = new uint256[](count);
        for (uint256 i = 0; i < count; i++) {
            result[i] = pending[i];
        }
        
        return result;
    }
    
    /**
     * @notice Get transaction confirmation count
     * @param txId Transaction ID
     * @return Number of confirmations
     */
    function getConfirmationCount(uint256 txId) external view returns (uint256) {
        return transactions[txId].confirmations;
    }
    
    /**
     * @notice Check if transaction can be executed
     * @param txId Transaction ID
     * @return True if ready for execution
     */
    function canExecute(uint256 txId) external view returns (bool) {
        Transaction storage txn = transactions[txId];
        if (txn.executed || block.timestamp > txn.expiresAt) return false;
        if (txn.confirmations < requiredConfirmations) return false;
        if (emergencyMode && !emergencySigners[msg.sender]) return false;
        return true;
    }
    
    receive() external payable {}
}