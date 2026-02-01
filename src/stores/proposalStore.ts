import { createStore } from "solid-js/store";
import { createSignal } from "solid-js";
import { type Address, parseEther, formatEther } from "viem";

// Proposal Types
export type ProposalStatus = 
  | "pending"
  | "active"
  | "succeeded"
  | "defeated"
  | "queued"
  | "executed"
  | "canceled";

export type VoteType = "for" | "against" | "abstain";

export interface Vote {
  voter: Address;
  type: VoteType;
  weight: bigint;
  timestamp: number;
}

export interface Proposal {
  id: string;
  daoId: string;
  title: string;
  description: string;
  content: string;
  creator: Address;
  status: ProposalStatus;
  createdAt: number;
  startTime: number;
  endTime: number;
  executionTime?: number;
  votesFor: bigint;
  votesAgainst: bigint;
  votesAbstain: bigint;
  totalVotes: bigint;
  quorum: bigint;
  votes: Vote[];
  hasVoted: boolean;
  userVote?: VoteType;
  actions: ProposalAction[];
}

export interface ProposalAction {
  target: Address;
  value: bigint;
  data: string;
  description: string;
}

export interface CreateProposalInput {
  title: string;
  description: string;
  content: string;
  actions: ProposalAction[];
}

// Filter options
export interface ProposalFilter {
  status?: ProposalStatus | "all";
  search?: string;
  sortBy?: "newest" | "oldest" | "mostVotes";
}

// Proposal Store State
interface ProposalState {
  proposals: Proposal[];
  currentProposal: Proposal | null;
  isLoading: boolean;
  isCreating: boolean;
  error: string | null;
  filter: ProposalFilter;
}

// Create the store
const [proposalState, setProposalState] = createStore<ProposalState>({
  proposals: [],
  currentProposal: null,
  isLoading: false,
  isCreating: false,
  error: null,
  filter: {
    status: "all",
    sortBy: "newest",
  },
});

