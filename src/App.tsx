import { lazy, Suspense, ErrorBoundary } from "solid-js";
import { Router, Route } from "@solidjs/router";
import { ComponentErrorBoundary } from "./components/ErrorBoundary";
import { PageLoader } from "./components/LoadingSpinner";
import { PerformanceProvider } from "./utils/performance";
import { QueryClientProvider } from "./utils/queryClient";
import { registerSW } from "virtual:pwa-register";

// Eagerly load critical components
import Layout from "./components/Layout";
import Home from "./pages/Home";

// Lazy load all route components for code splitting
const DAOList = lazy(() => import("./pages/DAOList"));
const DAOCreate = lazy(() => import("./pages/DAOCreate"));
const DAODetail = lazy(() => import("./pages/DAODetail"));
const DAOProposals = lazy(() => import("./pages/DAOProposals"));
const DAOCreateProposal = lazy(() => import("./pages/DAOCreateProposal"));
const DAOProposalDetail = lazy(() => import("./pages/DAOProposalDetail"));
const DAOTasks = lazy(() => import("./pages/DAOTasks"));
const DAOCreateTask = lazy(() => import("./pages/DAOCreateTask"));
const DAOTaskDetail = lazy(() => import("./pages/DAOTaskDetail"));
const DAOTreasury = lazy(() => import("./pages/DAOTreasury"));
const DAOMembers = lazy(() => import("./pages/DAOMembers"));
const DAOVoting = lazy(() => import("./pages/DAOVoting"));
const Settings = lazy(() => import("./pages/Settings"));
const NotFound = lazy(() => import("./pages/NotFound"));

// Prefetch component - loads components after initial render
const prefetchRoutes = () => {
  // Prefetch common routes after initial paint
  requestIdleCallback(() => {
    import("./pages/DAOList");
    import("./pages/DAODetail");
  });
};

// Register service worker
if ("serviceWorker" in navigator) {
  const updateSW = registerSW({
    immediate: true,
    onNeedRefresh() {
      // Show update notification
      if (confirm("New version available! Reload to update?")) {
        updateSW(true);
      }
    },
    onOfflineReady() {
      console.log("App ready to work offline");
    },
  });
}

// App component
export default function App() {
  // Prefetch after mount
  prefetchRoutes();

  return (
    <PerformanceProvider>
      <QueryClientProvider>
        <Router>
          <Route path="/" component={Layout}>
            <Route path="/" component={Home} />
            
            {/* DAO Routes */}
            <Route
              path="/daos"
              component={() => (
                <Suspense fallback={<PageLoader />}>
                  <ComponentErrorBoundary>
                    <DAOList />
                  </ComponentErrorBoundary>
                </Suspense>
              )}
            />
            <Route
              path="/dao/create"
              component={() => (
                <Suspense fallback={<PageLoader />}>
                  <ComponentErrorBoundary>
                    <DAOCreate />
                  </ComponentErrorBoundary>
                </Suspense>
              )}
            />
            <Route
              path="/dao/:id"
              component={() => (
                <Suspense fallback={<PageLoader />}>
                  <ComponentErrorBoundary>
                    <DAODetail />
                  </ComponentErrorBoundary>
                </Suspense>
              )}
            />
            <Route
              path="/dao/:id/proposals"
              component={() => (
                <Suspense fallback={<PageLoader />}>
                  <ComponentErrorBoundary>
                    <DAOProposals />
                  </ComponentErrorBoundary>
                </Suspense>
              )}
            />
            <Route
              path="/dao/:id/proposals/create"
              component={() => (
                <Suspense fallback={<PageLoader />}>
                  <ComponentErrorBoundary>
                    <DAOCreateProposal />
                  </ComponentErrorBoundary>
                </Suspense>
              )}
            />
            <Route
              path="/dao/:id/proposals/:proposalId"
              component={() => (
                <Suspense fallback={<PageLoader />}>
                  <ComponentErrorBoundary>
                    <DAOProposalDetail />
                  </ComponentErrorBoundary>
                </Suspense>
              )}
            />
            <Route
              path="/dao/:id/tasks"
              component={() => (
                <Suspense fallback={<PageLoader />}>
                  <ComponentErrorBoundary>
                    <DAOTasks />
                  </ComponentErrorBoundary>
                </Suspense>
              )}
            />
            <Route
              path="/dao/:id/tasks/create"
              component={() => (
                <Suspense fallback={<PageLoader />}>
                  <ComponentErrorBoundary>
                    <DAOCreateTask />
                  </ComponentErrorBoundary>
                </Suspense>
              )}
            />
            <Route
              path="/dao/:id/tasks/:taskId"
              component={() => (
                <Suspense fallback={<PageLoader />}>
                  <ComponentErrorBoundary>
                    <DAOTaskDetail />
                  </ComponentErrorBoundary>
                </Suspense>
              )}
            />
            <Route
              path="/dao/:id/treasury"
              component={() => (
                <Suspense fallback={<PageLoader />}>
                  <ComponentErrorBoundary>
                    <DAOTreasury />
                  </ComponentErrorBoundary>
                </Suspense>
              )}
            />
            <Route
              path="/dao/:id/members"
              component={() => (
                <Suspense fallback={<PageLoader />}>
                  <ComponentErrorBoundary>
                    <DAOMembers />
                  </ComponentErrorBoundary>
                </Suspense>
              )}
            />
            <Route
              path="/dao/:id/vote"
              component={() => (
                <Suspense fallback={<PageLoader />}>
                  <ComponentErrorBoundary>
                    <DAOVoting />
                  </ComponentErrorBoundary>
                </Suspense>
              )}
            />
            
            {/* Settings */}
            <Route
              path="/settings"
              component={() => (
                <Suspense fallback={<PageLoader />}>
                  <ComponentErrorBoundary>
                    <Settings />
                  </ComponentErrorBoundary>
                </Suspense>
              )}
            />
            
            {/* 404 */}
            <Route
              path="*"
              component={() => (
                <Suspense fallback={<PageLoader />}>
                  <NotFound />
                </Suspense>
              )}
            />
          </Route>
        </Router>
      </QueryClientProvider>
    </PerformanceProvider>
  );
}
