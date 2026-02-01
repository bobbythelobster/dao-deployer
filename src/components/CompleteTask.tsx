import { createSignal, Show, For } from "solid-js";
import { useWallet } from "../stores/walletStore";
import { useToast } from "./ToastNotifications";
import { ButtonSpinner } from "./LoadingSpinner";
import type { Task } from "./TaskList";
import type { Address } from "viem";

interface CompleteTaskProps {
  task: Task;
  isAssignee: boolean;
  isTaskCreator: boolean;
  onSubmitWork: (submission: {
    deliverables: string[];
    notes: string;
    proofLinks: string[];
  }) => void;
  onApproveWork?: () => void;
  onRequestChanges?: (feedback: string) => void;
}

export default function CompleteTask(props: CompleteTaskProps) {
  const { state: walletState } = useWallet();
  const toast = useToast();

  const [deliverables, setDeliverables] = createSignal<string[]>([""]);
  const [notes, setNotes] = createSignal("");
  const [proofLinks, setProofLinks] = createSignal<string[]>([""]);
  const [isSubmitting, setIsSubmitting] = createSignal(false);
  const [feedback, setFeedback] = createSignal("");
  const [showFeedbackForm, setShowFeedbackForm] = createSignal(false);

  const addDeliverable = () => {
    setDeliverables([...deliverables(), ""]);
  };

  const updateDeliverable = (index: number, value: string) => {
    const newDeliverables = [...deliverables()];
    newDeliverables[index] = value;
    setDeliverables(newDeliverables);
  };

  const removeDeliverable = (index: number) => {
    setDeliverables(deliverables().filter((_, i) => i !== index));
  };

  const addProofLink = () => {
    setProofLinks([...proofLinks(), ""]);
  };

  const updateProofLink = (index: number, value: string) => {
    const newLinks = [...proofLinks()];
    newLinks[index] = value;
    setProofLinks(newLinks);
  };

  const removeProofLink = (index: number) => {
    setProofLinks(proofLinks().filter((_, i) => i !== index));
  };

  const handleSubmit = async (e: Event) => {
    e.preventDefault();

    const validDeliverables = deliverables().filter((d) => d.trim());
    if (validDeliverables.length === 0) {
      toast.error("Please add at least one deliverable");
      return;
    }

    setIsSubmitting(true);
    try {
      await props.onSubmitWork({
        deliverables: validDeliverables,
        notes: notes(),
        proofLinks: proofLinks().filter((l) => l.trim()),
      });
      toast.success("Work submitted successfully!");
    } catch (error) {
      toast.error("Failed to submit work");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleRequestChanges = async () => {
    if (!feedback().trim()) {
      toast.error("Please provide feedback");
      return;
    }
    props.onRequestChanges?.(feedback());
    setShowFeedbackForm(false);
    toast.success("Feedback sent to assignee");
  };

  return (
    <div class="space-y-6">
      <div>
        <h2 class="text-2xl font-bold text-gray-900 dark:text-white mb-2">
          Complete Task
        </h2>
        <p class="text-gray-600 dark:text-gray-400">
          {props.task.title}
        </p>
      </div>

      <Show when={props.isAssignee}>
        <form onSubmit={handleSubmit} class="space-y-6">
          {/* Deliverables */}
          <div>
            <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Deliverables
            </label>
            <p class="text-xs text-gray-500 mb-3">
              List all files, links, or outputs you've produced
            </p>
            <div class="space-y-2">
              <For each={deliverables()}>
                {(deliverable, index) => (
                  <div class="flex gap-2">
                    <input
                      type="text"
                      value={deliverable}
                      onInput={(e) => updateDeliverable(index(), e.currentTarget.value)}
                      placeholder={`Deliverable ${index() + 1}`}
                      class="flex-1 px-4 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                    <Show when={deliverables().length > 1}>
                      <button
                        type="button"
                        onClick={() => removeDeliverable(index())}
                        class="px-3 py-2 text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors"
                      >
                        <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
                        </svg>
                      </button>
                    </Show>
                  </div>
                )}
              </For>
            </div>
            <button
              type="button"
              onClick={addDeliverable}
              class="mt-2 text-sm text-blue-600 hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-300"
            >
              + Add another deliverable
            </button>
          </div>

          {/* Proof Links */}
          <div>
            <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Proof Links (Optional)
            </label>
            <p class="text-xs text-gray-500 mb-3">
              GitHub repos, demos, screenshots, or other evidence
            </p>
            <div class="space-y-2">
              <For each={proofLinks()}>
                {(link, index) => (
                  <div class="flex gap-2">
                    <input
                      type="url"
                      value={link}
                      onInput={(e) => updateProofLink(index(), e.currentTarget.value)}
                      placeholder="https://..."
                      class="flex-1 px-4 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                    <Show when={proofLinks().length > 1}>
                      <button
                        type="button"
                        onClick={() => removeProofLink(index())}
                        class="px-3 py-2 text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors"
                      >
                        <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
                        </svg>
                      </button>
                    </Show>
                  </div>
                )}
              </For>
            </div>
            <button
              type="button"
              onClick={addProofLink}
              class="mt-2 text-sm text-blue-600 hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-300"
            >
              + Add another link
            </button>
          </div>

          {/* Notes */}
          <div>
            <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Additional Notes
            </label>
            <textarea
              value={notes()}
              onInput={(e) => setNotes(e.currentTarget.value)}
              placeholder="Any additional context, instructions, or notes for the task creator..."
              rows={4}
              class="w-full px-4 py-3 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
            />
          </div>

          {/* Expected Deliverables */}
          <div class="bg-blue-50 dark:bg-blue-900/20 rounded-lg p-4">
            <h4 class="text-sm font-medium text-blue-900 dark:text-blue-200 mb-2">
              Expected Deliverables
            </h4>
            <ul class="text-sm text-blue-800 dark:text-blue-300 space-y-1">
              <For each={props.task.deliverables}>
                {(item) => (
                  <li class="flex items-center gap-2">
                    <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    {item}
                  </li>
                )}
              </For>
            </ul>
          </div>

          {/* Submit Button */}
          <button
            type="submit"
            disabled={isSubmitting()}
            class="w-full px-6 py-3 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-400 text-white font-semibold rounded-lg transition-colors flex items-center justify-center gap-2"
          >
            <Show when={isSubmitting()} fallback="Submit Work for Review">
              <ButtonSpinner size="sm" />
              Submitting...
            </Show>
          </button>
        </form>
      </Show>

      <Show when={props.isTaskCreator}>
        <div class="bg-gray-50 dark:bg-gray-700/50 rounded-lg p-6">
          <h3 class="text-lg font-bold text-gray-900 dark:text-white mb-4">
            Review Submitted Work
          </h3>
          <p class="text-gray-600 dark:text-gray-400 mb-6">
            Review the deliverables submitted by the assignee and either approve or request changes.
          </p>

          <Show when={!showFeedbackForm()}>
            <div class="flex gap-4">
              <button
                onClick={props.onApproveWork}
                class="flex-1 px-6 py-3 bg-green-600 hover:bg-green-700 text-white font-semibold rounded-lg transition-colors"
              >
                Approve & Release Payment
              </button>
              <button
                onClick={() => setShowFeedbackForm(true)}
                class="flex-1 px-6 py-3 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 font-semibold rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
              >
                Request Changes
              </button>
            </div>
          </Show>

          <Show when={showFeedbackForm()}>
            <div class="space-y-4">
              <textarea
                value={feedback()}
                onInput={(e) => setFeedback(e.currentTarget.value)}
                placeholder="Describe what needs to be changed or improved..."
                rows={4}
                class="w-full px-4 py-3 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
              />
              <div class="flex gap-4">
                <button
                  onClick={() => setShowFeedbackForm(false)}
                  class="flex-1 px-6 py-3 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 font-semibold rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={handleRequestChanges}
                  class="flex-1 px-6 py-3 bg-yellow-600 hover:bg-yellow-700 text-white font-semibold rounded-lg transition-colors"
                >
                  Send Feedback
                </button>
              </div>
            </div>
          </Show>
        </div>
      </Show>
    </div>
  );
}
