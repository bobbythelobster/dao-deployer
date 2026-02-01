import { createSignal, createEffect } from "solid-js";
import { useDAO, type DAOConfig } from "../stores/daoStore";

/**
 * Props for the DAOConfigForm component
 * @interface DAOConfigFormProps
 */
interface DAOConfigFormProps {
  /** Initial form data for editing existing DAO config */
  initialData?: Partial<DAOConfig>;
  /** Callback when form is submitted with valid data */
  onSubmit: (config: DAOConfig) => void;
  /** Optional callback for back button navigation */
  onBack?: () => void;
  /** Whether the form is currently submitting */
  isSubmitting?: boolean;
}

/**
 * Form validation errors interface
 * @interface FormErrors
 */
interface FormErrors {
  name?: string;
  description?: string;
}

/**
 * DAO Configuration Form Component
 * 
 * Multi-step form for configuring basic DAO settings.
 * Includes validation, accessibility features, and mobile-responsive design.
 * 
 * @component
 * @example
 * ```tsx
 * <DAOConfigForm
 *   onSubmit={(config) => console.log(config)}
 *   onBack={() => navigate(-1)}
 * />
 * ```
 * 
 * @accessibility
 * - All inputs have associated labels
 * - Error messages linked via aria-describedby
 * - Required fields marked with aria-required
 * - Keyboard navigation support
 * - Screen reader friendly error announcements
 */
