import Link from "next/link";
import { EmailBadge, EmailDetail, PublishBadge } from "@/components/admin/StatusBadges";
import { PageTitle, Panel } from "@/components/admin/ui";
import { AlertIcon, ArrowRightIcon, UploadIcon } from "@/components/ui/icons";
import { requireAdmin } from "@/lib/auth";
import { isEmailConfigured } from "@/lib/email/menu-email";
import { publicFileUrl } from "@/lib/storage";
import { formatDateTime, formatMenuDate, pragueToday } from "@/lib/time";
import type { DailyMenu, PrivateSettings } from "@/lib/types";

export const metadata = { title: "Přehled" };

type LogRow = { id: string; menu_date: string | null; recipient: string; status: "sent" | "failed"; trigger: string; error: string | null; created_at: string };

export default async function DashboardPage() {
  const { supabase } = await requireAdmin();
  const [{ data: current }, { data: recent }, { data: lastLog }, { data: priv }] = await Promise.all([
    supabase.from("daily_menus").select("*").eq("is_current", true).maybeSingle(),
    supabase.from("daily_menus").select("*").order("uploaded_at", { ascending: false }).limit(5),
    supabase.from("menu_email_log").select("*").order("created_at", { ascending: false }).limit(1).maybeSingle(),
    supabase.from("private_settings").select("*").eq("id", 1).maybeSingle(),
  ]);
  const menu = current as DailyMenu | null;
  const log = lastLog as LogRow | null;
  const settings = priv as PrivateSettings | null;
  const today = pragueToday();
  const isToday = menu?.menu_date === today;

  return (
    <>
      <PageTitle title="Dobrý den" intro={`Dnes je ${formatMenuDate(today)}.`} />

      {!isEmailConfigured() && (
        <p className="mb-6 flex items-start gap-3 rounded-2xl bg-amber-300/30 px-5 py-4 text-sm text-amber-700">
          <AlertIcon size={20} className="mt-0.5 shrink-0" />
          E-mailová služba zatím není nastavená (RESEND_API_KEY, EMAIL_FROM). Menu se zveřejní, ale e-mail se neodešle. Viz README.
        </p>
      )}

      <Link
        href="/admin/menu/nahrat"
        className="group mb-8 flex items-center justify-between gap-4 rounded-3xl bg-pond-900 px-6 py-7 text-paper shadow-[var(--shadow-lift)] transition hover:bg-pond-800 sm:px-8 sm:py-9"
      >
        <span className="flex items-center gap-4">
          <span className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-amber-500 text-pond-950">
            <UploadIcon size={28} />
          </span>
          <span>
            <span className="block font-display text-2xl font-semibold tracking-wide sm:text-3xl">NAHRÁT NOVÉ MENU</span>
            <span className="mt-1 block text-sm text-paper/70">PNG z počítače nebo telefonu · zveřejnění jedním kliknutím</span>
          </span>
        </span>
        <ArrowRightIcon size={26} className="hidden shrink-0 transition group-hover:translate-x-1 sm:block" />
      </Link>

      <div className="grid gap-6 lg:grid-cols-[1.3fr_1fr]">
        <Panel title="Aktuální menu na webu">
          {menu ? (
            <div className="flex gap-4">
              <a href={publicFileUrl("menus", menu.storage_path) ?? "#"} target="_blank" rel="noopener" className="shrink-0">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={publicFileUrl("menus", menu.storage_path) ?? ""} alt="Náhled menu" className="h-36 w-28 rounded-lg border border-line object-cover object-top" />
              </a>
              <div className="min-w-0 space-y-2 text-sm">
                <p className="font-display text-xl font-semibold text-pond-950 first-letter:uppercase">{formatMenuDate(menu.menu_date)}</p>
                {!isToday && (
                  <p className="font-semibold text-amber-700">
                    {menu.menu_date < today ? "Pozor: na webu není menu na dnešek." : "Menu je na nadcházející den."}
                  </p>
                )}
                <div className="flex flex-wrap gap-2">
                  <PublishBadge menu={menu} />
                  <EmailBadge status={menu.email_status} />
                </div>
                <p className="text-ink-soft">Zveřejněno {formatDateTime(menu.published_at)}</p>
                <p className="text-ink-soft"><EmailDetail menu={menu} /></p>
              </div>
            </div>
          ) : (
            <p className="text-ink-soft">Zatím není zveřejněné žádné menu. Na webu se zobrazuje „Dnešní menu připravujeme“.</p>
          )}
        </Panel>

        <Panel title="Poslední e-mail">
          {log ? (
            <div className="space-y-2 text-sm">
              <EmailBadge status={log.status} />
              <p>
                {formatDateTime(log.created_at)} · {log.trigger === "auto" ? "automaticky" : "ručně"}
                {log.menu_date && <> · menu {formatMenuDate(log.menu_date, { weekday: false })}</>}
              </p>
              <p className="break-all text-ink-soft">Příjemce: {log.recipient}</p>
              {log.error && <p className="text-red-800">{log.error}</p>}
            </div>
          ) : (
            <p className="text-sm text-ink-soft">Zatím nebyl odeslán žádný e-mail.</p>
          )}
          {settings && (
            <p className="mt-4 border-t border-line pt-4 text-sm text-ink-soft">
              Menu se posílá na <strong className="break-all text-ink">{settings.menu_email_recipient}</strong>
              {!settings.menu_email_enabled && " (automatické odesílání je vypnuté)"}.{" "}
              <Link href="/admin/nastaveni#email" className="text-pond-700 underline">Změnit</Link>
            </p>
          )}
        </Panel>
      </div>

      <div className="mt-6">
        <Panel title="Historie menu">
          {(recent as DailyMenu[] | null)?.length ? (
            <ul className="divide-y divide-line">
              {(recent as DailyMenu[]).map((m) => (
                <li key={m.id} className="flex flex-wrap items-center justify-between gap-2 py-3 text-sm">
                  <span className="font-semibold first-letter:uppercase">{formatMenuDate(m.menu_date)}</span>
                  <span className="flex flex-wrap gap-2">
                    <PublishBadge menu={m} />
                    <EmailBadge status={m.email_status} />
                  </span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-ink-soft">Historie je prázdná.</p>
          )}
          <Link href="/admin/menu/historie" className="mt-4 inline-flex items-center gap-2 text-sm font-semibold text-pond-700">
            Celá historie <ArrowRightIcon size={16} />
          </Link>
        </Panel>
      </div>

      <div className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {[
          ["/admin/nastaveni", "Nastavení", "Kontakt, otevírací doba, texty, e-mail"],
          ["/admin/nabidka", "Jídla a nápoje", "Stálá nabídka a ceny"],
          ["/admin/sport", "Sportovní přenosy", "Program zápasů"],
          ["/admin/galerie", "Fotografie", "Galerie a prostory"],
        ].map(([href, title, desc]) => (
          <Link key={href} href={href} className="card p-5 transition hover:border-pond-500">
            <span className="block font-semibold text-pond-950">{title}</span>
            <span className="mt-1 block text-sm text-ink-soft">{desc}</span>
          </Link>
        ))}
      </div>
    </>
  );
}
