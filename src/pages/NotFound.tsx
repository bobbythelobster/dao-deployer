import { A } from "@solidjs/router";

export default function NotFound() {
  return (
    <div class="flex flex-col items-center justify-center py-16 text-center">
      <div class="w-24 h-24 bg-gray-100 dark:bg-gray-800 rounded-full flex items-center justify-center mb-6">
        <svg
          class="w-12 h-12 text-gray-400"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            stroke-linecap="round"
            stroke-linejoin="round"
            stroke-width="2"
            d="M9.172 16.172a4 4 0 015.656 0M9 10h.01M15 10h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
          />
        </svg>
      </div>
      <h1 class="text-4xl font-bold text-gray-900 dark:text-white mb-4">
        404
      </h1>
      <p class="text-xl text-gray-600 dark:text-gray-400 mb-2">
        Page Not Found
      </p>
      <p class="text-gray-500 dark:text-gray-400 max-w-md mb-8">
        The page you're looking for doesn't exist or has been moved.
      </p>
      <A
        href="/"
        class="px-6 py-3 bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-lg transition-colors"
      >
        Go Home
      </A>
    </div>
  );
}
