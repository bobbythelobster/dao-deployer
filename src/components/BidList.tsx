import { For, Show, createSignal } from "solid-js";
import { type Address, formatEther } from "viem";
import { useWallet } from "../stores/walletStore";
import type { Task } from "./TaskList";

export interface Bid {
  id: string;
  taskId: string;
  proposer: Address;
  amount: bigint;
  description: string;
  timeline: number;
  status: "pending" | "accepted" | "rejected";
  createdAt: number;
}

interface BidListProps {
  task: Task;
  bids?: Bid[];
  isTaskCreator: boolean;
  onAcceptBid?: (bidId: string) => void;
  onRejectBid?: (bidId: string) => void;
}

// Mock bids
const mockBids: Bid[] = [
  {
    id: "1",
    taskId: "1",
    proposer: "0x4444444444444444444444444444444444444444" as Address,
    amount: BigInt("4500000000000000000"),
    description: "I have 5 years of experience building landing pages for crypto projects. I can deliver a responsive, modern design with animations and dark mode support within 10 days.",
    timeline: 10,
    status: "pending",
    createdAt: Date.now() - 86400000,
  },
  {
    id: "2",
    taskId: "1",
    proposer: "0x5555555555555555555555555555555555555555" as Address,
    amount: BigInt("5200000000000000000"),
    description: "Full-stack developer with expertise in React and Web3. I'll create a pixel-perfect landing page with wallet connection integration and optimized performance.",
    timeline: 12,
    status: "pending",
    createdAt: Date.now() - 86400000 * 2,
  },
  {
    id: "3",
    taskId: "1",
    proposer: "0x6666666666666666666666666666666666666666" as Address,
    amount: BigInt("4800000000000000000"),
    description: "UI/UX designer and frontend developer. I'll deliver a beautiful, conversion-optimized landing page with A/B testing capabilities.",
    timeline: 8,
    status: "accepted",
    createdAt: Date.now() - 86400000 * 3,
  },
];

export default function BidList(props: BidListProps) {
  const { state: walletState } = useWallet();
  const [expandedBid, setExpandedBid] = createSignal<string | null>(null);

  const bids = () => props.bids || mockBids.filter((b) => b.taskId === props.task.id);

  const formatAddress = (addr: string) => {
    return `${addr.slice(0, 6)}...${addr.slice(-4)}`;
  };

  const formatDate = (timestamp: number) => {
    return new Date(timestamp).toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
    });
  };

  const getStatusColor = (status: Bid["status"]) => {
    const colors = {
      pending: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/50 dark:text-yellow-300",
      accepted: "bg-green-100 text-green-800 dark:bg-green-900/50 dark:text-green-300",
      rejected: "bg-red-100 text-red-800 dark:bg-red-900/50 dark:text-red-300",
    };
    return colors[status];
  };

  const isMyBid = (bid: Bid) => {
    return walletState.address?.toLowerCase() === bid.proposer.toLowerCase();
  };

  return (
    <div class="space-y-4">
      <div class="flex items-center justify-between">
        <h3 class="text-lg font-bold text-gray-900 dark:text-white">
          Bids ({bids().length})
        </h3>
        <Show when={!props.isTaskCreator && !bids().some(isMyBid)}>
          <button class="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium rounded-lg transition-colors">
            Submit Bid
          </button>
        </Show>
      </div>

      <For each={bids()}>
        {(bid) => (
          <div
            class={`p-4 rounded-lg border transition-all ${
              bid.status === "accepted"
                ? "bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-800"
                : "bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700"
            }`}
          >
            <div class="flex items-start justify-between gap-4">
              <div class="flex-1">
                <div class="flex items-center gap-2 mb-2">
                  <span class="font-mono text-sm text-gray-700 dark:text-gray-300">
                    {formatAddress(bid.proposer)}
                  </span>
                  <Show when={isMyBid(bid)}>
                    <span class="px-2 py-0.5 bg-blue-100 dark:bg-blue-900/50 text-blue-700 dark:text-blue-300 text-xs rounded-full">
                      You
                    </span>
                  </Show>
                  <span class={`px-2 py-0.5 text-xs font-medium rounded-full ${getStatusColor(bid.status)}`}>
                    {bid.status}
                  </span>
                </div>

                <div class="flex items-center gap-4 text-sm text-gray-600 dark:text-gray-400 mb-3">
                  <span class="font-semibold text-gray-900 dark:text-white">
                    {formatEther(bid.amount)} {props.task.token}
                  </span>
                  <span>•</span>
                  <span>{bid.timeline} days</span>
                  <span>•</span>
                  <span>{formatDate(bid.createdAt)}</span>
                </div>

                <p class={`text-gray-600 dark:text-gray-400 text-sm ${
                  expandedBid() === bid.id ? "" : "line-clamp-2"
                }`}>
                  {bid.description}
                </p>

                <Show when={bid.description.length > 150}>
                  <button
                    onClick={() => setExpandedBid(expandedBid() === bid.id ? null : bid.id)}
                    class="text-blue-600 hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-300 text-sm mt-2"
                  >
                    {expandedBid() === bid.id ? "Show less" : "Read more"}
                  </button>
                </Show>
              </div>

              {/* Actions for task creator */}
              <Show when={props.isTaskCreator && bid.status === "pending"}>
                <div class="flex flex-col gap-2">
                  <button
                    onClick={() => props.onAcceptBid?.(bid.id)}
                    class="px-3 py-1.5 bg-green-600 hover:bg-green-700 text-white text-sm font-medium rounded-lg transition-colors"
                  >
                    Accept
                  </button>
                  <button
                    onClick={() => props.onRejectBid?.(bid.id)}
                    class="px-3 py-1.5 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 text-sm font-medium rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
                  >
                    Reject
                  </button>
                </div>
              </Show>
            </div>
          </div>
        )}
      </For>

      <Show when={bids().length === 0}>
        <div class="text-center py-8 bg-gray-50 dark:bg-gray-800/50 rounded-lg">
          <p class="text-gray-500 dark:text-gray-400">
            No bids yet. Be the first to submit a bid!
          </p>
        </div>
      </Show>
    </div>
  );
}
