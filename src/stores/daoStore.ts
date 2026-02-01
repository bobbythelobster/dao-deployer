import { createStore } from "solid-js/store";
import { createSignal, createEffect } from "solid-js";
import { type Address, formatEther, parseEther } from "viem";

// DAO Types
export interface DAO {
  id: string;
  address: Address;
  name: string;
  description: string;
  tokenAddress: Address;
  tokenName: string;
  tokenSymbol: string;
  tokenTotalSupply: bigint;
  createdAt: number;
  creator: Address;
  members: number;
  proposalsCount: number;
  activeProposals: number;
  treasuryBalance: bigint;
  governanceParams: GovernanceParams;
}

export interface GovernanceParams {
  votingThreshold: bigint;
  votingDuration: number;
  executionDelay: number;
  quorum: number;
  proposalThreshold: bigint;
}

export interface TokenConfig {
  name: string;
  symbol: string;
  initialSupply: string;
  maxSupply: string;
  decimals: number;
}

export interface DAOConfig {
  name: string;
  description: string;
  tokenConfig: TokenConfig;
  governanceParams: GovernanceParams;
}

// Deployment status
export type DeploymentStep = 
  | "idle"
  | "preparing"
  | "deploying_token"
  | "deploying_dao"
  | "configuring"
  | "verifying"
  | "completed"
  | "failed";

export interface DeploymentStatus {
  step: DeploymentStep;
  progress: number;
  message: string;
  txHash?: string;
  contractAddress?: Address;
  error?: string;
}

// DAO Store State
interface DAOState {
  daos: DAO[];
  currentDAO: DAO | null;
  deploymentStatus: DeploymentStatus;
  isLoading: boolean;
  error: string | null;
}

// Create the store
const [daoState, setDAOState] = createStore<DAOState>({
  daos: [],
  currentDAO: null,
  deploymentStatus: {
    step: "idle",
    progress: 0,
    message: "",
  },
  isLoading: false,
  error: null,
});

// Mock DAOs for development
const mockDAOs: DAO[] = [
  {
    id: "1",
    address: "0x1234567890123456789012345678901234567890" as Address,
    name: "Developer DAO",
    description: "A DAO for developers to collaborate and fund open source projects",
    tokenAddress: "0xabcdefabcdefabcdefabcdefabcdefabcdefabcdef" as Address,
    tokenName: "Developer Token",
    tokenSymbol: "DEV",
    tokenTotalSupply: parseEther("1000000"),
    createdAt: Date.now() - 86400000 * 30,
    creator: "0x1111111111111111111111111111111111111111" as Address,
    members: 42,
    proposalsCount: 15,
    activeProposals: 3,
    treasuryBalance: parseEther("50.5"),
    governanceParams: {
      votingThreshold: parseEther("100"),
      votingDuration: 86400 * 3, // 3 days
      executionDelay: 86400, // 1 day
      quorum: 51, // 51%
      proposalThreshold: parseEther("10"),
    },
  },
  {
    id: "2",
    address: "0x2345678901234567890123456789012345678901" as Address,
    name: "Community Grants DAO",
    description: "Funding community initiatives and public goods",
    tokenAddress: "0xbcdefabcdefabcdefabcdefabcdefabcdefabcde" as Address,
    tokenName: "Community Token",
    tokenSymbol: "COMM",
    tokenTotalSupply: parseEther("500000"),
    createdAt: Date.now() - 86400000 * 15,
    creator: "0x2222222222222222222222222222222222222222" as Address,
    members: 128,
    proposalsCount: 8,
    activeProposals: 2,
    treasuryBalance: parseEther("125.75"),
    governanceParams: {
      votingThreshold: parseEther("50"),
      votingDuration: 86400 * 5, // 5 days
      executionDelay: 86400 * 2, // 2 days
      quorum: 40, // 40%
      proposalThreshold: parseEther("5"),
    },
  },
];

