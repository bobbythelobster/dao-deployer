import { Show } from "solid-js";
import { type DAO, formatTokenAmount, formatDuration } from "../stores/daoStore";
import { useWallet } from "../stores/walletStore";
import { useNavigate } from "@solidjs/router";

/**
 * Props for the DAOCard component
 * @interface DAOCardProps
 */
interface DAOCardProps {
  /** DAO data to display */
  dao: DAO;
  /** Visual variant of the card */
  variant?: "default" | "compact" | "featured";
  /** Optional click handler (defaults to navigation) */
  onClick?: (dao: DAO) => void;
  /** Whether the card is in a loading state */
  isLoading?: boolean;
}

/**
 * DAO Card Component
 * 
 * Displays a summary card for a DAO with key metrics and information.
 * Supports multiple visual variants and is fully accessible.
 * 
 * @component
 * @example
 * ```tsx
 * <DAOCard dao={daoData} variant="featured" />
 * <DAOCard dao={daoData} variant="compact" onClick={handleClick} />
 * ```
 * 
 * @accessibility
 * - Uses article semantic element
 * - Clickable with keyboard support
 * - Status indicators have aria-labels
 * - Color is not the only means of conveying information
 */
export default function DAOCard(props: DAOCardProps) {
  const navigate = useNavigate();
  const { state: walletState } = useWallet();
  
  const variant = props.variant || "default";

  /**
   * Formats an Ethereum address for display
   * @param {string} addr - The address to format
   * @returns {string} Formatted address (0x1234...5678)
   */
  const formatAddress = (addr: string): string => {
    return `${addr.slice(0, 6)}...${addr.slice(-4)}`;
  };

  /**
   * Formats a timestamp to a readable date
   * @param {number} timestamp - Unix timestamp in milliseconds
   * @returns {string} Formatted date string
   */
  const formatDate = (timestamp: number): string => {
    return new Date(timestamp).toLocaleDateString("en-US", {
      year: "numeric",
      month: "short",
      day: "numeric",
    });
  };

  /**
   * Checks if the connected wallet is the DAO creator
   * @returns {boolean} True if connected wallet is creator
   */
  const isCreator = (): boolean => {
    return walletState.address?.toLowerCase() === props.dao.creator.toLowerCase();
  };

  /**
   * Handles card click - navigates to DAO detail or calls onClick prop
   */
  const handleClick = () => {
    if (props.onClick) {
      props.onClick(props.dao);
    } else {
      navigate(`/dao/${props.dao.id}`);
    }
  };

  /**
   * Handles keyboard navigation
   * @param {KeyboardEvent} e - Keyboard event
   */
  const handleKeyDown = (e: KeyboardEvent) => {
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      handleClick();
    }
  };

  // Variant-specific CSS classes
  const cardClasses = {
    default: "bg-white dark:bg-gray-800 rounded-xl p-4 sm:p-6 border border-gray-200 dark:border-gray-700 hover:shadow-lg transition-all cursor-pointer focus:outline-none focus:ring-2 focus:ring-blue-500",
    compact: "bg-white dark:bg-gray-800 rounded-lg p-3 sm:p-4 border border-gray-200 dark:border-gray-700 hover:shadow-md transition-all cursor-pointer focus:outline-none focus:ring-2 focus:ring-blue-500",
    featured: "bg-gradient-to-br from-blue-50 to-indigo-50 dark:from-blue-900/20 dark:to-indigo-900/20 rounded-xl p-4 sm:p-6 border border-blue-200 dark:border-blue-800 hover:shadow-xl transition-all cursor-pointer focus:outline-none focus:ring-2 focus:ring-blue-500",
  };

  // Size classes for the avatar
  const avatarSizeClasses = {
    default: "w-10 h-10 sm:w-12 sm:h-12",
    compact: "w-8 h-8 sm:w-10 sm:h-10",
    featured: "w-10 h-10 sm:w-12 sm:h-12",
  };

  return (
    <article
      class={cardClasses[variant]}
      onClick={handleClick}
      onKeyDown={handleKeyDown}
      tabIndex={0}
      role="link"
      aria-label={`${props.dao.name} DAO. ${props.dao.members} members, ${props.dao.proposalsCount} proposals, ${props.dao.activeProposals} active`}
    >
      {/* Header */}
      <div class="flex items-start justify-between mb-3 sm:mb-4 gap-2">
        <div class="flex items-center gap-2 sm:gap-3 min-w-0">
          {/* DAO Avatar */}
          <div 
            class={`${avatarSizeClasses[variant]} rounded-full flex items-center justify-center text-base sm:text-lg font-bold flex-shrink-0 ${
              variant === "featured" 
                ? "bg-blue-500 text-white" 
                : "bg-gradient-to-br from-blue-400 to-indigo-500 text-white"
            }`}
            aria-hidden="true"
          >
            {props.dao.name.charAt(0).toUpperCase()}
          </div>
          
          {/* DAO Name and Token Info */}
          <div class="min-w-0">
            <h3 class="font-bold text-gray-900 dark:text-white text-base sm:text-lg leading-tight truncate">
              {props.dao.name}
            </h3>
            <p class="text-xs sm:text-sm text-gray-500 dark:text-gray-400 truncate">
              {props.dao.tokenSymbol} • {formatAddress(props.dao.address)}
            </p>
          </div>
        </div>
        
        {/* Creator Badge */}
        <Show when={isCreator()}>
          <span 
            class="px-2 py-1 bg-blue-100 dark:bg-blue-900/50 text-blue-700 dark:text-blue-300 text-xs font-medium rounded-full flex-shrink-0"
          >
            Creator
          </span>
        </Show>
      </div>

      {/* Description */}
      <p class="text-gray-600 dark:text-gray-400 text-sm mb-3 sm:mb-4 line-clamp-2">
        {props.dao.description}
      </p>

      {/* Stats Grid */}
      <div class={`grid gap-2 sm:gap-3 mb-3 sm:mb-4 ${variant === "compact" ? "grid-cols-2" : "grid-cols-3"}`}>
        <div class="bg-gray-50 dark:bg-gray-700/50 rounded-lg p-2 sm:p-3">
          <p class="text-xs text-gray-500 dark:text-gray-400">Members</p>
          <p class="font-semibold text-gray-900 dark:text-white text-sm sm:text-base">
            {props.dao.members.toLocaleString()}
          </p>
        </div>
        <div class="bg-gray-50 dark:bg-gray-700/50 rounded-lg p-2 sm:p-3">
          <p class="text-xs text-gray-500 dark:text-gray-400">Proposals</p>
          <p class="font-semibold text-gray-900 dark:text-white text-sm sm:text-base">
            {props.dao.proposalsCount.toLocaleString()}
          </p>
        </div>
        <Show when={variant !== "compact"}>
          <div class="bg-gray-50 dark:bg-gray-700/50 rounded-lg p-2 sm:p-3">
            <p class="text-xs text-gray-500 dark:text-gray-400">Active</p>
            <p class="font-semibold text-green-600 dark:text-green-400 text-sm sm:text-base">
              {props.dao.activeProposals.toLocaleString()}
            </p>
          </div>
        </Show>
      </div>

      {/* Treasury & Token Info - Hidden on compact */}
      <Show when={variant !== "compact"}>
        <div class="border-t border-gray-200 dark:border-gray-700 pt-3 sm:pt-4 mb-3 sm:mb-4">
          <div class="flex justify-between items-center mb-2">
            <span class="text-xs sm:text-sm text-gray-500 dark:text-gray-400">Treasury</span>
            <span class="font-semibold text-gray-900 dark:text-white text-sm sm:text-base">
              {formatTokenAmount(props.dao.treasuryBalance)} ETH
            </span>
          </div>
          <div class="flex justify-between items-center">
            <span class="text-xs sm:text-sm text-gray-500 dark:text-gray-400">Token Supply</span>
            <span class="font-semibold text-gray-900 dark:text-white text-sm sm:text-base">
              {formatTokenAmount(props.dao.tokenTotalSupply)} {props.dao.tokenSymbol}
            </span>
          </div>
        </div>
      </Show>

      {/* Governance Params - Featured only */}
      <Show when={variant === "featured"}>
        <div class="bg-white/50 dark:bg-black/20 rounded-lg p-2 sm:p-3 mb-3 sm:mb-4">
          <div class="grid grid-cols-2 gap-2 text-xs sm:text-sm">
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
      <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs text-gray-500 dark:text-gray-400">
        <span>Created {formatDate(props.dao.createdAt)}</span>
        <Show when={props.dao.activeProposals > 0}>
          <span 
            class="flex items-center gap-1 text-green-600 dark:text-green-400"
            aria-label={`${props.dao.activeProposals} active proposal${props.dao.activeProposals !== 1 ? "s" : ""}`}
          >
            <span class="w-2 h-2 bg-green-500 rounded-full animate-pulse" aria-hidden="true"></span>
            {props.dao.activeProposals} active
          </span>
        </Show>
      </div>
    </article>
  );
}

