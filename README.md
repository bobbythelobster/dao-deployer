# DAO Deployer

A robust DAO deployment web application built with Bun, SolidJS, Viem, and Aragon OSX.

## Features

- **Aragon OSX Integration** - Deploy DAOs using the battle-tested Aragon framework
- **Soul-Bound Tokens** - Non-transferable ERC20 tokens for governance
- **Multi-Network Support** - Ethereum mainnet, Base, and L2s
- **Proposal System** - Off-chain markdown with on-chain hash verification
- **Task Market** - Bid/offer system for completing proposals
- **Threshold Voting** - Participation-based voting with time intervals

## Tech Stack

- **Runtime:** Bun
- **Frontend:** SolidJS + TypeScript
- **Blockchain:** Viem + Aragon SDK
- **Testing:** Bun test runner
- **Networks:** Ethereum, Base, L2s

## Architecture

### Smart Contracts
- `SoulBoundToken.sol` - Non-transferable governance tokens
- `DAOFactory.sol` - DAO creation factory
- `ProposalManager.sol` - Proposal lifecycle management
- `TaskMarket.sol` - Task completion marketplace

### Frontend
- DAO creation wizard
- Proposal management interface
- Voting dashboard
- Task marketplace
- Treasury management

### Integration
- Viem clients for all supported networks
- Aragon SDK for DAO operations
- IPFS for off-chain proposal storage

## Development

```bash
# Install dependencies
bun install

# Run development server
bun run dev

# Run tests
bun test

# Run tests with coverage
bun run test:coverage
```

## Deployment

The application can be deployed to any static hosting service or run as a Node.js application.

## License

MIT
