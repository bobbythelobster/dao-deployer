import { createSignal, createEffect } from "solid-js";
import { type TokenConfig } from "../stores/daoStore";
import { parseEther, formatEther } from "viem";

interface TokenConfigFormProps {
  initialData?: Partial<TokenConfig>;
  onSubmit: (config: TokenConfig) => void;
  onBack: () => void;
}

export default function TokenConfigForm(props: TokenConfigFormProps) {
  const [name, setName] = createSignal(props.initialData?.name || "");
  const [symbol, setSymbol] = createSignal(props.initialData?.symbol || "");
  const [initialSupply, setInitialSupply] = createSignal(props.initialData?.initialSupply || "1000000");
  const [maxSupply, setMaxSupply] = createSignal(props.initialData?.maxSupply || "10000000");
  const [errors, setErrors] = createSignal<Record<string, string>>({});
  const [showAdvanced, setShowAdvanced] = createSignal(false);

  const validate = () => {
    const newErrors: Record<string, string> = {};
    
    if (!name().trim()) {
      newErrors.name = "Token name is required";
    } else if (name().length < 2) {
      newErrors.name = "Name must be at least 2 characters";
    } else if (name().length > 50) {
      newErrors.name = "Name must be less than 50 characters";
    }

    if (!symbol().trim()) {
      newErrors.symbol = "Token symbol is required";
    } else if (symbol().length < 2) {
      newErrors.symbol = "Symbol must be at least 2 characters";
    } else if (symbol().length > 10) {
      newErrors.symbol = "Symbol must be less than 10 characters";
    } else if (!/^[A-Za-z]+$/.test(symbol())) {
      newErrors.symbol = "Symbol must contain only letters";
    }

    const initialSupplyNum = parseFloat(initialSupply());
    if (isNaN(initialSupplyNum) || initialSupplyNum <= 0) {
      newErrors.initialSupply = "Initial supply must be greater than 0";
    }

    const maxSupplyNum = parseFloat(maxSupply());
    if (isNaN(maxSupplyNum) || maxSupplyNum <= 0) {
      newErrors.maxSupply = "Max supply must be greater than 0";
    } else if (maxSupplyNum < initialSupplyNum) {
      newErrors.maxSupply = "Max supply must be greater than or equal to initial supply";
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = (e: Event) => {
    e.preventDefault();
    if (validate()) {
      props.onSubmit({
        name: name(),
        symbol: symbol().toUpperCase(),
        initialSupply: initialSupply(),
        maxSupply: maxSupply(),
        decimals: 18,
      });
    }
  };

  const presets = [
    { name: "Starter", initial: "1000000", max: "10000000", desc: "1M initial, 10M max" },
    { name: "Growth", initial: "10000000", max: "100000000", desc: "10M initial, 100M max" },
    { name: "Enterprise", initial: "100000000", max: "1000000000", desc: "100M initial, 1B max" },
    { name: "Fixed", initial: "1000000", max: "1000000", desc: "Fixed 1M supply" },
  ];

  return (
    <form onSubmit={handleSubmit} class="space-y-6">
      <div class="text-center mb-8">
        <h2 class="text-2xl font-bold text-gray-900 dark:text-white mb-2">
          Configure Soul-Bound Token
        </h2>
        <p class="text-gray-600 dark:text-gray-400">
          Set up your governance token. These tokens are non-transferable and represent voting power.
        </p>
      </div>

      {/* Presets */}
      <div class="grid grid-cols-2 gap-3">
        {presets.map((preset) => (
          <button
            key={preset.name}
            type="button"
            onClick={() => {
              setInitialSupply(preset.initial);
              setMaxSupply(preset.max);
            }}
            class="p-3 border border-gray-200 dark:border-gray-700 rounded-lg hover:border-blue-500 hover:bg-blue-50 dark:hover:bg-blue-900/20 transition-all text-left"
          >
            <p class="font-medium text-gray-900 dark:text-white">{preset.name}</p>
            <p class="text-xs text-gray-500">{preset.desc}</p>
          </button>
        ))}
      </div>

      <div class="space-y-4">
        {/* Token Name */}
        <div>
          <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
            Token Name <span class="text-red-500">*</span>
          </label>
          <input
            type="text"
            value={name()}
            onInput={(e) => setName(e.currentTarget.value)}
            placeholder="e.g., Developer Governance Token"
            class={`w-full px-4 py-3 rounded-lg border ${
              errors().name
                ? "border-red-500 focus:ring-red-500"
                : "border-gray-300 dark:border-gray-600 focus:ring-blue-500"
            } bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:outline-none focus:ring-2 transition-all`}
          />
          {errors().name && (
            <p class="mt-1 text-sm text-red-600">{errors().name}</p>
          )}
        </div>

        {/* Token Symbol */}
        <div>
          <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
            Token Symbol <span class="text-red-500">*</span>
          </label>
          <div class="relative">
            <input
              type="text"
              value={symbol()}
              onInput={(e) => setSymbol(e.currentTarget.value.toUpperCase())}
              placeholder="e.g., DEV"
              maxLength={10}
              class={`w-full px-4 py-3 rounded-lg border ${
                errors().symbol
                  ? "border-red-500 focus:ring-red-500"
                  : "border-gray-300 dark:border-gray-600 focus:ring-blue-500"
              } bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:outline-none focus:ring-2 transition-all uppercase`}
            />
            <div class="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm">
              {symbol().length}/10
            </div>
          </div>
          {errors().symbol && (
            <p class="mt-1 text-sm text-red-600">{errors().symbol}</p>
          )}
        </div>

        {/* Initial Supply */}
        <div>
          <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
            Initial Supply <span class="text-red-500">*</span>
          </label>
          <input
            type="number"
            value={initialSupply()}
            onInput={(e) => setInitialSupply(e.currentTarget.value)}
            placeholder="1000000"
            min="1"
            class={`w-full px-4 py-3 rounded-lg border ${
              errors().initialSupply
                ? "border-red-500 focus:ring-red-500"
                : "border-gray-300 dark:border-gray-600 focus:ring-blue-500"
            } bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:outline-none focus:ring-2 transition-all`}
          />
          {errors().initialSupply && (
            <p class="mt-1 text-sm text-red-600">{errors().initialSupply}</p>
          )}
        </div>

        {/* Max Supply */}
        <div>
          <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
            Maximum Supply <span class="text-red-500">*</span>
          </label>
          <input
            type="number"
            value={maxSupply()}
            onInput={(e) => setMaxSupply(e.currentTarget.value)}
            placeholder="10000000"
            min="1"
            class={`w-full px-4 py-3 rounded-lg border ${
              errors().maxSupply
                ? "border-red-500 focus:ring-red-500"
                : "border-gray-300 dark:border-gray-600 focus:ring-blue-500"
            } bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:outline-none focus:ring-2 transition-all`}
          />
          {errors().maxSupply && (
            <p class="mt-1 text-sm text-red-600">{errors().maxSupply}</p>
          )}
          <p class="mt-1 text-xs text-gray-500">
            Maximum tokens that can ever exist (0 for unlimited)
          </p>
        </div>
      </div>

      {/* Soul-Bound Info */}
      <div class="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-lg p-4">
        <div class="flex items-start gap-3">
          <svg class="w-5 h-5 text-amber-600 dark:text-amber-400 mt-0.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
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
      <div class="flex gap-4 pt-4">
        <button
          type="button"
          onClick={props.onBack}
          class="flex-1 px-6 py-3 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 font-semibold rounded-lg hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
        >
          Back
        </button>
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
