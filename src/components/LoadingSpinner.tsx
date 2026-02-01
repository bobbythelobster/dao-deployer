import { Show } from "solid-js";

interface LoadingSpinnerProps {
  size?: "sm" | "md" | "lg" | "xl";
  color?: "blue" | "white" | "gray" | "green";
  text?: string;
  fullScreen?: boolean;
}

export default function LoadingSpinner(props: LoadingSpinnerProps) {
  const sizeClasses = {
    sm: "w-4 h-4 border-2",
    md: "w-8 h-8 border-2",
    lg: "w-12 h-12 border-3",
    xl: "w-16 h-16 border-4",
  };

  const colorClasses = {
    blue: "border-blue-600",
    white: "border-white",
    gray: "border-gray-600",
    green: "border-green-600",
  };

  const spinner = (
    <div
      class={`${sizeClasses[props.size || "md"]} ${
        colorClasses[props.color || "blue"]
      } border-t-transparent rounded-full animate-spin`}
      style={{ "border-top-color": "transparent" }}
    />
  );

  return (
    <Show
      when={props.fullScreen}
      fallback={
        <div class="flex flex-col items-center justify-center gap-3">
          {spinner}
          <Show when={props.text}>
            <p class="text-sm text-gray-600 dark:text-gray-400 animate-pulse">
              {props.text}
            </p>
          </Show>
        </div>
      }
    >
      <div class="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50">
        <div class="bg-white dark:bg-gray-800 rounded-xl p-8 flex flex-col items-center gap-4 shadow-2xl">
          {spinner}
          <Show when={props.text}>
            <p class="text-lg font-medium text-gray-900 dark:text-white">
              {props.text}
            </p>
          </Show>
        </div>
      </div>
    </Show>
  );
}

// Inline spinner for buttons
export function ButtonSpinner(props: { size?: "sm" | "md"; color?: "white" | "blue" }) {
  const sizeClasses = {
    sm: "w-4 h-4 border-2",
    md: "w-5 h-5 border-2",
  };

  const colorClasses = {
    white: "border-white",
    blue: "border-blue-600",
  };

  return (
    <div
      class={`${sizeClasses[props.size || "sm"]} ${
        colorClasses[props.color || "white"]
      } border-t-transparent rounded-full animate-spin`}
    />
  );
}

// Skeleton loader for cards/lists
export function SkeletonCard() {
  return (
    <div class="bg-white dark:bg-gray-800 rounded-xl p-6 border border-gray-200 dark:border-gray-700 animate-pulse">
      <div class="flex items-center gap-4 mb-4">
        <div class="w-12 h-12 bg-gray-200 dark:bg-gray-700 rounded-full" />
        <div class="flex-1">
          <div class="h-4 bg-gray-200 dark:bg-gray-700 rounded w-3/4 mb-2" />
          <div class="h-3 bg-gray-200 dark:bg-gray-700 rounded w-1/2" />
        </div>
      </div>
      <div class="space-y-2">
        <div class="h-3 bg-gray-200 dark:bg-gray-700 rounded" />
        <div class="h-3 bg-gray-200 dark:bg-gray-700 rounded w-5/6" />
        <div class="h-3 bg-gray-200 dark:bg-gray-700 rounded w-4/6" />
      </div>
    </div>
  );
}

export function SkeletonList(props: { count?: number }) {
  const count = props.count || 3;
  
  return (
    <div class="space-y-4">
      {Array.from({ length: count }).map((_, i) => (
        <div
          key={i}
          class="bg-white dark:bg-gray-800 rounded-lg p-4 border border-gray-200 dark:border-gray-700 animate-pulse"
        >
          <div class="flex items-center justify-between">
            <div class="flex items-center gap-3 flex-1">
              <div class="w-10 h-10 bg-gray-200 dark:bg-gray-700 rounded-full" />
              <div class="flex-1">
                <div class="h-4 bg-gray-200 dark:bg-gray-700 rounded w-1/3 mb-2" />
                <div class="h-3 bg-gray-200 dark:bg-gray-700 rounded w-1/4" />
              </div>
            </div>
            <div class="w-20 h-8 bg-gray-200 dark:bg-gray-700 rounded" />
          </div>
        </div>
      ))}
    </div>
  );
}

// Page loader
export function PageLoader(props: { message?: string }) {
  return (
    <div class="min-h-[50vh] flex items-center justify-center">
      <LoadingSpinner size="lg" text={props.message || "Loading..."} />
    </div>
  );
}
