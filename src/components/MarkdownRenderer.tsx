import { createMemo } from "solid-js";

interface MarkdownRendererProps {
  content: string;
  class?: string;
}

// Simple markdown parser - in production, use a proper library like marked or remark
export default function MarkdownRenderer(props: MarkdownRendererProps) {
  const parsedContent = createMemo(() => {
    let html = props.content
      // Escape HTML
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      // Headers
      .replace(/^### (.*$)/gim, '<h3 class="text-xl font-bold text-gray-900 dark:text-white mt-6 mb-3">$1</h3>')
      .replace(/^## (.*$)/gim, '<h2 class="text-2xl font-bold text-gray-900 dark:text-white mt-8 mb-4">$1</h2>')
      .replace(/^# (.*$)/gim, '<h1 class="text-3xl font-bold text-gray-900 dark:text-white mt-8 mb-4">$1</h1>')
      // Bold
      .replace(/\*\*(.*?)\*\*/g, '<strong class="font-semibold text-gray-900 dark:text-white">$1</strong>')
      // Italic
      .replace(/\*(.*?)\*/g, '<em class="italic">$1</em>')
      // Code
      .replace(/`([^`]+)`/g, '<code class="px-1.5 py-0.5 bg-gray-100 dark:bg-gray-700 rounded text-sm font-mono text-gray-800 dark:text-gray-200">$1</code>')
      // Code blocks
      .replace(/```([\s\S]*?)```/g, '<pre class="bg-gray-100 dark:bg-gray-800 p-4 rounded-lg overflow-x-auto my-4"><code class="text-sm font-mono text-gray-800 dark:text-gray-200">$1</code></pre>')
      // Links
      .replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2" target="_blank" rel="noopener noreferrer" class="text-blue-600 hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-300 underline">$1</a>')
      // Unordered lists
      .replace(/^\s*[-*+] (.*$)/gim, '<li class="ml-4 text-gray-700 dark:text-gray-300">$1</li>')
      // Ordered lists
      .replace(/^\s*(\d+)\. (.*$)/gim, '<li class="ml-4 text-gray-700 dark:text-gray-300" value="$1">$2</li>')
      // Blockquotes
      .replace(/^> (.*$)/gim, '<blockquote class="border-l-4 border-blue-500 pl-4 py-2 my-4 bg-blue-50 dark:bg-blue-900/20 text-gray-700 dark:text-gray-300 italic">$1</blockquote>')
      // Horizontal rules
      .replace(/^---$/gim, '<hr class="my-6 border-gray-200 dark:border-gray-700" />')
      // Line breaks
      .replace(/\n/g, '<br />');

    return html;
  });

  return (
    <div 
      class={`prose dark:prose-invert max-w-none ${props.class || ""}`}
      innerHTML={parsedContent()}
    />
  );
}

// Alternative: Simple text renderer for previews
export function TextPreview(props: { content: string; maxLength?: number }) {
  const preview = createMemo(() => {
    const max = props.maxLength || 150;
    // Remove markdown syntax for preview
    const plain = props.content
      .replace(/#+ /g, "")
      .replace(/\*\*/g, "")
      .replace(/\*/g, "")
      .replace(/`{3}[\s\S]*?`{3}/g, "")
      .replace(/`([^`]+)`/g, "$1")
      .replace(/\[([^\]]+)\]\([^)]+\)/g, "$1")
      .replace(/\n/g, " ")
      .trim();
    
    if (plain.length <= max) return plain;
    return plain.slice(0, max) + "...";
  });

  return <span class="text-gray-600 dark:text-gray-400">{preview()}</span>;
}

// Table renderer for structured data
export function MarkdownTable(props: { headers: string[]; rows: string[][] }) {
  return (
    <div class="overflow-x-auto">
      <table class="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
        <thead class="bg-gray-50 dark:bg-gray-800">
          <tr>
            {props.headers.map((header) => (
              <th class="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                {header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody class="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
          {props.rows.map((row) => (
            <tr>
              {row.map((cell) => (
                <td class="px-4 py-3 text-sm text-gray-900 dark:text-white">
                  {cell}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
