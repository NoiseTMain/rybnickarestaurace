export const metadata = { title: "Chybí konfigurace" };

export default function ConfigPage() {
  return (
    <main className="mx-auto flex min-h-dvh max-w-xl items-center px-4">
      <div className="glass rounded-[28px] p-8">
        <h1 className="font-[family-name:var(--font-display)] text-2xl font-semibold">Aplikace není nakonfigurovaná</h1>
        <p className="mt-3 text-sm text-ink-2">
          Na Vercelu musí HomeOS používat databázi Supabase – lokální souborový režim by data při každém nasazení ztratil.
          Nastavte proměnné <code>NEXT_PUBLIC_SUPABASE_URL</code> a <code>NEXT_PUBLIC_SUPABASE_ANON_KEY</code> (viz README → Nasazení) a aplikaci znovu nasaďte.
        </p>
      </div>
    </main>
  );
}
