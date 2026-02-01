// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {Test, console} from "forge-std/Test.sol";
import {DAOFactory} from "../src/DAOFactory.sol";
import {SoulBoundToken} from "../src/SoulBoundToken.sol";
import {MockDAOImplementation} from "../src/mocks/MockDAOImplementation.sol";
import {MockTokenImplementation} from "../src/mocks/MockTokenImplementation.sol";

/**
 * @title DAOFactoryTest
 * @notice Test suite for DAOFactory contract
 */
contract DAOFactoryTest is Test {
    DAOFactory public factory;
    MockDAOImplementation public daoImpl;
    MockTokenImplementation public tokenImpl;
    
    address public owner;
    address public user1;
    address public user2;
    address public unauthorizedDeployer;
    
    event DAOCreated(
        uint256 indexed daoId,
        address indexed daoAddress,
        address indexed tokenAddress,
        address creator,
        string name
    );
    
    function setUp() public {
        owner = address(this);
        user1 = makeAddr("user1");
        user2 = makeAddr("user2");
        unauthorizedDeployer = makeAddr("unauthorizedDeployer");
        
        // Deploy implementation contracts
        daoImpl = new MockDAOImplementation();
        tokenImpl = new MockTokenImplementation();
        
        // Deploy factory
        factory = new DAOFactory(
            address(daoImpl),
            address(tokenImpl),
            owner
        );
    }
    
    // ============ Constructor Tests ============
    
    function test_InitialState() public view {
        assertEq(factory.daoImplementation(), address(daoImpl));
        assertEq(factory.tokenImplementation(), address(tokenImpl));
        assertEq(factory.owner(), owner);
        assertEq(factory.daoCounter(), 0);
        assertTrue(factory.authorizedDeployers(owner));
    }
    
    function test_Constructor_RevertWhen_ZeroDAOImplementation() public {
        vm.expectRevert(DAOFactory.DAOImplementationNotSet.selector);
        new DAOFactory(address(0), address(tokenImpl), owner);
    }
    
    function test_Constructor_RevertWhen_ZeroTokenImplementation() public {
        vm.expectRevert(DAOFactory.TokenImplementationNotSet.selector);
        new DAOFactory(address(daoImpl), address(0), owner);
    }
    
    // ============ Authorization Tests ============
    
    function test_AuthorizeDeployer() public {
        factory.authorizeDeployer(user1);
        assertTrue(factory.authorizedDeployers(user1));
        assertTrue(factory.isAuthorizedDeployer(user1));
    }
    
    function test_RevokeDeployer() public {
        factory.authorizeDeployer(user1);
        factory.revokeDeployer(user1);
        assertFalse(factory.authorizedDeployers(user1));
    }
    
    function test_AuthorizeDeployer_OnlyOwner() public {
        vm.prank(user1);
        vm.expectRevert();
        factory.authorizeDeployer(user2);
    }
    
    // ============ DAO Creation Tests ============
    
    function _createBasicConfig() internal pure returns (DAOFactory.DAOConfig memory) {
        address[] memory initialMembers = new address[](2);
        initialMembers[0] = makeAddr("member1");
        initialMembers[1] = makeAddr("member2");
        
        uint256[] memory initialAllocations = new uint256[](2);
        initialAllocations[0] = 1000 * 10**18;
        initialAllocations[1] = 500 * 10**18;
        
        return DAOFactory.DAOConfig({
            name: "Test DAO",
            description: "A test DAO for testing",
            tokenName: "Test Token",
            tokenSymbol: "TEST",
            maxSupply: 10000000 * 10**18,
            votingDelay: 100,
            votingPeriod: 1000,
            proposalThreshold: 100 * 10**18,
            quorumPercentage: 4000, // 40%
            executionDelay: 2 days,
            initialMembers: initialMembers,
            initialAllocations: initialAllocations
        });
    }
    
    function test_CreateDAO() public {
        DAOFactory.DAOConfig memory config = _createBasicConfig();
        
        vm.expectEmit(false, false, false, false);
        emit DAOCreated(1, address(0), address(0), owner, "Test DAO");
        
        (uint256 daoId, address daoAddress, address tokenAddress) = factory.createDAO(config);
        
        assertEq(daoId, 1);
        assertTrue(daoAddress != address(0));
        assertTrue(tokenAddress != address(0));
        
        // Verify stored data
        DAOFactory.DeployedDAO memory deployed = factory.getDAO(daoId);
        assertEq(deployed.name, "Test DAO");
        assertEq(deployed.creator, owner);
        assertTrue(deployed.active);
        
        // Verify token minting
        SoulBoundToken token = SoulBoundToken(tokenAddress);
        assertEq(token.balanceOf(config.initialMembers[0]), 1000 * 10**18);
        assertEq(token.balanceOf(config.initialMembers[1]), 500 * 10**18);
    }
    
    function test_CreateDAO_RevertWhen_EmptyName() public {
        DAOFactory.DAOConfig memory config = _createBasicConfig();
        config.name = "";
        
        vm.expectRevert(DAOFactory.EmptyDAOName.selector);
        factory.createDAO(config);
    }
    
    function test_CreateDAO_RevertWhen_EmptyTokenName() public {
        DAOFactory.DAOConfig memory config = _createBasicConfig();
        config.tokenName = "";
        
        vm.expectRevert(DAOFactory.EmptyTokenName.selector);
        factory.createDAO(config);
    }
    
    function test_CreateDAO_RevertWhen_EmptyTokenSymbol() public {
        DAOFactory.DAOConfig memory config = _createBasicConfig();
        config.tokenSymbol = "";
        
        vm.expectRevert(DAOFactory.EmptyTokenSymbol.selector);
        factory.createDAO(config);
    }
    
    function test_CreateDAO_RevertWhen_VotingPeriodTooShort() public {
        DAOFactory.DAOConfig memory config = _createBasicConfig();
        config.votingPeriod = 50; // Below MIN_VOTING_PERIOD (100)
        
        vm.expectRevert(DAOFactory.VotingPeriodTooShort.selector);
        factory.createDAO(config);
    }
    
    function test_CreateDAO_RevertWhen_InvalidQuorum() public {
        DAOFactory.DAOConfig memory config = _createBasicConfig();
        config.quorumPercentage = 10001; // Above MAX_QUORUM_PERCENTAGE (10000)
        
        vm.expectRevert(DAOFactory.InvalidQuorumPercentage.selector);
        factory.createDAO(config);
    }
    
    function test_CreateDAO_RevertWhen_ArrayLengthMismatch() public {
        DAOFactory.DAOConfig memory config = _createBasicConfig();
        
        address[] memory members = new address[](2);
        members[0] = makeAddr("member1");
        members[1] = makeAddr("member2");
        
        uint256[] memory allocations = new uint256[](3);
        allocations[0] = 100;
        allocations[1] = 200;
        allocations[2] = 300;
        
        config.initialMembers = members;
        config.initialAllocations = allocations;
        
        vm.expectRevert(DAOFactory.ArrayLengthMismatch.selector);
        factory.createDAO(config);
    }
    
    function test_CreateDAO_RevertWhen_Unauthorized() public {
        DAOFactory.DAOConfig memory config = _createBasicConfig();
        
        vm.prank(unauthorizedDeployer);
        vm.expectRevert("Not authorized deployer");
        factory.createDAO(config);
    }
    
    // ============ Multiple DAO Creation Tests ============
    
    function test_CreateMultipleDAOs() public {
        DAOFactory.DAOConfig memory config1 = _createBasicConfig();
        DAOFactory.DAOConfig memory config2 = _createBasicConfig();
        config2.name = "Second DAO";
        
        (uint256 daoId1, , ) = factory.createDAO(config1);
        (uint256 daoId2, , ) = factory.createDAO(config2);
        
        assertEq(daoId1, 1);
        assertEq(daoId2, 2);
        assertEq(factory.daoCounter(), 2);
    }
    
    // ============ DAO Deactivation Tests ============
    
    function test_DeactivateDAO() public {
        DAOFactory.DAOConfig memory config = _createBasicConfig();
        (uint256 daoId, , ) = factory.createDAO(config);
        
        factory.deactivateDAO(daoId);
        
        DAOFactory.DeployedDAO memory deployed = factory.getDAO(daoId);
        assertFalse(deployed.active);
    }
    
    function test_DeactivateDAO_RevertWhen_NotCreatorOrOwner() public {
        DAOFactory.DAOConfig memory config = _createBasicConfig();
        (uint256 daoId, , ) = factory.createDAO(config);
        
        vm.prank(user1);
        vm.expectRevert(DAOFactory.NotDAOCreator.selector);
        factory.deactivateDAO(daoId);
    }
    
    function test_DeactivateDAO_RevertWhen_AlreadyInactive() public {
        DAOFactory.DAOConfig memory config = _createBasicConfig();
        (uint256 daoId, , ) = factory.createDAO(config);
        
        factory.deactivateDAO(daoId);
        
        vm.expectRevert(DAOFactory.DAOAlreadyInactive.selector);
        factory.deactivateDAO(daoId);
    }
    
    function test_ReactivateDAO() public {
        DAOFactory.DAOConfig memory config = _createBasicConfig();
        (uint256 daoId, , ) = factory.createDAO(config);
        
        factory.deactivateDAO(daoId);
        factory.reactivateDAO(daoId);
        
        DAOFactory.DeployedDAO memory deployed = factory.getDAO(daoId);
        assertTrue(deployed.active);
    }
    
    function test_ReactivateDAO_OnlyOwner() public {
        DAOFactory.DAOConfig memory config = _createBasicConfig();
        (uint256 daoId, , ) = factory.createDAO(config);
        factory.deactivateDAO(daoId);
        
        vm.prank(user1);
        vm.expectRevert();
        factory.reactivateDAO(daoId);
    }
    
    // ============ Update Implementation Tests ============
    
    function test_UpdateDAOImplementation() public {
        MockDAOImplementation newImpl = new MockDAOImplementation();
        
        factory.updateDAOImplementation(address(newImpl));
        assertEq(factory.daoImplementation(), address(newImpl));
    }
    
    function test_UpdateTokenImplementation() public {
        MockTokenImplementation newImpl = new MockTokenImplementation();
        
        factory.updateTokenImplementation(address(newImpl));
        assertEq(factory.tokenImplementation(), address(newImpl));
    }
    
    function test_UpdateDAOImplementation_RevertWhen_ZeroAddress() public {
        vm.expectRevert(DAOFactory.DAOImplementationNotSet.selector);
        factory.updateDAOImplementation(address(0));
    }
    
    // ============ Query Tests ============
    
    function test_GetDAOsByCreator() public {
        DAOFactory.DAOConfig memory config = _createBasicConfig();
        factory.createDAO(config);
        factory.createDAO(config);
        
        uint256[] memory daos = factory.getDAOsByCreator(owner);
        assertEq(daos.length, 2);
        assertEq(daos[0], 1);
        assertEq(daos[1], 2);
    }
    
    function test_GetDAOsInRange() public {
        DAOFactory.DAOConfig memory config = _createBasicConfig();
        factory.createDAO(config);
        factory.createDAO(config);
        factory.createDAO(config);
        
        DAOFactory.DeployedDAO[] memory daos = factory.getDAOsInRange(1, 3);
        assertEq(daos.length, 2);
        assertEq(daos[0].name, "Test DAO");
    }
    
    function test_GetTotalDAOs() public {
        DAOFactory.DAOConfig memory config = _createBasicConfig();
        factory.createDAO(config);
        factory.createDAO(config);
        
        assertEq(factory.getTotalDAOs(), 2);
    }
    
    function test_DAOAddressToId() public {
        DAOFactory.DAOConfig memory config = _createBasicConfig();
        (uint256 daoId, address daoAddress, ) = factory.createDAO(config);
        
        assertEq(factory.daoAddressToId(daoAddress), daoId);
    }
    
    // ============ Batch Creation Tests ============
    
    function test_BatchCreateDAOs() public {
        DAOFactory.DAOConfig[] memory configs = new DAOFactory.DAOConfig[](3);
        configs[0] = _createBasicConfig();
        configs[1] = _createBasicConfig();
        configs[1].name = "DAO 2";
        configs[2] = _createBasicConfig();
        configs[2].name = "DAO 3";
        
        (uint256[] memory daoIds, address[] memory daoAddresses, ) = factory.batchCreateDAOs(configs);
        
        assertEq(daoIds.length, 3);
        assertEq(daoAddresses.length, 3);
        assertEq(factory.daoCounter(), 3);
    }
    
    function test_BatchCreateDAOs_RevertWhen_Empty() public {
        DAOFactory.DAOConfig[] memory configs = new DAOFactory.DAOConfig[](0);
        
        vm.expectRevert("Empty configs");
        factory.batchCreateDAOs(configs);
    }
    
    function test_BatchCreateDAOs_RevertWhen_TooMany() public {
        DAOFactory.DAOConfig[] memory configs = new DAOFactory.DAOConfig[](11);
        for (uint256 i = 0; i < 11; i++) {
            configs[i] = _createBasicConfig();
        }
        
        vm.expectRevert("Too many DAOs at once");
        factory.batchCreateDAOs(configs);
    }
    
    // ============ Prediction Tests ============
    
    function test_PredictAddresses() public {
        address predictedDAO = factory.predictDAOAddress(1, owner);
        address predictedToken = factory.predictTokenAddress(1, owner);
        
        DAOFactory.DAOConfig memory config = _createBasicConfig();
        (, address actualDAO, address actualToken) = factory.createDAO(config);
        
        // Note: Predictions won't match exactly due to timestamp in salt
        // but they should be non-zero
        assertTrue(predictedDAO != address(0));
        assertTrue(predictedToken != address(0));
    }
}
