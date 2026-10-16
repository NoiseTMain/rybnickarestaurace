import Link from "next/link";
import { EmailBadge, EmailDetail, PublishBadge } from "@/components/admin/StatusBadges";
import { PageTitle } from "@/components/admin/ui";
import { requireAdmin } from "@/lib/auth";
import { formatBytes } from "@/lib/png";
import { downloadFileUrl, publicFileUrl } from "@/lib/storage";
import { formatDateTime, formatMenuDate } from "@/lib/time";
import type { DailyMenu } from "@/lib/types";
import { HistoryActions } from "./HistoryActions";

export const metadata = { title: "Historie menu" };

const PAGE_SIZE = 20;

export default async function HistoryPage({ searchParams }: { searchParams: Promise<{ strana?: string }> }) {
  const { supabase } = await requireAdmin();
  const page = Math.max(1, Number((await searchParams).strana) || 1);
  const { data, count } = await supabase
    .from("daily_menus")
    .select("*", { count: "exact" })
    .order("menu_date", { ascending: false })
    .order("uploaded_at", { ascending: false })
    .range((page - 1) * PAGE_SIZE, page * PAGE_SIZE - 1);
  const menus = (data ?? []) as DailyMenu[];
  const pages = Math.max(1, Math.ceil((count ?? 0) / PAGE_SIZE));

  return (
    <>
      <PageTitle title="Historie menu" intro="Všechna nahraná menu. Nahrání nového menu historii nemaže.">
        <Link href="/admin/menu/nahrat" className="btn btn-primary">Nahrát nové menu</Link>
      </PageTitle>

      {!menus.length ? (
        <p className="card p-6 text-ink-soft">Zatím nebylo nahráno žádné menu.</p>
      ) : (
        <ul className="space-y-4">
          {menus.map((m) => {
            const url = publicFileUrl("menus", m.storage_path)!;
            return (
              <li key={m.id} className={`card flex flex-col gap-4 p-4 sm:flex-row sm:p-5 ${m.is_current ? "ring-2 ring-pond-600" : ""}`}>
                <a href={url} target="_blank" rel="noopener" className="shrink-0 self-start" aria-label="Zobrazit menu v plné velikosti">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={url} alt="" loading="lazy" className="h-40 w-32 rounded-lg border border-line bg-cream object-cover object-top" />
                </a>
                <div className="min-w-0 flex-1 space-y-2">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="mr-2 font-display text-xl font-semibold text-pond-950 first-letter:uppercase">{formatMenuDate(m.menu_date)}</p>
                    <PublishBadge menu={m} />
                    <EmailBadge status={m.email_status} />
                  </div>
                  <dl className="grid gap-x-6 gap-y-1 text-sm text-ink-soft sm:grid-cols-2">
                    <div><dt className="inline">Nahráno: </dt><dd className="inline text-ink">{formatDateTime(m.uploaded_at)}</dd></div>
                    <div><dt className="inline">Zveřejněno: </dt><dd className="inline text-ink">{formatDateTime(m.published_at)}</dd></div>
                    <div className="min-w-0 truncate"><dt className="inline">Soubor: </dt><dd className="inline text-ink" title={m.original_filename}>{m.original_filename}</dd></div>
                    <div><dt className="inline">Velikost: </dt><dd className="inline text-ink">{formatBytes(m.file_size)}{m.width ? ` · ${m.width} × ${m.height} px` : ""}</dd></div>
                    <div className="sm:col-span-2"><dt className="inline">E-mail: </dt><dd className="inline break-words text-ink">{m.email_status === "sent" || m.email_status === "failed" ? <EmailDetail menu={m} /> : m.email_status === "skipped" ? "neodesílán (vypnuto)" : "zatím neodeslán"}{m.email_attempts > 1 && ` · pokusů: ${m.email_attempts}`}</dd></div>
                  </dl>
                  <HistoryActions
                    id={m.id}
                    url={url}
                    downloadUrl={downloadFileUrl("menus", m.storage_path, m.original_filename) ?? url}
                    isCurrent={m.is_current}
                    emailStatus={m.email_status}
                    emailSentAt={m.email_sent_at ? formatDateTime(m.email_sent_at) : null}
                    label={formatMenuDate(m.menu_date)}
                  />
                </div>
              </li>
            );
          })}
        </ul>
      )}

      {pages > 1 && (
        <nav className="mt-8 flex items-center justify-center gap-3" aria-label="Stránkování">
          {page > 1 && <Link className="btn btn-outline" href={`?strana=${page - 1}`}>Novější</Link>}
          <span className="text-sm text-ink-soft">Strana {page} z {pages}</span>
          {page < pages && <Link className="btn btn-outline" href={`?strana=${page + 1}`}>Starší</Link>}
        </nav>
      )}
    </>
  );
}
