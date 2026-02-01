# Makefile for DAO Deployer Contracts

.PHONY: help install build test coverage clean deploy-local deploy-testnet deploy-mainnet

help:
	@echo "Available commands:"
	@echo "  install        - Install dependencies"
	@echo "  build          - Compile contracts"
	@echo "  test           - Run tests"
	@echo "  test-verbose   - Run tests with verbose output"
	@echo "  coverage       - Generate coverage report"
	@echo "  clean          - Clean build artifacts"
	@echo "  format         - Format code"
	@echo "  lint           - Lint code"
	@echo "  snapshot       - Create gas snapshot"
	@echo "  anvil          - Start local Anvil node"
	@echo "  deploy-local   - Deploy to local Anvil"
	@echo "  deploy-testnet - Deploy to Sepolia testnet"
	@echo "  deploy-mainnet - Deploy to mainnet"

install:
	forge install
	npm install

build:
	forge build

test:
	forge test

test-verbose:
	forge test -vvv

test-gas:
	forge test --gas-report

coverage:
	forge coverage

coverage-report:
	forge coverage --report lcov
clean:
	forge clean
	 rm -rf out/

format:
	forge fmt

lint:
	solhint 'src/**/*.sol'

snapshot:
	forge snapshot

anvil:
	anvil --fork-url $(MAINNET_RPC_URL)

deploy-local:
	forge script script/Deploy.s.sol:DeployToLocal --fork-url http://localhost:8545 --broadcast

deploy-testnet:
	forge script script/Deploy.s.sol --rpc-url $(SEPOLIA_RPC_URL) --broadcast --verify

deploy-mainnet:
	forge script script/Deploy.s.sol --rpc-url $(MAINNET_RPC_URL) --broadcast --verify

verify:
	forge verify-contract --chain-id 1 --watch

size:
	forge build --sizes

# Generate ABIs for frontend
abis:
	mkdir -p ../src/abis
	forge build --extra-output-files abi
	cp out/SoulBoundToken.sol/SoulBoundToken.json ../src/abis/
	cp out/DAOFactory.sol/DAOFactory.json ../src/abis/
	cp out/ProposalManager.sol/ProposalManager.json ../src/abis/
	cp out/TaskMarket.sol/TaskMarket.json ../src/abis/
