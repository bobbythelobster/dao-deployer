import { createEffect, Show, For, lazy, Suspense } from "solid-js";
import { useParams, A, useNavigate } from "@solidjs/router";
import { useDAO, daoActions, daoState, formatTokenAmount, formatDuration } from "../stores";
import { useQuery } from "../utils/queryClient";
import { PageLoader } from "../components/LoadingSpinner";

// Lazy load heavy components
const ProposalList = lazy(() => import("../components/ProposalList"));
const TaskList = lazy(() => import("../components/TaskList"));
const TreasuryView = lazy(() => import("../components/TreasuryView"));

export default function DAODetail() {
  const params = useParams();
  const navigate = useNavigate();
  const { state } = useDAO();
  const daoId = () => params.id;

  // Use query client with deduplication
  const daoQuery = useQuery({
    queryKey: ["dao", daoId()],
    queryFn: async () => {
      await daoActions.loadDAO(daoId());
      return daoState.currentDAO;
    },
    staleTime: 30000, // 30 seconds
    cacheTime: 5 * 60 * 1000, // 5 minutes
  });

  const dao = () => daoQuery.data || state.currentDAO;

  const formatAddress = (addr: string) => `${addr.slice(0, 6)}...${addr.slice(-4)}`;

  return (
    <Show
      when={!daoQuery.isLoading && dao()}
      fallback={<PageLoader />}
    >
      <div class="space-y-8">
        {/* DAO Header */}
        <div class="bg-white dark:bg-gray-800 rounded-xl p-6 border border-gray-200 dark:border-gray-700">
          <div class="flex flex-col md:flex-row md:items-start md:justify-between gap-4">
            <div class="flex items-start gap-4">
              <div class="w-16 h-16 bg-gradient-to-br from-blue-500 to-purple-600 rounded-xl flex items-center justify-center text-white text-2xl font-bold">
                {dao()!.name.charAt(0)}
              </div>
              <div>
                <h1 class="text-2xl font-bold text-gray-900 dark:text-white">{dao()!.name}</h1>
                <p class="text-gray-500 dark:text-gray-400 font-mono text-sm mt-1">
                  {formatAddress(dao()!.address)}
                </p>
                <p class="text-gray-600 dark:text-gray-400 mt-2 max-w-xl">
                  {dao()!.description}
                </p>
              </div>
            </div>
            <div class="flex flex-wrap gap-2">
              <A
                href={`/dao/${daoId()}/proposals/create`}
                class="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-lg transition-colors flex items-center gap-2"
              >
                <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                </svg>
                New Proposal
              </A>
              <A
                href={`/dao/${daoId()}/tasks/create`}
                class="px-4 py-2 bg-green-600 hover:bg-green-700 text-white font-medium rounded-lg transition-colors flex items-center gap-2"
              >
                <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
                </svg>
                Post Task
              </A>
            </div>
          </div>

          {/* Stats */}
          <div class="grid grid-cols-2 md:grid-cols-4 gap-4 mt-6 pt-6 border-t border-gray-200 dark:border-gray-700">
            <Stat label="Members" value={dao()!.members.toString()} />
            <Stat label="Proposals" value={dao()!.proposalsCount.toString()} />
            <Stat label="Active Proposals" value={dao()!.activeProposals.toString()} />
            <Stat label="Treasury" value={`${formatTokenAmount(dao()!.treasuryBalance)} ETH`} />
          </div>
        </div>

        {/* Navigation Tabs */}
        <div class="border-b border-gray-200 dark:border-gray-700">
          <nav class="flex gap-6">
            <Tab href={`/dao/${daoId()}`} exact>Overview</Tab>
            <Tab href={`/dao/${daoId()}/proposals`}>Proposals</Tab>
            <Tab href={`/dao/${daoId()}/tasks`}>Tasks</Tab>
            <Tab href={`/dao/${daoId()}/treasury`}>Treasury</Tab>
            <Tab href={`/dao/${daoId()}/members`}>Members</Tab>
          </nav>
        </div>

        {/* Tab Content */}
        <div class="min-h-[400px]">
          <Suspense fallback={<PageLoader />}>
            <Switch fallback={<OverviewTab dao={dao()!} />}>
              <Match when={location.pathname.includes("/proposals")}>
                <ProposalList daoId={daoId()} />
              </Match>
              <Match when={location.pathname.includes("/tasks")}>
                <TaskList daoId={daoId()} />
              </Match>
              <Match when={location.pathname.includes("/treasury")}>
                <TreasuryView daoId={daoId()} />
              </Match>
              <Match when={location.pathname.includes("/members")}>
                <MembersTab dao={dao()!} />
              </Match>
            </Switch>
          </Suspense>
        </div>
      </div>
    </Show>
  );
}