// Mock proposals for development
const mockProposals: Proposal[] = [
  {
    id: "1",
    daoId: "1",
    title: "Fund New Developer Onboarding Program",
    description: "Allocate 10 ETH to create a comprehensive developer onboarding program",
    content: `# Fund New Developer Onboarding Program

## Summary
This proposal aims to allocate 10 ETH from the treasury to create a comprehensive developer onboarding program for the DAO.

## Motivation
We need to grow our developer community and provide better resources for new contributors.

## Details
- **Amount**: 10 ETH
- **Duration**: 3 months
- **Deliverables**:
  1. Documentation portal
  2. Video tutorials
  3. Mentorship program
  4. Bounty program for contributions

## Timeline
- Month 1: Documentation and tutorials
- Month 2: Mentorship program launch
- Month 3: Bounty program and evaluation

## Success Metrics
- 50 new active developers
- 100+ contributions
- 80% satisfaction rate`,
    creator: "0x1111111111111111111111111111111111111111" as Address,
    status: "active",
    createdAt: Date.now() - 86400000,
    startTime: Date.now() - 86400000,
    endTime: Date.now() + 86400000 * 2,
    votesFor: parseEther("450"),
    votesAgainst: parseEther("50"),
    votesAbstain: parseEther("25"),
    totalVotes: parseEther("525"),
    quorum: parseEther("300"),
    votes: [],
    hasVoted: false,
    actions: [
      {
        target: "0x1234567890123456789012345678901234567890" as Address,
        value: parseEther("10"),
        data: "0x",
        description: "Transfer 10 ETH to onboarding program multisig",
      },
    ],
  },
  {
    id: "2",
    daoId: "1",
    title: "Update Governance Parameters",
    description: "Reduce voting duration from 5 days to 3 days for faster decision making",
    content: `# Update Governance Parameters

## Summary
Reduce the voting duration from 5 days to 3 days to enable faster decision making.

## Motivation
Current 5-day voting period is too slow for urgent decisions. 3 days provides sufficient time for review while enabling agility.

## Changes
- Voting Duration: 5 days → 3 days
- Execution Delay: 2 days → 1 day
- Quorum: 40% → 51%

## Rationale
Based on analysis of past 20 proposals, average voting completion happens within 48 hours. The extra 3 days rarely change outcomes.

## Risks
- Less time for thorough review
- Mitigation: Increase quorum requirement to ensure broader participation`,
    creator: "0x2222222222222222222222222222222222222222" as Address,
    status: "succeeded",
    createdAt: Date.now() - 86400000 * 5,
    startTime: Date.now() - 86400000 * 5,
    endTime: Date.now() - 86400000 * 2,
    executionTime: Date.now() - 86400000,
    votesFor: parseEther("380"),
    votesAgainst: parseEther("80"),
    votesAbstain: parseEther("20"),
    totalVotes: parseEther("480"),
    quorum: parseEther("300"),
    votes: [],
    hasVoted: true,
    userVote: "for",
    actions: [
      {
        target: "0x1234567890123456789012345678901234567890" as Address,
        value: 0n,
        data: "0x12345678",
        description: "Update voting duration parameter",
      },
    ],
  },
  {
    id: "3",
    daoId: "1",
    title: "Add New Core Contributor",
    description: "Add Alice as a core contributor with 1000 token allocation",
    content: `# Add New Core Contributor

## Summary
Add Alice (0x3333...) as a core contributor with a 1000 token allocation.

## Background
Alice has been contributing to the DAO for 6 months, completing 15 bounties and leading the documentation initiative.

## Proposal
- Mint 1000 SBT tokens to Alice's address
- Grant core contributor status
- Add to multisig with 2-of-5 signing rights

## Justification
Alice has proven commitment and expertise. This formalizes her role and aligns incentives.

## Token Allocation Breakdown
- Past contributions: 400 tokens
- Future 6-month commitment: 600 tokens`,
    creator: "0x1111111111111111111111111111111111111111" as Address,
    status: "executed",
    createdAt: Date.now() - 86400000 * 10,
    startTime: Date.now() - 86400000 * 10,
    endTime: Date.now() - 86400000 * 7,
    executionTime: Date.now() - 86400000 * 6,
    votesFor: parseEther("500"),
    votesAgainst: parseEther("10"),
    votesAbstain: parseEther("5"),
    totalVotes: parseEther("515"),
    quorum: parseEther("300"),
    votes: [],
    hasVoted: true,
    userVote: "for",
    actions: [
      {
        target: "0xabcdefabcdefabcdefabcdefabcdefabcdefabcdef" as Address,
        value: 0n,
        data: "0x40c10f19000000000000000000000000000000000000000000000000000000000000033300000000000000000000000000000000000000000000000000000000000003e8",
        description: "Mint 1000 tokens to Alice",
      },
    ],
  },
];

