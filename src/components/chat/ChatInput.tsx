"use client";

import { FormEvent, useRef, useEffect } from "react";
import { Button } from "@/components/ui/Button";

interface ChatInputProps {
  value: string;
  onChange: (value: string) => void;
  onSubmit: (e: FormEvent) => void;
  isLoading: boolean;
  stop?: () => void;
}

export function ChatInput({
  value,
  onChange,
  onSubmit,
  isLoading,
  stop,
}: ChatInputProps) {
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = "auto";
      textareaRef.current.style.height = `${Math.min(textareaRef.current.scrollHeight, 200)}px`;
    }
  }, [value]);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      if (!isLoading && value.trim()) {
        onSubmit(e);
      }
    }
  };

  return (
    <form
      onSubmit={onSubmit}
      className="safe-area-inset-bottom border-t border-zinc-200 bg-white pb-4 pt-3 dark:border-zinc-800 dark:bg-zinc-950 sm:pb-5 sm:pt-4"
    >
      <div className="mx-auto flex max-w-3xl gap-2 px-4 safe-area-inset-x sm:gap-3 sm:px-6">
        <textarea
          ref={textareaRef}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Search for art deco lamps, vintage watches..."
          rows={2}
          className="min-h-[44px] flex-1 resize-none rounded-lg border border-zinc-300 bg-white px-3 py-3 text-base placeholder:text-zinc-400 focus:border-[var(--accent)] focus:outline-none focus:ring-1 focus:ring-[var(--accent)] dark:border-zinc-700 dark:bg-zinc-900 dark:placeholder:text-zinc-500 sm:min-h-[48px] sm:px-4 sm:py-3 sm:text-sm"
          disabled={isLoading}
        />
        {isLoading ? (
          <Button type="button" variant="secondary" onClick={stop}>
            Stop
          </Button>
        ) : (
          <Button type="submit" disabled={!value.trim()}>
            Send
          </Button>
        )}
      </div>
    </form>
  );
}
