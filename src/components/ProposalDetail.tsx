import { Show, createEffect } from "solid-js";
import { useProposals, proposalState, proposalActions } from "../stores/proposalStore";
import { useDAO } from "../stores/daoStore";
import { useWallet } from "../stores/walletStore";
import VotingInterface from "./VotingInterface";
import MarkdownRenderer from "./MarkdownRenderer";
import VoteResults from "./VoteResults";
import LoadingSpinner, { PageLoader } from "./LoadingSpinner";
import { useNavigate } from "@solidjs/router";
import { formatEther } from "viem";

interface ProposalDetailProps {
  proposalId: string;
}

export default function ProposalDetail(props: ProposalDetailProps) {
  const navigate = useNavigate();
  const { state: proposalState, actions } = useProposals();
  const { state: daoState } = useDAO();
  const { state: walletState } = useWallet();

  createEffect(() => {
    actions.loadProposal(props.proposalId);
  });

  const proposal = () => proposalState.currentProposal;
  const dao = () => daoState.currentDAO;

  const formatAddress = (addr: string) => {
    return `${addr.slice(0, 6)}...${addr.slice(-4)}`;
  };

  const formatDate = (timestamp: number) => {
    return new Date(timestamp).toLocaleString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  const getTimeStatus = () => {
    const now = Date.now();
    const p = proposal();
    if (!p) return "";

    if (now < p.startTime) {
      const diff = p.startTime - now;
      const hours = Math.floor(diff / (1000 * 60 * 60));
      return `Starts in ${hours}h`;
    } else if (now < p.endTime) {
      const diff = p.endTime - now;
      const days = Math.floor(diff / (1000 * 60 * 60 * 24));
      const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
      return `${days}d ${hours}h remaining`;
    } else {
      return "Voting ended";
    }
  };

  const canExecute = () => {
    const p = proposal();
    if (!p) return false;
    return (
      p.status === "succeeded" &&
      p.executionTime &&
      Date.now() >= p.executionTime
    );
  };

  return (
    <Show when={!proposalState.isLoading} fallback={<PageLoader message="Loading proposal..." />}>
      <Show when={proposal()} fallback={
        <div class="text-center py-12">
          <h3 class="text-lg font-medium text-gray-900 dark:text-white mb-2">
            Proposal not found
          </h3>
          <button
            onClick={() => navigate(-1)}
            class="text-blue-600 hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-300"
          >
            Go back
          </button>
        </div>
      }>
        <div class="max-w-5xl mx-auto">
          {/* Breadcrumb */}
          <div class="flex items-center gap-2 text-sm text-gray-500 dark:text-gray-400 mb-6">
            <button
              onClick={() => navigate(`/dao/${proposal()!.daoId}`)}
              class="hover:text-gray-700 dark:hover:text-gray-300"
            >
              {dao()?.name || "DAO"}
            </button>
            <span>/</span>
            <span>Proposals</span>
            <span>/</span>
            <span class="text-gray-900 dark:text-white">{proposal()!.title}</span>
          </div>

          {/* Header */}
          <div class="mb-8">
            <div class="flex items-center gap-3 mb-4">
              <span
                class="px-3 py-1 text-sm font-medium rounded-full"
                style={{
                  "background-color": `${proposalActions.getProposalStatusColor(proposal()!.status)}20`,
                  color: proposalActions.getProposalStatusColor(proposal()!.status),
                }}
              >
                {proposalActions.getProposalStatusLabel(proposal()!.status)}
              </span>
              <Show when={proposal()!.hasVoted}>
                <span class="px-3 py-1 bg-green-100 dark:bg-green-900/50 text-green-700 dark:text-green-300 text-sm font-medium rounded-full">
                  You voted {proposal()!.userVote}
                </span>
              </Show>
            </div>

            <h1 class="text-3xl font-bold text-gray-900 dark:text-white mb-4">
              {proposal()!.title}
            </h1>

            <div class="flex flex-wrap items-center gap-6 text-sm text-gray-500 dark:text-gray-400">
              <span class="flex items-center gap-2">
                <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                </svg>
                {formatAddress(proposal()!.creator)}
              </span>
              <span class="flex items-center gap-2">
                <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                </svg>
                Created {formatDate(proposal()!.createdAt)}
              </span>
              <Show when={proposal()!.status === "active"}>
                <span class="flex items-center gap-2 text-blue-600 dark:text-blue-400">
                  <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  {getTimeStatus()}
                </span>
              </Show>
            </div>
          </div>

          {/* Main Content */}
          <div class="grid grid-cols-1 lg:grid-cols-3 gap-8">
            {/* Left Column - Content */}
            <div class="lg:col-span-2 space-y-6">
              {/* Description */}
              <div class="bg-white dark:bg-gray-800 rounded-xl p-6 border border-gray-200 dark:border-gray-700">
                <h3 class="text-lg font-bold text-gray-900 dark:text-white mb-4">
                  Description
                </h3>
                <p class="text-gray-600 dark:text-gray-400">
                  {proposal()!.description}
                </p>
              </div>

              {/* Detailed Content */}
              <div class="bg-white dark:bg-gray-800 rounded-xl p-6 border border-gray-200 dark:border-gray-700">
                <h3 class="text-lg font-bold text-gray-900 dark:text-white mb-4">
                  Details
                </h3>
                <MarkdownRenderer content={proposal()!.content} />
              </div>

              {/* Actions */}
              <Show when={proposal()!.actions.length > 0}>
                <div class="bg-white dark:bg-gray-800 rounded-xl p-6 border border-gray-200 dark:border-gray-700">
                  <h3 class="text-lg font-bold text-gray-900 dark:text-white mb-4">
                    Executable Actions
                  </h3>
                  <div class="space-y-3">
                    {proposal()!.actions.map((action, index) => (
                      <div class="p-4 bg-gray-50 dark:bg-gray-700/50 rounded-lg">
                        <div class="flex items-center gap-2 mb-2">
                          <span class="w-6 h-6 bg-blue-100 dark:bg-blue-900/50 text-blue-700 dark:text-blue-300 rounded-full flex items-center justify-center text-xs font-medium">
                            {index + 1}
                          </span>
                          <span class="font-medium text-gray-900 dark:text-white">
                            {action.description}
                          </span>
                        </div>
                        <div class="text-sm text-gray-500 dark:text-gray-400 space-y-1 ml-8">
                          <p>Target: {formatAddress(action.target)}</p>
                          <p>Value: {formatEther(action.value)} ETH</p>
                          <Show when={action.data !== "0x"}>
                            <p class="font-mono text-xs truncate">Data: {action.data}</p>
                          </Show>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </Show>

              {/* Vote Results */}
              <VoteResults proposal={proposal()!} />
            </div>

            {/* Right Column - Voting & Info */}
            <div class="space-y-6">
              {/* Voting Interface */}
              <VotingInterface proposal={proposal()!} />

              {/* Timeline */}
              <div class="bg-white dark:bg-gray-800 rounded-xl p-6 border border-gray-200 dark:border-gray-700">
                <h3 class="text-lg font-bold text-gray-900 dark:text-white mb-4">
                  Timeline
                </h3>
                <div class="space-y-4">
                  <div class="flex items-start gap-3">
                    <div class="w-2 h-2 bg-blue-500 rounded-full mt-2" />
                    <div>
                      <p class="font-medium text-gray-900 dark:text-white">Created</p>
                      <p class="text-sm text-gray-500">{formatDate(proposal()!.createdAt)}</p>
                    </div>
                  </div>
                  <div class="flex items-start gap-3">
                    <div class={`w-2 h-2 rounded-full mt-2 ${
                      Date.now() >= proposal()!.startTime ? "bg-green-500" : "bg-gray-300"
                    }`} />
                    <div>
                      <p class="font-medium text-gray-900 dark:text-white">Voting Starts</p>
                      <p class="text-sm text-gray-500">{formatDate(proposal()!.startTime)}</p>
                    </div>
                  </div>
                  <div class="flex items-start gap-3">
                    <div class={`w-2 h-2 rounded-full mt-2 ${
                      Date.now() >= proposal()!.endTime ? "bg-green-500" : "bg-gray-300"
                    }`} />
                    <div>
                      <p class="font-medium text-gray-900 dark:text-white">Voting Ends</p>
                      <p class="text-sm text-gray-500">{formatDate(proposal()!.endTime)}</p>
                    </div>
                  </div>
                  <Show when={proposal()!.executionTime}>
                    <div class="flex items-start gap-3">
                      <div class={`w-2 h-2 rounded-full mt-2 ${
                        Date.now() >= proposal()!.executionTime! ? "bg-green-500" : "bg-gray-300"
                      }`} />
                      <div>
                        <p class="font-medium text-gray-900 dark:text-white">Executable</p>
                        <p class="text-sm text-gray-500">{formatDate(proposal()!.executionTime!)}</p>
                      </div>
                    </div>
                  </Show>
                </div>
              </div>

              {/* Execute Button */}
              <Show when={canExecute()}>
                <button
                  onClick={() => {}}
                  class="w-full px-6 py-3 bg-green-600 hover:bg-green-700 text-white font-semibold rounded-lg transition-colors"
                >
                  Execute Proposal
                </button>
              </Show>
            </div>
          </div>
        </div>
      </Show>
    </Show>
  );
}
