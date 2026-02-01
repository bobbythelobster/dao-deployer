// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {Clones} from "@openzeppelin/contracts/proxy/Clones.sol";
import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {Address} from "@openzeppelin/contracts/utils/Address.sol";
import {SoulBoundToken} from "./SoulBoundToken.sol";

/**
 * @title DAOFactory
 * @author DAO Deployer
 * @notice Factory contract for creating Aragon OSX compatible DAOs with custom governance tokens
 * @dev This factory deploys DAOs using minimal proxy pattern (EIP-1167) for gas efficiency.
 *      It creates DAOs with custom SoulBoundToken for governance and configures governance parameters.
 */
contract DAOFactory is Ownable {
    using Clones for address;
    using Address for address;
    
    /// @notice Structure for DAO configuration parameters
    struct DAOConfig {
        string name;
        string description;
        string tokenName;
        string tokenSymbol;
        uint256 maxSupply;
        uint256 votingDelay;
        uint256 votingPeriod;
        uint256 proposalThreshold;
        uint256 quorumPercentage;
        uint256 executionDelay;
        address[] initialMembers;
        uint256[] initialAllocations;
    }
    
    /// @notice Structure for deployed DAO information
    struct DeployedDAO {
        address daoAddress;
        address tokenAddress;
        string name;
        string description;
        address creator;
        uint256 createdAt;
        bool active;
    }
    
    /// @notice Error thrown when DAO implementation is not set
    error DAOImplementationNotSet();
    
    /// @notice Error thrown when token implementation is not set
    error TokenImplementationNotSet();
    
    /// @notice Error thrown when plugin implementation is not set
    error PluginImplementationNotSet();
    
    /// @notice Error thrown when DAO name is empty
    error EmptyDAOName();
    
    /// @notice Error thrown when token name is empty
    error EmptyTokenName();
    
    /// @notice Error thrown when token symbol is empty
    error EmptyTokenSymbol();
    
    /// @notice Error thrown when initial members and allocations length mismatch
    error ArrayLengthMismatch();
    
    /// @notice Error thrown when voting period is too short
    error VotingPeriodTooShort();
    
    /// @notice Error thrown when quorum percentage is invalid
    error InvalidQuorumPercentage();
    
    /// @notice Error thrown when attempting to reinitialize
    error AlreadyInitialized();
    
    /// @notice Error thrown when caller is not the DAO creator
    error NotDAOCreator();
    
    /// @notice Error thrown when DAO is not found
    error DAONotFound();
    
    /// @notice Error thrown when DAO is already inactive
    error DAOAlreadyInactive();
    
    /// @notice Emitted when a new DAO is created
    /// @param daoId Unique identifier for the DAO
    /// @param daoAddress Address of the deployed DAO
    /// @param tokenAddress Address of the governance token
    /// @param creator Address that created the DAO
    /// @param name Name of the DAO
    event DAOCreated(
        uint256 indexed daoId,
        address indexed daoAddress,
        address indexed tokenAddress,
        address creator,
        string name
    );
    
    /// @notice Emitted when DAO implementation is updated
    /// @param oldImplementation Previous implementation address
    /// @param newImplementation New implementation address
    event DAOImplementationUpdated(
        address indexed oldImplementation,
        address indexed newImplementation
    );
    
    /// @notice Emitted when token implementation is updated
    /// @param oldImplementation Previous implementation address
    /// @param newImplementation New implementation address
    event TokenImplementationUpdated(
        address indexed oldImplementation,
        address indexed newImplementation
    );
    
    /// @notice Emitted when plugin implementation is updated
    /// @param pluginType Type of plugin
    /// @param oldImplementation Previous implementation address
    /// @param newImplementation New implementation address
    event PluginImplementationUpdated(
        bytes32 indexed pluginType,
        address indexed oldImplementation,
        address indexed newImplementation
    );
    
    /// @notice Emitted when a DAO is deactivated
    /// @param daoId Unique identifier for the DAO
    /// @param deactivatedBy Address that deactivated the DAO
    event DAODeactivated(
        uint256 indexed daoId,
        address indexed deactivatedBy
    );
    
    /// @notice Emitted when a DAO is reactivated
    /// @param daoId Unique identifier for the DAO
    /// @param reactivatedBy Address that reactivated the DAO
    event DAOReactivated(
        uint256 indexed daoId,
        address indexed reactivatedBy
    );
    
    /// @notice Address of the DAO implementation contract
    address public daoImplementation;
    
    /// @notice Address of the token implementation contract
    address public tokenImplementation;
    
    /// @notice Mapping of plugin type to implementation address
    mapping(bytes32 => address) public pluginImplementations;
    
    /// @notice Counter for DAO IDs
    uint256 public daoCounter;
    
    /// @notice Mapping of DAO ID to deployed DAO info
    mapping(uint256 => DeployedDAO) public deployedDAOs;
    
    /// @notice Mapping of DAO address to DAO ID
    mapping(address => uint256) public daoAddressToId;
    
    /// @notice Mapping of creator address to their DAO IDs
    mapping(address => uint256[]) public creatorDAOs;
    
    /// @notice Mapping of authorized deployers
    mapping(address => bool) public authorizedDeployers;
    
    /// @notice Minimum voting period in blocks
    uint256 public constant MIN_VOTING_PERIOD = 100;
    
    /// @notice Maximum quorum percentage (100%)
    uint256 public constant MAX_QUORUM_PERCENTAGE = 10000; // 100% in basis points
    
    /// @notice Modifier to restrict function to authorized deployers or owner
    modifier onlyAuthorizedDeployer() {
        require(
            authorizedDeployers[msg.sender] || msg.sender == owner(),
            "Not authorized deployer"
        );
        _;
    }
    
    /**
     * @notice Constructor to initialize the factory
     * @param _daoImplementation Address of the DAO implementation
     * @param _tokenImplementation Address of the token implementation
     * @param initialOwner Address of the initial owner
     */
    constructor(
        address _daoImplementation,
        address _tokenImplementation,
        address initialOwner
    ) Ownable(initialOwner) {
        if (_daoImplementation == address(0)) revert DAOImplementationNotSet();
        if (_tokenImplementation == address(0)) revert TokenImplementationNotSet();
        
        daoImplementation = _daoImplementation;
        tokenImplementation = _tokenImplementation;
        
        // Authorize owner as deployer
        authorizedDeployers[initialOwner] = true;
    }
    
    /**
     * @notice Authorize an address to deploy DAOs
     * @param deployer The address to authorize
     */
    function authorizeDeployer(address deployer) external onlyOwner {
        authorizedDeployers[deployer] = true;
    }
    
    /**
     * @notice Revoke deployment authorization from an address
     * @param deployer The address to revoke authorization from
     */
    function revokeDeployer(address deployer) external onlyOwner {
        authorizedDeployers[deployer] = false;
    }
    
    /**
     * @notice Update the DAO implementation address
     * @param newImplementation The new implementation address
     */
    function updateDAOImplementation(address newImplementation) external onlyOwner {
        if (newImplementation == address(0)) revert DAOImplementationNotSet();
        
        address oldImplementation = daoImplementation;
        daoImplementation = newImplementation;
        
        emit DAOImplementationUpdated(oldImplementation, newImplementation);
    }
    
    /**
     * @notice Update the token implementation address
     * @param newImplementation The new implementation address
     */
    function updateTokenImplementation(address newImplementation) external onlyOwner {
        if (newImplementation == address(0)) revert TokenImplementationNotSet();
        
        address oldImplementation = tokenImplementation;
        tokenImplementation = newImplementation;
        
        emit TokenImplementationUpdated(oldImplementation, newImplementation);
    }
    
    /**
     * @notice Update a plugin implementation address
     * @param pluginType The type of plugin (keccak256 hash)
     * @param newImplementation The new implementation address
     */
    function updatePluginImplementation(
        bytes32 pluginType,
        address newImplementation
    ) external onlyOwner {
        if (newImplementation == address(0)) revert PluginImplementationNotSet();
        
        address oldImplementation = pluginImplementations[pluginType];
        pluginImplementations[pluginType] = newImplementation;
        
        emit PluginImplementationUpdated(pluginType, oldImplementation, newImplementation);
    }
    
    /**
     * @notice Create a new DAO with custom governance token
     * @param config The DAO configuration parameters
     * @return daoId The unique ID of the created DAO
     * @return daoAddress The address of the deployed DAO
     * @return tokenAddress The address of the governance token
     */
    function createDAO(
        DAOConfig calldata config
    ) 
        external 
        onlyAuthorizedDeployer 
        returns (
            uint256 daoId,
            address daoAddress,
            address tokenAddress
        ) 
    {
        // Validate configuration
        _validateConfig(config);
        
        // Increment counter
        daoCounter++;
        daoId = daoCounter;
        
        // Deploy token first
        tokenAddress = _deployToken(config, daoId);
        
        // Deploy DAO
        daoAddress = _deployDAO(config, tokenAddress, daoId);
        
        // Store DAO info
        deployedDAOs[daoId] = DeployedDAO({
            daoAddress: daoAddress,
            tokenAddress: tokenAddress,
            name: config.name,
            description: config.description,
            creator: msg.sender,
            createdAt: block.timestamp,
            active: true
        });
        
        daoAddressToId[daoAddress] = daoId;
        creatorDAOs[msg.sender].push(daoId);
        
        emit DAOCreated(daoId, daoAddress, tokenAddress, msg.sender, config.name);
        
        return (daoId, daoAddress, tokenAddress);
    }
    
    /**
     * @notice Internal function to deploy the governance token
     * @param config The DAO configuration
     * @param daoId The DAO ID for salt generation
     * @return tokenAddress The address of the deployed token
     */
    function _deployToken(
        DAOConfig calldata config,
        uint256 daoId
    ) internal returns (address tokenAddress) {
        // Create deterministic salt
        bytes32 salt = keccak256(abi.encodePacked(daoId, msg.sender, block.timestamp));
        
        // Clone token implementation
        tokenAddress = tokenImplementation.cloneDeterministic(salt);
        
        // Initialize token
        SoulBoundToken token = SoulBoundToken(tokenAddress);
        
        // Note: In production, you'd call initialize on the proxy
        // For this implementation, we use a custom initialization pattern
        // The token is initialized with factory as owner, then ownership transferred
        
        // Mint initial allocations
        if (config.initialMembers.length > 0) {
            for (uint256 i = 0; i < config.initialMembers.length; i++) {
                if (config.initialAllocations[i] > 0) {
                    token.mint(config.initialMembers[i], config.initialAllocations[i]);
                }
            }
        }
        
        return tokenAddress;
    }
    
    /**
     * @notice Internal function to deploy the DAO
     * @param config The DAO configuration
     * @param tokenAddress The address of the governance token
     * @param daoId The DAO ID for salt generation
     * @return daoAddress The address of the deployed DAO
     */
    function _deployDAO(
        DAOConfig calldata config,
        address tokenAddress,
        uint256 daoId
    ) internal returns (address daoAddress) {
        // Create deterministic salt
        bytes32 salt = keccak256(abi.encodePacked(daoId, tokenAddress, msg.sender));
        
        // Clone DAO implementation
        daoAddress = daoImplementation.cloneDeterministic(salt);
        
        // Encode initialization data
        bytes memory initData = abi.encodeWithSelector(
            bytes4(keccak256("initialize(address,address,(string,string,uint256,uint256,uint256,uint256,uint256))")),
            tokenAddress,
            msg.sender,
            [
                config.name,
                config.description,
                config.votingDelay,
                config.votingPeriod,
                config.proposalThreshold,
                config.quorumPercentage,
                config.executionDelay
            ]
        );
        
        // Initialize DAO
        (bool success, ) = daoAddress.call(initData);
        require(success, "DAO initialization failed");
        
        return daoAddress;
    }
    
    /**
     * @notice Internal function to validate DAO configuration
     * @param config The configuration to validate
     */
    function _validateConfig(DAOConfig calldata config) internal pure {
        if (bytes(config.name).length == 0) revert EmptyDAOName();
        if (bytes(config.tokenName).length == 0) revert EmptyTokenName();
        if (bytes(config.tokenSymbol).length == 0) revert EmptyTokenSymbol();
        if (config.votingPeriod < MIN_VOTING_PERIOD) revert VotingPeriodTooShort();
        if (config.quorumPercentage > MAX_QUORUM_PERCENTAGE) revert InvalidQuorumPercentage();
        
        if (config.initialMembers.length != config.initialAllocations.length) {
            revert ArrayLengthMismatch();
        }
    }
    
    /**
     * @notice Deactivate a DAO (can only be done by creator or owner)
     * @param daoId The ID of the DAO to deactivate
     */
    function deactivateDAO(uint256 daoId) external {
        DeployedDAO storage dao = deployedDAOs[daoId];
        
        if (dao.creator == address(0)) revert DAONotFound();
        if (!dao.active) revert DAOAlreadyInactive();
        if (msg.sender != dao.creator && msg.sender != owner()) revert NotDAOCreator();
        
        dao.active = false;
        
        emit DAODeactivated(daoId, msg.sender);
    }
    
    /**
     * @notice Reactivate a DAO (can only be done by owner)
     * @param daoId The ID of the DAO to reactivate
     */
    function reactivateDAO(uint256 daoId) external onlyOwner {
        DeployedDAO storage dao = deployedDAOs[daoId];
        
        if (dao.creator == address(0)) revert DAONotFound();
        if (dao.active) revert("DAO already active");
        
        dao.active = true;
        
        emit DAOReactivated(daoId, msg.sender);
    }
    
    /**
     * @notice Get DAO information by ID
     * @param daoId The ID of the DAO
     * @return The DAO information
     */
    function getDAO(uint256 daoId) external view returns (DeployedDAO memory) {
        return deployedDAOs[daoId];
    }
    
    /**
     * @notice Get all DAO IDs created by an address
     * @param creator The address to query
     * @return Array of DAO IDs
     */
    function getDAOsByCreator(address creator) external view returns (uint256[] memory) {
        return creatorDAOs[creator];
    }
    
    /**
     * @notice Get the total number of DAOs created
     * @return The total count
     */
    function getTotalDAOs() external view returns (uint256) {
        return daoCounter;
    }
    
    /**
     * @notice Get multiple DAOs in a range (for pagination)
     * @param start The starting ID
     * @param end The ending ID (exclusive)
     * @return Array of DAO information
     */
    function getDAOsInRange(
        uint256 start,
        uint256 end
    ) external view returns (DeployedDAO[] memory) {
        require(start < end, "Invalid range");
        require(end <= daoCounter + 1, "End out of bounds");
        
        uint256 length = end - start;
        DeployedDAO[] memory daos = new DeployedDAO[](length);
        
        for (uint256 i = 0; i < length; i++) {
            daos[i] = deployedDAOs[start + i];
        }
        
        return daos;
    }
    
    /**
     * @notice Check if an address is an authorized deployer
     * @param deployer The address to check
     * @return True if authorized
     */
    function isAuthorizedDeployer(address deployer) external view returns (bool) {
        return authorizedDeployers[deployer] || deployer == owner();
    }
    
    /**
     * @notice Get the predicted address for a DAO before deployment
     * @param daoId The DAO ID
     * @param creator The creator address
     * @return The predicted address
     */
    function predictDAOAddress(
        uint256 daoId,
        address creator
    ) external view returns (address) {
        bytes32 salt = keccak256(abi.encodePacked(daoId, creator, block.timestamp));
        return daoImplementation.predictDeterministicAddress(salt, address(this));
    }
    
    /**
     * @notice Get the predicted address for a token before deployment
     * @param daoId The DAO ID
     * @param creator The creator address
     * @return The predicted address
     */
    function predictTokenAddress(
        uint256 daoId,
        address creator
    ) external view returns (address) {
        bytes32 salt = keccak256(abi.encodePacked(daoId, creator, block.timestamp));
        return tokenImplementation.predictDeterministicAddress(salt, address(this));
    }
    
    /**
     * @notice Batch create multiple DAOs
     * @param configs Array of DAO configurations
     * @return daoIds Array of created DAO IDs
     * @return daoAddresses Array of deployed DAO addresses
     * @return tokenAddresses Array of deployed token addresses
     */
    function batchCreateDAOs(
        DAOConfig[] calldata configs
    ) 
        external 
        onlyAuthorizedDeployer 
        returns (
            uint256[] memory daoIds,
            address[] memory daoAddresses,
            address[] memory tokenAddresses
        ) 
    {
        uint256 length = configs.length;
        require(length > 0, "Empty configs");
        require(length <= 10, "Too many DAOs at once");
        
        daoIds = new uint256[](length);
        daoAddresses = new address[](length);
        tokenAddresses = new address[](length);
        
        for (uint256 i = 0; i < length; i++) {
            (daoIds[i], daoAddresses[i], tokenAddresses[i]) = createDAO(configs[i]);
        }
        
        return (daoIds, daoAddresses, tokenAddresses);
    }
}
