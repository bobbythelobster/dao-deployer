import { createSignal } from "solid-js";
import { type GovernanceParams } from "../stores/daoStore";
import { parseEther } from "viem";

interface GovernanceConfigFormProps {
  initialData?: Partial<GovernanceParams>;
  tokenSymbol?: string;
  onSubmit: (params: GovernanceParams) => void;
  onBack: () => void;
}

export default function GovernanceConfigForm(props: GovernanceConfigFormProps) {
  const [votingDuration, setVotingDuration] = createSignal(
    Math.floor((props.initialData?.votingDuration || 86400 * 3) / 86400)
  );
  const [executionDelay, setExecutionDelay] = createSignal(
    Math.floor((props.initialData?.executionDelay || 86400) / 86400)
  );
  const [quorum, setQuorum] = createSignal(props.initialData?.quorum || 51);
  const [proposalThreshold, setProposalThreshold] = createSignal(
    props.initialData?.proposalThreshold ? 
      Number(props.initialData.proposalThreshold) / 1e18 : 100
  );
  const [votingThreshold, setVotingThreshold] = createSignal(
    props.initialData?.votingThreshold ?
      Number(props.initialData.votingThreshold) / 1e18 : 1
  );
  const [errors, setErrors] = createSignal<Record<string, string>>({});

  const validate = () => {
    const newErrors: Record<string, string> = {};

    if (votingDuration() < 1) {
      newErrors.votingDuration = "Voting duration must be at least 1 day";
    } else if (votingDuration() > 30) {
      newErrors.votingDuration = "Voting duration cannot exceed 30 days";
    }

    if (executionDelay() < 0) {
      newErrors.executionDelay = "Execution delay cannot be negative";
    } else if (executionDelay() > 7) {
      newErrors.executionDelay = "Execution delay cannot exceed 7 days";
    }

    if (quorum() < 1 || quorum() > 100) {
      newErrors.quorum = "Quorum must be between 1% and 100%";
    }

    if (proposalThreshold() < 0) {
      newErrors.proposalThreshold = "Proposal threshold cannot be negative";
    }

    if (votingThreshold() < 0) {
      newErrors.votingThreshold = "Voting threshold cannot be negative";
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = (e: Event) => {
    e.preventDefault();
    if (validate()) {
      props.onSubmit({
        votingDuration: votingDuration() * 86400,
        executionDelay: executionDelay() * 86400,
        quorum: quorum(),
        proposalThreshold: parseEther(proposalThreshold().toString()),
        votingThreshold: parseEther(votingThreshold().toString()),
      });
    }
  };

  const presets = [
    { 
      name: "Quick", 
      voting: 1, 
      delay: 0, 
      quorum: 51,
      desc: "Fast decisions, 1 day voting"
    },
    { 
      name: "Standard", 
      voting: 3, 
      delay: 1, 
      quorum: 51,
      desc: "Balanced approach"
    },
    { 
      name: "Deliberative", 
      voting: 7, 
      delay: 2, 
      quorum: 40,
      desc: "More time for discussion"
    },
    { 
      name: "Conservative", 
      voting: 14, 
      delay: 3, 
      quorum: 66,
      desc: "High consensus required"
    },
  ];

  return (
    <form onSubmit={handleSubmit} class="space-y-6">
      <div class="text-center mb-8">
        <h2 class="text-2xl font-bold text-gray-900 dark:text-white mb-2">
          Governance Settings
        </h2>
        <p class="text-gray-600 dark:text-gray-400">
          Configure how decisions are made in your DAO
        </p>
      </div>

      {/* Presets */}
      <div class="grid grid-cols-2 gap-3">
        {presets.map((preset) => (
          <button
            key={preset.name}
            type="button"
            onClick={() => {
              setVotingDuration(preset.voting);
              setExecutionDelay(preset.delay);
              setQuorum(preset.quorum);
            }}
            class="p-3 border border-gray-200 dark:border-gray-700 rounded-lg hover:border-blue-500 hover:bg-blue-50 dark:hover:bg-blue-900/20 transition-all text-left"
          >
            <p class="font-medium text-gray-900 dark:text-white">{preset.name}</p>
            <p class="text-xs text-gray-500">{preset.desc}</p>
          </button>
        ))}
      </div>

      <div class="space-y-6">
        {/* Voting Duration */}
        <div>
          <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
            Voting Duration: {votingDuration()} day{votingDuration() !== 1 ? "s" : ""}
          </label>
          <input
            type="range"
            min="1"
            max="30"
            value={votingDuration()}
            onInput={(e) => setVotingDuration(parseInt(e.currentTarget.value))}
            class="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-blue-600"
          />
          <div class="flex justify-between text-xs text-gray-500 mt-1">
            <span>1 day</span>
            <span>30 days</span>
          </div>
          {errors().votingDuration && (
            <p class="mt-1 text-sm text-red-600">{errors().votingDuration}</p>
          )}
          <p class="mt-1 text-xs text-gray-500">
            How long members have to vote on proposals
          </p>
        </div>

        {/* Execution Delay */}
        <div>
          <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
            Execution Delay: {executionDelay()} day{executionDelay() !== 1 ? "s" : ""}
          </label>
          <input
            type="range"
            min="0"
            max="7"
            value={executionDelay()}
            onInput={(e) => setExecutionDelay(parseInt(e.currentTarget.value))}
            class="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-blue-600"
          />
          <div class="flex justify-between text-xs text-gray-500 mt-1">
            <span>No delay</span>
            <span>7 days</span>
          </div>
          {errors().executionDelay && (
            <p class="mt-1 text-sm text-red-600">{errors().executionDelay}</p>
          )}
          <p class="mt-1 text-xs text-gray-500">
            Time between proposal passing and execution
          </p>
        </div>

        {/* Quorum */}
        <div>
          <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
            Quorum: {quorum()}%
          </label>
          <input
            type="range"
            min="1"
            max="100"
            value={quorum()}
            onInput={(e) => setQuorum(parseInt(e.currentTarget.value))}
            class="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-blue-600"
          />
          <div class="flex justify-between text-xs text-gray-500 mt-1">
            <span>1%</span>
            <span>100%</span>
          </div>
          {errors().quorum && (
            <p class="mt-1 text-sm text-red-600">{errors().quorum}</p>
          )}
          <p class="mt-1 text-xs text-gray-500">
            Minimum % of total supply that must vote for a proposal to pass
          </p>
        </div>

        {/* Proposal Threshold */}
        <div>
          <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
            Proposal Threshold ({props.tokenSymbol || "tokens"})
          </label>
          <input
            type="number"
            value={proposalThreshold()}
            onInput={(e) => setProposalThreshold(parseFloat(e.currentTarget.value))}
            min="0"
            step="0.01"
            class={`w-full px-4 py-3 rounded-lg border ${
              errors().proposalThreshold
                ? "border-red-500 focus:ring-red-500"
                : "border-gray-300 dark:border-gray-600 focus:ring-blue-500"
            } bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:outline-none focus:ring-2 transition-all`}
          />
          {errors().proposalThreshold && (
            <p class="mt-1 text-sm text-red-600">{errors().proposalThreshold}</p>
          )}
          <p class="mt-1 text-xs text-gray-500">
            Minimum tokens required to create a proposal (0 for no threshold)
          </p>
        </div>

        {/* Voting Threshold */}
        <div>
          <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
            Voting Threshold ({props.tokenSymbol || "tokens"})
          </label>
          <input
            type="number"
            value={votingThreshold()}
            onInput={(e) => setVotingThreshold(parseFloat(e.currentTarget.value))}
            min="0"
            step="0.01"
            class={`w-full px-4 py-3 rounded-lg border ${
              errors().votingThreshold
                ? "border-red-500 focus:ring-red-500"
                : "border-gray-300 dark:border-gray-600 focus:ring-blue-500"
            } bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:outline-none focus:ring-2 transition-all`}
          />
          {errors().votingThreshold && (
            <p class="mt-1 text-sm text-red-600">{errors().votingThreshold}</p>
          )}
          <p class="mt-1 text-xs text-gray-500">
            Minimum tokens required to vote on proposals (0 for no threshold)
          </p>
        </div>
      </div>

      {/* Info Box */}
      <div class="bg-blue-50 dark:bg-blue-900/20 rounded-lg p-4">
        <h4 class="text-sm font-medium text-blue-900 dark:text-blue-200 mb-2">
          📊 Governance Summary
        </h4>
        <ul class="text-sm text-blue-800 dark:text-blue-300 space-y-1">
          <li>• Voting period: {votingDuration()} day{votingDuration() !== 1 ? "s" : ""}</li>
          <li>• Execution delay: {executionDelay()} day{executionDelay() !== 1 ? "s" : ""}</li>
          <li>• Required participation: {quorum()}%</li>
          <li>• Proposal cost: {proposalThreshold()} {props.tokenSymbol || "tokens"}</li>
        </ul>
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
          Review & Deploy
        </button>
      </div>
    </form>
  );
}
