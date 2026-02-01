// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {Test, console} from "forge-std/Test.sol";
import {SoulBoundToken} from "../src/SoulBoundToken.sol";

/**
 * @title SoulBoundTokenTest
 * @notice Test suite for SoulBoundToken contract
 */
contract SoulBoundTokenTest is Test {
    SoulBoundToken public token;
    
    address public owner;
    address public user1;
    address public user2;
    address public user3;
    address public unauthorizedMinter;
    
    uint256 public constant INITIAL_SUPPLY = 1000000 * 10**18;
    uint256 public constant MAX_SUPPLY = 10000000 * 10**18;
    
    event TokensMinted(address indexed to, uint256 amount, address indexed minter);
    event TokensBurned(address indexed from, uint256 amount, address indexed burner);
    event VotingPowerDelegated(address indexed delegator, address indexed delegatee, uint256 amount);
    event VotingPowerUndelegated(address indexed delegator, address indexed delegatee, uint256 amount);
    
    function setUp() public {
        owner = address(this);
        user1 = makeAddr("user1");
        user2 = makeAddr("user2");
        user3 = makeAddr("user3");
        unauthorizedMinter = makeAddr("unauthorizedMinter");
        
        token = new SoulBoundToken(
            "Test Soul Bound Token",
            "TSBT",
            MAX_SUPPLY,
            owner
        );
        
        // Mint initial tokens
        token.mint(user1, 1000 * 10**18);
        token.mint(user2, 500 * 10**18);
        token.mint(user3, 250 * 10**18);
    }
    
    // ============ Basic Token Tests ============
    
    function test_InitialState() public view {
        assertEq(token.name(), "Test Soul Bound Token");
        assertEq(token.symbol(), "TSBT");
        assertEq(token.maxSupply(), MAX_SUPPLY);
        assertEq(token.owner(), owner);
        assertEq(token.totalSupply(), 1750 * 10**18);
    }
    
    function test_Mint() public {
        uint256 mintAmount = 100 * 10**18;
        
        vm.expectEmit(true, true, false, true);
        emit TokensMinted(user1, mintAmount, owner);
        
        token.mint(user1, mintAmount);
        
        assertEq(token.balanceOf(user1), 1100 * 10**18);
        assertEq(token.totalSupply(), 1850 * 10**18);
    }
    
    function test_Mint_RevertWhen_ZeroAddress() public {
        vm.expectRevert(SoulBoundToken.MintToZeroAddress.selector);
        token.mint(address(0), 100 * 10**18);
    }
    
    function test_Mint_RevertWhen_ZeroAmount() public {
        vm.expectRevert(SoulBoundToken.MintZeroAmount.selector);
        token.mint(user1, 0);
    }
    
    function test_Mint_RevertWhen_ExceedsMaxSupply() public {
        uint256 currentSupply = token.totalSupply();
        uint256 excessAmount = MAX_SUPPLY - currentSupply + 1;
        
        vm.expectRevert(
            abi.encodeWithSelector(
                SoulBoundToken.ERC20ExceededMaxSupply.selector,
                currentSupply + excessAmount,
                MAX_SUPPLY
            )
        );
        token.mint(user1, excessAmount);
    }
    
    function test_Mint_RevertWhen_Unauthorized() public {
        vm.prank(unauthorizedMinter);
        vm.expectRevert(SoulBoundToken.UnauthorizedMinter.selector);
        token.mint(user1, 100 * 10**18);
    }
    
    // ============ Batch Mint Tests ============
    
    function test_BatchMint() public {
        address[] memory recipients = new address[](3);
        recipients[0] = user1;
        recipients[1] = user2;
        recipients[2] = user3;
        
        uint256[] memory amounts = new uint256[](3);
        amounts[0] = 100 * 10**18;
        amounts[1] = 200 * 10**18;
        amounts[2] = 300 * 10**18;
        
        token.batchMint(recipients, amounts);
        
        assertEq(token.balanceOf(user1), 1100 * 10**18);
        assertEq(token.balanceOf(user2), 700 * 10**18);
        assertEq(token.balanceOf(user3), 550 * 10**18);
    }
    
    function test_BatchMint_RevertWhen_ArrayLengthMismatch() public {
        address[] memory recipients = new address[](2);
        recipients[0] = user1;
        recipients[1] = user2;
        
        uint256[] memory amounts = new uint256[](3);
        amounts[0] = 100 * 10**18;
        amounts[1] = 200 * 10**18;
        amounts[2] = 300 * 10**18;
        
        vm.expectRevert("Array length mismatch");
        token.batchMint(recipients, amounts);
    }
    
    // ============ Burn Tests ============
    
    function test_Burn() public {
        uint256 burnAmount = 100 * 10**18;
        uint256 initialBalance = token.balanceOf(user1);
        
        vm.prank(user1);
        vm.expectEmit(true, true, false, true);
        emit TokensBurned(user1, burnAmount, user1);
        
        token.burn(burnAmount);
        
        assertEq(token.balanceOf(user1), initialBalance - burnAmount);
    }
    
    function test_Burn_RevertWhen_ZeroAmount() public {
        vm.prank(user1);
        vm.expectRevert(SoulBoundToken.BurnZeroAmount.selector);
        token.burn(0);
    }
    
    function test_BurnFrom() public {
        uint256 burnAmount = 100 * 10**18;
        
        vm.prank(user1);
        token.approve(owner, burnAmount);
        
        token.burnFrom(user1, burnAmount);
        
        assertEq(token.balanceOf(user1), 900 * 10**18);
    }
    
    // ============ Soul-Bound Transfer Tests ============
    
    function test_Transfer_Revert() public {
        vm.prank(user1);
        vm.expectRevert(SoulBoundToken.TransferNotAllowed.selector);
        token.transfer(user2, 100 * 10**18);
    }
    
    function test_TransferFrom_Revert() public {
        vm.prank(user1);
        token.approve(user2, 100 * 10**18);
        
        vm.prank(user2);
        vm.expectRevert(SoulBoundToken.TransferNotAllowed.selector);
        token.transferFrom(user1, user2, 100 * 10**18);
    }
    
    function test_Approve_Revert() public {
        vm.expectRevert(SoulBoundToken.TransferNotAllowed.selector);
        token.approve(user2, 100 * 10**18);
    }
    
    function test_IncreaseAllowance_Revert() public {
        vm.expectRevert(SoulBoundToken.TransferNotAllowed.selector);
        token.increaseAllowance(user2, 100 * 10**18);
    }
    
    function test_DecreaseAllowance_Revert() public {
        vm.expectRevert(SoulBoundToken.TransferNotAllowed.selector);
        token.decreaseAllowance(user2, 100 * 10**18);
    }
    
    // ============ Delegation Tests ============
    
    function test_Delegate() public {
        uint256 delegateAmount = 500 * 10**18;
        
        vm.prank(user1);
        vm.expectEmit(true, true, false, true);
        emit VotingPowerDelegated(user1, user2, delegateAmount);
        
        token.delegate(user2, delegateAmount);
        
        SoulBoundToken.Delegation memory delegation = token.getDelegation(user1);
        assertEq(delegation.delegatee, user2);
        assertEq(delegation.amount, delegateAmount);
        assertEq(token.receivedDelegations(user2), delegateAmount);
        assertEq(token.totalDelegated(), delegateAmount);
    }
    
    function test_Delegate_RevertWhen_ZeroAddress() public {
        vm.prank(user1);
        vm.expectRevert("Cannot delegate to zero address");
        token.delegate(address(0), 100 * 10**18);
    }
    
    function test_Delegate_RevertWhen_Self() public {
        vm.prank(user1);
        vm.expectRevert("Cannot delegate to self");
        token.delegate(user1, 100 * 10**18);
    }
    
    function test_Delegate_RevertWhen_ZeroAmount() public {
        vm.prank(user1);
        vm.expectRevert("Cannot delegate zero");
        token.delegate(user2, 0);
    }
    
    function test_Delegate_RevertWhen_InsufficientBalance() public {
        vm.prank(user1);
        vm.expectRevert("Insufficient balance");
        token.delegate(user2, 2000 * 10**18);
    }
    
    function test_Undelegate() public {
        uint256 delegateAmount = 500 * 10**18;
        
        vm.startPrank(user1);
        token.delegate(user2, delegateAmount);
        
        vm.expectEmit(true, true, false, true);
        emit VotingPowerUndelegated(user1, user2, delegateAmount);
        
        token.undelegate();
        vm.stopPrank();
        
        SoulBoundToken.Delegation memory delegation = token.getDelegation(user1);
        assertEq(delegation.delegatee, address(0));
        assertEq(delegation.amount, 0);
        assertEq(token.receivedDelegations(user2), 0);
        assertEq(token.totalDelegated(), 0);
    }
    
    function test_Undelegate_RevertWhen_NoDelegation() public {
        vm.prank(user1);
        vm.expectRevert("No active delegation");
        token.undelegate();
    }
    
    function test_Delegate_OverwritesPrevious() public {
        vm.startPrank(user1);
        token.delegate(user2, 300 * 10**18);
        token.delegate(user3, 400 * 10**18);
        vm.stopPrank();
        
        assertEq(token.receivedDelegations(user2), 0);
        assertEq(token.receivedDelegations(user3), 400 * 10**18);
    }
    
    // ============ Voting Power Tests ============
    
    function test_GetVotingPower() public {
        assertEq(token.getVotingPower(user1), 1000 * 10**18);
        
        vm.prank(user1);
        token.delegate(user2, 500 * 10**18);
        
        // user1 has 500 (balance - delegated)
        assertEq(token.getVotingPower(user1), 500 * 10**18);
        // user2 has 500 (balance) + 500 (received) = 1000
        assertEq(token.getVotingPower(user2), 1000 * 10**18);
    }
    
    // ============ Authorized Minter Tests ============
    
    function test_AuthorizeMinter() public {
        token.authorizeMinter(user1);
        assertTrue(token.isAuthorizedMinter(user1));
        
        vm.prank(user1);
        token.mint(user2, 100 * 10**18);
        assertEq(token.balanceOf(user2), 600 * 10**18);
    }
    
    function test_RevokeMinter() public {
        token.authorizeMinter(user1);
        token.revokeMinter(user1);
        
        assertFalse(token.authorizedMinters(user1));
        
        vm.prank(user1);
        vm.expectRevert(SoulBoundToken.UnauthorizedMinter.selector);
        token.mint(user2, 100 * 10**18);
    }
    
    // ============ Token Info Tests ============
    
    function test_GetTokenInfo() public view {
        (
            string memory name,
            string memory symbol,
            uint256 totalSupply,
            uint256 maxSupply,
            uint256 totalDelegated
        ) = token.getTokenInfo();
        
        assertEq(name, "Test Soul Bound Token");
        assertEq(symbol, "TSBT");
        assertEq(totalSupply, 1750 * 10**18);
        assertEq(maxSupply, MAX_SUPPLY);
        assertEq(totalDelegated, 0);
    }
    
    // ============ Fuzz Tests ============
    
    function testFuzz_Mint(uint256 amount) public {
        vm.assume(amount > 0 && amount <= MAX_SUPPLY - token.totalSupply());
        
        uint256 initialSupply = token.totalSupply();
        
        token.mint(user1, amount);
        
        assertEq(token.totalSupply(), initialSupply + amount);
        assertEq(token.balanceOf(user1), 1000 * 10**18 + amount);
    }
    
    function testFuzz_Delegate(uint256 amount) public {
        uint256 balance = token.balanceOf(user1);
        vm.assume(amount > 0 && amount <= balance);
        
        vm.prank(user1);
        token.delegate(user2, amount);
        
        assertEq(token.receivedDelegations(user2), amount);
    }
}
