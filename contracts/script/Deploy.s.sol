// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {Script, console} from "forge-std/Script.sol";
import {SoulBoundToken} from "../src/SoulBoundToken.sol";
import {DAOFactory} from "../src/DAOFactory.sol";
import {ProposalManager} from "../src/ProposalManager.sol";
import {TaskMarket} from "../src/TaskMarket.sol";
import {MockDAOImplementation} from "../src/mocks/MockDAOImplementation.sol";
import {MockTokenImplementation} from "../src/mocks/MockTokenImplementation.sol";

/**
 * @title DeployScript
 * @notice Deployment script for DAO Deployer contracts
 * @dev Run with: forge script script/Deploy.s.sol --rpc-url <RPC_URL> --broadcast
 */
contract DeployScript is Script {
    
    // Configuration
    uint256 public constant MIN_REWARD = 0.01 ether;
    uint256 public constant PLATFORM_FEE = 250; // 2.5% in basis points
    uint256 public constant PROPOSAL_THRESHOLD = 100 * 10**18;
    uint256 public constant QUORUM_PERCENTAGE = 4000; // 40% in basis points
    
    function run() external {
        // Get deployment private key from environment
        uint256 deployerPrivateKey = vm.envUint("PRIVATE_KEY");
        address deployer = vm.addr(deployerPrivateKey);
        
        console.log("Deploying contracts with address:", deployer);
        
        vm.startBroadcast(deployerPrivateKey);
        
        // Step 1: Deploy mock implementations (for testing)
        // In production, replace with actual Aragon OSX implementations
        console.log("Deploying mock implementations...");
        MockDAOImplementation daoImpl = new MockDAOImplementation();
        MockTokenImplementation tokenImpl = new MockTokenImplementation();
        console.log("Mock DAO Implementation:", address(daoImpl));
        console.log("Mock Token Implementation:", address(tokenImpl));
        
        // Step 2: Deploy DAOFactory
        console.log("Deploying DAOFactory...");
        DAOFactory daoFactory = new DAOFactory(
            address(daoImpl),
            address(tokenImpl),
            deployer
        );
        console.log("DAOFactory deployed at:", address(daoFactory));
        
        // Step 3: Deploy a sample SoulBoundToken
        console.log("Deploying sample SoulBoundToken...");
        SoulBoundToken sampleToken = new SoulBoundToken(
            "Sample Governance Token",
            "SGT",
            10000000 * 10**18, // 10M max supply
            deployer
        );
        console.log("Sample Token deployed at:", address(sampleToken));
        
        // Step 4: Deploy ProposalManager
        console.log("Deploying ProposalManager...");
        ProposalManager.ProposalConfig memory proposalConfig = ProposalManager.ProposalConfig({
            votingDelay: 100,           // 100 blocks
            votingPeriod: 1000,         // 1000 blocks
            proposalThreshold: PROPOSAL_THRESHOLD,
            quorumPercentage: QUORUM_PERCENTAGE,
            executionDelay: 2 days,
            gracePeriod: 7 days
        });
        
        ProposalManager proposalManager = new ProposalManager(
            address(sampleToken),
            proposalConfig,
            deployer
        );
        console.log("ProposalManager deployed at:", address(proposalManager));
        
        // Step 5: Deploy TaskMarket
        console.log("Deploying TaskMarket...");
        TaskMarket taskMarket = new TaskMarket(
            MIN_REWARD,
            PLATFORM_FEE,
            deployer, // fee recipient
            deployer
        );
        console.log("TaskMarket deployed at:", address(taskMarket));
        
        // Step 6: Configure authorizations
        console.log("Configuring authorizations...");
        
        // Authorize proposal manager to accept tasks
        taskMarket.authorizeAcceptor(address(proposalManager));
        
        // Authorize DAO factory to mint tokens
        sampleToken.authorizeMinter(address(daoFactory));
        
        // Add deployer as dispute resolver
        taskMarket.addDisputeResolver(deployer);
        
        vm.stopBroadcast();
        
        // Log deployment summary
        console.log("\n=== Deployment Summary ===");
        console.log("Network:", block.chainid);
        console.log("Deployer:", deployer);
        console.log("");
        console.log("Core Contracts:");
        console.log("  DAOFactory:", address(daoFactory));
        console.log("  ProposalManager:", address(proposalManager));
        console.log("  TaskMarket:", address(taskMarket));
        console.log("  SampleToken:", address(sampleToken));
        console.log("");
        console.log("Implementation Contracts:");
        console.log("  DAO Implementation:", address(daoImpl));
        console.log("  Token Implementation:", address(tokenImpl));
        console.log("");
        console.log("Configuration:");
        console.log("  Platform Fee:", PLATFORM_FEE, "basis points (2.5%)");
        console.log("  Min Reward:", MIN_REWARD);
        console.log("  Proposal Threshold:", PROPOSAL_THRESHOLD);
        console.log("  Quorum Percentage:", QUORUM_PERCENTAGE, "basis points (40%)");
        console.log("");
        console.log("Authorizations configured:");
        console.log("  ProposalManager -> TaskMarket acceptor");
        console.log("  DAOFactory -> SampleToken minter");
        console.log("  Deployer -> Dispute resolver");
    }
}

