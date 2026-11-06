import { formatMoney, type Cents } from "@/lib/money";
import { cn } from "./cn";

export function Money({
  value, className, colored = false, sign = false, decimals = "auto",
}: {
  value: Cents;
  className?: string;
  colored?: boolean;
  sign?: boolean;
  decimals?: "auto" | "always" | "never";
}) {
  return (
    <span className={cn("num whitespace-nowrap", colored && value > 0 && "text-pos", colored && value < 0 && "text-neg", className)}>
      {formatMoney(value, { sign, decimals })}
    </span>
  );
}
