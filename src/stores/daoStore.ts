import { createStore } from "solid-js/store";
import { createSignal, createEffect } from "solid-js";
import { type Address, formatEther, parseEther } from "viem";
import { 
  withRetry, 
  CircuitBreaker,
  type RetryOptions 
} from "../utils/retry";
import { 
  uiActions 
} from "./uiStore";

// ============================================================================
// TYPES & INTERFACES
// ============================================================================

/**
 * DAO entity representing a decentralized autonomous organization
 * @interface DAO
 */
export interface DAO {
  /** Unique identifier */
  id: string;
  /** Ethereum contract address */
  address: Address;
  /** DAO name */
  name: string;
  /** DAO description */
  description: string;
  /** Token contract address */
  tokenAddress: Address;
  /** Token name */
  tokenName: string;
  /** Token symbol */
  tokenSymbol: string;
  /** Total token supply */
  tokenTotalSupply: bigint;
  /** Creation timestamp */
  createdAt: number;
  /** Creator address */
  creator: Address;
  /** Number of members */
  members: number;
  /** Total proposals count */
  proposalsCount: number;
  /** Active proposals count */
  activeProposals: number;
  /** Treasury balance in wei */
  treasuryBalance: bigint;
  /** Governance parameters */
  governanceParams: GovernanceParams;
}

/**
 * Governance parameters for voting and execution
 * @interface GovernanceParams
 */
export interface GovernanceParams {
  /** Minimum votes required for proposal to pass */
  votingThreshold: bigint;
  /** Voting period duration in seconds */
  votingDuration: number;
  /** Delay before execution in seconds */
  executionDelay: number;
  /** Quorum percentage (0-100) */
  quorum: number;
  /** Minimum tokens to create proposal */
  proposalThreshold: bigint;
}

/**
 * Token configuration for DAO creation
 * @interface TokenConfig
 */
export interface TokenConfig {
  /** Token name */
  name: string;
  /** Token symbol */
  symbol: string;
  /** Initial token supply as string */
  initialSupply: string;
  /** Maximum token supply as string */
  maxSupply: string;
  /** Token decimals (default: 18) */
  decimals: number;
}

/**
 * Complete DAO configuration for creation
 * @interface DAOConfig
 */
export interface DAOConfig {
  /** DAO name */
  name: string;
  /** DAO description */
  description: string;
  /** Token configuration */
  tokenConfig: TokenConfig;
  /** Governance parameters */
  governanceParams: GovernanceParams;
}

/**
 * Deployment step identifiers
 */
export type DeploymentStep = 
  | "idle"
  | "preparing"
  | "deploying_token"
  | "deploying_dao"
  | "configuring"
  | "verifying"
  | "completed"
  | "failed";

/**
 * Deployment status tracking
 * @interface DeploymentStatus
 */
export interface DeploymentStatus {
  /** Current deployment step */
  step: DeploymentStep;
  /** Progress percentage (0-100) */
  progress: number;
  /** Human-readable status message */
  message: string;
  /** Transaction hash if available */
  txHash?: string;
  /** Deployed contract address */
  contractAddress?: Address;
  /** Error message if failed */
  error?: string;
  /** Timestamp of status update */
  timestamp?: number;
}

/**
 * DAO store state interface
 * @interface DAOState
 */
interface DAOState {
  /** List of all DAOs */
  daos: DAO[];
  /** Currently selected DAO */
  currentDAO: DAO | null;
  /** Current deployment status */
  deploymentStatus: DeploymentStatus;
  /** Global loading state */
  isLoading: boolean;
  /** Current error message */
  error: string | null;
  /** Retry count for current operation */
  retryCount: number;
}

// ============================================================================
// INITIAL STATE
// ============================================================================

// Create the store with initial state
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
  retryCount: 0,
});

// ============================================================================
// MOCK DATA (Development Only)
// ============================================================================

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
      votingDuration: 86400 * 3,
      executionDelay: 86400,
      quorum: 51,
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
      votingDuration: 86400 * 5,
      executionDelay: 86400 * 2,
      quorum: 40,
      proposalThreshold: parseEther("5"),
    },
  },
];

// ============================================================================
// CIRCUIT BREAKERS
// ============================================================================

// Circuit breaker for DAO loading operations
const daoLoadCircuitBreaker = new CircuitBreaker({
  failureThreshold: 3,
  resetTimeout: 30000,
});

// Circuit breaker for deployment operations
const deploymentCircuitBreaker = new CircuitBreaker({
  failureThreshold: 2,
  resetTimeout: 60000,
});

// ============================================================================
// RETRY CONFIGURATION
// ============================================================================

