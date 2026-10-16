import type { ReactNode } from "react";

export function SectionHeading({
  eyebrow,
  title,
  intro,
  align = "left",
  as: Tag = "h2",
  tone = "light",
  id,
}: {
  eyebrow?: string;
  title: ReactNode;
  intro?: ReactNode;
  align?: "left" | "center";
  as?: "h1" | "h2";
  tone?: "light" | "dark";
  id?: string;
}) {
  return (
    <div className={`max-w-2xl ${align === "center" ? "mx-auto text-center" : ""}`}>
      {eyebrow && <p className={`eyebrow ${tone === "dark" ? "!text-amber-300" : ""}`}>{eyebrow}</p>}
      <Tag
        id={id}
        className={`mt-3 text-balance font-display text-[2.1rem] leading-[1.08] font-semibold sm:text-5xl ${
          tone === "dark" ? "text-paper" : "text-pond-950"
        }`}
      >
        {title}
      </Tag>
      {intro && (
        <p className={`mt-4 text-pretty text-lg leading-relaxed ${tone === "dark" ? "text-paper/75" : "text-ink-soft"}`}>{intro}</p>
      )}
    </div>
  );
}

/** Záhlaví podstránek */
export function PageHero({ eyebrow, title, intro }: { eyebrow: string; title: string; intro?: ReactNode }) {
  return (
    <div className="ripple-bg relative overflow-hidden text-paper">
      <Ripples />
      <div className="container-page relative py-14 sm:py-20">
        <SectionHeading eyebrow={eyebrow} title={title} intro={intro} as="h1" tone="dark" />
      </div>
    </div>
  );
}

/** Jemná dekorace – soustředné vlny na hladině rybníka */
export function Ripples({ className = "" }: { className?: string }) {
  return (
    <svg
      aria-hidden="true"
      className={`pointer-events-none absolute -right-24 -top-24 h-[34rem] w-[34rem] text-amber-300/15 ${className}`}
      viewBox="0 0 400 400"
      fill="none"
      stroke="currentColor"
    >
      {[40, 80, 120, 160, 200].map((r, i) => (
        <ellipse key={r} cx="200" cy="200" rx={r} ry={r * 0.62} strokeWidth={1.4 - i * 0.18} />
      ))}
    </svg>
  );
}
