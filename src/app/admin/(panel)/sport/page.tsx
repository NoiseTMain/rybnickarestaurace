import { ActionForm, PageTitle, Panel, SubmitButton } from "@/components/admin/ui";
import { requireAdmin } from "@/lib/auth";
import { formatDateTime, isoHoursFromNow, pragueToday, utcIsoToPragueLocal } from "@/lib/time";
import type { SportEvent } from "@/lib/types";
import { deleteSportEvent, saveSportEvent } from "../../actions";

export const metadata = { title: "Sportovní přenosy" };

const SPORTS = ["Fotbal", "Hokej", "Tenis", "Formule 1", "Biatlon", "Basketbal", "Házená", "Volejbal", "Atletika", "MMA"];

export default async function SportAdminPage() {
  const { supabase } = await requireAdmin();
  const since = isoHoursFromNow(-7 * 24);
  const { data } = await supabase.from("sport_events").select("*").gte("starts_at", since).order("starts_at");
  const events = (data ?? []) as SportEvent[];
  const pastLimit = isoHoursFromNow(-3);

  return (
    <>
      <PageTitle title="Sportovní přenosy" intro="Přenosy se na webu zobrazují do 3 hodin po začátku, pak automaticky zmizí. Časy jsou v českém čase." />
      <datalist id="sports">{SPORTS.map((s) => <option key={s} value={s} />)}</datalist>
      <div className="space-y-6">
        <Panel title="Přidat přenos">
          <EventForm />
        </Panel>
        <Panel title={`Naplánované přenosy (${events.length})`}>
          {!events.length && <p className="text-sm text-ink-soft">Žádné přenosy nejsou naplánované.</p>}
          <ul className="divide-y divide-line">
            {events.map((e) => (
              <li key={e.id} className={`py-3 ${e.starts_at < pastLimit ? "opacity-60" : ""}`}>
                <details>
                  <summary className="flex cursor-pointer list-none flex-wrap items-center justify-between gap-2">
                    <span>
                      <span className="mr-2 text-xs font-semibold tracking-wide text-amber-700 uppercase">{e.sport}</span>
                      <span className="font-semibold">{e.title}</span>
                      {!e.is_visible && <span className="ml-2 text-xs text-ink-soft">(skryto)</span>}
                    </span>
                    <span className="text-sm text-ink-soft">{formatDateTime(e.starts_at)}</span>
                  </summary>
                  <div className="mt-3 rounded-xl bg-cream/50 p-4">
                    <EventForm event={e} />
                    <ActionForm action={deleteSportEvent} confirmText={`Smazat přenos „${e.title}“?`} className="mt-3">
                      <input type="hidden" name="id" value={e.id} />
                      <SubmitButton className="text-sm font-semibold text-red-800 underline" pendingText="Mažu…">Smazat</SubmitButton>
                    </ActionForm>
                  </div>
                </details>
              </li>
            ))}
          </ul>
        </Panel>
      </div>
    </>
  );
}

function EventForm({ event }: { event?: SportEvent }) {
  const local = event ? utcIsoToPragueLocal(event.starts_at) : "";
  const id = event?.id ?? "new";
  return (
    <ActionForm action={saveSportEvent} resetOnSuccess={!event} className="grid gap-4 sm:grid-cols-6">
      {event && <input type="hidden" name="id" value={event.id} />}
      <div className="sm:col-span-2">
        <label className="field-label" htmlFor={`d-${id}`}>Datum *</label>
        <input id={`d-${id}`} name="date" type="date" required defaultValue={local.slice(0, 10) || pragueToday()} className="field" />
      </div>
      <div className="sm:col-span-2">
        <label className="field-label" htmlFor={`t-${id}`}>Čas *</label>
        <input id={`t-${id}`} name="time" type="time" required defaultValue={local.slice(11, 16)} className="field" />
      </div>
      <div className="sm:col-span-2">
        <label className="field-label" htmlFor={`s-${id}`}>Sport *</label>
        <input id={`s-${id}`} name="sport" list="sports" required maxLength={60} defaultValue={event?.sport} className="field" />
      </div>
      <div className="sm:col-span-6">
        <label className="field-label" htmlFor={`n-${id}`}>Událost *</label>
        <input id={`n-${id}`} name="title" required maxLength={200} defaultValue={event?.title} placeholder="např. Sparta – Slavia" className="field" />
      </div>
      <div className="sm:col-span-6">
        <label className="field-label" htmlFor={`p-${id}`}>Popis</label>
        <input id={`p-${id}`} name="description" maxLength={500} defaultValue={event?.description ?? ""} placeholder="např. Fortuna liga, 12. kolo · velké plátno v sále" className="field" />
      </div>
      {event && (
        <label className="flex items-center gap-2 text-sm sm:col-span-6">
          <input type="checkbox" name="is_visible" defaultChecked={event.is_visible} className="h-5 w-5 accent-pond-700" /> Zobrazovat na webu
        </label>
      )}
      <div className="sm:col-span-6"><SubmitButton>{event ? "Uložit" : "Přidat přenos"}</SubmitButton></div>
    </ActionForm>
  );
}