const defaultRetryOptions: RetryOptions = {
  maxRetries: 3,
  initialDelay: 1000,
  maxDelay: 10000,
  backoffMultiplier: 2,
  onRetry: (attempt, error, delay) => {
    console.log(`Retry attempt ${attempt} after ${delay}ms: ${error.message}`);
    setDAOState("retryCount", attempt);
  },
  onFailure: (error, attempts) => {
    console.error(`Failed after ${attempts} attempts:`, error);
    setDAOState("retryCount", 0);
  },
};

// ============================================================================
// DAO ACTIONS
// ============================================================================

export const daoActions = {
  /**
   * Load all DAOs with retry logic
   * Uses circuit breaker to prevent cascading failures
   */
  async loadDAOs() {
    setDAOState("isLoading", true);
    setDAOState("error", null);
    setDAOState("retryCount", 0);
    
    try {
      // Check circuit breaker
      if (daoLoadCircuitBreaker.isOpen()) {
        throw new Error("Service temporarily unavailable. Please try again later.");
      }
      
      const result = await withRetry(async () => {
        // In production, this would fetch from the blockchain or subgraph
        // Simulate API call
        await new Promise((resolve) => setTimeout(resolve, 500));
        
        // Simulate occasional failures for testing retry
        if (Math.random() < 0.1) {
          throw new Error("Network error - simulated");
        }
        
        return mockDAOs;
      }, defaultRetryOptions);
      
      if (result.success) {
        setDAOState("daos", result.data || []);
        daoLoadCircuitBreaker.reset();
      } else {
        throw result.error || new Error("Failed to load DAOs");
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : "Failed to load DAOs";
      setDAOState("error", message);
      uiActions.error(message);
      
      // Track failure in circuit breaker
      try {
        await daoLoadCircuitBreaker.execute(async () => {
          throw error;
        });
      } catch {
        // Circuit breaker tracking
      }
    } finally {
      setDAOState("isLoading", false);
      setDAOState("retryCount", 0);
    }
  },

  /**
   * Load a specific DAO by ID
   * @param {string} id - DAO ID to load
   */
  async loadDAO(id: string) {
    setDAOState("isLoading", true);
    setDAOState("error", null);
    setDAOState("retryCount", 0);
    
    try {
      const result = await withRetry(async () => {
        // In production, fetch from blockchain
        await new Promise((resolve) => setTimeout(resolve, 300));
        
        const dao = mockDAOs.find((d) => d.id === id);
        if (!dao) {
          throw new Error(`DAO with ID ${id} not found`);
        }
        
        return dao;
      }, {
        ...defaultRetryOptions,
        maxRetries: 2,
      });
      
      if (result.success) {
        setDAOState("currentDAO", result.data || null);
      } else {
        throw result.error || new Error("Failed to load DAO");
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : "Failed to load DAO";
      setDAOState("error", message);
      uiActions.error(message);
    } finally {
      setDAOState("isLoading", false);
      setDAOState("retryCount", 0);
    }
  },

  /**
   * Deploy a new DAO with progress tracking
   * @param {DAOConfig} config - DAO configuration
   */
  async deployDAO(config: DAOConfig) {
    // Check circuit breaker
    if (deploymentCircuitBreaker.isOpen()) {
      const message = "Deployment service temporarily unavailable. Please try again later.";
      setDAOState("deploymentStatus", {
        step: "failed",
        progress: 0,
        message,
        error: message,
        timestamp: Date.now(),
      });
      uiActions.error(message);
      return;
    }
    
    setDAOState("deploymentStatus", {
      step: "preparing",
      progress: 10,
      message: "Preparing deployment...",
      timestamp: Date.now(),
    });

    const steps: { 
      step: DeploymentStep; 
      message: string; 
      progress: number;
      duration: number;
    }[] = [
      { step: "deploying_token", message: "Deploying Soul-Bound Token...", progress: 30, duration: 2000 },
      { step: "deploying_dao", message: "Deploying DAO Core...", progress: 50, duration: 2000 },
      { step: "configuring", message: "Configuring governance parameters...", progress: 70, duration: 1500 },
      { step: "verifying", message: "Verifying contracts on Etherscan...", progress: 90, duration: 1500 },
      { step: "completed", message: "Deployment complete!", progress: 100, duration: 500 },
    ];

    try {
      for (const step of steps) {
        // Update status
        setDAOState("deploymentStatus", {
          step: step.step,
          progress: step.progress,
          message: step.message,
          txHash: `0x${Math.random().toString(16).slice(2)}${Math.random().toString(16).slice(2)}`,
          timestamp: Date.now(),
        });

        // Simulate step execution with retry
        await withRetry(async () => {
          await new Promise((resolve) => setTimeout(resolve, step.duration));
          
          // Simulate occasional failures
          if (Math.random() < 0.05) {
            throw new Error(`Failed during ${step.step}`);
          }
        }, {
          maxRetries: 2,
          initialDelay: 500,
          onRetry: (attempt) => {
            setDAOState("deploymentStatus", {
              ...daoState.deploymentStatus,
              message: `${step.message} (Retry ${attempt})`,
            });
          },
        });
      }

      // Create the new DAO
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
      
      // Reset circuit breaker on success
      deploymentCircuitBreaker.reset();
      
      uiActions.success(`DAO "${config.name}" deployed successfully!`);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "Deployment failed";
      
      setDAOState("deploymentStatus", {
        step: "failed",
        progress: 0,
        message: "Deployment failed",
        error: errorMessage,
        timestamp: Date.now(),
      });
      
      uiActions.error(`Deployment failed: ${errorMessage}`);
      
      // Track failure in circuit breaker
      try {
        await deploymentCircuitBreaker.execute(async () => {
          throw error;
        });
      } catch {
        // Circuit breaker tracking
      }
    }
  },

  /**
   * Retry a failed deployment
   */
  async retryDeployment() {
    if (daoState.deploymentStatus.step === "failed") {
      const lastConfig = daoState.currentDAO ? {
        name: daoState.currentDAO.name,
        description: daoState.currentDAO.description,
        tokenConfig: {
          name: daoState.currentDAO.tokenName,
          symbol: daoState.currentDAO.tokenSymbol,
          initialSupply: formatEther(daoState.currentDAO.tokenTotalSupply),
          maxSupply: formatEther(daoState.currentDAO.tokenTotalSupply * 10n),
          decimals: 18,
        },
        governanceParams: daoState.currentDAO.governanceParams,
      } : null;
      
      if (lastConfig) {
        uiActions.info("Retrying deployment...");
        await this.deployDAO(lastConfig);
      }
    }
  },

  /**
   * Reset deployment status to idle
   */
  resetDeployment() {
    setDAOState("deploymentStatus", {
      step: "idle",
      progress: 0,
      message: "",
    });
  },

  /**
   * Clear the currently selected DAO
   */
  clearCurrentDAO() {
    setDAOState("currentDAO", null);
  },

  /**
   * Clear any error message
   */
  clearError() {
    setDAOState("error", null);
  },

  /**
   * Refresh DAO data with retry
   * @param {string} id - DAO ID to refresh
   */
  async refreshDAO(id: string) {
    setDAOState("isLoading", true);
    
    try {
      const result = await withRetry(async () => {
        // Fetch fresh data
        await new Promise((resolve) => setTimeout(resolve, 300));
        const dao = mockDAOs.find((d) => d.id === id);
        if (!dao) throw new Error("DAO not found");
        return dao;
      }, defaultRetryOptions);
      
      if (result.success && result.data) {
        // Update in list
        setDAOState("daos", (daos) => 
          daos.map((d) => d.id === id ? result.data! : d)
        );
        
        // Update current if selected
        if (daoState.currentDAO?.id === id) {
          setDAOState("currentDAO", result.data);
        }
        
        uiActions.success("DAO data refreshed");
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : "Failed to refresh DAO";
      uiActions.error(message);
    } finally {
      setDAOState("isLoading", false);
    }
  },
};

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

/**
 * Formats a token amount for display
 * @param {bigint} amount - Amount in wei
 * @param {number} [decimals=18] - Token decimals
 * @returns {string} Formatted amount
 */
export function formatTokenAmount(amount: bigint, decimals: number = 18): string {
  return formatEther(amount);
}

/**
 * Formats a duration in seconds to a human-readable string
 * @param {number} seconds - Duration in seconds
 * @returns {string} Formatted duration
 */
export function formatDuration(seconds: number): string {
  const days = Math.floor(seconds / 86400);
  const hours = Math.floor((seconds % 86400) / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  
  if (days > 0) {
    return `${days} day${days > 1 ? "s" : ""}${hours > 0 ? ` ${hours}h` : ""}`;
  }
  if (hours > 0) {
    return `${hours} hour${hours > 1 ? "s" : ""}${minutes > 0 ? ` ${minutes}m` : ""}`;
  }
  return `${minutes} minute${minutes > 1 ? "s" : ""}`;
}

/**
 * Gets the circuit breaker status for monitoring
 * @returns {Object} Circuit breaker states
 */
export function getCircuitBreakerStatus(): {
  daoLoad: ReturnType<typeof daoLoadCircuitBreaker.getStats>;
  deployment: ReturnType<typeof deploymentCircuitBreaker.getStats>;
} {
  return {
    daoLoad: daoLoadCircuitBreaker.getStats(),
    deployment: deploymentCircuitBreaker.getStats(),
  };
}

// ============================================================================
// EXPORTS
// ============================================================================

export { daoState };

/**
 * Hook to access DAO store
 * @returns {Object} DAO state and actions
 */
export function useDAO() {
  return {
    state: daoState,
    actions: daoActions,
  };
}
