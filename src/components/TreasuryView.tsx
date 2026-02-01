import { createSignal, For, Show } from "solid-js";
import { formatEther, type Address } from "viem";
import { useWallet } from "../stores/walletStore";

interface TreasuryTransaction {
  id: string;
  type: "in" | "out";
  amount: bigint;
  token: string;
  from: Address;
  to: Address;
  description: string;
  timestamp: number;
  txHash: string;
}

interface TreasuryViewProps {
  daoAddress: Address;
  balance: bigint;
  tokenAddress?: Address;
  tokenBalance?: bigint;
  tokenSymbol?: string;
}

export default function TreasuryView(props: TreasuryViewProps) {
  const { state: walletState } = useWallet();
  const [activeTab, setActiveTab] = createSignal<"assets" | "transactions">("assets");

  // Mock transactions
  const transactions: TreasuryTransaction[] = [
    {
      id: "1",
      type: "in",
      amount: BigInt("50000000000000000000"),
      token: "ETH",
      from: "0x1111111111111111111111111111111111111111" as Address,
      to: props.daoAddress,
      description: "Initial funding",
      timestamp: Date.now() - 86400000 * 30,
      txHash: "0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef",
    },
    {
      id: "2",
      type: "out",
      amount: BigInt("10000000000000000000"),
      token: "ETH",
      from: props.daoAddress,
      to: "0x2222222222222222222222222222222222222222" as Address,
      description: "Grant payment - Developer onboarding",
      timestamp: Date.now() - 86400000 * 15,
      txHash: "0xabcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890",
    },
    {
      id: "3",
      type: "in",
      amount: BigInt("25000000000000000000"),
      token: "ETH",
      from: "0x3333333333333333333333333333333333333333" as Address,
      to: props.daoAddress,
      description: "Donation from community member",
      timestamp: Date.now() - 86400000 * 7,
      txHash: "0x7890abcdef1234567890abcdef1234567890abcdef1234567890abcdef123456",
    },
  ];

  const formatAddress = (addr: string) => {
    return `${addr.slice(0, 6)}...${addr.slice(-4)}`;
  };

  const formatDate = (timestamp: number) => {
    return new Date(timestamp).toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    });
  };

  const formatAmount = (amount: bigint, token: string) => {
    const value = formatEther(amount);
    return `${value} ${token}`;
  };

  const totalIn = () => {
    return transactions
      .filter((t) => t.type === "in")
      .reduce((sum, t) => sum + t.amount, 0n);
  };

  const totalOut = () => {
    return transactions
      .filter((t) => t.type === "out")
      .reduce((sum, t) => sum + t.amount, 0n);
  };

  return (
    <div class="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 overflow-hidden">
      {/* Header */}
      <div class="p-6 border-b border-gray-200 dark:border-gray-700">
        <div class="flex items-center justify-between">
          <div>
            <h3 class="text-lg font-bold text-gray-900 dark:text-white">
              Treasury
            </h3>
            <p class="text-sm text-gray-500 dark:text-gray-400">
              DAO funds and transaction history
            </p>
          </div>
          <div class="flex gap-2">
            <button
              onClick={() => {}}
              class="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium rounded-lg transition-colors"
            >
              Deposit
            </button>
          </div>
        </div>
      </div>

      {/* Balance Cards */}
      <div class="p-6 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 border-b border-gray-200 dark:border-gray-700">
        {/* ETH Balance */}
        <div class="bg-gradient-to-br from-blue-500 to-blue-600 rounded-xl p-4 text-white">
          <div class="flex items-center gap-2 mb-2">
            <div class="w-8 h-8 bg-white/20 rounded-full flex items-center justify-center">
              <span class="font-bold text-sm">Ξ</span>
            </div>
            <span class="text-blue-100">ETH Balance</span>
          </div>
          <p class="text-2xl font-bold">{formatEther(props.balance)} ETH</p>
          <p class="text-sm text-blue-200 mt-1">Native token</p>
        </div>

        {/* Token Balance */}
        <Show when={props.tokenBalance !== undefined}>
          <div class="bg-gradient-to-br from-purple-500 to-purple-600 rounded-xl p-4 text-white">
            <div class="flex items-center gap-2 mb-2">
              <div class="w-8 h-8 bg-white/20 rounded-full flex items-center justify-center">
                <span class="font-bold text-sm">{props.tokenSymbol?.charAt(0)}</span>
              </div>
              <span class="text-purple-100">{props.tokenSymbol} Balance</span>
            </div>
            <p class="text-2xl font-bold">
              {formatEther(props.tokenBalance!)} {props.tokenSymbol}
            </p>
            <p class="text-sm text-purple-200 mt-1">Governance token</p>
          </div>
        </Show>

        {/* Stats */}
        <div class="bg-gray-50 dark:bg-gray-700/50 rounded-xl p-4">
          <p class="text-sm text-gray-500 dark:text-gray-400 mb-3">30 Day Activity</p>
          <div class="space-y-2">
            <div class="flex justify-between">
              <span class="text-sm text-gray-600 dark:text-gray-400">Inflows</span>
              <span class="text-sm font-medium text-green-600 dark:text-green-400">
                +{formatEther(totalIn())} ETH
              </span>
            </div>
            <div class="flex justify-between">
              <span class="text-sm text-gray-600 dark:text-gray-400">Outflows</span>
              <span class="text-sm font-medium text-red-600 dark:text-red-400">
                -{formatEther(totalOut())} ETH
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div class="flex border-b border-gray-200 dark:border-gray-700">
        <button
          onClick={() => setActiveTab("assets")}
          class={`flex-1 py-3 px-4 text-sm font-medium transition-colors ${
            activeTab() === "assets"
              ? "text-blue-600 border-b-2 border-blue-600"
              : "text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-300"
          }`}
        >
          Assets
        </button>
        <button
          onClick={() => setActiveTab("transactions")}
          class={`flex-1 py-3 px-4 text-sm font-medium transition-colors ${
            activeTab() === "transactions"
              ? "text-blue-600 border-b-2 border-blue-600"
              : "text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-300"
          }`}
        >
          Transactions
        </button>
      </div>

      {/* Tab Content */}
      <div class="p-6">
        <Show when={activeTab() === "assets"}>
          <div class="space-y-3">
            {/* ETH */}
            <div class="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-700/50 rounded-lg">
              <div class="flex items-center gap-3">
                <div class="w-10 h-10 bg-blue-100 dark:bg-blue-900/50 rounded-full flex items-center justify-center">
                  <span class="font-bold text-blue-600 dark:text-blue-400">Ξ</span>
                </div>
                <div>
                  <p class="font-medium text-gray-900 dark:text-white">Ethereum</p>
                  <p class="text-sm text-gray-500">ETH</p>
                </div>
              </div>
              <div class="text-right">
                <p class="font-medium text-gray-900 dark:text-white">
                  {formatEther(props.balance)}
                </p>
                <p class="text-sm text-gray-500">ETH</p>
              </div>
            </div>

            {/* Governance Token */}
            <Show when={props.tokenBalance !== undefined}>
              <div class="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-700/50 rounded-lg">
                <div class="flex items-center gap-3">
                  <div class="w-10 h-10 bg-purple-100 dark:bg-purple-900/50 rounded-full flex items-center justify-center">
                    <span class="font-bold text-purple-600 dark:text-purple-400">
                      {props.tokenSymbol?.charAt(0)}
                    </span>
                  </div>
                  <div>
                    <p class="font-medium text-gray-900 dark:text-white">Governance Token</p>
                    <p class="text-sm text-gray-500">{props.tokenSymbol}</p>
                  </div>
                </div>
                <div class="text-right">
                  <p class="font-medium text-gray-900 dark:text-white">
                    {formatEther(props.tokenBalance!)}
                  </p>
                  <p class="text-sm text-gray-500">{props.tokenSymbol}</p>
                </div>
              </div>
            </Show>
          </div>
        </Show>

        <Show when={activeTab() === "transactions"}>
          <div class="space-y-3">
            <For each={transactions}>
              {(tx) => (
                <div class="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-700/50 rounded-lg">
                  <div class="flex items-center gap-3">
                    <div
                      class={`w-10 h-10 rounded-full flex items-center justify-center ${
                        tx.type === "in"
                          ? "bg-green-100 dark:bg-green-900/50 text-green-600 dark:text-green-400"
                          : "bg-red-100 dark:bg-red-900/50 text-red-600 dark:text-red-400"
                      }`}
                    >
                      <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        {tx.type === "in" ? (
                          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 14l-7 7m0 0l-7-7m7 7V3" />
                        ) : (
                          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 10l7-7m0 0l7 7m-7-7v18" />
                        )}
                      </svg>
                    </div>
                    <div>
                      <p class="font-medium text-gray-900 dark:text-white">{tx.description}</p>
                      <p class="text-sm text-gray-500">
                        {formatAddress(tx.type === "in" ? tx.from : tx.to)} • {formatDate(tx.timestamp)}
                      </p>
                    </div>
                  </div>
                  <div class="text-right">
                    <p
                      class={`font-medium ${
                        tx.type === "in"
                          ? "text-green-600 dark:text-green-400"
                          : "text-red-600 dark:text-red-400"
                      }`}
                    >
                      {tx.type === "in" ? "+" : "-"}
                      {formatAmount(tx.amount, tx.token)}
                    </p>
                    <a
                      href={`https://etherscan.io/tx/${tx.txHash}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      class="text-xs text-blue-600 hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-300"
                    >
                      View →
                    </a>
                  </div>
                </div>
              )}
            </For>
          </div>
        </Show>
      </div>
    </div>
  );
}
