interface PriceProps {
  amount: number;
  currency?: string;
  className?: string;
  size?: "sm" | "md" | "lg";
}

const sizeStyles = {
  sm: "text-sm",
  md: "text-base",
  lg: "text-lg font-semibold",
};

export function Price({
  amount,
  currency = "USD",
  className = "",
  size = "md",
}: PriceProps) {
  const formatted = new Intl.NumberFormat("en-US", {
    style: "currency",
    currency,
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount);

  return (
    <span
      className={`font-medium text-zinc-900 dark:text-zinc-100 ${sizeStyles[size]} ${className}`}
    >
      {formatted}
    </span>
  );
}

interface PriceRangeProps {
  low: number;
  high: number;
  currency?: string;
  className?: string;
}

export function PriceRange({
  low,
  high,
  currency = "USD",
  className = "",
}: PriceRangeProps) {
  const format = (n: number) =>
    new Intl.NumberFormat("en-US", {
      style: "currency",
      currency,
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(n);

  return (
    <span className={`text-sm text-zinc-500 dark:text-zinc-400 ${className}`}>
      Est. {format(low)} - {format(high)}
    </span>
  );
}
