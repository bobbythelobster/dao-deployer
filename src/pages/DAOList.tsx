import { createSignal, createEffect, Show, For } from "solid-js";
import { A, useNavigate } from "@solidjs/router";
import { useDAO, daoActions, type DAO } from "../stores";
import { VirtualList } from "../components/VirtualList";
import { DAOCardSkeleton } from "../components/DAOCard";
import { usePerformance } from "../utils/performance";

export default function DAOList() {
  const navigate = useNavigate();
  const { state: daoState } = useDAO();
  const performance = usePerformance();
  const [searchQuery, setSearchQuery] = createSignal("");
  const [sortBy, setSortBy] = createSignal<"newest" | "members" | "treasury">("newest");

  // Load DAOs on mount
  createEffect(() => {
    const startTime = performance.now();
    daoActions.loadDAOs().then(() => {
      performance.trackCustomMetric("dao_list_load", performance.now() - startTime);
    });
  });

  // Filter and sort DAOs
  const filteredDAOs = () => {
    let daos = daoState.daos;
    
    // Filter by search
    if (searchQuery()) {
      const query = searchQuery().toLowerCase();
      daos = daos.filter(
        (dao) =>
          dao.name.toLowerCase().includes(query) ||
          dao.description.toLowerCase().includes(query)
      );
    }

    // Sort
    return [...daos].sort((a, b) => {
      switch (sortBy()) {
        case "newest":
          return b.createdAt - a.createdAt;
        case "members":
          return b.members - a.members;
        case "treasury":
          return Number(b.treasuryBalance - a.treasuryBalance);
        default:
          return 0;
      }
    });
  };

  // Virtual list item renderer
  const renderDAO = (dao: DAO) => (
    <DAOCard dao={dao} />
  );

  return (
    <div class="space-y-6">
      {/* Header */}
      <div class="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h1 class="text-2xl font-bold text-gray-900 dark:text-white">Explore DAOs</h1>
          <p class="text-gray-600 dark:text-gray-400">
            Discover and join decentralized organizations
          </p>
        </div>
        <button
          onClick={() => navigate("/dao/create")}
          class="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-lg transition-colors flex items-center gap-2"
        >
          <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v16m8-8H4" />
          </svg>
          Create DAO
        </button>
      </div>

      {/* Filters */}
      <div class="flex flex-col sm:flex-row gap-4">
        <div class="flex-1 relative">
          <input
            type="text"
            placeholder="Search DAOs..."
            value={searchQuery()}
            onInput={(e) => setSearchQuery(e.currentTarget.value)}
            class="w-full pl-10 pr-4 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
          />
          <svg
            class="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
        </div>
        <select
          value={sortBy()}
          onChange={(e) => setSortBy(e.currentTarget.value as any)}
          class="px-4 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
        >
          <option value="newest">Newest First</option>
          <option value="members">Most Members</option>
          <option value="treasury">Highest Treasury</option>
        </select>
      </div>

      {/* DAO List */}
      <Show
        when={!daoState.isLoading}
        fallback={
          <div class="space-y-4">
            <For each={[1, 2, 3]}>{() => <DAOCardSkeleton />}</For>
          </div>
        }
      >
        <Show
          when={filteredDAOs().length > 0}
          fallback={
            <div class="text-center py-16">
              <div class="w-16 h-16 bg-gray-200 dark:bg-gray-700 rounded-full flex items-center justify-center mx-auto mb-4">
                <svg class="w-8 h-8 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                </svg>
              </div>
              <h3 class="text-lg font-medium text-gray-900 dark:text-white mb-2">
                No DAOs found
              </h3>
              <p class="text-gray-500 dark:text-gray-400 mb-4">
                {searchQuery() ? "Try adjusting your search" : "Be the first to create a DAO"}
              </p>
              <A
                href="/dao/create"
                class="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-lg transition-colors"
              >
                Create DAO
              </A>
            </div>
          }
        >
          {/* Use VirtualList for large lists */}
          <Show
            when={filteredDAOs().length > 20}
            fallback={
              <div class="grid gap-4">
                <For each={filteredDAOs()}>
                  {(dao) => <DAOCard dao={dao} />}
                </For>
              </div>
            }
          >
            <VirtualList
              items={filteredDAOs()}
              itemHeight={180}
              containerHeight={600}
              overscan={5}
              renderItem={(dao) => <DAOCard dao={dao} />}
              keyExtractor={(dao) => dao.id}
              class="rounded-xl border border-gray-200 dark:border-gray-700"
            />
          </Show>
        </Show>
      </Show>
    </div>
  );
}

// DAO Card Component
function DAOCard(props: { dao: DAO }) {
  const formatAddress = (addr: string) => `${addr.slice(0, 6)}...${addr.slice(-4)}`;
  
  return (
    <A
      href={`/dao/${props.dao.id}`}
      class="block bg-white dark:bg-gray-800 rounded-xl p-6 border border-gray-200 dark:border-gray-700 hover:shadow-lg transition-all"
    >
      <div class="flex items-start justify-between gap-4">
        <div class="flex-1 min-w-0">
          <div class="flex items-center gap-3 mb-2">
            <div class="w-10 h-10 bg-gradient-to-br from-blue-500 to-purple-600 rounded-lg flex items-center justify-center text-white font-bold">
              {props.dao.name.charAt(0)}
            </div>
            <div>
              <h3 class="font-semibold text-gray-900 dark:text-white truncate">
                {props.dao.name}
              </h3>
              <p class="text-sm text-gray-500">{props.dao.tokenSymbol}</p>
            </div>
          </div>
          <p class="text-gray-600 dark:text-gray-400 text-sm line-clamp-2 mb-4">
            {props.dao.description}
          </p>
          <div class="flex flex-wrap items-center gap-4 text-sm text-gray-500">
            <span class="flex items-center gap-1">
              <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
              </svg>
              {props.dao.members} members
            </span>
            <span class="flex items-center gap-1">
              <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
              </svg>
              {props.dao.proposalsCount} proposals
            </span>
            <span class="flex items-center gap-1">
              <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              {props.dao.treasuryBalance.toString()} ETH
            </span>
          </div>
        </div>
        <div class="text-right">
          <span class={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${
            props.dao.activeProposals > 0
              ? "bg-green-100 text-green-800 dark:bg-green-900/50 dark:text-green-300"
              : "bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300"
          }`}>
            {props.dao.activeProposals > 0 ? `${props.dao.activeProposals} Active` : "No Active"}
          </span>
        </div>
      </div>
    </A>
  );
}