// DAO Actions
export const daoActions = {
  // Load all DAOs
  async loadDAOs() {
    setDAOState("isLoading", true);
    setDAOState("error", null);
    
    try {
      // In production, this would fetch from the blockchain or subgraph
      // For now, use mock data
      await new Promise((resolve) => setTimeout(resolve, 500));
      setDAOState("daos", mockDAOs);
    } catch (error) {
      setDAOState("error", error instanceof Error ? error.message : "Failed to load DAOs");
    } finally {
      setDAOState("isLoading", false);
    }
  },

  // Load a specific DAO
  async loadDAO(id: string) {
    setDAOState("isLoading", true);
    setDAOState("error", null);
    
    try {
      // In production, fetch from blockchain
      await new Promise((resolve) => setTimeout(resolve, 300));
      const dao = mockDAOs.find((d) => d.id === id) || null;
      setDAOState("currentDAO", dao);
    } catch (error) {
      setDAOState("error", error instanceof Error ? error.message : "Failed to load DAO");
    } finally {
      setDAOState("isLoading", false);
    }
  },

  // Deploy a new DAO
  async deployDAO(config: DAOConfig) {
    setDAOState("deploymentStatus", {
      step: "preparing",
      progress: 10,
      message: "Preparing deployment...",
    });

    const steps: { step: DeploymentStep; message: string; progress: number }[] = [
      { step: "deploying_token", message: "Deploying Soul-Bound Token...", progress: 30 },
      { step: "deploying_dao", message: "Deploying DAO Core...", progress: 50 },
      { step: "configuring", message: "Configuring governance parameters...", progress: 70 },
      { step: "verifying", message: "Verifying contracts...", progress: 90 },
      { step: "completed", message: "Deployment complete!", progress: 100 },
    ];

    try {
      for (const step of steps) {
        await new Promise((resolve) => setTimeout(resolve, 1500));
        setDAOState("deploymentStatus", {
          step: step.step,
          progress: step.progress,
          message: step.message,
          txHash: `0x${Math.random().toString(16).slice(2)}${Math.random().toString(16).slice(2)}`,
        });
      }

      // Add the new DAO to the list
      const newDAO: DAO = {
        id: Math.random().toString(36).slice(2),
        address: `0x${Math.random().toString(16).slice(2, 42)}` as Address,
        name: config.name,
        description: config.description,
        tokenAddress: `0x${Math.random().toString(16).slice(2, 42)}` as Address,
        tokenName: config.tokenConfig.name,
        tokenSymbol: config.tokenConfig.symbol,
        tokenTotalSupply: parseEther(config.tokenConfig.initialSupply),
        createdAt: Date.now(),
        creator: "0x1111111111111111111111111111111111111111" as Address,
        members: 1,
        proposalsCount: 0,
        activeProposals: 0,
        treasuryBalance: 0n,
        governanceParams: config.governanceParams,
      };

      setDAOState("daos", (daos) => [...daos, newDAO]);
      setDAOState("currentDAO", newDAO);
    } catch (error) {
      setDAOState("deploymentStatus", {
        step: "failed",
        progress: 0,
        message: "Deployment failed",
        error: error instanceof Error ? error.message : "Unknown error",
      });
    }
  },

  // Reset deployment status
  resetDeployment() {
    setDAOState("deploymentStatus", {
      step: "idle",
      progress: 0,
      message: "",
    });
  },

  // Clear current DAO
  clearCurrentDAO() {
    setDAOState("currentDAO", null);
  },

  // Clear error
  clearError() {
    setDAOState("error", null);
  },
};

// Helper functions
export function formatTokenAmount(amount: bigint, decimals: number = 18): string {
  return formatEther(amount);
}

export function formatDuration(seconds: number): string {
  const days = Math.floor(seconds / 86400);
  const hours = Math.floor((seconds % 86400) / 3600);
  
  if (days > 0) {
    return `${days} day${days > 1 ? "s" : ""}${hours > 0 ? ` ${hours}h` : ""}`;
  }
  return `${hours} hour${hours > 1 ? "s" : ""}`;
}

// Export store
export { daoState };

// Hook
export function useDAO() {
  return {
    state: daoState,
    actions: daoActions,
  };
}
