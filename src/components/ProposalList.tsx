import { For, Show, createSignal } from "solid-js";
import { 
  useProposals, 
  proposalState, 
  proposalActions, 
  type ProposalStatus,
  type ProposalFilter 
} from "../stores/proposalStore";
import ProposalCard from "./ProposalCard";
import LoadingSpinner, { SkeletonList } from "./LoadingSpinner";

interface ProposalListProps {
  daoId: string;
  showFilters?: boolean;
  limit?: number;
}

export default function ProposalList(props: ProposalListProps) {
  const { state, getFiltered, actions } = useProposals();
  const [searchQuery, setSearchQuery] = createSignal("");

  const statusOptions: { value: ProposalStatus | "all"; label: string }[] = [
    { value: "all", label: "All Proposals" },
    { value: "active", label: "Active" },
    { value: "pending", label: "Pending" },
    { value: "succeeded", label: "Succeeded" },
    { value: "defeated", label: "Defeated" },
    { value: "executed", label: "Executed" },
  ];

  const sortOptions = [
    { value: "newest", label: "Newest First" },
    { value: "oldest", label: "Oldest First" },
    { value: "mostVotes", label: "Most Votes" },
  ];

  const handleSearch = (e: InputEvent) => {
    const value = (e.target as HTMLInputElement).value;
    setSearchQuery(value);
    actions.setFilter({ search: value });
  };

  const handleStatusChange = (e: Event) => {
    const value = (e.target as HTMLSelectElement).value as ProposalStatus | "all";
    actions.setFilter({ status: value });
  };

  const handleSortChange = (e: Event) => {
    const value = (e.target as HTMLSelectElement).value as ProposalFilter["sortBy"];
    actions.setFilter({ sortBy: value });
  };

  const filteredProposals = () => {
    const filtered = getFiltered();
    return props.limit ? filtered.slice(0, props.limit) : filtered;
  };

  return (
    <div class="space-y-6">
      {/* Header */}
      <div class="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h2 class="text-xl font-bold text-gray-900 dark:text-white">
            Proposals
          </h2>
          <p class="text-sm text-gray-500 dark:text-gray-400">
            {state.proposals.length} total proposals
          </p>
        </div>
        <button
          onClick={() => {}}
          class="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-lg transition-colors flex items-center gap-2"
        >
          <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v16m8-8H4" />
          </svg>
          New Proposal
        </button>
      </div>

      {/* Filters */}
      <Show when={props.showFilters !== false}>
        <div class="bg-white dark:bg-gray-800 rounded-lg p-4 border border-gray-200 dark:border-gray-700">
          <div class="flex flex-col sm:flex-row gap-4">
            {/* Search */}
            <div class="flex-1 relative">
              <svg 
                class="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" 
                fill="none" 
                stroke="currentColor" 
                viewBox="0 0 24 24"
              >
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
              <input
                type="text"
                value={searchQuery()}
                onInput={handleSearch}
                placeholder="Search proposals..."
                class="w-full pl-10 pr-4 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            {/* Status Filter */}
            <select
              value={state.filter.status}
              onChange={handleStatusChange}
              class="px-4 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <For each={statusOptions}>
                {(option) => (
                  <option value={option.value}>{option.label}</option>
                )}
              </For>
            </select>

            {/* Sort */}
            <select
              value={state.filter.sortBy}
              onChange={handleSortChange}
              class="px-4 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <For each={sortOptions}>
                {(option) => (
                  <option value={option.value}>{option.label}</option>
                )}
              </For>
            </select>
          </div>
        </div>
      </Show>

      {/* Loading State */}
      <Show when={state.isLoading}>
        <SkeletonList count={3} />
      </Show>

      {/* Empty State */}
      <Show when={!state.isLoading && filteredProposals().length === 0}>
        <div class="text-center py-12 bg-gray-50 dark:bg-gray-800/50 rounded-xl">
          <div class="w-16 h-16 bg-gray-200 dark:bg-gray-700 rounded-full flex items-center justify-center mx-auto mb-4">
            <svg class="w-8 h-8 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
          </div>
          <h3 class="text-lg font-medium text-gray-900 dark:text-white mb-2">
            No proposals found
          </h3>
          <p class="text-gray-500 dark:text-gray-400 max-w-sm mx-auto">
            {state.filter.status !== "all" 
              ? `No ${state.filter.status} proposals. Try changing the filter.`
              : "Be the first to create a proposal for this DAO!"}
          </p>
        </div>
      </Show>

      {/* Proposal List */}
      <Show when={!state.isLoading && filteredProposals().length > 0}>
        <div class="space-y-4">
          <For each={filteredProposals()}>
            {(proposal) => (
              <ProposalCard proposal={proposal} />
            )}
          </For>
        </div>
      </Show>

      {/* View All Link */}
      <Show when={props.limit && state.proposals.length > props.limit}>
        <div class="text-center">
          <button
            onClick={() => {}}
            class="text-blue-600 hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-300 font-medium"
          >
            View all {state.proposals.length} proposals →
          </button>
        </div>
      </Show>
    </div>
  );
}
