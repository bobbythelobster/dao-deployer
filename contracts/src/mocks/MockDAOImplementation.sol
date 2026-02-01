// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {Initializable} from "@openzeppelin/contracts/proxy/utils/Initializable.sol";
import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";

/**
 * @title MockDAOImplementation
 * @notice Mock implementation of a DAO for testing the factory
 * @dev This is a simplified DAO implementation for testing purposes
 */
contract MockDAOImplementation is Initializable, Ownable {
    
    /// @notice DAO configuration
    struct DAOConfig {
        string name;
        string description;
        uint256 votingDelay;
        uint256 votingPeriod;
        uint256 proposalThreshold;
        uint256 quorumPercentage;
        uint256 executionDelay;
    }
    
    /// @notice Governance token address
    address public governanceToken;
    
    /// @notice DAO configuration
    DAOConfig public config;
    
    /// @notice Whether the DAO has been initialized
    bool public initialized;
    
    /// @notice Emitted when DAO is initialized
    event DAOInitialized(
        address indexed governanceToken,
        address indexed creator,
        string name,
        string description
    );
    
    /// @notice Custom error for already initialized
    error AlreadyInitialized();
    
    /**
     * @notice Initialize the DAO (called by factory via proxy)
     * @param _governanceToken Address of the governance token
     * @param _creator Address of the DAO creator
     * @param _config Encoded DAO configuration
     */
    function initialize(
        address _governanceToken,
        address _creator,
        bytes memory _config
    ) external initializer {
        if (initialized) revert AlreadyInitialized();
        
        governanceToken = _governanceToken;
        initialized = true;
        
        // Decode config
        (
            string memory name,
            string memory description,
            uint256 votingDelay,
            uint256 votingPeriod,
            uint256 proposalThreshold,
            uint256 quorumPercentage,
            uint256 executionDelay
        ) = abi.decode(_config, (string, string, uint256, uint256, uint256, uint256, uint256));
        
        config = DAOConfig({
            name: name,
            description: description,
            votingDelay: votingDelay,
            votingPeriod: votingPeriod,
            proposalThreshold: proposalThreshold,
            quorumPercentage: quorumPercentage,
            executionDelay: executionDelay
        });
        
        // Transfer ownership to creator
        _transferOwnership(_creator);
        
        emit DAOInitialized(_governanceToken, _creator, name, description);
    }
    
    /**
     * @notice Alternative initialization with explicit parameters
     * @param _governanceToken Address of the governance token
     * @param _creator Address of the DAO creator
     * @param name DAO name
     * @param description DAO description
     * @param votingDelay Voting delay in blocks
     * @param votingPeriod Voting period in blocks
     * @param proposalThreshold Minimum votes to create proposal
     * @param quorumPercentage Quorum percentage in basis points
     * @param executionDelay Delay before execution
     */
    function initializeExplicit(
        address _governanceToken,
        address _creator,
        string memory name,
        string memory description,
        uint256 votingDelay,
        uint256 votingPeriod,
        uint256 proposalThreshold,
        uint256 quorumPercentage,
        uint256 executionDelay
    ) external {
        if (initialized) revert AlreadyInitialized();
        
        governanceToken = _governanceToken;
        initialized = true;
        
        config = DAOConfig({
            name: name,
            description: description,
            votingDelay: votingDelay,
            votingPeriod: votingPeriod,
            proposalThreshold: proposalThreshold,
            quorumPercentage: quorumPercentage,
            executionDelay: executionDelay
        });
        
        _transferOwnership(_creator);
        
        emit DAOInitialized(_governanceToken, _creator, name, description);
    }
    
    /**
     * @notice Get DAO info
     */
    function getDAOInfo() external view returns (
        address token,
        string memory name,
        string memory description,
        address owner
    ) {
        return (
            governanceToken,
            config.name,
            config.description,
            owner()
        );
    }
    
    /**
     * @notice Mock function to execute a proposal
     */
    function executeProposal(bytes calldata data) external onlyOwner returns (bool) {
        // Mock execution - in real implementation this would execute actions
        (bool success, ) = address(this).call(data);
        return success;
    }
}
