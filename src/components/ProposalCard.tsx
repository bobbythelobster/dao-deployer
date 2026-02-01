import { Show } from "solid-js";
import { 
  type Proposal, 
  getProposalStatusColor, 
  getProposalStatusLabel,
  calculateVotePercentage 
} from "../stores/proposalStore";
import { useNavigate } from "@solidjs/router";
import { formatEther } from "viem";

interface ProposalCardProps {
  proposal: Proposal;
  variant?: "default" | "compact";
}

export default function ProposalCard(props: ProposalCardProps) {
  const navigate = useNavigate();
  const variant = props.variant || "default";

  const formatAddress = (addr: string) => {
    return `${addr.slice(0, 6)}...${addr.slice(-4)}`;
  };

  const formatDate = (timestamp: number) => {
    return new Date(timestamp).toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
    });
  };

  const getTimeRemaining = () => {
    const now = Date.now();
    const end = props.proposal.endTime;
    
    if (now > end) return "Ended";
    
    const diff = end - now;
    const days = Math.floor(diff / (1000 * 60 * 60 * 24));
    const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
    
    if (days > 0) return `${days}d ${hours}h remaining`;
    return `${hours}h remaining`;
  };

  const totalVotes = () => {
    return props.proposal.votesFor + props.proposal.votesAgainst + props.proposal.votesAbstain;
  };

  const forPercentage = () => {
    const total = totalVotes();
    if (total === 0n) return 0;
    return Number((props.proposal.votesFor * 100n) / total);
  };

  const againstPercentage = () => {
    const total = totalVotes();
    if (total === 0n) return 0;
    return Number((props.proposal.votesAgainst * 100n) / total);
  };

  const statusColor = getProposalStatusColor(props.proposal.status);
  const statusLabel = getProposalStatusLabel(props.proposal.status);

  return (
    <div
      class={`bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 hover:shadow-lg transition-all cursor-pointer ${
        variant === "compact" ? "p-4" : "p-6"
      }`}
      onClick={() => navigate(`/proposal/${props.proposal.id}`)}
    >
      {/* Header */}
      <div class="flex items-start justify-between gap-4 mb-3">
        <div class="flex-1 min-w-0">
          <div class="flex items-center gap-2 mb-1">
            <span
              class="px-2 py-0.5 text-xs font-medium rounded-full"
              style={{
                "background-color": `${statusColor}20`,
                color: statusColor,
              }}
            >
              {statusLabel}
            </span>
            <Show when={props.proposal.hasVoted}>
              <span class="px-2 py-0.5 bg-green-100 dark:bg-green-900/50 text-green-700 dark:text-green-300 text-xs font-medium rounded-full">
                Voted
              </span>
            </Show>
          </div>
          <h3 class="font-semibold text-gray-900 dark:text-white text-lg leading-tight truncate">
            {props.proposal.title}
          </h3>
        </div>
        <Show when={props.proposal.status === "active"}>
          <span class="text-sm text-gray-500 dark:text-gray-400 whitespace-nowrap">
            {getTimeRemaining()}
          </span>
        </Show>
      </div>

      {/* Description */}
      <p class="text-gray-600 dark:text-gray-400 text-sm mb-4 line-clamp-2">
        {props.proposal.description}
      </p>

      {/* Vote Progress */}
      <Show when={totalVotes() > 0n}>
        <div class="mb-4">
          <div class="flex h-2 rounded-full overflow-hidden bg-gray-200 dark:bg-gray-700">
            <div
              class="bg-green-500 transition-all"
              style={{ width: `${forPercentage()}%` }}
            />
            <div
              class="bg-red-500 transition-all"
              style={{ width: `${againstPercentage()}%` }}
            />
            <div
              class="bg-gray-400 transition-all"
              style={{ width: `${100 - forPercentage() - againstPercentage()}%` }}
            />
          </div>
          <div class="flex justify-between text-xs text-gray-500 mt-1">
            <span class="text-green-600 dark:text-green-400">
              {forPercentage().toFixed(1)}% For
            </span>
            <span class="text-red-600 dark:text-red-400">
              {againstPercentage().toFixed(1)}% Against
            </span>
          </div>
        </div>
      </Show>

      {/* Footer */}
      <div class="flex items-center justify-between text-sm">
        <div class="flex items-center gap-4 text-gray-500 dark:text-gray-400">
          <span class="flex items-center gap-1">
            <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
            </svg>
            {formatAddress(props.proposal.creator)}
          </span>
          <Show when={variant !== "compact"}>
            <span class="flex items-center gap-1">
              <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
              </svg>
              {formatEther(totalVotes())} votes
            </span>
          </Show>
        </div>
        <span class="text-gray-400">
          {formatDate(props.proposal.createdAt)}
        </span>
      </div>
    </div>
  );
}
