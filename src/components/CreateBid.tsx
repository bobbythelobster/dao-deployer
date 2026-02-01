import { createSignal, Show } from "solid-js";
import { useWallet } from "../stores/walletStore";
import { useToast } from "./ToastNotifications";
import { ButtonSpinner } from "./LoadingSpinner";
import { type Address, parseEther, formatEther } from "viem";
import type { Task } from "./TaskList";

interface CreateBidProps {
  task: Task;
  onSubmit: (bid: {
    amount: bigint;
    description: string;
    timeline: number;
    proposer: Address;
  }) => void;
  onCancel: () => void;
}

export default function CreateBid(props: CreateBidProps) {
  const { state: walletState } = useWallet();
  const toast = useToast();
  
  const [amount, setAmount] = createSignal(
    Number(formatEther(props.task.bounty))
  );
  const [description, setDescription] = createSignal("");
  const [timeline, setTimeline] = createSignal(7);
  const [isSubmitting, setIsSubmitting] = createSignal(false);
  const [errors, setErrors] = createSignal<Record<string, string>>({});

  const validate = () => {
    const newErrors: Record<string, string> = {};
    
    if (amount() <= 0) {
      newErrors.amount = "Bid amount must be greater than 0";
    } else if (amount() > Number(formatEther(props.task.bounty)) * 2) {
      newErrors.amount = "Bid amount cannot exceed 2x the bounty";
    }

    if (!description().trim()) {
      newErrors.description = "Please describe your approach";
    } else if (description().length < 50) {
      newErrors.description = "Description must be at least 50 characters";
    }

    if (timeline() < 1) {
      newErrors.timeline = "Timeline must be at least 1 day";
    } else if (timeline() > 90) {
      newErrors.timeline = "Timeline cannot exceed 90 days";
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e: Event) => {
    e.preventDefault();
    
    if (!walletState.isConnected) {
      toast.error("Please connect your wallet first");
      return;
    }

    if (!validate()) return;

    setIsSubmitting(true);
    try {
      await props.onSubmit({
        amount: parseEther(amount().toString()),
        description: description(),
        timeline: timeline(),
        proposer: walletState.address as Address,
      });
      toast.success("Bid submitted successfully!");
    } catch (error) {
      toast.error("Failed to submit bid");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} class="space-y-6">
      <div>
        <h2 class="text-2xl font-bold text-gray-900 dark:text-white mb-2">
          Submit Bid
        </h2>
        <p class="text-gray-600 dark:text-gray-400">
          Bid on "{props.task.title}"
        </p>
      </div>

      {/* Task Summary */}
      <div class="bg-gray-50 dark:bg-gray-700/50 rounded-lg p-4">
        <div class="flex justify-between items-center mb-2">
          <span class="text-sm text-gray-500 dark:text-gray-400">Task Bounty</span>
          <span class="font-semibold text-gray-900 dark:text-white">
            {formatEther(props.task.bounty)} {props.task.token}
          </span>
        </div>
        <div class="flex justify-between items-center">
          <span class="text-sm text-gray-500 dark:text-gray-400">Current Bids</span>
          <span class="font-semibold text-gray-900 dark:text-white">
            {props.task.bidsCount}
          </span>
        </div>
      </div>

      {/* Bid Amount */}
      <div>
        <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
          Your Bid Amount ({props.task.token})
        </label>
        <div class="relative">
          <input
            type="number"
            value={amount()}
            onInput={(e) => setAmount(parseFloat(e.currentTarget.value))}
            step="0.001"
            min="0"
            class={`w-full px-4 py-3 rounded-lg border ${
              errors().amount
                ? "border-red-500 focus:ring-red-500"
                : "border-gray-300 dark:border-gray-600 focus:ring-blue-500"
            } bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:outline-none focus:ring-2 transition-all`}
          />
          <span class="absolute right-4 top-1/2 -translate-y-1/2 text-gray-500">
            {props.task.token}
          </span>
        </div>
        {errors().amount && <p class="mt-1 text-sm text-red-600">{errors().amount}</p>}
        <p class="mt-1 text-xs text-gray-500">
          You can bid above or below the listed bounty
        </p>
      </div>

      {/* Timeline */}
      <div>
        <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
          Estimated Timeline: {timeline()} days
        </label>
        <input
          type="range"
          min="1"
          max="90"
          value={timeline()}
          onInput={(e) => setTimeline(parseInt(e.currentTarget.value))}
          class="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-blue-600"
        />
        <div class="flex justify-between text-xs text-gray-500 mt-1">
          <span>1 day</span>
          <span>90 days</span>
        </div>
        {errors().timeline && <p class="mt-1 text-sm text-red-600">{errors().timeline}</p>}
      </div>

      {/* Description */}
      <div>
        <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
          Your Approach
        </label>
        <textarea
          value={description()}
          onInput={(e) => setDescription(e.currentTarget.value)}
          placeholder="Describe your experience, approach to the task, and why you're the best candidate..."
          rows={6}
          class={`w-full px-4 py-3 rounded-lg border ${
            errors().description
              ? "border-red-500 focus:ring-red-500"
              : "border-gray-300 dark:border-gray-600 focus:ring-blue-500"
          } bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:outline-none focus:ring-2 transition-all resize-none`}
        />
        {errors().description && <p class="mt-1 text-sm text-red-600">{errors().description}</p>}
        <div class="flex justify-between mt-1">
          <p class="text-xs text-gray-500">Minimum 50 characters</p>
          <p class={`text-xs ${description().length < 50 ? "text-red-500" : "text-gray-500"}`}>
            {description().length} chars
          </p>
        </div>
      </div>

      {/* Deliverables Check */}
      <div class="bg-blue-50 dark:bg-blue-900/20 rounded-lg p-4">
        <h4 class="text-sm font-medium text-blue-900 dark:text-blue-200 mb-2">
          Required Deliverables
        </h4>
        <ul class="text-sm text-blue-800 dark:text-blue-300 space-y-1">
          {props.task.deliverables.map((item) => (
            <li key={item} class="flex items-center gap-2">
              <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              {item}
            </li>
          ))}
        </ul>
      </div>

      {/* Actions */}
      <div class="flex gap-4">
        <button
          type="button"
          onClick={props.onCancel}
          class="flex-1 px-6 py-3 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 font-semibold rounded-lg hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
        >
          Cancel
        </button>
        <button
          type="submit"
          disabled={isSubmitting()}
          class="flex-1 px-6 py-3 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-400 text-white font-semibold rounded-lg transition-colors flex items-center justify-center gap-2"
        >
          <Show when={isSubmitting()} fallback="Submit Bid">
            <ButtonSpinner size="sm" />
            Submitting...
          </Show>
        </button>
      </div>
    </form>
  );
}
