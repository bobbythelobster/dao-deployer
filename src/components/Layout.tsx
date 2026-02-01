import { type Component, type JSX, lazy, Suspense } from "solid-js";
import { useLocation, A } from "@solidjs/router";
import { useWallet } from "../stores";

// Lazy load non-critical components
const NetworkSwitcher = lazy(() => import("./NetworkSwitcher"));
const ConnectWallet = lazy(() => import("./ConnectWallet"));
const ToastNotifications = lazy(() => import("./ToastNotifications"));

interface LayoutProps {
  children: JSX.Element;
}

const Layout: Component<LayoutProps> = (props) => {
  const location = useLocation();
  const { state: walletState } = useWallet();

  const isActive = (path: string) => {
    return location.pathname === path || location.pathname.startsWith(`${path}/`);
  };

  return (
    <div class="min-h-screen bg-gray-50 dark:bg-gray-900">
      {/* Header */}
      <header class="sticky top-0 z-50 bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700">
        <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div class="flex items-center justify-between h-16">
            {/* Logo */}
            <A href="/" class="flex items-center gap-2">
              <div class="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center">
                <svg class="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                </svg>
              </div>
              <span class="text-xl font-bold text-gray-900 dark:text-white">DAO Deployer</span>
            </A>

            {/* Navigation */}
            <nav class="hidden md:flex items-center gap-1">
              <A
                href="/daos"
                class={`px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                  isActive("/daos") || isActive("/dao")
                    ? "bg-blue-100 text-blue-700 dark:bg-blue-900/50 dark:text-blue-300"
                    : "text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white"
                }`}
              >
                DAOs
              </A>
              <A
                href="/dao/create"
                class={`px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                  isActive("/dao/create")
                    ? "bg-blue-100 text-blue-700 dark:bg-blue-900/50 dark:text-blue-300"
                    : "text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white"
                }`}
              >
                Create DAO
              </A>
              <A
                href="/settings"
                class={`px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                  isActive("/settings")
                    ? "bg-blue-100 text-blue-700 dark:bg-blue-900/50 dark:text-blue-300"
                    : "text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white"
                }`}
              >
                Settings
              </A>
            </nav>

            {/* Wallet & Network */}
            <div class="flex items-center gap-3">
              <Suspense fallback={<div class="w-20 h-8 bg-gray-200 dark:bg-gray-700 rounded animate-pulse" />}>
                <NetworkSwitcher />
              </Suspense>
              <Suspense fallback={<div class="w-32 h-10 bg-gray-200 dark:bg-gray-700 rounded animate-pulse" />}>
                <ConnectWallet />
              </Suspense>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {props.children}
      </main>

      {/* Toast Notifications */}
      <Suspense>
        <ToastNotifications />
      </Suspense>
    </div>
  );
};

export default Layout;
