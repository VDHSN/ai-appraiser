"use client";

interface ThinkingIndicatorProps {
  text: string;
  isStreaming: boolean;
}

export function ThinkingIndicator({
  text,
  isStreaming,
}: ThinkingIndicatorProps) {
  return (
    <details className="group">
      <summary className="flex cursor-pointer list-none items-center gap-2 text-sm text-zinc-500 dark:text-zinc-400">
        {isStreaming ? (
          <>
            <div className="h-4 w-4 animate-spin rounded-full border-2 border-zinc-300 border-t-zinc-600 dark:border-zinc-600 dark:border-t-zinc-300" />
            <span>Thinking...</span>
          </>
        ) : (
          <>
            <svg
              className="h-4 w-4 transition-transform group-open:rotate-90"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M9 5l7 7-7 7"
              />
            </svg>
            <span>Thoughts</span>
          </>
        )}
      </summary>
      <div className="mt-2 border-l-2 border-zinc-200 pl-4 dark:border-zinc-700">
        <p className="whitespace-pre-wrap text-sm italic text-zinc-500 dark:text-zinc-400">
          {text}
        </p>
      </div>
    </details>
  );
}
