import { ActionForm, PageTitle, SubmitButton } from "@/components/admin/ui";
import { requireAdmin } from "@/lib/auth";
import { telHref } from "@/lib/format";
import { formatDateTime, formatMenuDate } from "@/lib/time";
import type { Inquiry } from "@/lib/types";
import { deleteInquiry, setInquiryStatus } from "../../actions";

export const metadata = { title: "Poptávky" };

export default async function InquiriesPage() {
  const { supabase } = await requireAdmin();
  const { data } = await supabase.from("inquiries").select("*").order("created_at", { ascending: false }).limit(200);
  const list = (data ?? []) as Inquiry[];
  return (
    <>
      <PageTitle title="Poptávky a rezervace" intro="Zprávy odeslané z formuláře na webu. Rezervace je platná až po vašem potvrzení zákazníkovi." />
      {!list.length && <p className="card p-6 text-ink-soft">Zatím nepřišla žádná poptávka.</p>}
      <ul className="space-y-4">
        {list.map((q) => (
          <li key={q.id} className={`card p-5 ${q.status === "new" ? "border-amber-400" : "opacity-75"}`}>
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className="font-semibold">
                <span className={`mr-2 rounded-full px-2.5 py-1 text-xs ${q.kind === "event" ? "bg-pond-900 text-paper" : "bg-cream"}`}>
                  {q.kind === "event" ? "Akce / pronájem" : "Rezervace"}
                </span>
                {q.name}
              </p>
              <span className="text-sm text-ink-soft">{formatDateTime(q.created_at)}</span>
            </div>
            <dl className="mt-3 grid gap-1 text-sm sm:grid-cols-2">
              <div><dt className="inline text-ink-soft">Telefon: </dt><dd className="inline"><a className="font-semibold text-pond-700" href={telHref(q.phone)}>{q.phone}</a></dd></div>
              {q.email && <div><dt className="inline text-ink-soft">E-mail: </dt><dd className="inline break-all"><a className="text-pond-700" href={`mailto:${q.email}`}>{q.email}</a></dd></div>}
              {q.event_date && <div><dt className="inline text-ink-soft">Termín: </dt><dd className="inline">{formatMenuDate(q.event_date)}{q.event_time && `, ${q.event_time}`}</dd></div>}
              {q.guests && <div><dt className="inline text-ink-soft">Osob: </dt><dd className="inline">{q.guests}</dd></div>}
              {q.space && <div><dt className="inline text-ink-soft">Prostor: </dt><dd className="inline">{q.space}</dd></div>}
            </dl>
            {q.message && <p className="mt-3 rounded-xl bg-cream/60 p-3 text-sm whitespace-pre-line">{q.message}</p>}
            <div className="mt-4 flex flex-wrap items-center gap-3">
              <ActionForm action={setInquiryStatus} className="contents">
                <input type="hidden" name="id" value={q.id} />
                <input type="hidden" name="status" value={q.status === "new" ? "handled" : "new"} />
                <SubmitButton className="btn btn-outline !min-h-10 !text-sm">{q.status === "new" ? "Označit jako vyřízené" : "Vrátit mezi nové"}</SubmitButton>
              </ActionForm>
              <ActionForm action={deleteInquiry} confirmText="Smazat poptávku?" className="contents">
                <input type="hidden" name="id" value={q.id} />
                <SubmitButton className="text-sm font-semibold text-red-800 underline" pendingText="Mažu…">Smazat</SubmitButton>
              </ActionForm>
              {!q.email_notified && <span className="text-xs text-ink-soft">(upozornění e-mailem neodešlo)</span>}
            </div>
          </li>
        ))}
      </ul>
    </>
  );
}
