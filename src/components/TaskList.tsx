import { For, Show, createSignal } from "solid-js";
import { type Address, formatEther } from "viem";
import { useNavigate } from "@solidjs/router";

// Task Types
export type TaskStatus = "open" | "in_progress" | "completed" | "cancelled";
export type TaskCategory = "development" | "design" | "marketing" | "community" | "other";

export interface Task {
  id: string;
  daoId: string;
  title: string;
  description: string;
  category: TaskCategory;
  status: TaskStatus;
  bounty: bigint;
  token: string;
  creator: Address;
  assignee?: Address;
  createdAt: number;
  deadline?: number;
  bidsCount: number;
  deliverables: string[];
}

interface TaskListProps {
  daoId: string;
  tasks?: Task[];
  showFilters?: boolean;
  limit?: number;
}

// Mock tasks
const mockTasks: Task[] = [
  {
    id: "1",
    daoId: "1",
    title: "Build Landing Page",
    description: "Create a modern landing page for the DAO with responsive design",
    category: "development",
    status: "open",
    bounty: BigInt("5000000000000000000"),
    token: "ETH",
    creator: "0x1111111111111111111111111111111111111111" as Address,
    createdAt: Date.now() - 86400000 * 2,
    deadline: Date.now() + 86400000 * 14,
    bidsCount: 3,
    deliverables: ["HTML/CSS/JS files", "Responsive design", "Dark mode support"],
  },
  {
    id: "2",
    daoId: "1",
    title: "Design New Logo",
    description: "Design a professional logo for the DAO that represents our community",
    category: "design",
    status: "open",
    bounty: BigInt("2000000000000000000"),
    token: "ETH",
    creator: "0x2222222222222222222222222222222222222222" as Address,
    createdAt: Date.now() - 86400000 * 5,
    deadline: Date.now() + 86400000 * 7,
    bidsCount: 8,
    deliverables: ["SVG files", "PNG exports", "Brand guidelines"],
  },
  {
    id: "3",
    daoId: "1",
    title: "Write Documentation",
    description: "Create comprehensive documentation for the DAO smart contracts",
    category: "other",
    status: "in_progress",
    bounty: BigInt("3000000000000000000"),
    token: "ETH",
    creator: "0x1111111111111111111111111111111111111111" as Address,
    assignee: "0x3333333333333333333333333333333333333333" as Address,
    createdAt: Date.now() - 86400000 * 10,
    deadline: Date.now() + 86400000 * 5,
    bidsCount: 5,
    deliverables: ["Technical docs", "API reference", "Tutorials"],
  },
];