export default function DAOConfigForm(props: DAOConfigFormProps) {
  // Form state signals
  const [name, setName] = createSignal(props.initialData?.name || "");
  const [description, setDescription] = createSignal(props.initialData?.description || "");
  const [errors, setErrors] = createSignal<FormErrors>({});
  const [touched, setTouched] = createSignal<Record<string, boolean>>({});

  /**
   * Validates the form fields
   * @returns {boolean} True if validation passes
   */
  const validate = (): boolean => {
    const newErrors: FormErrors = {};
    const currentName = name().trim();
    const currentDescription = description().trim();
    
    // Name validation
    if (!currentName) {
      newErrors.name = "DAO name is required";
    } else if (currentName.length < 3) {
      newErrors.name = "Name must be at least 3 characters";
    } else if (currentName.length > 50) {
      newErrors.name = "Name must be less than 50 characters";
    } else if (!/^[a-zA-Z0-9\s\-_]+$/.test(currentName)) {
      newErrors.name = "Name can only contain letters, numbers, spaces, hyphens, and underscores";
    }

    // Description validation
    if (!currentDescription) {
      newErrors.description = "Description is required";
    } else if (currentDescription.length < 10) {
      newErrors.description = "Description must be at least 10 characters";
    } else if (currentDescription.length > 500) {
      newErrors.description = "Description must be less than 500 characters";
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  /**
   * Real-time validation effect
   */
  createEffect(() => {
    if (Object.keys(touched()).length > 0) {
      validate();
    }
  });

  /**
   * Handles form submission
   * @param {Event} e - Form submit event
   */
  const handleSubmit = (e: Event) => {
    e.preventDefault();
    
    // Mark all fields as touched
    setTouched({ name: true, description: true });
    
    if (validate()) {
      props.onSubmit({
        name: name().trim(),
        description: description().trim(),
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

  /**
   * Handles input blur for touch tracking
   * @param {string} field - Field name
   */
  const handleBlur = (field: string) => {
    setTouched((prev) => ({ ...prev, [field]: true }));
  };

  /**
   * Determines input styling based on validation state
   * @param {string} fieldName - Name of the field
   * @returns {string} CSS classes for the input
   */
  const getInputClasses = (fieldName: keyof FormErrors): string => {
    const baseClasses = "w-full px-4 py-3 rounded-lg border bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:outline-none focus:ring-2 transition-all";
    const isValid = !errors()[fieldName] || !touched()[fieldName];
    const isInvalid = errors()[fieldName] && touched()[fieldName];
    
    if (isInvalid) {
      return `${baseClasses} border-red-500 focus:ring-red-500`;
    }
    if (touched()[fieldName]) {
      return `${baseClasses} border-green-500 focus:ring-green-500`;
    }
    return `${baseClasses} border-gray-300 dark:border-gray-600 focus:ring-blue-500`;
  };

  return (
    <form 
      onSubmit={handleSubmit} 
      class="space-y-6"
      aria-label="DAO Configuration Form"
      noValidate
    >
      {/* Header */}
      <div class="text-center mb-8">
        <h2 
          class="text-2xl md:text-3xl font-bold text-gray-900 dark:text-white mb-2"
          id="form-title"
        >
          Create Your DAO
        </h2>
        <p class="text-gray-600 dark:text-gray-400 text-sm md:text-base">
          Let's start with the basics. What should we call your organization?
        </p>
      </div>

      {/* Progress indicator */}
      <nav aria-label="Form progress" class="mb-6">
        <ol class="flex items-center justify-center gap-2 text-sm">
          <li class="flex items-center text-blue-600 dark:text-blue-400 font-medium">
            <span class="w-6 h-6 rounded-full bg-blue-600 text-white flex items-center justify-center text-xs mr-1">1</span>
            Basic Info
          </li>
          <li class="w-8 h-px bg-gray-300 dark:bg-gray-600"></li>
          <li class="flex items-center text-gray-400">
            <span class="w-6 h-6 rounded-full bg-gray-200 dark:bg-gray-700 flex items-center justify-center text-xs mr-1">2</span>
            Token
          </li>
          <li class="w-8 h-px bg-gray-300 dark:bg-gray-600"></li>
          <li class="flex items-center text-gray-400">
            <span class="w-6 h-6 rounded-full bg-gray-200 dark:bg-gray-700 flex items-center justify-center text-xs mr-1">3</span>
            Governance
          </li>
        </ol>
      </nav>

      <div class="space-y-5">
        {/* DAO Name */}
        <div>
          <label 
            for="dao-name" 
            class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1"
          >
            DAO Name <span class="text-red-500" aria-hidden="true">*</span>
            <span class="sr-only">(required)</span>
          </label>
          <input
            type="text"
            id="dao-name"
            name="name"
            value={name()}
            onInput={(e) => setName(e.currentTarget.value)}
            onBlur={() => handleBlur("name")}
            placeholder="e.g., Developer DAO"
            class={getInputClasses("name")}
            aria-required="true"
            aria-invalid={errors().name && touched().name ? "true" : "false"}
            aria-describedby={errors().name && touched().name ? "name-error" : "name-help"}
            maxLength={50}
            disabled={props.isSubmitting}
            autoComplete="off"
          />
          {errors().name && touched().name && (
            <p 
              id="name-error" 
              class="mt-1 text-sm text-red-600 flex items-center gap-1"
              role="alert"
            >
              <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              {errors().name}
            </p>
          )}
          <div class="flex justify-between mt-1">
            <p id="name-help" class="text-xs text-gray-500">
              This will be the official name of your DAO
            </p>
            <span class={`text-xs ${name().length > 45 ? "text-orange-500" : "text-gray-500"}`} aria-live="polite">
              {name().length}/50
            </span>
          </div>
        </div>

        {/* Description */}
        <div>
          <label 
            for="dao-description" 
            class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1"
          >
            Description <span class="text-red-500" aria-hidden="true">*</span>
            <span class="sr-only">(required)</span>
          </label>
          <textarea
            id="dao-description"
            name="description"
            value={description()}
            onInput={(e) => setDescription(e.currentTarget.value)}
            onBlur={() => handleBlur("description")}
            placeholder="Describe what your DAO does and its mission..."
            rows={4}
            class={`${getInputClasses("description")} resize-y min-h-[100px]`}
            aria-required="true"
            aria-invalid={errors().description && touched().description ? "true" : "false"}
            aria-describedby={errors().description && touched().description ? "description-error" : "description-help"}
            maxLength={500}
            disabled={props.isSubmitting}
          />
          {errors().description && touched().description && (
            <p 
              id="description-error" 
              class="mt-1 text-sm text-red-600 flex items-center gap-1"
              role="alert"
            >
              <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              {errors().description}
            </p>
          )}
          <div class="flex justify-between mt-1">
            <p id="description-help" class="text-xs text-gray-500">
              Briefly explain your DAO's purpose
            </p>
            <span 
              class={`text-xs ${description().length > 450 ? "text-orange-500" : "text-gray-500"}`}
              aria-live="polite"
            >
              {description().length}/500
            </span>
          </div>
        </div>
      </div>

      {/* Tips Card */}
      <div class="bg-blue-50 dark:bg-blue-900/20 rounded-lg p-4 border border-blue-200 dark:border-blue-800">
        <h4 class="text-sm font-medium text-blue-900 dark:text-blue-200 mb-2 flex items-center gap-2">
          <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          Tips for a great DAO
        </h4>
        <ul class="text-sm text-blue-800 dark:text-blue-300 space-y-1.5" role="list">
          <li class="flex items-start gap-2">
            <span class="mt-1 w-1 h-1 bg-blue-400 rounded-full flex-shrink-0" aria-hidden="true"></span>
            <span>Choose a memorable, unique name</span>
          </li>
          <li class="flex items-start gap-2">
            <span class="mt-1 w-1 h-1 bg-blue-400 rounded-full flex-shrink-0" aria-hidden="true"></span>
            <span>Be clear about your DAO's mission</span>
          </li>
          <li class="flex items-start gap-2">
            <span class="mt-1 w-1 h-1 bg-blue-400 rounded-full flex-shrink-0" aria-hidden="true"></span>
            <span>Consider your target community</span>
          </li>
          <li class="flex items-start gap-2">
            <span class="mt-1 w-1 h-1 bg-blue-400 rounded-full flex-shrink-0" aria-hidden="true"></span>
            <span>Think about long-term sustainability</span>
          </li>
        </ul>
      </div>

      {/* Actions */}
      <div class="flex flex-col sm:flex-row gap-3 pt-4">
        {props.onBack && (
          <button
            type="button"
            onClick={props.onBack}
            disabled={props.isSubmitting}
            class="order-2 sm:order-1 flex-1 px-6 py-3 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 font-semibold rounded-lg hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors disabled:opacity-50 disabled:cursor-not-allowed focus:outline-none focus:ring-2 focus:ring-gray-400"
          >
            Back
          </button>
        )}
        <button
          type="submit"
          disabled={props.isSubmitting}
          class="order-1 sm:order-2 flex-1 px-6 py-3 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 text-white font-semibold rounded-lg transition-colors disabled:cursor-not-allowed focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 flex items-center justify-center gap-2"
        >
          {props.isSubmitting ? (
            <>
              <svg class="w-5 h-5 animate-spin" fill="none" viewBox="0 0 24 24" aria-hidden="true">
                <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
                <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
              </svg>
              <span>Saving...</span>
            </>
          ) : (
            <>
              <span>Continue</span>
              <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7" />
              </svg>
            </>
          )}
        </button>
      </div>

      {/* Keyboard shortcuts hint */}
      <p class="text-xs text-gray-400 text-center hidden sm:block">
        Press <kbd class="px-1.5 py-0.5 bg-gray-100 dark:bg-gray-700 rounded text-gray-600 dark:text-gray-400 font-mono">Enter</kbd> to continue
      </p>
    </form>
  );
}
