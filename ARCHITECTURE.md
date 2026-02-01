# DAO Deployer Architecture

## Overview

This document describes the architecture of the DAO Deployer application.

## System Components

### 1. Smart Contract Layer

**SoulBoundToken.sol**
- ERC20 compliant but non-transferable
- Mintable by DAO only
- Burnable by token holder or DAO
- Tracks voting power 1:1 with balance
- No approval/transfer functionality

**DAOFactory.sol**
- Creates new Aragon OSX DAOs
- Deploys custom SoulBoundToken
- Configures governance plugins
- Sets initial permissions

**ProposalManager.sol**
- Stores proposal metadata (IPFS hash)
- Manages voting periods
- Tracks vote counts
- Handles proposal execution
- Supports threshold-based voting

**TaskMarket.sol**
- Allows creating tasks from proposals
- Supports bid/offer system
- Tracks task completion
- Handles reward distribution

### 2. Frontend Layer

**Pages**
- `/` - Landing page
- `/create` - DAO creation wizard
- `/dao/:id` - DAO dashboard
- `/dao/:id/proposals` - Proposal list
- `/dao/:id/proposals/:id` - Proposal detail
- `/dao/:id/tasks` - Task marketplace

**State Management**
- `walletStore` - Wallet connection, network
- `daoStore` - DAO data, creation flow
- `proposalStore` - Proposals, voting
- `taskStore` - Tasks, bids
- `uiStore` - Loading, errors, toasts

### 3. Integration Layer

**Viem Configuration**
- Public clients for each network
- Wallet client for transactions
- Multicall for batching
- Chain definitions

**Aragon SDK**
- DAO creation
- Plugin management
- Permission handling

**IPFS**
- Proposal content storage
- Content addressing
- Pinning service

## Data Flow

### Creating a DAO
1. User fills DAO configuration form
2. Frontend validates input
3. Deploy DAO via Aragon SDK
4. Deploy SoulBoundToken
5. Configure governance settings
6. Store DAO metadata

### Creating a Proposal
1. User writes proposal in markdown
2. Upload to IPFS
3. Store IPFS hash on-chain
4. Set voting parameters
5. Open voting period

### Voting on a Proposal
1. User connects wallet
2. Check voting power (soul-bound token balance)
3. Cast vote (yes/no)
4. Track vote count
5. Check if threshold met within time

### Completing a Task
1. Task created from approved proposal
2. Users submit bids
3. DAO votes on best bid
4. Winner completes task
5. DAO confirms completion
6. Tokens minted as reward

## Security Considerations

- Soul-bound tokens prevent vote buying
- Threshold voting prevents low-participation attacks
- Time intervals ensure fair voting periods
- IPFS ensures proposal content immutability
- Aragon OSX provides battle-tested DAO infrastructure

## Testing Strategy

- 100% contract coverage
- Integration tests for full flows
- E2E tests for user journeys
- Gas optimization tests
- Security property tests
