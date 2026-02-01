import { createSignal, Show, lazy, Suspense } from "solid-js";
import { useNavigate } from "@solidjs/router";
import { useDAO, daoActions, type DAOConfig, type GovernanceParams } from "../stores";
import { useToast } from "../components/ToastNotifications";

// Lazy load form components
const DAOConfigForm = lazy(() => import("../components/DAOConfigForm"));
const TokenConfigForm = lazy(() => import("../components/TokenConfigForm"));
const GovernanceConfigForm = lazy(() => import("../components/GovernanceConfigForm"));
const DeployProgress = lazy(() => import("../components/DeployProgress"));

type Step = "config" | "token" | "governance" | "review" | "deploying";

export default function DAOCreate() {
  const navigate = useNavigate();
  const { state: daoState } = useDAO();
  const toast = useToast();
  const [currentStep, setCurrentStep] = createSignal<Step>("config");
  
  const [config, setConfig] = createSignal<{
    name: string;
    description: string;
  }>({ name: "", description: "" });
  
  const [tokenConfig, setTokenConfig] = createSignal({
    name: "",
    symbol: "",
    initialSupply: "1000000",
    maxSupply: "10000000",
    decimals: 18,
  });
  
  const [governanceConfig, setGovernanceConfig] = createSignal<GovernanceParams>({
    votingThreshold: BigInt("100"),
    votingDuration: 86400 * 3, // 3 days
    executionDelay: 86400, // 1 day
    quorum: 51,
    proposalThreshold: BigInt("10"),
  });

  const steps: { id: Step; label: string }[] = [
    { id: "config", label: "DAO Info" },
    { id: "token", label: "Token" },
    { id: "governance", label: "Governance" },
    { id: "review", label: "Review" },
  ];

  const handleDeploy = async () => {
    setCurrentStep("deploying");
    
    const daoConfig: DAOConfig = {
      name: config().name,
      description: config().description,
      tokenConfig: {
        name: tokenConfig().name,
        symbol: tokenConfig().symbol,
        initialSupply: tokenConfig().initialSupply,
        maxSupply: tokenConfig().maxSupply,
        decimals: tokenConfig().decimals,
      },
      governanceParams: governanceConfig(),
    };

    try {
      await daoActions.deployDAO(daoConfig);
      
      if (daoState.currentDAO) {
        toast.success("DAO deployed successfully!");
        navigate(`/dao/${daoState.currentDAO.id}`);
      }
    } catch (error) {
      toast.error("Failed to deploy DAO");
      setCurrentStep("review");
    }
  };

  const canProceed = () => {
    switch (currentStep()) {
      case "config":
        return config().name.length >= 3 && config().description.length >= 10;
      case "token":
        return tokenConfig().name && tokenConfig().symbol && tokenConfig().initialSupply;
      case "governance":
        return governanceConfig().quorum >= 1 && governanceConfig().quorum <= 100;
      default:
        return true;
    }
  };

  return (
    <div class="max-w-3xl mx-auto">
      {/* Header */}
      <div class="mb-8">
        <h1 class="text-2xl font-bold text-gray-900 dark:text-white">Create DAO</h1>
        <p class="text-gray-600 dark:text-gray-400">
          Set up your decentralized organization in a few simple steps
        </p>
      </div>

      {/* Progress Steps */}
      <Show when={currentStep() !== "deploying"}>
        <div class="mb-8">
          <div class="flex items-center justify-between">
            <For each={steps}>
              {(step, index) => (
                <>
                  <div class="flex flex-col items-center">
                    <div
                      class={`w-10 h-10 rounded-full flex items-center justify-center font-semibold ${
                        steps.findIndex((s) => s.id === currentStep()) >= index()
                          ? "bg-blue-600 text-white"
                          : "bg-gray-200 dark:bg-gray-700 text-gray-500"
                      }`}
                    >
                      {index() + 1}
                    </div>
                    <span class="mt-2 text-sm text-gray-600 dark:text-gray-400">
                      {step.label}
                    </span>
                  </div>
                  <Show when={index() < steps.length - 1}>
                    <div
                      class={`flex-1 h-0.5 mx-4 ${
                        steps.findIndex((s) => s.id === currentStep()) > index()
                          ? "bg-blue-600"
                          : "bg-gray-200 dark:bg-gray-700"
                      }`}
                    />
                  </Show>
                </>
              )}
            </For>
          </div>
        </div>
      </Show>

      {/* Step Content */}
      <div class="bg-white dark:bg-gray-800 rounded-xl p-6 border border-gray-200 dark:border-gray-700">
        <Suspense fallback={<div class="h-64 flex items-center justify-center">Loading...</div>}>
          <Switch>
            <Match when={currentStep() === "config"}>
              <DAOConfigForm
                value={config()}
                onChange={setConfig}
              />
            </Match>
            <Match when={currentStep() === "token"}>
              <TokenConfigForm
                value={tokenConfig()}
                onChange={setTokenConfig}
              />
            </Match>
            <Match when={currentStep() === "governance"}>
              <GovernanceConfigForm
                value={governanceConfig()}
                onChange={setGovernanceConfig}
              />
            </Match>
            <Match when={currentStep() === "review"}>
              <ReviewStep
                config={config()}
                tokenConfig={tokenConfig()}
                governanceConfig={governanceConfig()}
              />
            </Match>
            <Match when={currentStep() === "deploying"}>
              <DeployProgress status={daoState.deploymentStatus} />
            </Match>
          </Switch>
        </Suspense>
      </div>

      {/* Navigation Buttons */}
      <Show when={currentStep() !== "deploying"}>
        <div class="flex justify-between mt-6">
          <button
            onClick={() => {
              const currentIndex = steps.findIndex((s) => s.id === currentStep());
              if (currentIndex > 0) {
                setCurrentStep(steps[currentIndex - 1].id);
              } else {
                navigate("/daos");
              }
            }}
            class="px-6 py-2 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
          >
            Back
          </button>
          
          <Show
            when={currentStep() !== "review"}
            fallback={
              <button
                onClick={handleDeploy}
                disabled={!canProceed()}
                class="px-6 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-400 text-white font-medium rounded-lg transition-colors"
              >
                Deploy DAO
              </button>
            }
          >
            <button
              onClick={() => {
                const currentIndex = steps.findIndex((s) => s.id === currentStep());
                if (currentIndex < steps.length - 1) {
                  setCurrentStep(steps[currentIndex + 1].id);
                }
              }}
              disabled={!canProceed()}
              class="px-6 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-400 text-white font-medium rounded-lg transition-colors"
            >
              Next
            </button>
          </Show>
        </div>
      </Show>
    </div>
  );
}

