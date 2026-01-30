/**
 * Brand logo component displaying "apprAIser" with emphasized "AI".
 * The "AI" portion is highlighted in gold with bold weight.
 */

interface BrandLogoProps {
  size?: "sm" | "md" | "lg";
  className?: string;
}

const sizeClasses: Record<string, string> = {
  sm: "text-2xl sm:text-3xl",
  md: "text-4xl sm:text-5xl",
  lg: "text-5xl sm:text-6xl md:text-7xl",
};

export function BrandLogo({ size = "lg", className = "" }: BrandLogoProps) {
  return (
    <h1
      className={`font-sans tracking-tight ${sizeClasses[size]} ${className}`}
    >
      <span className="font-light text-zinc-800 dark:text-zinc-100">appr</span>
      <span className="font-bold text-[var(--accent-gold)]">AI</span>
      <span className="font-light text-zinc-800 dark:text-zinc-100">ser</span>
    </h1>
  );
}