import { Switch, Match } from "solid-js";
import { useLocation } from "@solidjs/router";

function Stat(props: { label: string; value: string }) {
  return (
    <div>
      <div class="text-2xl font-bold text-gray-900 dark:text-white">{props.value}</div>
      <div class="text-sm text-gray-500 dark:text-gray-400">{props.label}</div>
    </div>
  );
}

function Tab(props: { href: string; children: any; exact?: boolean }) {
  const location = useLocation();
  const isActive = () => {
    if (props.exact) {
      return location.pathname === props.href;
    }
    return location.pathname.startsWith(props.href);
  };

  return (
    <A
      href={props.href}
      class={`pb-4 text-sm font-medium border-b-2 transition-colors ${
        isActive()
          ? "border-blue-600 text-blue-600"
          : "border-transparent text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-300"
      }`}
    >
      {props.children}
    </A>
  );
}

function OverviewTab(props: { dao: any }) {
  return (
    <div class="grid md:grid-cols-2 gap-6">
      {/* Governance Parameters */}
      <div class="bg-white dark:bg-gray-800 rounded-xl p-6 border border-gray-200 dark:border-gray-700">
        <h3 class="text-lg font-semibold text-gray-900 dark:text-white mb-4">
          Governance Parameters
        </h3>
        <div class="space-y-3">
          <ParameterRow
            label="Voting Duration"
            value={formatDuration(props.dao.governanceParams.votingDuration)}
          />
          <ParameterRow
            label="Execution Delay"
            value={formatDuration(props.dao.governanceParams.executionDelay)}
          />
          <ParameterRow
            label="Quorum"
            value={`${props.dao.governanceParams.quorum}%`}
          />
          <ParameterRow
            label="Voting Threshold"
            value={`${formatTokenAmount(props.dao.governanceParams.votingThreshold)} ${props.dao.tokenSymbol}`}
          />
          <ParameterRow
            label="Proposal Threshold"
            value={`${formatTokenAmount(props.dao.governanceParams.proposalThreshold)} ${props.dao.tokenSymbol}`}
          />
        </div>
      </div>

      {/* Token Info */}
      <div class="bg-white dark:bg-gray-800 rounded-xl p-6 border border-gray-200 dark:border-gray-700">
        <h3 class="text-lg font-semibold text-gray-900 dark:text-white mb-4">
          Token Information
        </h3>
        <div class="space-y-3">
          <ParameterRow label="Token Name" value={props.dao.tokenName} />
          <ParameterRow label="Symbol" value={props.dao.tokenSymbol} />
          <ParameterRow
            label="Total Supply"
            value={`${formatTokenAmount(props.dao.tokenTotalSupply)} ${props.dao.tokenSymbol}`}
          />
          <ParameterRow
            label="Token Address"
            value={`${props.dao.tokenAddress.slice(0, 6)}...${props.dao.tokenAddress.slice(-4)}`}
          />
        </div>
      </div>

      {/* Recent Activity */}
      <div class="md:col-span-2 bg-white dark:bg-gray-800 rounded-xl p-6 border border-gray-200 dark:border-gray-700">
        <h3 class="text-lg font-semibold text-gray-900 dark:text-white mb-4">
          Recent Activity
        </h3>
        <div class="text-center py-8 text-gray-500 dark:text-gray-400">
          Activity feed coming soon...
        </div>
      </div>
    </div>
  );
}

function ParameterRow(props: { label: string; value: string }) {
  return (
    <div class="flex justify-between items-center py-2 border-b border-gray-100 dark:border-gray-700 last:border-0">
      <span class="text-gray-600 dark:text-gray-400">{props.label}</span>
      <span class="font-medium text-gray-900 dark:text-white">{props.value}</span>
    </div>
  );
}

function MembersTab(props: { dao: any }) {
  return (
    <div class="bg-white dark:bg-gray-800 rounded-xl p-6 border border-gray-200 dark:border-gray-700">
      <h3 class="text-lg font-semibold text-gray-900 dark:text-white mb-4">
        Members ({props.dao.members})
      </h3>
      <div class="text-center py-8 text-gray-500 dark:text-gray-400">
        Member list coming soon...
      </div>
    </div>
  );
}
