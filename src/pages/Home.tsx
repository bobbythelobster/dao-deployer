import { A } from "@solidjs/router";
import { usePerformance } from "../utils/performance";
import { onMount } from "solid-js";

export default function Home() {
  const performance = usePerformance();

  onMount(() => {
    // Track page load performance
    performance.trackCustomMetric("home_page_mount", performance.now());
  });

  return (
    <div class="space-y-16">
      {/* Hero Section */}
      <section class="text-center py-16 px-4">
        <h1 class="text-4xl md:text-6xl font-bold text-gray-900 dark:text-white mb-6">
          Deploy Your DAO in Minutes
        </h1>
        <p class="text-xl text-gray-600 dark:text-gray-400 max-w-2xl mx-auto mb-8">
          Create decentralized autonomous organizations with soul-bound token governance.
          Fast, secure, and fully customizable.
        </p>
        <div class="flex flex-col sm:flex-row gap-4 justify-center">
          <A
            href="/dao/create"
            class="px-8 py-4 bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-xl transition-all hover:shadow-lg"
          >
            Create DAO
          </A>
          <A
            href="/daos"
            class="px-8 py-4 bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700 text-gray-900 dark:text-white font-semibold rounded-xl transition-all"
          >
            Explore DAOs
          </A>
        </div>
      </section>

      {/* Features */}
      <section class="grid md:grid-cols-3 gap-8">
        <FeatureCard
          icon="shield"
          title="Soul-Bound Tokens"
          description="Non-transferable governance tokens ensure voting power stays with active contributors."
        />
        <FeatureCard
          icon="vote"
          title="On-Chain Voting"
          description="Secure, transparent proposal voting with customizable parameters and execution delays."
        />
        <FeatureCard
          icon="tasks"
          title="Task Marketplace"
          description="Post tasks, receive bids, and manage work with built-in escrow and dispute resolution."
        />
      </section>

      {/* Stats */}
      <section class="bg-blue-600 rounded-2xl p-8 text-white">
        <div class="grid grid-cols-2 md:grid-cols-4 gap-8 text-center">
          <Stat value="50+" label="DAOs Created" />
          <Stat value="1,200+" label="Members" />
          <Stat value="$2.5M" label="Treasury Value" />
          <Stat value="500+" label="Proposals" />
        </div>
      </section>

      {/* How It Works */}
      <section>
        <h2 class="text-3xl font-bold text-center text-gray-900 dark:text-white mb-12">
          How It Works
        </h2>
        <div class="grid md:grid-cols-4 gap-6">
          <Step
            number={1}
            title="Configure"
            description="Set up your DAO name, token, and governance parameters."
          />
          <Step
            number={2}
            title="Deploy"
            description="Deploy your DAO contracts to the blockchain in one click."
          />
          <Step
            number={3}
            title="Invite"
            description="Add members and distribute soul-bound governance tokens."
          />
          <Step
            number={4}
            title="Govern"
            description="Create proposals, vote, and execute decisions on-chain."
          />
        </div>
      </section>
    </div>
  );
}

function FeatureCard(props: { icon: string; title: string; description: string }) {
  const icons: Record<string, JSX.Element> = {
    shield: (
      <svg class="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
      </svg>
    ),
    vote: (
      <svg class="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
      </svg>
    ),
    tasks: (
      <svg class="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01" />
      </svg>
    ),
  };

  return (
    <div class="bg-white dark:bg-gray-800 rounded-xl p-6 shadow-sm border border-gray-200 dark:border-gray-700 hover:shadow-md transition-shadow">
      <div class="w-14 h-14 bg-blue-100 dark:bg-blue-900/50 rounded-xl flex items-center justify-center text-blue-600 dark:text-blue-400 mb-4">
        {icons[props.icon]}
      </div>
      <h3 class="text-lg font-semibold text-gray-900 dark:text-white mb-2">
        {props.title}
      </h3>
      <p class="text-gray-600 dark:text-gray-400">{props.description}</p>
    </div>
  );
}

function Stat(props: { value: string; label: string }) {
  return (
    <div>
      <div class="text-3xl md:text-4xl font-bold">{props.value}</div>
      <div class="text-blue-200">{props.label}</div>
    </div>
  );
}

function Step(props: { number: number; title: string; description: string }) {
  return (
    <div class="text-center">
      <div class="w-12 h-12 bg-blue-600 text-white rounded-full flex items-center justify-center text-xl font-bold mx-auto mb-4">
        {props.number}
      </div>
      <h3 class="text-lg font-semibold text-gray-900 dark:text-white mb-2">
        {props.title}
      </h3>
      <p class="text-gray-600 dark:text-gray-400">{props.description}</p>
    </div>
  );
}

import type { JSX } from "solid-js";
