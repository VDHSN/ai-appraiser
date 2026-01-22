"use client";

import { useState } from "react";
import { getProxiedImageUrl } from "@/lib/image-proxy";

interface ImageGalleryProps {
  images: string[];
  alt: string;
}

function ImagePlaceholder({ className = "" }: { className?: string }) {
  return (
    <div
      className={`flex items-center justify-center bg-zinc-100 text-zinc-400 dark:bg-zinc-800 ${className}`}
    >
      <svg
        className="h-12 w-12"
        fill="none"
        stroke="currentColor"
        viewBox="0 0 24 24"
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={1.5}
          d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"
        />
      </svg>
    </div>
  );
}

export function ImageGallery({ images, alt }: ImageGalleryProps) {
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [errorIndexes, setErrorIndexes] = useState<Set<number>>(new Set());

  if (images.length === 0) {
    return <ImagePlaceholder className="aspect-square rounded-lg" />;
  }

  const handleError = (index: number) => {
    setErrorIndexes((prev) => new Set(prev).add(index));
  };

  return (
    <div className="space-y-3">
      <div className="relative aspect-square overflow-hidden rounded-lg bg-zinc-100 dark:bg-zinc-800">
        {errorIndexes.has(selectedIndex) ? (
          <ImagePlaceholder className="h-full w-full" />
        ) : (
          /* eslint-disable-next-line @next/next/no-img-element */
          <img
            src={getProxiedImageUrl(images[selectedIndex])}
            alt={`${alt} - Image ${selectedIndex + 1}`}
            className="h-full w-full object-contain"
            onError={() => handleError(selectedIndex)}
          />
        )}
      </div>

      {images.length > 1 && (
        <div className="flex gap-2 overflow-x-auto pb-2">
          {images.map((img, i) => (
            <button
              key={i}
              onClick={() => setSelectedIndex(i)}
              className={`relative h-16 w-16 flex-shrink-0 overflow-hidden rounded-md ${
                i === selectedIndex
                  ? "ring-2 ring-[var(--accent)]"
                  : "ring-1 ring-zinc-200 dark:ring-zinc-700"
              }`}
            >
              {errorIndexes.has(i) ? (
                <div className="h-full w-full bg-zinc-200 dark:bg-zinc-700" />
              ) : (
                /* eslint-disable-next-line @next/next/no-img-element */
                <img
                  src={getProxiedImageUrl(img)}
                  alt={`${alt} thumbnail ${i + 1}`}
                  className="h-full w-full object-cover"
                  onError={() => handleError(i)}
                />
              )}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