// Proposal Actions
export const proposalActions = {
  // Load proposals for a DAO
  async loadProposals(daoId: string) {
    setProposalState("isLoading", true);
    setProposalState("error", null);
    
    try {
      // In production, fetch from blockchain or subgraph
      await new Promise((resolve) => setTimeout(resolve, 500));
      const proposals = mockProposals.filter((p) => p.daoId === daoId);
      setProposalState("proposals", proposals);
    } catch (error) {
      setProposalState("error", error instanceof Error ? error.message : "Failed to load proposals");
    } finally {
      setProposalState("isLoading", false);
    }
  },

  // Load a specific proposal
  async loadProposal(id: string) {
    setProposalState("isLoading", true);
    setProposalState("error", null);
    
    try {
      await new Promise((resolve) => setTimeout(resolve, 300));
      const proposal = mockProposals.find((p) => p.id === id) || null;
      setProposalState("currentProposal", proposal);
    } catch (error) {
      setProposalState("error", error instanceof Error ? error.message : "Failed to load proposal");
    } finally {
      setProposalState("isLoading", false);
    }
  },

  // Create a new proposal
  async createProposal(daoId: string, input: CreateProposalInput) {
    setProposalState("isCreating", true);
    setProposalState("error", null);
    
    try {
      // In production, submit to blockchain
      await new Promise((resolve) => setTimeout(resolve, 2000));
      
      const newProposal: Proposal = {
        id: Math.random().toString(36).slice(2),
        daoId,
        title: input.title,
        description: input.description,
        content: input.content,
        creator: "0x1111111111111111111111111111111111111111" as Address,
        status: "pending",
        createdAt: Date.now(),
        startTime: Date.now() + 3600000, // Starts in 1 hour
        endTime: Date.now() + 86400000 * 3 + 3600000, // 3 days voting
        votesFor: 0n,
        votesAgainst: 0n,
        votesAbstain: 0n,
        totalVotes: 0n,
        quorum: parseEther("300"),
        votes: [],
        hasVoted: false,
        actions: input.actions,
      };

      setProposalState("proposals", (proposals) => [newProposal, ...proposals]);
      setProposalState("currentProposal", newProposal);
    } catch (error) {
      setProposalState("error", error instanceof Error ? error.message : "Failed to create proposal");
    } finally {
      setProposalState("isCreating", false);
    }
  },

  // Vote on a proposal
  async vote(proposalId: string, voteType: VoteType, weight: bigint) {
    setProposalState("isLoading", true);
    
    try {
      // In production, submit vote to blockchain
      await new Promise((resolve) => setTimeout(resolve, 1000));
      
      setProposalState("proposals", (proposals) =>
        proposals.map((p) => {
          if (p.id !== proposalId) return p;
          
          const newVote: Vote = {
            voter: "0x1111111111111111111111111111111111111111" as Address,
            type: voteType,
            weight,
            timestamp: Date.now(),
          };

          const updates: Partial<Proposal> = {
            hasVoted: true,
            userVote: voteType,
            votes: [...p.votes, newVote],
          };

          if (voteType === "for") {
            updates.votesFor = p.votesFor + weight;
          } else if (voteType === "against") {
            updates.votesAgainst = p.votesAgainst + weight;
          } else {
            updates.votesAbstain = p.votesAbstain + weight;
          }

          updates.totalVotes = (updates.votesFor || p.votesFor) + 
                              (updates.votesAgainst || p.votesAgainst) + 
                              (updates.votesAbstain || p.votesAbstain);

          return { ...p, ...updates };
        })
      );

      // Update current proposal if viewing
      if (proposalState.currentProposal?.id === proposalId) {
        proposalActions.loadProposal(proposalId);
      }
    } catch (error) {
      setProposalState("error", error instanceof Error ? error.message : "Failed to vote");
    } finally {
      setProposalState("isLoading", false);
    }
  },

  // Set filter
  setFilter(filter: Partial<ProposalFilter>) {
    setProposalState("filter", (f) => ({ ...f, ...filter }));
  },

  // Clear current proposal
  clearCurrentProposal() {
    setProposalState("currentProposal", null);
  },

  // Clear error
  clearError() {
    setProposalState("error", null);
  },
};

// Helper functions
export function getProposalStatusColor(status: ProposalStatus): string {
  const colors: Record<ProposalStatus, string> = {
    pending: "#f59e0b",
    active: "#3b82f6",
    succeeded: "#10b981",
    defeated: "#ef4444",
    queued: "#8b5cf6",
    executed: "#059669",
    canceled: "#6b7280",
  };
  return colors[status];
}

export function getProposalStatusLabel(status: ProposalStatus): string {
  const labels: Record<ProposalStatus, string> = {
    pending: "Pending",
    active: "Active",
    succeeded: "Succeeded",
    defeated: "Defeated",
    queued: "Queued",
    executed: "Executed",
    canceled: "Canceled",
  };
  return labels[status];
}

export function calculateVotePercentage(votes: bigint, total: bigint): number {
  if (total === 0n) return 0;
  return Number((votes * 100n) / total);
}

// Filter and sort proposals
export function getFilteredProposals(
  proposals: Proposal[],
  filter: ProposalFilter
): Proposal[] {
  let result = [...proposals];

  if (filter.status && filter.status !== "all") {
    result = result.filter((p) => p.status === filter.status);
  }

  if (filter.search) {
    const search = filter.search.toLowerCase();
    result = result.filter(
      (p) =>
        p.title.toLowerCase().includes(search) ||
        p.description.toLowerCase().includes(search)
    );
  }

  if (filter.sortBy) {
    switch (filter.sortBy) {
      case "newest":
        result.sort((a, b) => b.createdAt - a.createdAt);
        break;
      case "oldest":
        result.sort((a, b) => a.createdAt - b.createdAt);
        break;
      case "mostVotes":
        result.sort((a, b) => Number(b.totalVotes - a.totalVotes));
        break;
    }
  }

  return result;
}

// Export store
export { proposalState };

// Hook
export function useProposals() {
  return {
    state: proposalState,
    actions: proposalActions,
    getFiltered: () => getFilteredProposals(proposalState.proposals, proposalState.filter),
  };
}
