# DAO Deployer Contracts

Smart contracts for the DAO Deployer project - a comprehensive suite for creating and managing Aragon OSX compatible DAOs with soul-bound governance tokens.

## Overview

This repository contains the smart contracts for a DAO deployment and management system featuring:

- **SoulBoundToken**: Non-transferable ERC20 governance tokens
- **DAOFactory**: Factory for creating Aragon OSX compatible DAOs
- **ProposalManager**: Proposal lifecycle management with off-chain content
- **TaskMarket**: Decentralized marketplace for completing DAO tasks

## Architecture

```
┌─────────────────┐     ┌─────────────────┐     ┌─────────────────┐
│  DAOFactory     │────▶│ SoulBoundToken  │     │ ProposalManager │
│  (Factory)      │     │  (Governance)   │◄────│  (Voting)       │
└─────────────────┘     └─────────────────┘     └─────────────────┘
         │                                               │
         │                                               │
         ▼                                               ▼
┌─────────────────┐                          ┌─────────────────┐
│   DAO Proxy     │                          │   TaskMarket    │
│ (Aragon OSX)    │                          │  (Marketplace)  │
└─────────────────┘                          └─────────────────┘
```

## Contracts

### SoulBoundToken.sol
A non-transferable ERC20 token for DAO governance:
- ✅ Mintable only by authorized DAO contracts
- ✅ Burnable by token holders
- ❌ No transfers allowed (soul-bound)
- ✅ Delegatable voting power
- ✅ Batch minting for gas efficiency

### DAOFactory.sol
Factory for deploying Aragon OSX compatible DAOs:
- ✅ Creates DAOs with deterministic addresses
- ✅ Deploys custom SoulBoundToken for each DAO
- ✅ Configurable governance parameters
- ✅ Batch DAO creation
- ✅ DAO activation/deactivation

### ProposalManager.sol
Manages proposal lifecycle:
- ✅ Off-chain content storage (IPFS hash)
- ✅ Configurable voting periods
- ✅ Support for For/Against/Abstain votes
- ✅ Quorum-based proposal success
- ✅ Proposal queuing and execution

### TaskMarket.sol
Decentralized marketplace for DAO tasks:
- ✅ Create offers with ETH or ERC20 rewards
- ✅ Accept/reject offers
- ✅ Track task completion
- ✅ Dispute resolution system
- ✅ Platform fees and reputation tracking

## Installation

### Prerequisites

- [Foundry](https://book.getfoundry.sh/getting-started/installation)
- Node.js 18+

### Setup

```bash
# Install Foundry dependencies
forge install

# Install OpenZeppelin contracts
forge install OpenZeppelin/openzeppelin-contracts@v5.0.0

# Install Forge Standard Library
forge install foundry-rs/forge-std
```

## Usage

### Build

```bash
forge build
```

### Test

```bash
# Run all tests
forge test

# Run with verbose output
forge test -vvv

# Run specific test file
forge test --match-path test/SoulBoundToken.t.sol

# Generate coverage report
forge coverage --report lcov
```

### Deploy

```bash
# Local deployment (Anvil)
anvil --fork-url $MAINNET_RPC_URL
forge script script/Deploy.s.sol:DeployToLocal --fork-url http://localhost:8545 --broadcast

# Testnet deployment
forge script script/Deploy.s.sol --rpc-url $SEPOLIA_RPC_URL --broadcast --verify

# Mainnet deployment
forge script script/Deploy.s.sol --rpc-url $MAINNET_RPC_URL --broadcast --verify
```

## Contract Addresses

### Testnet (Sepolia)

| Contract | Address |
|----------|---------|
| DAOFactory | TBD |
| ProposalManager | TBD |
| TaskMarket | TBD |

### Mainnet

| Contract | Address |
|----------|---------|
| DAOFactory | TBD |
| ProposalManager | TBD |
| TaskMarket | TBD |

## Testing

The test suite covers:

- **SoulBoundToken**: 100% coverage of minting, burning, delegation, and soul-bound restrictions
- **DAOFactory**: Full coverage of DAO creation, authorization, and configuration
- **ProposalManager**: Complete proposal lifecycle testing
- **TaskMarket**: Offer creation, acceptance, completion, and dispute resolution

Run tests with gas reporting:
```bash
forge test --gas-report
```

## Gas Optimization

Key optimizations implemented:

1. **Minimal Proxy Pattern (EIP-1167)**: Used in DAOFactory for cheap DAO deployment
2. **Batch Operations**: Batch minting and voting for gas savings
3. **Custom Errors**: More gas efficient than revert strings
4. **Storage Packing**: Optimized struct layouts
5. **Unchecked Math**: Used where overflow is impossible

## Security

### Audits

- [ ] Pending audit by [Audit Firm]

### Security Considerations

1. **Soul-bound tokens**: Cannot be transferred, preventing governance attacks
2. **Access control**: Role-based permissions for sensitive operations
3. **Reentrancy protection**: Used in all external calls handling ETH
4. **Input validation**: Comprehensive checks on all user inputs

## Integration with Frontend

The contracts are designed to work with:

- **Bun**: Fast JavaScript runtime
- **SolidJS**: Reactive frontend framework
- **Viem**: TypeScript Ethereum interface

Example integration:

```typescript
import { createPublicClient, http } from 'viem'
import { mainnet } from 'viem/chains'
import { DAOFactoryABI } from './abis/DAOFactory'

const client = createPublicClient({
  chain: mainnet,
  transport: http()
})

// Read DAO info
const dao = await client.readContract({
  address: DAO_FACTORY_ADDRESS,
  abi: DAOFactoryABI,
  functionName: 'getDAO',
  args: [1]
})
```

## Contributing

1. Fork the repository
2. Create a feature branch
3. Write tests for new functionality
4. Ensure all tests pass
5. Submit a pull request

## License

MIT License - see [LICENSE](LICENSE) for details

## Resources

- [Foundry Book](https://book.getfoundry.sh/)
- [OpenZeppelin Contracts](https://docs.openzeppelin.com/contracts)
- [Aragon OSX](https://devs.aragon.org/)
- [Viem Documentation](https://viem.sh/)

## Contact

- GitHub Issues: [github.com/dao-deployer/contracts/issues](https://github.com/dao-deployer/contracts/issues)
- Discord: [discord.gg/dao-deployer](https://discord.gg/dao-deployer)
- Twitter: [@DAODeployer](https://twitter.com/DAODeployer)
