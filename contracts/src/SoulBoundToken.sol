// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {ERC20} from "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import {ERC20Burnable} from "@openzeppelin/contracts/token/ERC20/extensions/ERC20Burnable.sol";
import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";

/**
 * @title SoulBoundToken
 * @author DAO Deployer
 * @notice A non-transferable ERC20 token for DAO governance
 * @dev This token is "soul-bound" meaning it cannot be transferred between addresses.
 *      It is minted by the DAO and used for voting power. The token can be burned.
 *      This implementation overrides all transfer functions to prevent transfers.
 */
contract SoulBoundToken is ERC20, ERC20Burnable, Ownable {
    
    /// @notice Error thrown when a transfer is attempted (tokens are soul-bound)
    error TransferNotAllowed();
    
    /// @notice Error thrown when minting to the zero address
    error MintToZeroAddress();
    
    /// @notice Error thrown when minting zero tokens
    error MintZeroAmount();
    
    /// @notice Error thrown when burning from the zero address
    error BurnFromZeroAddress();
    
    /// @notice Error thrown when burning zero tokens
    error BurnZeroAmount();
    
    /// @notice Error thrown when unauthorized address tries to mint
    error UnauthorizedMinter();
    
    /// @notice Error thrown when minter is already authorized
    error MinterAlreadyAuthorized();
    
    /// @notice Error thrown when minter is not authorized
    error MinterNotAuthorized();
    
    /// @notice Error thrown when batch mint total overflows
    error BatchMintOverflow();
    
    /// @notice Emitted when voting power is delegated
    /// @param delegator The address delegating voting power
    /// @param delegatee The address receiving delegated voting power
    /// @param amount The amount of voting power delegated
    event VotingPowerDelegated(
        address indexed delegator,
        address indexed delegatee,
        uint256 amount
    );
    
    /// @notice Emitted when voting power is undelegated
    /// @param delegator The address removing delegation
    /// @param delegatee The address that was delegated to
    /// @param amount The amount of voting power removed from delegation
    event VotingPowerUndelegated(
        address indexed delegator,
        address indexed delegatee,
        uint256 amount
    );
    
    /// @notice Emitted when tokens are minted
    /// @param to The address receiving the tokens
    /// @param amount The amount of tokens minted
    /// @param minter The address that performed the mint
    event TokensMinted(
        address indexed to,
        uint256 amount,
        address indexed minter
    );
    
    /// @notice Emitted when tokens are burned
    /// @param from The address whose tokens were burned
    /// @param amount The amount of tokens burned
    /// @param burner The address that performed the burn
    event TokensBurned(
        address indexed from,
        uint256 amount,
        address indexed burner
    );
    
    /// @notice Structure to track delegation information
    /// @dev Packed to save gas: address (20 bytes) + uint96 (12 bytes) + uint64 (8 bytes) = 2 slots
    struct Delegation {
        address delegatee;
        uint96 amount;
        uint64 delegatedAt;
    }
    
    /// @notice Mapping of delegator to their delegation info
    mapping(address => Delegation) public delegations;
    
    /// @notice Mapping of delegatee to total delegated voting power
    mapping(address => uint256) public receivedDelegations;
    
    /// @notice Mapping of authorized minters (DAO contracts)
    mapping(address => bool) public authorizedMinters;
    
    /// @notice The maximum total supply of tokens
    uint256 public immutable maxSupply;
    
    /// @notice The total amount of tokens currently delegated
    uint256 public totalDelegated;
    
    /// @notice Modifier to restrict function to authorized minters or owner
    modifier onlyMinter() {
        if (!authorizedMinters[msg.sender] && msg.sender != owner()) {
            revert UnauthorizedMinter();
        }
        _;
    }
    
    /**
     * @notice Constructor to initialize the SoulBoundToken
     * @param name The name of the token
     * @param symbol The symbol of the token
     * @param _maxSupply The maximum total supply of tokens (0 for unlimited)
     * @param initialOwner The address of the initial owner
     */
    constructor(
        string memory name,
        string memory symbol,
        uint256 _maxSupply,
        address initialOwner
    ) ERC20(name, symbol) Ownable(initialOwner) {
        maxSupply = _maxSupply;
        
        // Authorize the owner as a minter by default
        authorizedMinters[initialOwner] = true;
    }
    
    /**
     * @notice Authorize an address to mint tokens
     * @param minter The address to authorize
     */
    function authorizeMinter(address minter) external onlyOwner {
        authorizedMinters[minter] = true;
    }
    
    /**
     * @notice Revoke minting authorization from an address
     * @param minter The address to revoke authorization from
     */
    function revokeMinter(address minter) external onlyOwner {
        authorizedMinters[minter] = false;
    }
    
    /**
     * @notice Check if an address is an authorized minter
     * @param minter The address to check
     * @return True if the address is authorized, false otherwise
     */
    function isAuthorizedMinter(address minter) external view returns (bool) {
        return authorizedMinters[minter] || minter == owner();
    }
    
    /**
     * @notice Mint new tokens to a specified address
     * @dev Only authorized minters can mint
     * @param to The address to mint tokens to
     * @param amount The amount of tokens to mint
     */
    function mint(address to, uint256 amount) external onlyMinter {
        if (to == address(0)) revert MintToZeroAddress();
        if (amount == 0) revert MintZeroAmount();
        if (maxSupply > 0 && totalSupply() + amount > maxSupply) {
            revert ERC20ExceededMaxSupply(totalSupply() + amount, maxSupply);
        }
        
        _mint(to, amount);
        emit TokensMinted(to, amount, msg.sender);
    }
    
    /**
     * @notice Batch mint tokens to multiple addresses
     * @dev Gas efficient for distributing tokens to many addresses
     * @param recipients Array of addresses to mint to
     * @param amounts Array of amounts to mint to each recipient
     */
    function batchMint(
        address[] calldata recipients,
        uint256[] calldata amounts
    ) external onlyMinter {
        uint256 length = recipients.length;
        if (length != amounts.length) revert("Array length mismatch");
        if (length == 0) revert("Empty arrays");
        
        uint256 totalAmount;
        for (uint256 i = 0; i < length; i++) {
            totalAmount += amounts[i];
        }
        
        if (maxSupply > 0 && totalSupply() + totalAmount > maxSupply) {
            revert ERC20ExceededMaxSupply(totalSupply() + totalAmount, maxSupply);
        }
        
        for (uint256 i = 0; i < length; i++) {
            if (recipients[i] == address(0)) revert MintToZeroAddress();
            if (amounts[i] == 0) revert MintZeroAmount();
            
            _mint(recipients[i], amounts[i]);
            emit TokensMinted(recipients[i], amounts[i], msg.sender);
        }
    }
    
    /**
     * @notice Burn tokens from the caller's account
     * @param amount The amount of tokens to burn
     */
    function burn(uint256 amount) public override {
        if (amount == 0) revert BurnZeroAmount();
        
        // Clear any delegation before burning
        if (delegations[msg.sender].amount > 0) {
            _undelegate(msg.sender);
        }
        
        super.burn(amount);
        emit TokensBurned(msg.sender, amount, msg.sender);
    }
    
    /**
     * @notice Burn tokens from a specified account (requires allowance)
     * @param account The account to burn tokens from
     * @param amount The amount of tokens to burn
     */
    function burnFrom(address account, uint256 amount) public override {
        if (account == address(0)) revert BurnFromZeroAddress();
        if (amount == 0) revert BurnZeroAmount();
        
        // Clear any delegation before burning
        if (delegations[account].amount > 0) {
            _undelegate(account);
        }
        
        super.burnFrom(account, amount);
        emit TokensBurned(account, amount, msg.sender);
    }
    
    /**
     * @notice Get the voting power of an address
     * @dev Voting power equals balance plus any delegated voting power
     * @param account The address to check
     * @return The total voting power
     */
    function getVotingPower(address account) external view returns (uint256) {
        return balanceOf(account) + receivedDelegations[account];
    }
    
    /**
     * @notice Delegate voting power to another address
     * @dev The delegator must have sufficient balance
     * @param delegatee The address to delegate voting power to
     * @param amount The amount of voting power to delegate
     */
    function delegate(address delegatee, uint256 amount) external {
        if (delegatee == address(0)) revert("Cannot delegate to zero address");
        if (delegatee == msg.sender) revert("Cannot delegate to self");
        if (amount == 0) revert("Cannot delegate zero");
        if (amount > balanceOf(msg.sender)) revert("Insufficient balance");
        
        // Remove existing delegation if any
        if (delegations[msg.sender].amount > 0) {
            _undelegate(msg.sender);
        }
        
        delegations[msg.sender] = Delegation({
            delegatee: delegatee,
            amount: amount,
            delegatedAt: block.timestamp
        });
        
        receivedDelegations[delegatee] += amount;
        totalDelegated += amount;
        
        emit VotingPowerDelegated(msg.sender, delegatee, amount);
    }
    
    /**
     * @notice Remove voting power delegation
     */
    function undelegate() external {
        if (delegations[msg.sender].amount == 0) revert("No active delegation");
        
        _undelegate(msg.sender);
    }
    
    /**
     * @notice Get delegation info for an address
     * @param delegator The address to check
     * @return The delegation information
     */
    function getDelegation(address delegator) 
        external 
        view 
        returns (Delegation memory) 
    {
        return delegations[delegator];
    }
    
    /**
     * @notice Internal function to remove delegation
     * @param delegator The address removing their delegation
     */
    function _undelegate(address delegator) internal {
        Delegation memory delegation = delegations[delegator];
        
        receivedDelegations[delegation.delegatee] -= delegation.amount;
        totalDelegated -= delegation.amount;
        
        emit VotingPowerUndelegated(
            delegator,
            delegation.delegatee,
            delegation.amount
        );
        
        delete delegations[delegator];
    }
    
    /**
     * @notice Override transfer function to prevent transfers (soul-bound)
     * @dev Always reverts with TransferNotAllowed
     */
    function transfer(address, uint256) public pure override returns (bool) {
        revert TransferNotAllowed();
    }
    
    /**
     * @notice Override transferFrom function to prevent transfers (soul-bound)
     * @dev Always reverts with TransferNotAllowed
     */
    function transferFrom(
        address,
        address,
        uint256
    ) public pure override returns (bool) {
        revert TransferNotAllowed();
    }
    
    /**
     * @notice Override approve function to prevent approvals (soul-bound)
     * @dev Always reverts with TransferNotAllowed
     */
    function approve(address, uint256) public pure override returns (bool) {
        revert TransferNotAllowed();
    }
    
    /**
     * @notice Override increaseAllowance to prevent (soul-bound)
     * @dev Always reverts with TransferNotAllowed
     */
    function increaseAllowance(
        address,
        uint256
    ) public pure override returns (bool) {
        revert TransferNotAllowed();
    }
    
    /**
     * @notice Override decreaseAllowance to prevent (soul-bound)
     * @dev Always reverts with TransferNotAllowed
     */
    function decreaseAllowance(
        address,
        uint256
    ) public pure override returns (bool) {
        revert TransferNotAllowed();
    }
    
    /**
     * @notice Custom error for exceeding max supply
     */
    error ERC20ExceededMaxSupply(uint256 totalSupply, uint256 maxSupply);
    
    /**
     * @notice Override _beforeTokenTransfer to ensure no transfers occur
     * @dev Only minting and burning are allowed
     */
    function _update(
        address from,
        address to,
        uint256 value
    ) internal override {
        // Allow minting (from == address(0)) and burning (to == address(0))
        // but prevent any other transfers
        if (from != address(0) && to != address(0)) {
            revert TransferNotAllowed();
        }
        
        super._update(from, to, value);
    }
    
    /**
     * @notice Get detailed token information
     * @return Token information struct with all relevant data
     */
    function getTokenInfo() 
        external 
        view 
        returns (
            string memory tokenName,
            string memory tokenSymbol,
            uint256 totalSupplyValue,
            uint256 maxSupplyValue,
            uint256 totalDelegatedValue
        ) 
    {
        return (
            name(),
            symbol(),
            totalSupply(),
            maxSupply,
            totalDelegated
        );
    }
}
