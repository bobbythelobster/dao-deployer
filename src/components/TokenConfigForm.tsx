import { createSignal, createEffect } from "solid-js";
import { type TokenConfig } from "../stores/daoStore";
import { parseEther, formatEther } from "viem";

/**
 * Props for the TokenConfigForm component
 * @interface TokenConfigFormProps
 */
interface TokenConfigFormProps {
  /** Initial token configuration data */
  initialData?: Partial<TokenConfig>;
  /** Callback when form is submitted with valid data */
  onSubmit: (config: TokenConfig) => void;
  /** Callback for back button navigation */
  onBack: () => void;
  /** Whether the form is currently submitting */
  isSubmitting?: boolean;
}

/**
 * Form validation errors interface
 * @interface FormErrors
 */
interface FormErrors {
  name?: string;
  symbol?: string;
  initialSupply?: string;
  maxSupply?: string;
}

/**
 * Token preset configuration
 * @interface TokenPreset
 */
interface TokenPreset {
  name: string;
  initial: string;
  max: string;
  desc: string;
}

/**
 * Token Configuration Form Component
 * 
 * Form for configuring the Soul-Bound governance token.
 * Features preset configurations, real-time validation, and accessibility support.
 * 
 * @component
 * @example
 * ```tsx
 * <TokenConfigForm
 *   initialData={{ name: "My Token", symbol: "MTK" }}
 *   onSubmit={(config) => deployToken(config)}
 *   onBack={() => setStep(1)}
 * />
 * ```
 * 
 * @accessibility
 * - All inputs have associated labels
 * - Error messages announced to screen readers
 * - Preset buttons have clear descriptions
 * - Keyboard navigation support
 * - Focus management for dynamic content
 */
