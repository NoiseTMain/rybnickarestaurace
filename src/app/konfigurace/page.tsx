import { publicEnv } from "@/lib/env";

export const metadata = { title: "Chybí konfigurace" };
export const dynamic = "force-dynamic";

function Row({ name, ok }: { name: string; ok: boolean }) {
  return (
    <li className="flex items-center justify-between gap-3 rounded-xl bg-white/[0.04] px-3 py-2 text-sm">
      <code className="break-all">{name}</code>
      <span className={ok ? "text-pos" : "text-neg"}>{ok ? "nastaveno" : "chybí"}</span>
    </li>
  );
}

export default function ConfigPage() {
  return (
    <main className="mx-auto flex min-h-dvh max-w-xl items-center px-4 py-10">
      <div className="glass rounded-[28px] p-6 sm:p-8">
        <h1 className="font-[family-name:var(--font-display)] text-2xl font-semibold">Aplikace není nakonfigurovaná</h1>
        <p className="mt-3 text-sm text-ink-2">
          Na Vercelu musí HomeOS používat databázi Supabase – lokální souborový režim by data při každém nasazení ztratil.
        </p>
        <ul className="mt-4 space-y-2">
          <Row name="NEXT_PUBLIC_SUPABASE_URL" ok={Boolean(publicEnv.supabaseUrl)} />
          <Row name="NEXT_PUBLIC_SUPABASE_ANON_KEY" ok={Boolean(publicEnv.supabaseAnonKey)} />
        </ul>
        <ol className="mt-4 list-decimal space-y-1 pl-5 text-sm text-ink-2">
          <li>Vercel → projekt → Settings → Environment Variables: doplňte chybějící proměnné (prostředí Production).</li>
          <li>Deployments → u posledního nasazení „Redeploy“. Proměnné NEXT_PUBLIC_ se načítají jen při sestavení.</li>
        </ol>
      </div>
    </main>
  );
}
