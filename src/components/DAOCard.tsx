import { Show } from "solid-js";
import { type DAO, formatTokenAmount, formatDuration } from "../stores/daoStore";
import { useWallet } from "../stores/walletStore";
import { useNavigate } from "@solidjs/router";

interface DAOCardProps {
  dao: DAO;
  variant?: "default" | "compact" | "featured";
}

export default function DAOCard(props: DAOCardProps) {
  const navigate = useNavigate();
  const { state: walletState } = useWallet();
  
  const variant = props.variant || "default";

  const formatAddress = (addr: string) => {
    return `${addr.slice(0, 6)}...${addr.slice(-4)}`;
  };

  const formatDate = (timestamp: number) => {
    return new Date(timestamp).toLocaleDateString("en-US", {
      year: "numeric",
      month: "short",
      day: "numeric",
    });
  };

  const isCreator = () => {
    return walletState.address?.toLowerCase() === props.dao.creator.toLowerCase();
  };

  const cardClasses = {
    default: "bg-white dark:bg-gray-800 rounded-xl p-6 border border-gray-200 dark:border-gray-700 hover:shadow-lg transition-all cursor-pointer",
    compact: "bg-white dark:bg-gray-800 rounded-lg p-4 border border-gray-200 dark:border-gray-700 hover:shadow-md transition-all cursor-pointer",
    featured: "bg-gradient-to-br from-blue-50 to-indigo-50 dark:from-blue-900/20 dark:to-indigo-900/20 rounded-xl p-6 border border-blue-200 dark:border-blue-800 hover:shadow-xl transition-all cursor-pointer",
  };

  return (
    <div
      class={cardClasses[variant]}
      onClick={() => navigate(`/dao/${props.dao.id}`)}
    >
      {/* Header */}
      <div class="flex items-start justify-between mb-4">
        <div class="flex items-center gap-3">
          <div class={`w-12 h-12 rounded-full flex items-center justify-center text-lg font-bold ${
            variant === "featured" 
              ? "bg-blue-500 text-white" 
              : "bg-gradient-to-br from-blue-400 to-indigo-500 text-white"
          }`}>
            {props.dao.name.charAt(0).toUpperCase()}
          </div>
          <div>
            <h3 class="font-bold text-gray-900 dark:text-white text-lg leading-tight">
              {props.dao.name}
            </h3>
            <p class="text-sm text-gray-500 dark:text-gray-400">
              {props.dao.tokenSymbol} • {formatAddress(props.dao.address)}
            </p>
          </div>
        </div>
        <Show when={isCreator()}>
          <span class="px-2 py-1 bg-blue-100 dark:bg-blue-900/50 text-blue-700 dark:text-blue-300 text-xs font-medium rounded-full">
            Creator
          </span>
        </Show>
      </div>

      {/* Description */}
      <p class="text-gray-600 dark:text-gray-400 text-sm mb-4 line-clamp-2">
        {props.dao.description}
      </p>

      {/* Stats Grid */}
      <div class={`grid gap-3 mb-4 ${variant === "compact" ? "grid-cols-2" : "grid-cols-3"}`}>
        <div class="bg-gray-50 dark:bg-gray-700/50 rounded-lg p-3">
          <p class="text-xs text-gray-500 dark:text-gray-400">Members</p>
          <p class="font-semibold text-gray-900 dark:text-white">{props.dao.members}</p>
        </div>
        <div class="bg-gray-50 dark:bg-gray-700/50 rounded-lg p-3">
          <p class="text-xs text-gray-500 dark:text-gray-400">Proposals</p>
          <p class="font-semibold text-gray-900 dark:text-white">{props.dao.proposalsCount}</p>
        </div>
        <Show when={variant !== "compact"}>
          <div class="bg-gray-50 dark:bg-gray-700/50 rounded-lg p-3">
            <p class="text-xs text-gray-500 dark:text-gray-400">Active</p>
            <p class="font-semibold text-green-600 dark:text-green-400">
              {props.dao.activeProposals}
            </p>
          </div>
        </Show>
      </div>

      {/* Treasury & Token Info */}
      <Show when={variant !== "compact"}>
        <div class="border-t border-gray-200 dark:border-gray-700 pt-4 mb-4">
          <div class="flex justify-between items-center mb-2">
            <span class="text-sm text-gray-500 dark:text-gray-400">Treasury</span>
            <span class="font-semibold text-gray-900 dark:text-white">
              {formatTokenAmount(props.dao.treasuryBalance)} ETH
            </span>
          </div>
          <div class="flex justify-between items-center">
            <span class="text-sm text-gray-500 dark:text-gray-400">Token Supply</span>
            <span class="font-semibold text-gray-900 dark:text-white">
              {formatTokenAmount(props.dao.tokenTotalSupply)} {props.dao.tokenSymbol}
            </span>
          </div>
        </div>
      </Show>

      {/* Governance Params */}
      <Show when={variant === "featured"}>
        <div class="bg-white/50 dark:bg-black/20 rounded-lg p-3 mb-4">
          <div class="grid grid-cols-2 gap-2 text-sm">
            <div>
              <span class="text-gray-500 dark:text-gray-400">Voting Period:</span>
              <span class="ml-1 text-gray-900 dark:text-white">
                {formatDuration(props.dao.governanceParams.votingDuration)}
              </span>
            </div>
            <div>
              <span class="text-gray-500 dark:text-gray-400">Quorum:</span>
              <span class="ml-1 text-gray-900 dark:text-white">
                {props.dao.governanceParams.quorum}%
              </span>
            </div>
          </div>
        </div>
      </Show>

      {/* Footer */}
      <div class="flex items-center justify-between text-xs text-gray-500 dark:text-gray-400">
        <span>Created {formatDate(props.dao.createdAt)}</span>
        <Show when={props.dao.activeProposals > 0}>
          <span class="flex items-center gap-1 text-green-600 dark:text-green-400">
            <span class="w-2 h-2 bg-green-500 rounded-full animate-pulse"></span>
            {props.dao.activeProposals} active proposal{props.dao.activeProposals !== 1 ? "s" : ""}
          </span>
        </Show>
      </div>
    </div>
  );
}

// DAO Card Skeleton for loading states
export function DAOCardSkeleton() {
  return (
    <div class="bg-white dark:bg-gray-800 rounded-xl p-6 border border-gray-200 dark:border-gray-700 animate-pulse">
      <div class="flex items-start gap-3 mb-4">
        <div class="w-12 h-12 bg-gray-200 dark:bg-gray-700 rounded-full" />
        <div class="flex-1">
          <div class="h-5 bg-gray-200 dark:bg-gray-700 rounded w-2/3 mb-2" />
          <div class="h-3 bg-gray-200 dark:bg-gray-700 rounded w-1/2" />
        </div>
      </div>
      <div class="space-y-2 mb-4">
        <div class="h-3 bg-gray-200 dark:bg-gray-700 rounded" />
        <div class="h-3 bg-gray-200 dark:bg-gray-700 rounded w-5/6" />
      </div>
      <div class="grid grid-cols-3 gap-3">
        <div class="h-12 bg-gray-200 dark:bg-gray-700 rounded" />
        <div class="h-12 bg-gray-200 dark:bg-gray-700 rounded" />
        <div class="h-12 bg-gray-200 dark:bg-gray-700 rounded" />
      </div>
    </div>
  );
}