/**
 * @title DeployToLocal
 * @notice Local deployment for testing
 */
contract DeployToLocal is DeployScript {
    function run() external override {
        // Use default Anvil key for local testing
        uint256 deployerPrivateKey = 0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80;
        
        vm.startBroadcast(deployerPrivateKey);
        
        MockDAOImplementation daoImpl = new MockDAOImplementation();
        MockTokenImplementation tokenImpl = new MockTokenImplementation();
        
        DAOFactory daoFactory = new DAOFactory(
            address(daoImpl),
            address(tokenImpl),
            vm.addr(deployerPrivateKey)
        );
        
        SoulBoundToken sampleToken = new SoulBoundToken(
            "Local Test Token",
            "LTT",
            1000000 * 10**18,
            vm.addr(deployerPrivateKey)
        );
        
        ProposalManager.ProposalConfig memory proposalConfig = ProposalManager.ProposalConfig({
            votingDelay: 1,
            votingPeriod: 10,
            proposalThreshold: 1,
            quorumPercentage: 3000,
            executionDelay: 0,
            gracePeriod: 1 days
        });
        
        ProposalManager proposalManager = new ProposalManager(
            address(sampleToken),
            proposalConfig,
            vm.addr(deployerPrivateKey)
        );
        
        TaskMarket taskMarket = new TaskMarket(
            0.001 ether,
            100, // 1%
            vm.addr(deployerPrivateKey),
            vm.addr(deployerPrivateKey)
        );
        
        vm.stopBroadcast();
        
        console.log("Local deployment complete!");
        console.log("DAOFactory:", address(daoFactory));
        console.log("ProposalManager:", address(proposalManager));
        console.log("TaskMarket:", address(taskMarket));
    }
}

/**
 * @title DeployProduction
 * @notice Production deployment with proper configuration
 */
contract DeployProduction is Script {
    function run() external {
        uint256 deployerPrivateKey = vm.envUint("PRIVATE_KEY");
        address deployer = vm.addr(deployerPrivateKey);
        address feeRecipient = vm.envAddress("FEE_RECIPIENT");
        
        console.log("Production deployment by:", deployer);
        console.log("Fee recipient:", feeRecipient);
        
        vm.startBroadcast(deployerPrivateKey);
        
        // In production, use actual Aragon OSX implementations
        // For now, these would be the actual deployed Aragon contracts
        address aragonDAOImpl = vm.envAddress("ARAGON_DAO_IMPL");
        address aragonTokenImpl = vm.envAddress("ARAGON_TOKEN_IMPL");
        
        DAOFactory daoFactory = new DAOFactory(
            aragonDAOImpl,
            aragonTokenImpl,
            deployer
        );
        
        vm.stopBroadcast();
        
        console.log("Production DAOFactory deployed at:", address(daoFactory));
    }
}
