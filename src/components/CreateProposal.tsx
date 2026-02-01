import { createSignal, Show, For } from "solid-js";
import { useProposals, proposalActions, type ProposalAction } from "../stores/proposalStore";
import { useWallet } from "../stores/walletStore";
import { useToast } from "./ToastNotifications";
import { ButtonSpinner } from "./LoadingSpinner";
import { type Address, parseEther } from "viem";

interface CreateProposalProps {
  daoId: string;
  onSuccess?: () => void;
  onCancel?: () => void;
}

export default function CreateProposal(props: CreateProposalProps) {
  const { state } = useProposals();
  const { state: walletState } = useWallet();
  const toast = useToast();

  const [step, setStep] = createSignal<1 | 2 | 3>(1);
  const [title, setTitle] = createSignal("");
  const [description, setDescription] = createSignal("");
  const [content, setContent] = createSignal("");
  const [actions, setActions] = createSignal<ProposalAction[]>([]);
  const [errors, setErrors] = createSignal<Record<string, string>>({});

  // New action form
  const [newActionTarget, setNewActionTarget] = createSignal("");
  const [newActionValue, setNewActionValue] = createSignal("");
  const [newActionData, setNewActionData] = createSignal("");
  const [newActionDesc, setNewActionDesc] = createSignal("");

  const validateStep1 = () => {
    const newErrors: Record<string, string> = {};
    
    if (!title().trim()) {
      newErrors.title = "Title is required";
    } else if (title().length < 5) {
      newErrors.title = "Title must be at least 5 characters";
    }

    if (!description().trim()) {
      newErrors.description = "Description is required";
    } else if (description().length < 20) {
      newErrors.description = "Description must be at least 20 characters";
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const validateStep2 = () => {
    if (!content().trim()) {
      setErrors({ content: "Detailed content is required" });
      return false;
    }
    setErrors({});
    return true;
  };

  const handleAddAction = () => {
    if (!newActionTarget() || !newActionDesc()) {
      toast.error("Target address and description are required");
      return;
    }

    const action: ProposalAction = {
      target: newActionTarget() as Address,
      value: parseEther(newActionValue() || "0"),
      data: newActionData() || "0x",
      description: newActionDesc(),
    };

    setActions([...actions(), action]);
    setNewActionTarget("");
    setNewActionValue("");
    setNewActionData("");
    setNewActionDesc("");
    toast.success("Action added");
  };

  const removeAction = (index: number) => {
    setActions(actions().filter((_, i) => i !== index));
  };

  const handleSubmit = async () => {
    if (!walletState.isConnected) {
      toast.error("Please connect your wallet first");
      return;
    }

    try {
      await proposalActions.createProposal(props.daoId, {
        title: title(),
        description: description(),
        content: content(),
        actions: actions(),
      });
      toast.success("Proposal created successfully!");
      props.onSuccess?.();
    } catch (error) {
      toast.error("Failed to create proposal");
    }
  };

  const formatAddress = (addr: string) => {
    return `${addr.slice(0, 6)}...${addr.slice(-4)}`;
  };

  return (
    <div class="max-w-3xl mx-auto">
      {/* Header */}
      <div class="mb-6">
        <h2 class="text-2xl font-bold text-gray-900 dark:text-white mb-2">
          Create Proposal
        </h2>
        <p class="text-gray-600 dark:text-gray-400">
          Submit a new proposal for the DAO to vote on
        </p>
      </div>

      {/* Progress Steps */}
      <div class="flex items-center gap-4 mb-8">
        {[1, 2, 3].map((s) => (
          <div class="flex items-center gap-2">
            <div
              class={`w-8 h-8 rounded-full flex items-center justify-center font-semibold text-sm ${
                s < step()
                  ? "bg-green-500 text-white"
                  : s === step()
                  ? "bg-blue-600 text-white"
                  : "bg-gray-200 dark:bg-gray-700 text-gray-500 dark:text-gray-400"
              }`}
            >
              {s < step() ? (
                <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7" />
                </svg>
              ) : (
                s
              )}
            </div>
            <span
              class={`text-sm ${
                s <= step()
                  ? "text-gray-900 dark:text-white font-medium"
                  : "text-gray-500 dark:text-gray-400"
              }`}
            >
              {s === 1 ? "Basic Info" : s === 2 ? "Content" : "Actions"}
            </span>
          </div>
        ))}
      </div>

      {/* Step 1: Basic Info */}
      <Show when={step() === 1}>
        <div class="space-y-6">
          <div>
            <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Proposal Title <span class="text-red-500">*</span>
            </label>
            <input
              type="text"
              value={title()}
              onInput={(e) => setTitle(e.currentTarget.value)}
              placeholder="e.g., Fund Community Initiative"
              class={`w-full px-4 py-3 rounded-lg border ${
                errors().title
                  ? "border-red-500 focus:ring-red-500"
                  : "border-gray-300 dark:border-gray-600 focus:ring-blue-500"
              } bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:outline-none focus:ring-2 transition-all`}
            />
            {errors().title && <p class="mt-1 text-sm text-red-600">{errors().title}</p>}
          </div>

          <div>
            <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Short Description <span class="text-red-500">*</span>
            </label>
            <textarea
              value={description()}
              onInput={(e) => setDescription(e.currentTarget.value)}
              placeholder="Brief summary of the proposal (shown in lists)"
              rows={3}
              class={`w-full px-4 py-3 rounded-lg border ${
                errors().description
                  ? "border-red-500 focus:ring-red-500"
                  : "border-gray-300 dark:border-gray-600 focus:ring-blue-500"
              } bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:outline-none focus:ring-2 transition-all resize-none`}
            />
            {errors().description && <p class="mt-1 text-sm text-red-600">{errors().description}</p>}
            <p class="mt-1 text-xs text-gray-500">{description().length}/280 characters</p>
          </div>

          <div class="flex gap-4">
            <button
              onClick={props.onCancel}
              class="flex-1 px-6 py-3 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 font-semibold rounded-lg hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={() => validateStep1() && setStep(2)}
              class="flex-1 px-6 py-3 bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-lg transition-colors"
            >
              Continue
            </button>
          </div>
        </div>
      </Show>

      {/* Step 2: Content */}
      <Show when={step() === 2}>
        <div class="space-y-6">
          <div>
            <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Detailed Content <span class="text-red-500">*</span>
            </label>
            <p class="text-xs text-gray-500 mb-2">
              Use Markdown formatting. Include motivation, details, and any relevant links.
            </p>
            <textarea
              value={content()}
              onInput={(e) => setContent(e.currentTarget.value)}
              placeholder={`# Proposal Title

## Summary
Brief overview of what this proposal aims to achieve.

## Motivation
Why is this proposal necessary? What problem does it solve?

## Details
Specific details about the implementation.

## Timeline
- Week 1: Initial setup
- Week 2: Execution
- Week 3: Review

## Budget
Breakdown of costs if applicable.`}
              rows={15}
              class={`w-full px-4 py-3 rounded-lg border font-mono text-sm ${
                errors().content
                  ? "border-red-500 focus:ring-red-500"
                  : "border-gray-300 dark:border-gray-600 focus:ring-blue-500"
              } bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:outline-none focus:ring-2 transition-all resize-y`}
            />
            {errors().content && <p class="mt-1 text-sm text-red-600">{errors().content}</p>}
          </div>

          <div class="flex gap-4">
            <button
              onClick={() => setStep(1)}
              class="flex-1 px-6 py-3 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 font-semibold rounded-lg hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
            >
              Back
            </button>
            <button
              onClick={() => validateStep2() && setStep(3)}
              class="flex-1 px-6 py-3 bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-lg transition-colors"
            >
              Continue
            </button>
          </div>
        </div>
      </Show>

      {/* Step 3: Actions */}
      <Show when={step() === 3}>
        <div class="space-y-6">
          <div>
            <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Proposal Actions (Optional)
            </label>
            <p class="text-xs text-gray-500 mb-4">
              Add executable actions that will be performed if the proposal passes.
            </p>

            {/* Existing Actions */}
            <Show when={actions().length > 0}>
              <div class="space-y-2 mb-4">
                <For each={actions()}>
                  {(action, index) => (
                    <div class="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-700/50 rounded-lg">
                      <div>
                        <p class="font-medium text-gray-900 dark:text-white text-sm">
                          {action.description}
                        </p>
                        <p class="text-xs text-gray-500">
                          To: {formatAddress(action.target)} • Value: {formatEther(action.value)} ETH
                        </p>
                      </div>
                      <button
                        onClick={() => removeAction(index())}
                        class="text-red-500 hover:text-red-700 p-1"
                      >
                        <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
                        </svg>
                      </button>
                    </div>
                  )}
                </For>
              </div>
            </Show>

            {/* Add New Action Form */}
            <div class="border border-gray-200 dark:border-gray-700 rounded-lg p-4 space-y-3">
              <p class="font-medium text-gray-900 dark:text-white text-sm">Add Action</p>
              
              <input
                type="text"
                value={newActionTarget()}
                onInput={(e) => setNewActionTarget(e.currentTarget.value)}
                placeholder="Target Address (0x...)"
                class="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              
              <input
                type="text"
                value={newActionValue()}
                onInput={(e) => setNewActionValue(e.currentTarget.value)}
                placeholder="ETH Value (optional)"
                class="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              
              <input
                type="text"
                value={newActionData()}
                onInput={(e) => setNewActionData(e.currentTarget.value)}
                placeholder="Transaction Data (0x...) - optional"
                class="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              
              <input
                type="text"
                value={newActionDesc()}
                onInput={(e) => setNewActionDesc(e.currentTarget.value)}
                placeholder="Action Description"
                class="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              
              <button
                onClick={handleAddAction}
                class="w-full px-4 py-2 bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 text-gray-700 dark:text-gray-300 font-medium rounded-lg transition-colors text-sm"
              >
                + Add Action
              </button>
            </div>
          </div>

          {/* Summary */}
          <div class="bg-blue-50 dark:bg-blue-900/20 rounded-lg p-4">
            <h4 class="font-medium text-blue-900 dark:text-blue-200 mb-2">Proposal Summary</h4>
            <ul class="text-sm text-blue-800 dark:text-blue-300 space-y-1">
              <li>• Title: {title()}</li>
              <li>• Description: {description().slice(0, 50)}...</li>
              <li>• Content: {content().length} characters</li>
              <li>• Actions: {actions().length}</li>
            </ul>
          </div>

          <div class="flex gap-4">
            <button
              onClick={() => setStep(2)}
              class="flex-1 px-6 py-3 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 font-semibold rounded-lg hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
            >
              Back
            </button>
            <button
              onClick={handleSubmit}
              disabled={state.isCreating}
              class="flex-1 px-6 py-3 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-400 text-white font-semibold rounded-lg transition-colors flex items-center justify-center gap-2"
            >
              <Show when={state.isCreating} fallback={"Submit Proposal"}>
                <ButtonSpinner size="sm" />
                Creating...
              </Show>
            </button>
          </div>
        </div>
      </Show>
    </div>
  );
}
