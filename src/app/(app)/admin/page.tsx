import { notFound } from "next/navigation";
import { Crown, ShieldCheck, Users } from "lucide-react";
import { requireContext } from "@/lib/context";
import { adminBackend, adminConfigured, isAdminEmail } from "@/lib/admin";
import { subscriptionActive } from "@/lib/subscription";
import { PRICES } from "@/lib/plans";
import { formatMoney } from "@/lib/money";
import { addDays, todayISO } from "@/lib/dates";
import { Card, PageHeader } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { FilterTabs } from "@/components/lists/Filters";
import { AdminGrantForm, AdminUserActions, AdminSearch } from "@/components/admin/AdminForms";

export const metadata = { title: "Administrace" };
export const dynamic = "force-dynamic";

const dt = (s: string | null | undefined) => (s ? new Date(s).toLocaleString("cs-CZ", { day: "numeric", month: "numeric", year: "numeric", hour: "2-digit", minute: "2-digit" }) : "—");
const d = (s: string | null | undefined) => (s ? new Date(s).toLocaleDateString("cs-CZ") : "—");

export default async function AdminPage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const ctx = await requireContext();
  if (!isAdminEmail(ctx.user.email)) notFound(); // pro ostatní stránka „neexistuje“
  const sp = await searchParams;
  if (!adminConfigured()) {
    return (
      <div className="space-y-4">
        <PageHeader title="Administrace" />
        <Card><p className="text-sm text-ink-2">Pro administraci je potřeba na serveru (Vercel → Settings → Environment Variables) nastavit <code>SUPABASE_SERVICE_ROLE_KEY</code> ze Supabase (Project Settings → API → service_role). Klíč nikdy nikam nevkládejte jinam.</p></Card>
      </div>
    );
  }
  const b = await adminBackend();
  const month = todayISO().slice(0, 7);
  const [users, subs, households, audit, usage] = await Promise.all([b.listUsers(), b.subscriptions(), b.households(), b.auditLog(50), b.aiUsage(month)]);
  const subOf = new Map(subs.map((s) => [s.user_id, s]));
  const usageOf = new Map(usage.map((u) => [u.user_id, u.count]));
  const weekAgo = new Date(addDays(todayISO(), -7)).getTime();
  const active = subs.filter((s) => subscriptionActive(s));
  const paid = active.filter((s) => s.source === "lemonsqueezy");
  const mrr = paid.reduce((a, s) => a + (s.variant === "yearly" ? Math.round(PRICES.yearly / 12) : PRICES.monthly), 0);
  const q = (sp.q ?? "").trim().toLowerCase();
  const filter = sp.f ?? "";
  const list = users
    .filter((u) => !q || u.email.toLowerCase().includes(q))
    .filter((u) => {
      const s = subOf.get(u.id);
      const on = subscriptionActive(s);
      return filter === "" || (filter === "premium" && on) || (filter === "paid" && on && s?.source === "lemonsqueezy") || (filter === "free" && !on);
    })
    .sort((a, z) => z.created_at.localeCompare(a.created_at));

  return (
    <div className="space-y-4">
      <PageHeader title={<span className="flex items-center gap-2"><ShieldCheck className="h-6 w-6 text-gold" />Administrace</span>} subtitle={`Přístup jen pro ${ctx.user.email}. Všechny akce se zapisují do záznamu.`} />
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-5">
        <Card className="!p-4"><p className="text-[11px] uppercase tracking-wider text-ink-3">Uživatelé</p><p className="text-2xl font-semibold">{users.length}</p><p className="text-xs text-ink-3">+{users.filter((u) => new Date(u.created_at).getTime() > weekAgo).length} za 7 dní</p></Card>
        <Card className="!p-4"><p className="text-[11px] uppercase tracking-wider text-ink-3">Premium aktivní</p><p className="text-2xl font-semibold">{active.length}</p><p className="text-xs text-ink-3">{paid.length} placených · {active.length - paid.length} přidělených</p></Card>
        <Card className="!p-4"><p className="text-[11px] uppercase tracking-wider text-ink-3">Měsíční příjem (odhad)</p><p className="gold-text text-2xl font-semibold">{formatMoney(mrr, { decimals: "never" })}</p><p className="text-xs text-ink-3">před poplatky Lemon Squeezy</p></Card>
        <Card className="!p-4"><p className="text-[11px] uppercase tracking-wider text-ink-3">Domácnosti</p><p className="text-2xl font-semibold">{households.filter((h) => !h.is_demo).length}</p><p className="text-xs text-ink-3">+ {households.filter((h) => h.is_demo).length} ukázkových</p></Card>
        <Card className="!p-4"><p className="text-[11px] uppercase tracking-wider text-ink-3">AI dotazů tento měsíc</p><p className="text-2xl font-semibold">{usage.reduce((a, u) => a + u.count, 0)}</p></Card>
      </div>

      <Card title={<span className="flex items-center gap-2"><Crown className="h-4 w-4 text-gold" />Přidat Premium podle e-mailu</span>} subtitle="Uživatel musí mít účet. Placené předplatné tím nepřepíšete.">
        <AdminGrantForm />
      </Card>

      <Card title={<span className="flex items-center gap-2"><Users className="h-4 w-4 text-gold" />Uživatelé ({list.length})</span>} subtitle="Finanční údaje uživatelů (částky, transakce, dokumenty) administrace záměrně nezobrazuje – jen údaje o účtu a rozsah používání." bodyClassName="space-y-3">
        <div className="flex flex-wrap items-center gap-2">
          <AdminSearch initial={sp.q ?? ""} />
          <FilterTabs name="f" options={[{ value: "", label: "Všichni" }, { value: "premium", label: "Premium" }, { value: "paid", label: "Placené" }, { value: "free", label: "Zdarma" }]} />
        </div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[980px] text-sm">
            <thead className="text-xs text-ink-3">
              <tr><th className="py-1 text-left font-medium">E-mail</th><th className="text-left font-medium">Registrace</th><th className="text-left font-medium">Poslední přihlášení</th><th className="text-left font-medium">Domácnosti</th><th className="text-left font-medium">Premium</th><th className="text-right font-medium">AI</th><th className="text-right font-medium">Akce</th></tr>
            </thead>
            <tbody>
              {list.map((u) => {
                const s = subOf.get(u.id);
                const on = subscriptionActive(s);
                const hh = households.filter((h) => h.users.includes(u.id));
                return (
                  <tr key={u.id} className="border-t border-white/[0.06] align-top">
                    <td className="py-2 pr-2">
                      <span className="font-medium">{u.email}</span>
                      {isAdminEmail(u.email) && <Badge tone="gold" className="ml-1">správce</Badge>}
                      {u.banned && <Badge tone="danger" className="ml-1">zablokován</Badge>}
                      {!u.confirmed && <span className="block text-[11px] text-warn">e-mail nepotvrzen</span>}
                      <span className="block font-mono text-[10px] text-ink-3">{u.id}</span>
                    </td>
                    <td className="pr-2 text-xs">{d(u.created_at)}</td>
                    <td className="pr-2 text-xs">{dt(u.last_sign_in_at)}</td>
                    <td className="pr-2 text-xs">
                      {hh.length ? hh.map((h) => (
                        <span key={h.id} className="block">
                          <b>{h.name}</b>{h.is_demo && " (demo)"}{h.owners.includes(u.id) ? " · vlastník" : " · člen"}
                          <span className="block text-ink-3">{h.counts.members} členů · {h.counts.accounts} účtů · {h.counts.transactions} pohybů · {h.counts.trips} cest · {h.counts.documents} dokumentů{h.lastActivity ? ` · aktivita ${d(h.lastActivity)}` : ""}</span>
                        </span>
                      )) : <span className="text-ink-3">zatím žádná</span>}
                    </td>
                    <td className="pr-2 text-xs">
                      {on ? <Badge tone="gold">{s!.source === "lemonsqueezy" ? (s!.variant === "yearly" ? "placené ročně" : "placené měsíčně") : s!.variant === "lifetime" ? "napořád" : "přiděleno"}</Badge> : <Badge>zdarma</Badge>}
                      {s && (
                        <span className="mt-0.5 block text-ink-3">
                          {s.status !== "granted" && s.status !== "active" ? `${s.status} · ` : ""}
                          {s.renews_at ? `obnoví ${d(s.renews_at)}` : s.ends_at ? `do ${d(s.ends_at)}` : ""}
                          {s.note ? ` · ${s.note}` : ""}
                        </span>
                      )}
                    </td>
                    <td className="num pr-2 text-right text-xs">{usageOf.get(u.id) ?? 0}</td>
                    <td className="text-right"><AdminUserActions userId={u.id} email={u.email} premium={on} paid={s?.source === "lemonsqueezy"} banned={u.banned} self={u.id === ctx.user.id} /></td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </Card>

      <Card title="Záznam akcí" subtitle="Přidělení, odebrání, blokace a platby">
        {audit.length ? (
          <ul className="space-y-1 text-xs">
            {audit.map((a) => <li key={a.id} className="flex flex-wrap gap-x-2 border-t border-white/[0.06] py-1 first:border-0"><span className="text-ink-3">{dt(a.created_at)}</span><b>{a.action}</b><span>{a.target_email ?? users.find((u) => u.id === a.target_user_id)?.email ?? a.target_user_id ?? ""}</span>{a.detail && <span className="text-ink-3">{JSON.stringify(a.detail)}</span>}</li>)}
          </ul>
        ) : <p className="text-sm text-ink-3">Zatím nic.</p>}
      </Card>
    </div>
  );
}
