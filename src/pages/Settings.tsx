import { createSignal, Show } from "solid-js";
import { useUI, uiActions } from "../stores";
import { usePerformance } from "../utils/performance";

export default function Settings() {
  const { state: uiState } = useUI();
  const performance = usePerformance();
  const [showPerformanceReport, setShowPerformanceReport] = createSignal(false);

  const report = () => performance.getReport();

  return (
    <div class="max-w-2xl mx-auto space-y-8">
      <div>
        <h1 class="text-2xl font-bold text-gray-900 dark:text-white">Settings</h1>
        <p class="text-gray-600 dark:text-gray-400">
          Customize your DAO Deployer experience
        </p>
      </div>

      {/* Appearance */}
      <section class="bg-white dark:bg-gray-800 rounded-xl p-6 border border-gray-200 dark:border-gray-700">
        <h2 class="text-lg font-semibold text-gray-900 dark:text-white mb-4">
          Appearance
        </h2>
        <div class="flex items-center justify-between">
          <div>
            <p class="font-medium text-gray-900 dark:text-white">Dark Mode</p>
            <p class="text-sm text-gray-500 dark:text-gray-400">
              Toggle between light and dark theme
            </p>
          </div>
          <button
            onClick={() => uiActions.toggleTheme()}
            class={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
              uiState.theme === "dark" ? "bg-blue-600" : "bg-gray-200 dark:bg-gray-700"
            }`}
          >
            <span
              class={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                uiState.theme === "dark" ? "translate-x-6" : "translate-x-1"
              }`}
            />
          </button>
        </div>
      </section>

      {/* Notifications */}
      <section class="bg-white dark:bg-gray-800 rounded-xl p-6 border border-gray-200 dark:border-gray-700">
        <h2 class="text-lg font-semibold text-gray-900 dark:text-white mb-4">
          Notifications
        </h2>
        <div class="space-y-4">
          <div class="flex items-center justify-between">
            <div>
              <p class="font-medium text-gray-900 dark:text-white">Proposal Updates</p>
              <p class="text-sm text-gray-500 dark:text-gray-400">
                Get notified about new proposals
              </p>
            </div>
            <input type="checkbox" checked class="w-5 h-5 text-blue-600 rounded" />
          </div>
          <div class="flex items-center justify-between">
            <div>
              <p class="font-medium text-gray-900 dark:text-white">Task Updates</p>
              <p class="text-sm text-gray-500 dark:text-gray-400">
                Get notified about task changes
              </p>
            </div>
            <input type="checkbox" checked class="w-5 h-5 text-blue-600 rounded" />
          </div>
        </div>
      </section>

      {/* Performance */}
      <section class="bg-white dark:bg-gray-800 rounded-xl p-6 border border-gray-200 dark:border-gray-700">
        <h2 class="text-lg font-semibold text-gray-900 dark:text-white mb-4">
          Performance
        </h2>
        <div class="space-y-4">
          <button
            onClick={() => setShowPerformanceReport(!showPerformanceReport())}
            class="w-full px-4 py-2 bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 text-gray-900 dark:text-white rounded-lg transition-colors text-left flex items-center justify-between"
          >
            <span>View Performance Report</span>
            <svg
              class={`w-5 h-5 transform transition-transform ${
                showPerformanceReport() ? "rotate-180" : ""
              }`}
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7" />
            </svg>
          </button>

          <Show when={showPerformanceReport()}>
            <div class="mt-4 p-4 bg-gray-50 dark:bg-gray-900 rounded-lg">
              <h3 class="font-medium text-gray-900 dark:text-white mb-3">Web Vitals</h3>
              <div class="grid grid-cols-2 gap-4 text-sm">
                <Metric label="FCP" value={report().metrics.fcp} unit="ms" />
                <Metric label="LCP" value={report().metrics.lcp} unit="ms" />
                <Metric label="FID" value={report().metrics.fid} unit="ms" />
                <Metric label="CLS" value={report().metrics.cls} unit="" />
                <Metric label="TTFB" value={report().metrics.ttfb} unit="ms" />
                <Metric label="TTI" value={report().metrics.tti} unit="ms" />
              </div>

              <Show when={report().slowRenders.length > 0}>
                <h3 class="font-medium text-gray-900 dark:text-white mt-4 mb-2">
                  Slow Renders ({report().slowRenders.length})
                </h3>
                <ul class="text-sm space-y-1">
                  {report().slowRenders.slice(-5).map((render) => (
                    <li class="text-red-600 dark:text-red-400">
                      {render.component}: {render.duration.toFixed(2)}ms
                    </li>
                  ))}
                </ul>
              </Show>

              <Show when={Object.keys(report().customMetrics).length > 0}>
                <h3 class="font-medium text-gray-900 dark:text-white mt-4 mb-2">
                  Custom Metrics
                </h3>
                <ul class="text-sm space-y-1">
                  {Object.entries(report().customMetrics).map(([name, values]) => (
                    <li class="text-gray-600 dark:text-gray-400">
                      {name}: {values.length} measurements
                    </li>
                  ))}
                </ul>
              </Show>
            </div>
          </Show>
        </div>
      </section>

      {/* Cache */}
      <section class="bg-white dark:bg-gray-800 rounded-xl p-6 border border-gray-200 dark:border-gray-700">
        <h2 class="text-lg font-semibold text-gray-900 dark:text-white mb-4">
          Cache
        </h2>
        <button
          onClick={() => {
            if ("caches" in window) {
              caches.keys().then((names) => {
                names.forEach((name) => caches.delete(name));
              });
            }
            localStorage.clear();
            sessionStorage.clear();
            window.location.reload();
          }}
          class="px-4 py-2 bg-red-100 dark:bg-red-900/50 text-red-700 dark:text-red-300 hover:bg-red-200 dark:hover:bg-red-900 rounded-lg transition-colors"
        >
          Clear All Cache & Reload
        </button>
      </section>
    </div>
  );
}

function Metric(props: { label: string; value: number | null; unit: string }) {
  const formatted = () => {
    if (props.value === null) return "-";
    if (props.label === "CLS") return props.value.toFixed(3);
    return Math.round(props.value).toLocaleString();
  };

  const getColor = () => {
    if (props.value === null) return "text-gray-400";
    
    switch (props.label) {
      case "FCP":
        return props.value < 1800 ? "text-green-600" : props.value < 3000 ? "text-yellow-600" : "text-red-600";
      case "LCP":
        return props.value < 2500 ? "text-green-600" : props.value < 4000 ? "text-yellow-600" : "text-red-600";
      case "FID":
        return props.value < 100 ? "text-green-600" : props.value < 300 ? "text-yellow-600" : "text-red-600";
      case "CLS":
        return props.value < 0.1 ? "text-green-600" : props.value < 0.25 ? "text-yellow-600" : "text-red-600";
      default:
        return "text-gray-900 dark:text-white";
    }
  };

  return (
    <div>
      <span class="text-gray-500 dark:text-gray-400">{props.label}:</span>{" "}
      <span class={`font-medium ${getColor()}`}>
        {formatted()}{props.unit}
      </span>
    </div>
  );
}
