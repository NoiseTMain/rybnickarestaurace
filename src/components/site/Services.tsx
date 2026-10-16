import { CheckIcon } from "@/components/ui/icons";
import type { Service } from "@/lib/types";

export function ServicesList({ services }: { services: Service[] }) {
  const enabled = services.filter((s) => s.enabled);
  if (!enabled.length) return null;
  return (
    <ul className="flex flex-wrap gap-2.5">
      {enabled.map((s) => (
        <li key={s.key} className="inline-flex items-center gap-2 rounded-full border border-line bg-white px-4 py-2 text-sm font-medium text-ink">
          <CheckIcon size={16} className="text-pond-600" />
          {s.label}
        </li>
      ))}
    </ul>
  );
}