export default function TaskList(props: TaskListProps) {
  const navigate = useNavigate();
  const [filterStatus, setFilterStatus] = createSignal<TaskStatus | "all">("all");
  const [filterCategory, setFilterCategory] = createSignal<TaskCategory | "all">("all");

  const tasks = () => props.tasks || mockTasks.filter((t) => t.daoId === props.daoId);

  const filteredTasks = () => {
    let result = tasks();
    if (filterStatus() !== "all") {
      result = result.filter((t) => t.status === filterStatus());
    }
    if (filterCategory() !== "all") {
      result = result.filter((t) => t.category === filterCategory());
    }
    return props.limit ? result.slice(0, props.limit) : result;
  };

  const getCategoryColor = (category: TaskCategory) => {
    const colors: Record<TaskCategory, string> = {
      development: "bg-blue-100 text-blue-800 dark:bg-blue-900/50 dark:text-blue-300",
      design: "bg-pink-100 text-pink-800 dark:bg-pink-900/50 dark:text-pink-300",
      marketing: "bg-green-100 text-green-800 dark:bg-green-900/50 dark:text-green-300",
      community: "bg-purple-100 text-purple-800 dark:bg-purple-900/50 dark:text-purple-300",
      other: "bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300",
    };
    return colors[category];
  };

  const getStatusColor = (status: TaskStatus) => {
    const colors: Record<TaskStatus, string> = {
      open: "bg-green-500",
      in_progress: "bg-yellow-500",
      completed: "bg-blue-500",
      cancelled: "bg-red-500",
    };
    return colors[status];
  };

  const formatAddress = (addr: string) => {
    return `${addr.slice(0, 6)}...${addr.slice(-4)}`;
  };

  const getTimeRemaining = (deadline?: number) => {
    if (!deadline) return "No deadline";
    const diff = deadline - Date.now();
    if (diff < 0) return "Overdue";
    const days = Math.floor(diff / (1000 * 60 * 60 * 24));
    return `${days} days left`;
  };

  return (
    <div class="space-y-6">
      {/* Header */}
      <div class="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h2 class="text-xl font-bold text-gray-900 dark:text-white">Available Tasks</h2>
          <p class="text-sm text-gray-500 dark:text-gray-400">
            Complete tasks and earn rewards
          </p>
        </div>
        <button
          onClick={() => navigate(`/dao/${props.daoId}/tasks/create`)}
          class="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-lg transition-colors flex items-center gap-2"
        >
          <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v16m8-8H4" />
          </svg>
          Post Task
        </button>
      </div>

      {/* Filters */}
      <Show when={props.showFilters !== false}>
        <div class="flex flex-wrap gap-3">
          <select
            value={filterStatus()}
            onChange={(e) => setFilterStatus(e.currentTarget.value as TaskStatus | "all")}
            class="px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-sm"
          >
            <option value="all">All Status</option>
            <option value="open">Open</option>
            <option value="in_progress">In Progress</option>
            <option value="completed">Completed</option>
          </select>

          <select
            value={filterCategory()}
            onChange={(e) => setFilterCategory(e.currentTarget.value as TaskCategory | "all")}
            class="px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-sm"
          >
            <option value="all">All Categories</option>
            <option value="development">Development</option>
            <option value="design">Design</option>
            <option value="marketing">Marketing</option>
            <option value="community">Community</option>
            <option value="other">Other</option>
          </select>
        </div>
      </Show>

      {/* Task List */}
      <div class="space-y-4">
        <For each={filteredTasks()}>
          {(task) => (
            <div
              class="bg-white dark:bg-gray-800 rounded-xl p-6 border border-gray-200 dark:border-gray-700 hover:shadow-lg transition-all cursor-pointer"
              onClick={() => navigate(`/dao/${props.daoId}/tasks/${task.id}`)}
            >
              <div class="flex items-start justify-between gap-4">
                <div class="flex-1">
                  <div class="flex items-center gap-2 mb-2">
                    <span class={`px-2 py-1 text-xs font-medium rounded-full ${getCategoryColor(task.category)}`}>
                      {task.category}
                    </span>
                    <span class="flex items-center gap-1 text-xs text-gray-500">
                      <span class={`w-2 h-2 rounded-full ${getStatusColor(task.status)}`} />
                      {task.status.replace("_", " ")}
                    </span>
                  </div>
                  <h3 class="font-semibold text-gray-900 dark:text-white text-lg mb-2">
                    {task.title}
                  </h3>
                  <p class="text-gray-600 dark:text-gray-400 text-sm mb-4">
                    {task.description}
                  </p>
                  <div class="flex flex-wrap items-center gap-4 text-sm text-gray-500">
                    <span class="flex items-center gap-1">
                      <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                      {formatEther(task.bounty)} {task.token}
                    </span>
                    <span class="flex items-center gap-1">
                      <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                      </svg>
                      {formatAddress(task.creator)}
                    </span>
                    <Show when={task.deadline}>
                      <span class={`flex items-center gap-1 ${
                        task.deadline! < Date.now() ? "text-red-500" : ""
                      }`}>
                        <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                        {getTimeRemaining(task.deadline)}
                      </span>
                    </Show>
                  </div>
                </div>
                <div class="text-right">
                  <span class="text-lg font-bold text-gray-900 dark:text-white">
                    {formatEther(task.bounty)} {task.token}
                  </span>
                  <p class="text-sm text-gray-500 mt-1">
                    {task.bidsCount} bid{task.bidsCount !== 1 ? "s" : ""}
                  </p>
                </div>
              </div>
            </div>
          )}
        </For>
      </div>

      {/* Empty State */}
      <Show when={filteredTasks().length === 0}>
        <div class="text-center py-12 bg-gray-50 dark:bg-gray-800/50 rounded-xl">
          <div class="w-16 h-16 bg-gray-200 dark:bg-gray-700 rounded-full flex items-center justify-center mx-auto mb-4">
            <svg class="w-8 h-8 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
            </svg>
          </div>
          <h3 class="text-lg font-medium text-gray-900 dark:text-white mb-2">
            No tasks found
          </h3>
          <p class="text-gray-500 dark:text-gray-400">
            Be the first to post a task for this DAO
          </p>
        </div>
      </Show>
    </div>
  );
}