/**
 * DAO Card Skeleton Loading Component
 * 
 * Displays a placeholder loading state for a DAO card.
 * Matches the layout of the actual card for smooth transitions.
 * 
 * @component
 * @example
 * ```tsx
 * <Show when={!dao} fallback={<DAOCard dao={dao} />}>
 *   <DAOCardSkeleton />
 * </Show>
 * ```
 */
export function DAOCardSkeleton() {
  return (
    <div 
      class="bg-white dark:bg-gray-800 rounded-xl p-4 sm:p-6 border border-gray-200 dark:border-gray-700 animate-pulse"
      aria-label="Loading DAO information"
      role="status"
    >
      {/* Header skeleton */}
      <div class="flex items-start gap-3 mb-4">
        <div class="w-10 h-10 sm:w-12 sm:h-12 bg-gray-200 dark:bg-gray-700 rounded-full" aria-hidden="true" />
        <div class="flex-1 min-w-0">
          <div class="h-5 bg-gray-200 dark:bg-gray-700 rounded w-2/3 mb-2" aria-hidden="true" />
          <div class="h-3 bg-gray-200 dark:bg-gray-700 rounded w-1/2" aria-hidden="true" />
        </div>
      </div>
      
      {/* Description skeleton */}
      <div class="space-y-2 mb-4" aria-hidden="true">
        <div class="h-3 bg-gray-200 dark:bg-gray-700 rounded" />
        <div class="h-3 bg-gray-200 dark:bg-gray-700 rounded w-5/6" />
      </div>
      
      {/* Stats skeleton */}
      <div class="grid grid-cols-3 gap-3" aria-hidden="true">
        <div class="h-12 bg-gray-200 dark:bg-gray-700 rounded" />
        <div class="h-12 bg-gray-200 dark:bg-gray-700 rounded" />
        <div class="h-12 bg-gray-200 dark:bg-gray-700 rounded" />
      </div>
    </div>
  );
}

/**
 * DAO Card List Skeleton
 * 
 * Displays multiple skeleton cards for list loading states.
 * 
 * @component
 * @param {Object} props - Component props
 * @param {number} [props.count=3] - Number of skeleton cards to display
 */
export function DAOCardListSkeleton(props: { count?: number }) {
  const count = props.count || 3;
  
  return (
    <div 
      class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6"
      aria-label="Loading DAO list"
      role="status"
    >
      {Array.from({ length: count }).map((_, i) => (
        <DAOCardSkeleton key={i} />
      ))}
    </div>
  );
}
