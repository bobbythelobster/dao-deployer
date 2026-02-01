import { createSignal, Show } from "solid-js";
import { 
  useProposals, 
  proposalActions, 
  type Proposal, 
  type VoteType,
  calculateVotePercentage 
} from "../stores/proposalStore";
import { useWallet, walletState } from "../stores/walletStore";
import LoadingSpinner, { ButtonSpinner } from "./LoadingSpinner";
import { useToast } from "./ToastNotifications";
import { parseEther, formatEther } from "viem";

interface VotingInterfaceProps {
  proposal: Proposal;
  userVotingPower?: bigint;
}

export default function VotingInterface(props: VotingInterfaceProps) {
  const { state } = useProposals();
  const { state: walletState } = useWallet();
  const toast = useToast();
  const [selectedVote, setSelectedVote] = createSignal<VoteType | null>(null);
  const [isSubmitting, setIsSubmitting] = createSignal(false);
  const [showConfirm, setShowConfirm] = createSignal(false);

  const canVote = () => {
    return (
      walletState.isConnected &&
      props.proposal.status === "active" &&
      !props.proposal.hasVoted &&
      Date.now() < props.proposal.endTime &&
      (props.userVotingPower || 0n) > 0n
    );
  };

  const handleVoteSelect = (vote: VoteType) => {
    setSelectedVote(vote);
    setShowConfirm(true);
  };

  const handleSubmitVote = async () => {
    if (!selectedVote()) return;
    
    setIsSubmitting(true);
    try {
      await proposalActions.vote(
        props.proposal.id,
        selectedVote()!,
        props.userVotingPower || parseEther("1")
      );
      toast.success("Vote submitted successfully!");
      setShowConfirm(false);
    } catch (error) {
      toast.error("Failed to submit vote");
    } finally {
      setIsSubmitting(false);
    }
  };

  const totalVotes = () => {
    return props.proposal.votesFor + props.proposal.votesAgainst + props.proposal.votesAbstain;
  };

  const forPercentage = () => calculateVotePercentage(props.proposal.votesFor, totalVotes());
  const againstPercentage = () => calculateVotePercentage(props.proposal.votesAgainst, totalVotes());
  const abstainPercentage = () => calculateVotePercentage(props.proposal.votesAbstain, totalVotes());

  const getVoteButtonStyle = (vote: VoteType) => {
    const base = "flex-1 py-4 px-6 rounded-xl font-semibold transition-all flex flex-col items-center gap-2";
    
    if (props.proposal.userVote === vote) {
      return `${base} ring-2 ring-offset-2 ${
        vote === "for" ? "bg-green-500 text-white ring-green-500" :
        vote === "against" ? "bg-red-500 text-white ring-red-500" :
        "bg-gray-500 text-white ring-gray-500"
      }`;
    }
    
    if (selectedVote() === vote) {
      return `${base} ring-2 ring-offset-2 ${
        vote === "for" ? "bg-green-100 text-green-800 ring-green-500 dark:bg-green-900/30 dark:text-green-200" :
        vote === "against" ? "bg-red-100 text-red-800 ring-red-500 dark:bg-red-900/30 dark:text-red-200" :
        "bg-gray-100 text-gray-800 ring-gray-500 dark:bg-gray-700 dark:text-gray-200"
      }`;
    }
    
    return `${base} ${
      vote === "for" ? "bg-green-50 text-green-700 hover:bg-green-100 dark:bg-green-900/20 dark:text-green-300 dark:hover:bg-green-900/30" :
      vote === "against" ? "bg-red-50 text-red-700 hover:bg-red-100 dark:bg-red-900/20 dark:text-red-300 dark:hover:bg-red-900/30" :
      "bg-gray-50 text-gray-700 hover:bg-gray-100 dark:bg-gray-800 dark:text-gray-300 dark:hover:bg-gray-700"
    }`;
  };

  return (
    <div class="bg-white dark:bg-gray-800 rounded-xl p-6 border border-gray-200 dark:border-gray-700">
      <h3 class="text-lg font-bold text-gray-900 dark:text-white mb-4">
        Cast Your Vote
      </h3>

      {/* Vote Stats */}
      <div class="space-y-3 mb-6">
        {/* For */}
        <div>
          <div class="flex justify-between text-sm mb-1">
            <span class="text-green-600 dark:text-green-400 font-medium">
              For ({forPercentage().toFixed(1)}%)
            </span>
            <span class="text-gray-600 dark:text-gray-400">
              {formatEther(props.proposal.votesFor)} votes
            </span>
          </div>
          <div class="h-2 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
            <div 
              class="h-full bg-green-500 rounded-full transition-all"
              style={{ width: `${forPercentage()}%` }}
            />
          </div>
        </div>

        {/* Against */}
        <div>
          <div class="flex justify-between text-sm mb-1">
            <span class="text-red-600 dark:text-red-400 font-medium">
              Against ({againstPercentage().toFixed(1)}%)
            </span>
            <span class="text-gray-600 dark:text-gray-400">
              {formatEther(props.proposal.votesAgainst)} votes
            </span>
          </div>
          <div class="h-2 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
            <div 
              class="h-full bg-red-500 rounded-full transition-all"
              style={{ width: `${againstPercentage()}%` }}
            />
          </div>
        </div>

        {/* Abstain */}
        <div>
          <div class="flex justify-between text-sm mb-1">
            <span class="text-gray-600 dark:text-gray-400 font-medium">
              Abstain ({abstainPercentage().toFixed(1)}%)
            </span>
            <span class="text-gray-600 dark:text-gray-400">
              {formatEther(props.proposal.votesAbstain)} votes
            </span>
          </div>
          <div class="h-2 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
            <div 
              class="h-full bg-gray-400 rounded-full transition-all"
              style={{ width: `${abstainPercentage()}%` }}
            />
          </div>
        </div>
      </div>

      {/* Quorum Progress */}
      <div class="bg-gray-50 dark:bg-gray-700/50 rounded-lg p-4 mb-6">
        <div class="flex justify-between text-sm mb-2">
          <span class="text-gray-600 dark:text-gray-400">Quorum Progress</span>
          <span class="font-medium text-gray-900 dark:text-white">
            {formatEther(totalVotes())} / {formatEther(props.proposal.quorum)}
          </span>
        </div>
        <div class="h-2 bg-gray-200 dark:bg-gray-600 rounded-full overflow-hidden">
          <div 
            class="h-full bg-blue-500 rounded-full transition-all"
            style={{ width: `${Math.min(100, calculateVotePercentage(totalVotes(), props.proposal.quorum))}%` }}
          />
        </div>
      </div>

      {/* Voting Buttons */}
      <Show 
        when={props.proposal.status === "active" && !props.proposal.hasVoted}
        fallback={
          <div class="text-center py-4">
            <Show when={props.proposal.hasVoted}>
              <div class="inline-flex items-center gap-2 px-4 py-2 bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-300 rounded-lg">
                <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7" />
                </svg>
                <span class="font-medium">
                  You voted {props.proposal.userVote}
                </span>
              </div>
            </Show>
            <Show when={props.proposal.status !== "active" && !props.proposal.hasVoted}>
              <p class="text-gray-500 dark:text-gray-400">
                Voting is {props.proposal.status}
              </p>
            </Show>
          </div>
        }
      >
        <Show 
          when={walletState.isConnected}
          fallback={
            <div class="text-center py-4 text-gray-500 dark:text-gray-400">
              Connect your wallet to vote
            </div>
          }
        >
          <div class="grid grid-cols-3 gap-3">
            <button
              onClick={() => handleVoteSelect("for")}
              class={getVoteButtonStyle("for")}
              disabled={isSubmitting()}
            >
              <svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M14 10h4.764a2 2 0 011.789 2.894l-3.5 7A2 2 0 0115.263 21h-4.017c-.163 0-.326-.02-.485-.06L7 20m7-10V5a2 2 0 00-2-2h-.095c-.5 0-.905.405-.905.905 0 .714-.211 1.412-.608 2.006L7 11v9m7-10h-2M7 20H5a2 2 0 01-2-2v-6a2 2 0 012-2h2.5" />
              </svg>
              <span>For</span>
            </button>

            <button
              onClick={() => handleVoteSelect("against")}
              class={getVoteButtonStyle("against")}
              disabled={isSubmitting()}
            >
              <svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10 14H5.236a2 2 0 01-1.789-2.894l3.5-7A2 2 0 018.736 3h4.018a2 2 0 01.485.06l3.76.94m-7 10v5a2 2 0 002 2h.095c.5 0 .905-.405.905-.905 0-.714.211-1.412.608-2.006L17 13V4m-7 10h2m5-10h2a2 2 0 012 2v6a2 2 0 01-2 2h-2.5" />
              </svg>
              <span>Against</span>
            </button>

            <button
              onClick={() => handleVoteSelect("abstain")}
              class={getVoteButtonStyle("abstain")}
              disabled={isSubmitting()}
            >
              <svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M20 12H4" />
              </svg>
              <span>Abstain</span>
            </button>
          </div>

          <Show when={props.userVotingPower}>
            <p class="text-center text-sm text-gray-500 dark:text-gray-400 mt-3">
              Your voting power: {formatEther(props.userVotingPower!)} tokens
            </p>
          </Show>
        </Show>
      </Show>

      {/* Confirmation Modal */}
      <Show when={showConfirm()}>
        <div class="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div class="bg-white dark:bg-gray-800 rounded-xl p-6 max-w-md w-full">
            <h4 class="text-lg font-bold text-gray-900 dark:text-white mb-2">
              Confirm Your Vote
            </h4>
            <p class="text-gray-600 dark:text-gray-400 mb-6">
              Are you sure you want to vote <strong>{selectedVote()}</strong> on this proposal? 
              This action cannot be undone.
            </p>
            <div class="flex gap-3">
              <button
                onClick={() => setShowConfirm(false)}
                class="flex-1 px-4 py-2 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
                disabled={isSubmitting()}
              >
                Cancel
              </button>
              <button
                onClick={handleSubmitVote}
                class="flex-1 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors flex items-center justify-center gap-2"
                disabled={isSubmitting()}
              >
                <Show when={isSubmitting()} fallback={"Confirm Vote"}>
                  <ButtonSpinner size="sm" />
                  Submitting...
                </Show>
              </button>
            </div>
          </div>
        </div>
      </Show>
    </div>
  );
}
