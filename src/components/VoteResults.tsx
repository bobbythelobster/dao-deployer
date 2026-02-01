import { For, Show, createSignal } from "solid-js";
import { type Proposal, calculateVotePercentage, type Vote } from "../stores/proposalStore";
import { formatEther } from "viem";

interface VoteResultsProps {
  proposal: Proposal;
}

export default function VoteResults(props: VoteResultsProps) {
  const [showAllVotes, setShowAllVotes] = createSignal(false);

  const totalVotes = () => {
    return props.proposal.votesFor + props.proposal.votesAgainst + props.proposal.votesAbstain;
  };

  const forPercentage = () => calculateVotePercentage(props.proposal.votesFor, totalVotes());
  const againstPercentage = () => calculateVotePercentage(props.proposal.votesAgainst, totalVotes());
  const abstainPercentage = () => calculateVotePercentage(props.proposal.votesAbstain, totalVotes());

  const quorumPercentage = () => {
    if (props.proposal.quorum === 0n) return 100;
    return Math.min(100, Number((totalVotes() * 100n) / props.proposal.quorum));
  };

  const formatAddress = (addr: string) => {
    return `${addr.slice(0, 6)}...${addr.slice(-4)}`;
  };

  const formatDate = (timestamp: number) => {
    return new Date(timestamp).toLocaleString("en-US", {
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  const displayedVotes = () => {
    const votes = props.proposal.votes;
    if (showAllVotes()) return votes;
    return votes.slice(0, 5);
  };

  return (
    <div class="bg-white dark:bg-gray-800 rounded-xl p-6 border border-gray-200 dark:border-gray-700">
      <h3 class="text-lg font-bold text-gray-900 dark:text-white mb-6">
        Voting Results
      </h3>

      {/* Results Summary */}
      <div class="grid grid-cols-3 gap-4 mb-6">
        {/* For */}
        <div class="text-center p-4 bg-green-50 dark:bg-green-900/20 rounded-lg">
          <div class="w-12 h-12 bg-green-100 dark:bg-green-800 rounded-full flex items-center justify-center mx-auto mb-2">
            <svg class="w-6 h-6 text-green-600 dark:text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M14 10h4.764a2 2 0 011.789 2.894l-3.5 7A2 2 0 0115.263 21h-4.017c-.163 0-.326-.02-.485-.06L7 20m7-10V5a2 2 0 00-2-2h-.095c-.5 0-.905.405-.905.905 0 .714-.211 1.412-.608 2.006L7 11v9m7-10h-2M7 20H5a2 2 0 01-2-2v-6a2 2 0 012-2h2.5" />
            </svg>
          </div>
          <p class="text-2xl font-bold text-green-600 dark:text-green-400">
            {forPercentage().toFixed(1)}%
          </p>
          <p class="text-sm text-gray-600 dark:text-gray-400">For</p>
          <p class="text-xs text-gray-500 mt-1">
            {formatEther(props.proposal.votesFor)} votes
          </p>
        </div>

        {/* Against */}
        <div class="text-center p-4 bg-red-50 dark:bg-red-900/20 rounded-lg">
          <div class="w-12 h-12 bg-red-100 dark:bg-red-800 rounded-full flex items-center justify-center mx-auto mb-2">
            <svg class="w-6 h-6 text-red-600 dark:text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10 14H5.236a2 2 0 01-1.789-2.894l3.5-7A2 2 0 018.736 3h4.018a2 2 0 01.485.06l3.76.94m-7 10v5a2 2 0 002 2h.095c.5 0 .905-.405.905-.905 0-.714.211-1.412.608-2.006L17 13V4m-7 10h2m5-10h2a2 2 0 012 2v6a2 2 0 01-2 2h-2.5" />
            </svg>
          </div>
          <p class="text-2xl font-bold text-red-600 dark:text-red-400">
            {againstPercentage().toFixed(1)}%
          </p>
          <p class="text-sm text-gray-600 dark:text-gray-400">Against</p>
          <p class="text-xs text-gray-500 mt-1">
            {formatEther(props.proposal.votesAgainst)} votes
          </p>
        </div>

        {/* Abstain */}
        <div class="text-center p-4 bg-gray-50 dark:bg-gray-700/50 rounded-lg">
          <div class="w-12 h-12 bg-gray-100 dark:bg-gray-700 rounded-full flex items-center justify-center mx-auto mb-2">
            <svg class="w-6 h-6 text-gray-600 dark:text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M20 12H4" />
            </svg>
          </div>
          <p class="text-2xl font-bold text-gray-600 dark:text-gray-400">
            {abstainPercentage().toFixed(1)}%
          </p>
          <p class="text-sm text-gray-600 dark:text-gray-400">Abstain</p>
          <p class="text-xs text-gray-500 mt-1">
            {formatEther(props.proposal.votesAbstain)} votes
          </p>
        </div>
      </div>

      {/* Progress Bars */}
      <div class="space-y-4 mb-6">
        <div>
          <div class="flex justify-between text-sm mb-1">
            <span class="text-green-600 dark:text-green-400 font-medium">For</span>
            <span class="text-gray-600 dark:text-gray-400">
              {formatEther(props.proposal.votesFor)} / {formatEther(totalVotes())}
            </span>
          </div>
          <div class="h-3 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
            <div 
              class="h-full bg-green-500 rounded-full transition-all duration-500"
              style={{ width: `${forPercentage()}%` }}
            />
          </div>
        </div>

        <div>
          <div class="flex justify-between text-sm mb-1">
            <span class="text-red-600 dark:text-red-400 font-medium">Against</span>
            <span class="text-gray-600 dark:text-gray-400">
              {formatEther(props.proposal.votesAgainst)} / {formatEther(totalVotes())}
            </span>
          </div>
          <div class="h-3 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
            <div 
              class="h-full bg-red-500 rounded-full transition-all duration-500"
              style={{ width: `${againstPercentage()}%` }}
            />
          </div>
        </div>

        <div>
          <div class="flex justify-between text-sm mb-1">
            <span class="text-gray-600 dark:text-gray-400 font-medium">Abstain</span>
            <span class="text-gray-600 dark:text-gray-400">
              {formatEther(props.proposal.votesAbstain)} / {formatEther(totalVotes())}
            </span>
          </div>
          <div class="h-3 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
            <div 
              class="h-full bg-gray-400 rounded-full transition-all duration-500"
              style={{ width: `${abstainPercentage()}%` }}
            />
          </div>
        </div>
      </div>

      {/* Quorum */}
      <div class="bg-blue-50 dark:bg-blue-900/20 rounded-lg p-4 mb-6">
        <div class="flex justify-between items-center mb-2">
          <span class="text-sm font-medium text-blue-900 dark:text-blue-200">Quorum</span>
          <span class="text-sm text-blue-800 dark:text-blue-300">
            {formatEther(totalVotes())} / {formatEther(props.proposal.quorum)}
          </span>
        </div>
        <div class="h-2 bg-blue-200 dark:bg-blue-800 rounded-full overflow-hidden">
          <div 
            class="h-full bg-blue-500 rounded-full transition-all duration-500"
            style={{ width: `${quorumPercentage()}%` }}
          />
        </div>
        <p class="text-xs text-blue-700 dark:text-blue-300 mt-2">
          {quorumPercentage().toFixed(1)}% of required quorum reached
        </p>
      </div>

      {/* Voter List */}
      <Show when={props.proposal.votes.length > 0}>
        <div class="border-t border-gray-200 dark:border-gray-700 pt-6">
          <h4 class="font-medium text-gray-900 dark:text-white mb-4">
            Voters ({props.proposal.votes.length})
          </h4>
          <div class="space-y-2">
            <For each={displayedVotes()}>
              {(vote) => (
                <div class="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-700/50 rounded-lg">
                  <div class="flex items-center gap-3">
                    <span
                      class={`w-2 h-2 rounded-full ${
                        vote.type === "for"
                          ? "bg-green-500"
                          : vote.type === "against"
                          ? "bg-red-500"
                          : "bg-gray-400"
                      }`}
                    />
                    <span class="font-mono text-sm text-gray-700 dark:text-gray-300">
                      {formatAddress(vote.voter)}
                    </span>
                  </div>
                  <div class="text-right">
                    <p class="text-sm font-medium text-gray-900 dark:text-white">
                      {formatEther(vote.weight)} votes
                    </p>
                    <p class="text-xs text-gray-500">{formatDate(vote.timestamp)}</p>
                  </div>
                </div>
              )}
            </For>
          </div>
          <Show when={props.proposal.votes.length > 5}>
            <button
              onClick={() => setShowAllVotes(!showAllVotes())}
              class="mt-3 text-sm text-blue-600 hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-300"
            >
              {showAllVotes() ? "Show less" : `Show all ${props.proposal.votes.length} votes`}
            </button>
          </Show>
        </div>
      </Show>
    </div>
  );
}
