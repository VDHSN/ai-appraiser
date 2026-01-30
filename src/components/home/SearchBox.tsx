"use client";

/**
 * Search box component for the landing page.
 * Includes a large input field with Curate and Appraise action buttons.
 */

import { useState, useRef, useEffect, type KeyboardEvent } from "react";
import { Button } from "@/components/ui/Button";
import type { AgentId } from "@/lib/agent/types";

interface SearchBoxProps {
  onSubmit: (message: string, agent: AgentId) => void;
  disabled?: boolean;
}

export function SearchBox({ onSubmit, disabled = false }: SearchBoxProps) {
  const [value, setValue] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  const handleSubmit = (agent: AgentId) => {
    const trimmedValue = value.trim();
    if (!trimmedValue || disabled) return;
    onSubmit(trimmedValue, agent);
  };

  const handleKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter" && value.trim()) {
      e.preventDefault();
      // Default to curator on Enter
      handleSubmit("curator");
    }
  };

  const hasInput = value.trim().length > 0;

  return (
    <div className="w-full max-w-2xl px-4">
      <div className="relative">
        <input
          ref={inputRef}
          type="text"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Search for rare collectibles, vintage watches, art..."
          disabled={disabled}
          data-testid="search-input"
          className="w-full rounded-full border border-zinc-300 bg-white px-6 py-4 text-lg shadow-sm transition-shadow duration-200 placeholder:text-zinc-400 hover:shadow-md focus:border-[var(--accent-gold)] focus:outline-none focus:ring-2 focus:ring-[var(--accent-gold)] focus:ring-opacity-50 dark:border-zinc-700 dark:bg-zinc-900 dark:placeholder:text-zinc-500 sm:text-xl"
        />
      </div>

      <div className="mt-6 flex justify-center gap-4">
        <Button
          type="button"
          variant="secondary"
          size="lg"
          onClick={() => handleSubmit("curator")}
          disabled={!hasInput || disabled}
          className="min-w-[120px]"
          data-testid="search-button-curate"
        >
          Curate
        </Button>
        <Button
          type="button"
          variant="secondary"
          size="lg"
          onClick={() => handleSubmit("appraiser")}
          disabled={!hasInput || disabled}
          className="min-w-[120px]"
          data-testid="search-button-appraise"
        >
          Appraise
        </Button>
      </div>
    </div>
  );
}