import { Switch, Match } from "solid-js";

function ReviewStep(props: {
  config: { name: string; description: string };
  tokenConfig: { name: string; symbol: string; initialSupply: string; maxSupply: string };
  governanceConfig: GovernanceParams;
}) {
  return (
    <div class="space-y-6">
      <h2 class="text-xl font-semibold text-gray-900 dark:text-white">Review Configuration</h2>
      
      <div class="space-y-4">
        <ReviewSection title="DAO Information">
          <ReviewItem label="Name" value={props.config.name} />
          <ReviewItem label="Description" value={props.config.description} />
        </ReviewSection>
        
        <ReviewSection title="Token Configuration">
          <ReviewItem label="Token Name" value={props.tokenConfig.name} />
          <ReviewItem label="Symbol" value={props.tokenConfig.symbol} />
          <ReviewItem label="Initial Supply" value={props.tokenConfig.initialSupply} />
          <ReviewItem label="Max Supply" value={props.tokenConfig.maxSupply} />
        </ReviewSection>
        
        <ReviewSection title="Governance Parameters">
          <ReviewItem label="Voting Threshold" value={`${props.governanceConfig.votingThreshold} tokens`} />
          <ReviewItem label="Voting Duration" value={`${props.governanceConfig.votingDuration / 86400} days`} />
          <ReviewItem label="Execution Delay" value={`${props.governanceConfig.executionDelay / 86400} days`} />
          <ReviewItem label="Quorum" value={`${props.governanceConfig.quorum}%`} />
          <ReviewItem label="Proposal Threshold" value={`${props.governanceConfig.proposalThreshold} tokens`} />
        </ReviewSection>
      </div>
    </div>
  );
}

function ReviewSection(props: { title: string; children: any }) {
  return (
    <div class="border border-gray-200 dark:border-gray-700 rounded-lg p-4">
      <h3 class="font-medium text-gray-900 dark:text-white mb-3">{props.title}</h3>
      <div class="space-y-2">{props.children}</div>
    </div>
  );
}

function ReviewItem(props: { label: string; value: string }) {
  return (
    <div class="flex justify-between">
      <span class="text-gray-500 dark:text-gray-400">{props.label}</span>
      <span class="text-gray-900 dark:text-white font-medium">{props.value}</span>
    </div>
  );
}
