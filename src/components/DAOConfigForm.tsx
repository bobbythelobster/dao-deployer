import { createSignal, createEffect } from "solid-js";
import { useDAO, type DAOConfig } from "../stores/daoStore";

interface DAOConfigFormProps {
  initialData?: Partial<DAOConfig>;
  onSubmit: (config: DAOConfig) => void;
  onBack?: () => void;
}

export default function DAOConfigForm(props: DAOConfigFormProps) {
  const [name, setName] = createSignal(props.initialData?.name || "");
  const [description, setDescription] = createSignal(props.initialData?.description || "");
  const [errors, setErrors] = createSignal<Record<string, string>>({});

  const validate = () => {
    const newErrors: Record<string, string> = {};
    
    if (!name().trim()) {
      newErrors.name = "DAO name is required";
    } else if (name().length < 3) {
      newErrors.name = "Name must be at least 3 characters";
    } else if (name().length > 50) {
      newErrors.name = "Name must be less than 50 characters";
    }

    if (!description().trim()) {
      newErrors.description = "Description is required";
    } else if (description().length < 10) {
      newErrors.description = "Description must be at least 10 characters";
    } else if (description().length > 500) {
      newErrors.description = "Description must be less than 500 characters";
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = (e: Event) => {
    e.preventDefault();
    if (validate()) {
      props.onSubmit({
        name: name(),
        description: description(),
        tokenConfig: props.initialData?.tokenConfig || {
          name: "",
          symbol: "",
          initialSupply: "",
          maxSupply: "",
          decimals: 18,
        },
        governanceParams: props.initialData?.governanceParams || {
          votingThreshold: 0n,
          votingDuration: 86400 * 3,
          executionDelay: 86400,
          quorum: 51,
          proposalThreshold: 0n,
        },
      });
    }
  };

  return (
    <form onSubmit={handleSubmit} class="space-y-6">
      <div class="text-center mb-8">
        <h2 class="text-2xl font-bold text-gray-900 dark:text-white mb-2">
          Create Your DAO
        </h2>
        <p class="text-gray-600 dark:text-gray-400">
          Let's start with the basics. What should we call your organization?
        </p>
      </div>

      <div class="space-y-4">
        {/* DAO Name */}
        <div>
          <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
            DAO Name <span class="text-red-500">*</span>
          </label>
          <input
            type="text"
            value={name()}
            onInput={(e) => setName(e.currentTarget.value)}
            placeholder="e.g., Developer DAO"
            class={`w-full px-4 py-3 rounded-lg border ${
              errors().name
                ? "border-red-500 focus:ring-red-500"
                : "border-gray-300 dark:border-gray-600 focus:ring-blue-500"
            } bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:outline-none focus:ring-2 transition-all`}
          />
          {errors().name && (
            <p class="mt-1 text-sm text-red-600">{errors().name}</p>
          )}
          <p class="mt-1 text-xs text-gray-500">
            This will be the official name of your DAO
          </p>
        </div>

        {/* Description */}
        <div>
          <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
            Description <span class="text-red-500">*</span>
          </label>
          <textarea
            value={description()}
            onInput={(e) => setDescription(e.currentTarget.value)}
            placeholder="Describe what your DAO does and its mission..."
            rows={4}
            class={`w-full px-4 py-3 rounded-lg border ${
              errors().description
                ? "border-red-500 focus:ring-red-500"
                : "border-gray-300 dark:border-gray-600 focus:ring-blue-500"
            } bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:outline-none focus:ring-2 transition-all resize-none`}
          />
          {errors().description && (
            <p class="mt-1 text-sm text-red-600">{errors().description}</p>
          )}
          <div class="flex justify-between mt-1">
            <p class="text-xs text-gray-500">
              Briefly explain your DAO's purpose
            </p>
            <p class={`text-xs ${description().length > 500 ? "text-red-500" : "text-gray-500"}`}>
              {description().length}/500
            </p>
          </div>
        </div>
      </div>

      {/* Tips */}
      <div class="bg-blue-50 dark:bg-blue-900/20 rounded-lg p-4">
        <h4 class="text-sm font-medium text-blue-900 dark:text-blue-200 mb-2">
          💡 Tips for a great DAO
        </h4>
        <ul class="text-sm text-blue-800 dark:text-blue-300 space-y-1">
          <li>• Choose a memorable, unique name</li>
          <li>• Be clear about your DAO's mission</li>
          <li>• Consider your target community</li>
          <li>• Think about long-term sustainability</li>
        </ul>
      </div>

      {/* Actions */}
      <div class="flex gap-4 pt-4">
        {props.onBack && (
          <button
            type="button"
            onClick={props.onBack}
            class="flex-1 px-6 py-3 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 font-semibold rounded-lg hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
          >
            Back
          </button>
        )}
        <button
          type="submit"
          class="flex-1 px-6 py-3 bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-lg transition-colors"
        >
          Continue
        </button>
      </div>
    </form>
  );
}