export default function TokenConfigForm(props: TokenConfigFormProps) {
  // Form state signals
  const [name, setName] = createSignal(props.initialData?.name || "");
  const [symbol, setSymbol] = createSignal(props.initialData?.symbol || "");
  const [initialSupply, setInitialSupply] = createSignal(props.initialData?.initialSupply || "1000000");
  const [maxSupply, setMaxSupply] = createSignal(props.initialData?.maxSupply || "10000000");
  const [errors, setErrors] = createSignal<FormErrors>({});
  const [touched, setTouched] = createSignal<Record<string, boolean>>({});
  const [showAdvanced, setShowAdvanced] = createSignal(false);

  /**
   * Token supply presets for common use cases
   */
  const presets: TokenPreset[] = [
    { name: "Starter", initial: "1000000", max: "10000000", desc: "1M initial, 10M max - Perfect for small communities" },
    { name: "Growth", initial: "10000000", max: "100000000", desc: "10M initial, 100M max - For scaling DAOs" },
    { name: "Enterprise", initial: "100000000", max: "1000000000", desc: "100M initial, 1B max - Large organizations" },
    { name: "Fixed", initial: "1000000", max: "1000000", desc: "Fixed 1M supply - No future minting" },
  ];

  /**
   * Validates all form fields
   * @returns {boolean} True if validation passes
   */
  const validate = (): boolean => {
    const newErrors: FormErrors = {};
    
    // Token name validation
    const currentName = name().trim();
    if (!currentName) {
      newErrors.name = "Token name is required";
    } else if (currentName.length < 2) {
      newErrors.name = "Name must be at least 2 characters";
    } else if (currentName.length > 50) {
      newErrors.name = "Name must be less than 50 characters";
    } else if (!/^[a-zA-Z0-9\s\-_]+$/.test(currentName)) {
      newErrors.name = "Name can only contain letters, numbers, spaces, hyphens, and underscores";
    }

    // Symbol validation
    const currentSymbol = symbol().trim();
    if (!currentSymbol) {
      newErrors.symbol = "Token symbol is required";
    } else if (currentSymbol.length < 2) {
      newErrors.symbol = "Symbol must be at least 2 characters";
    } else if (currentSymbol.length > 10) {
      newErrors.symbol = "Symbol must be less than 10 characters";
    } else if (!/^[A-Za-z]+$/.test(currentSymbol)) {
      newErrors.symbol = "Symbol must contain only letters";
    }

    // Initial supply validation
    const initialSupplyNum = parseFloat(initialSupply());
    if (isNaN(initialSupplyNum) || initialSupplyNum <= 0) {
      newErrors.initialSupply = "Initial supply must be greater than 0";
    } else if (initialSupplyNum > 1e18) {
      newErrors.initialSupply = "Initial supply is too large (max 1 quintillion)";
    }

    // Max supply validation
    const maxSupplyNum = parseFloat(maxSupply());
    if (isNaN(maxSupplyNum) || maxSupplyNum <= 0) {
      newErrors.maxSupply = "Max supply must be greater than 0";
    } else if (maxSupplyNum < initialSupplyNum) {
      newErrors.maxSupply = "Max supply must be greater than or equal to initial supply";
    } else if (maxSupplyNum > 1e18) {
      newErrors.maxSupply = "Max supply is too large (max 1 quintillion)";
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
    setTouched({ name: true, symbol: true, initialSupply: true, maxSupply: true });
    
    if (validate()) {
      props.onSubmit({
        name: name().trim(),
        symbol: symbol().toUpperCase().trim(),
        initialSupply: initialSupply(),
        maxSupply: maxSupply(),
        decimals: 18,
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
   * Applies a preset configuration
   * @param {TokenPreset} preset - The preset to apply
   */
  const applyPreset = (preset: TokenPreset) => {
    setInitialSupply(preset.initial);
    setMaxSupply(preset.max);
    setTouched((prev) => ({ ...prev, initialSupply: true, maxSupply: true }));
    
    // Announce change to screen readers
    const announcement = document.getElementById("preset-announcement");
    if (announcement) {
      announcement.textContent = `Applied ${preset.name} preset: ${preset.desc}`;
    }
  };

  /**
   * Determines input styling based on validation state
   * @param {keyof FormErrors} fieldName - Name of the field
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
      aria-label="Token Configuration Form"
      noValidate
    >
      {/* Header */}
      <div class="text-center mb-8">
        <h2 
          class="text-2xl md:text-3xl font-bold text-gray-900 dark:text-white mb-2"
          id="token-form-title"
        >
          Configure Soul-Bound Token
        </h2>
        <p class="text-gray-600 dark:text-gray-400 text-sm md:text-base">
          Set up your governance token. These tokens are non-transferable and represent voting power.
        </p>
      </div>

      {/* Progress indicator */}
      <nav aria-label="Form progress" class="mb-6">
        <ol class="flex items-center justify-center gap-2 text-sm">
          <li class="flex items-center text-green-600 dark:text-green-400">
            <span class="w-6 h-6 rounded-full bg-green-600 text-white flex items-center justify-center text-xs mr-1" aria-hidden="true">✓</span>
            <span class="hidden sm:inline">Basic Info</span>
          </li>
          <li class="w-8 h-px bg-gray-300 dark:bg-gray-600" aria-hidden="true"></li>
          <li class="flex items-center text-blue-600 dark:text-blue-400 font-medium">
            <span class="w-6 h-6 rounded-full bg-blue-600 text-white flex items-center justify-center text-xs mr-1">2</span>
            Token
          </li>
          <li class="w-8 h-px bg-gray-300 dark:bg-gray-600" aria-hidden="true"></li>
          <li class="flex items-center text-gray-400">
            <span class="w-6 h-6 rounded-full bg-gray-200 dark:bg-gray-700 flex items-center justify-center text-xs mr-1">3</span>
            <span class="hidden sm:inline">Governance</span>
          </li>
        </ol>
      </nav>

      {/* Live region for preset announcements */}
      <div id="preset-announcement" class="sr-only" aria-live="polite" aria-atomic="true"></div>

      {/* Presets */}
      <fieldset class="space-y-3">
        <legend class="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
          Quick Presets
        </legend>
        <div class="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {presets.map((preset) => (
            <button
              key={preset.name}
              type="button"
              onClick={() => applyPreset(preset)}
              disabled={props.isSubmitting}
              class="p-3 border border-gray-200 dark:border-gray-700 rounded-lg hover:border-blue-500 hover:bg-blue-50 dark:hover:bg-blue-900/20 transition-all text-left focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
              aria-label={`Apply ${preset.name} preset: ${preset.desc}`}
            >
              <p class="font-medium text-gray-900 dark:text-white">{preset.name}</p>
              <p class="text-xs text-gray-500 dark:text-gray-400">{preset.desc}</p>
            </button>
          ))}
        </div>
      </fieldset>

      <div class="space-y-5">
        {/* Token Name */}
        <div>
          <label 
            for="token-name" 
            class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1"
          >
            Token Name <span class="text-red-500" aria-hidden="true">*</span>
            <span class="sr-only">(required)</span>
          </label>
          <input
            type="text"
            id="token-name"
            name="name"
            value={name()}
            onInput={(e) => setName(e.currentTarget.value)}
            onBlur={() => handleBlur("name")}
            placeholder="e.g., Developer Governance Token"
            class={getInputClasses("name")}
            aria-required="true"
            aria-invalid={errors().name && touched().name ? "true" : "false"}
            aria-describedby={errors().name && touched().name ? "token-name-error" : "token-name-help"}
            maxLength={50}
            disabled={props.isSubmitting}
            autoComplete="off"
          />
          {errors().name && touched().name && (
            <p id="token-name-error" class="mt-1 text-sm text-red-600 flex items-center gap-1" role="alert">
              <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              {errors().name}
            </p>
          )}
          <p id="token-name-help" class="mt-1 text-xs text-gray-500">
            The full name of your governance token
          </p>
        </div>

        {/* Token Symbol */}
        <div>
          <label 
            for="token-symbol" 
            class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1"
          >
            Token Symbol <span class="text-red-500" aria-hidden="true">*</span>
            <span class="sr-only">(required)</span>
          </label>
          <div class="relative">
            <input
              type="text"
              id="token-symbol"
              name="symbol"
              value={symbol()}
              onInput={(e) => setSymbol(e.currentTarget.value.toUpperCase())}
              onBlur={() => handleBlur("symbol")}
              placeholder="e.g., DEV"
              maxLength={10}
              class={`${getInputClasses("symbol")} uppercase`}
              aria-required="true"
              aria-invalid={errors().symbol && touched().symbol ? "true" : "false"}
              aria-describedby={errors().symbol && touched().symbol ? "token-symbol-error" : "token-symbol-help"}
              disabled={props.isSubmitting}
              autoComplete="off"
            />
            <div class="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm" aria-hidden="true">
              {symbol().length}/10
            </div>
          </div>
          {errors().symbol && touched().symbol && (
            <p id="token-symbol-error" class="mt-1 text-sm text-red-600 flex items-center gap-1" role="alert">
              <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              {errors().symbol}
            </p>
          )}
          <p id="token-symbol-help" class="mt-1 text-xs text-gray-500">
            A short ticker symbol (2-10 letters)
          </p>
        </div>

        {/* Supply Grid */}
        <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {/* Initial Supply */}
          <div>
            <label 
              for="initial-supply" 
              class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1"
            >
              Initial Supply <span class="text-red-500" aria-hidden="true">*</span>
              <span class="sr-only">(required)</span>
            </label>
            <input
              type="number"
              id="initial-supply"
              name="initialSupply"
              value={initialSupply()}
              onInput={(e) => setInitialSupply(e.currentTarget.value)}
              onBlur={() => handleBlur("initialSupply")}
              placeholder="1000000"
              min="1"
              step="1"
              class={getInputClasses("initialSupply")}
              aria-required="true"
              aria-invalid={errors().initialSupply && touched().initialSupply ? "true" : "false"}
              aria-describedby={errors().initialSupply && touched().initialSupply ? "initial-supply-error" : "initial-supply-help"}
              disabled={props.isSubmitting}
            />
            {errors().initialSupply && touched().initialSupply && (
              <p id="initial-supply-error" class="mt-1 text-sm text-red-600 flex items-center gap-1" role="alert">
                <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                {errors().initialSupply}
              </p>
            )}
            <p id="initial-supply-help" class="mt-1 text-xs text-gray-500">
              Tokens minted at creation
            </p>
          </div>

          {/* Max Supply */}
          <div>
            <label 
              for="max-supply" 
              class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1"
            >
              Maximum Supply <span class="text-red-500" aria-hidden="true">*</span>
              <span class="sr-only">(required)</span>
            </label>
            <input
              type="number"
              id="max-supply"
              name="maxSupply"
              value={maxSupply()}
              onInput={(e) => setMaxSupply(e.currentTarget.value)}
              onBlur={() => handleBlur("maxSupply")}
              placeholder="10000000"
              min="1"
              step="1"
              class={getInputClasses("maxSupply")}
              aria-required="true"
              aria-invalid={errors().maxSupply && touched().maxSupply ? "true" : "false"}
              aria-describedby={errors().maxSupply && touched().maxSupply ? "max-supply-error" : "max-supply-help"}
              disabled={props.isSubmitting}
            />
            {errors().maxSupply && touched().maxSupply && (
              <p id="max-supply-error" class="mt-1 text-sm text-red-600 flex items-center gap-1" role="alert">
                <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                {errors().maxSupply}
              </p>
            )}
            <p id="max-supply-help" class="mt-1 text-xs text-gray-500">
              Maximum tokens ever (0 for unlimited)
            </p>
          </div>
        </div>
      </div>

      {/* Soul-Bound Info */}
      <div class="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-lg p-4">
        <div class="flex items-start gap-3">
          <svg class="w-5 h-5 text-amber-600 dark:text-amber-400 mt-0.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <div>
            <h4 class="text-sm font-medium text-amber-900 dark:text-amber-200">
              Soul-Bound Token
            </h4>
            <p class="text-sm text-amber-800 dark:text-amber-300 mt-1">
              These tokens are non-transferable and represent voting power in your DAO. 
              They can only be minted by the DAO and burned by token holders.
            </p>
          </div>
        </div>
      </div>

      {/* Actions */}
      <div class="flex flex-col sm:flex-row gap-3 pt-4">
        <button
          type="button"
          onClick={props.onBack}
          disabled={props.isSubmitting}
          class="order-2 sm:order-1 flex-1 px-6 py-3 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 font-semibold rounded-lg hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors disabled:opacity-50 disabled:cursor-not-allowed focus:outline-none focus:ring-2 focus:ring-gray-400"
        >
          Back
        </button>
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
    </form>
  );
}
