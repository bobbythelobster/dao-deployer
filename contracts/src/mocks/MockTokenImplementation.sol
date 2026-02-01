// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {Initializable} from "@openzeppelin/contracts/proxy/utils/Initializable.sol";
import {ERC20Upgradeable} from "@openzeppelin/contracts-upgradeable/token/ERC20/ERC20Upgradeable.sol";
import {OwnableUpgradeable} from "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";

/**
 * @title MockTokenImplementation
 * @notice Mock upgradeable token implementation for testing factory
 */
contract MockTokenImplementation is Initializable, ERC20Upgradeable, OwnableUpgradeable {
    
    bool public initialized;
    mapping(address => uint256) public votingPower;
    
    event TokenInitialized(string name, string symbol, address owner);
    
    error AlreadyInitialized();
    
    function initialize(
        string memory name,
        string memory symbol,
        address initialOwner
    ) external initializer {
        if (initialized) revert AlreadyInitialized();
        
        __ERC20_init(name, symbol);
        __Ownable_init(initialOwner);
        
        initialized = true;
        
        emit TokenInitialized(name, symbol, initialOwner);
    }
    
    function mint(address to, uint256 amount) external onlyOwner {
        _mint(to, amount);
        votingPower[to] += amount;
    }
    
    function batchMint(
        address[] calldata recipients,
        uint256[] calldata amounts
    ) external onlyOwner {
        require(recipients.length == amounts.length, "Length mismatch");
        
        for (uint256 i = 0; i < recipients.length; i++) {
            _mint(recipients[i], amounts[i]);
            votingPower[recipients[i]] += amounts[i];
        }
    }
    
    function burn(uint256 amount) external {
        _burn(msg.sender, amount);
        votingPower[msg.sender] -= amount;
    }
    
    function getVotingPower(address account) external view returns (uint256) {
        return votingPower[account];
    }
    
    // Override transfer to make it soul-bound (no transfers allowed)
    function transfer(address, uint256) public pure override returns (bool) {
        revert("Token is soul-bound");
    }
    
    function transferFrom(address, address, uint256) public pure override returns (bool) {
        revert("Token is soul-bound");
    }
}
