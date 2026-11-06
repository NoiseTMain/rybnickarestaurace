/** Okamžitá odezva při přepnutí stránky – kostra se zobrazí hned, data doběhnou. */
function Block({ className = "" }: { className?: string }) {
  return <div className={`glass animate-pulse rounded-[var(--radius-card)] ${className}`} />;
}

export default function Loading() {
  return (
    <div className="space-y-4" aria-busy="true" aria-label="Načítám">
      <div className="space-y-2">
        <div className="h-8 w-56 animate-pulse rounded-xl bg-white/[0.07]" />
        <div className="h-4 w-80 max-w-full animate-pulse rounded-lg bg-white/[0.05]" />
      </div>
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Block className="h-24" />
        <Block className="h-24" />
        <Block className="h-24" />
        <Block className="h-24" />
      </div>
      <div className="grid gap-4 lg:grid-cols-3">
        <Block className="h-72 lg:col-span-2" />
        <Block className="h-72" />
      </div>
      <Block className="h-48" />
    </div>
  );
}
