import { Download, Landmark, Trash2 } from "lucide-react";
import { requireContext } from "@/lib/context";
import { loadSnapshot } from "@/lib/data";
import { formatDate } from "@/lib/dates";
import { ACCOUNT_KIND_LABEL } from "@/lib/defaults";
import { FREQUENCY_LABEL } from "@/lib/finance/recurrence";
import { deleteSetupItem } from "@/lib/actions/setup";
import { cookies } from "next/headers";
import { Card, PageHeader } from "@/components/ui/Card";
import { ThemePicker } from "@/components/forms/ThemePicker";
import { THEME_COOKIE, parseTheme } from "@/lib/theme";
import { Money } from "@/components/ui/Money";
import { Badge } from "@/components/ui/Badge";
import { ActionButton } from "@/components/ui/ActionButton";
import { LinkButton } from "@/components/ui/Button";
import { SetupButton } from "@/components/forms/SetupForms";
import { WorkSettingsForm } from "@/components/forms/WorkForms";
import { BankImportButton } from "@/components/forms/CsvImport";
import { AutosaveField, AutosaveToggle, CreateDemoButton, DeleteHouseholdForm, InviteBox, JoinHouseholdForm, LeaveHouseholdButton, RemoveAccessButton, PasswordForm, RenameHousehold, RestoreForm } from "@/components/forms/SettingsForms";

export const metadata = { title: "Nastavení" };

const SECTIONS = [["vzhled", "Vzhled"], ["domacnost", "Domácnost"], ["clenove", "Členové"], ["ucty", "Účty"], ["prijmy", "Příjmy"], ["kategorie", "Kategorie"], ["planovani", "Rezerva a upozornění"], ["fakturace", "Fakturační údaje"], ["prace", "Práce"], ["banka", "Banka"], ["zaloha", "Export a záloha"], ["ucet", "Účet"]];

export default async function SettingsPage() {
  const ctx = await requireContext();
  const { data, snapshot: s } = await loadSnapshot(ctx);
  const st = data.settings!;
  const theme = parseTheme((await cookies()).get(THEME_COOKIE)?.value);
  const access = (await ctx.store.select("household_users", { household_id: ctx.household.id })).sort((a, b) => (a.role === "owner" ? -1 : 1) - (b.role === "owner" ? -1 : 1) || a.created_at.localeCompare(b.created_at));
  return (
    <div className="space-y-4">
      <PageHeader title="Nastavení" subtitle="Všechny finanční údaje zadáváte vy. Změny se ukládají automaticky." />
      <nav className="scroll-thin -mx-1 flex gap-1 overflow-x-auto px-1 pb-1" aria-label="Sekce nastavení">
        {SECTIONS.map(([id, l]) => <a key={id} href={`#${id}`} className="whitespace-nowrap rounded-full bg-white/[0.05] px-3 py-1.5 text-sm text-ink-2 hover:bg-white/10 hover:text-ink">{l}</a>)}
      </nav>

      <div className="grid gap-4 xl:grid-cols-2">
        <Card id="vzhled" title="Vzhled aplikace" subtitle="Platí pro toto zařízení" className="xl:col-span-2">
          <ThemePicker initialAccent={theme.accent} initialBg={theme.bg} />
        </Card>
        <Card id="domacnost" title="Domácnost" subtitle={ctx.household.is_demo ? "Ukázková domácnost" : `Vaše role: ${ctx.role === "owner" ? "vlastník" : "člen"}`}>
          <RenameHousehold name={ctx.household.name} />
          <div className="mt-4 space-y-2">
            <p className="text-xs font-medium uppercase tracking-wider text-ink-3">Vaše domácnosti</p>
            {ctx.households.map((h) => <div key={h.id} className="flex items-center gap-2 text-sm"><span className="flex-1">{h.name}</span>{h.is_demo && <Badge tone="warning">DEMO</Badge>}{h.id === ctx.household.id && <Badge tone="gold">aktivní</Badge>}</div>)}
          </div>
          <div className="mt-4 flex flex-wrap gap-2">
            {!ctx.households.some((h) => h.is_demo) && <CreateDemoButton />}
            {ctx.role === "owner" && <DeleteHouseholdForm id={ctx.household.id} name={ctx.household.name} isDemo={ctx.household.is_demo} />}
            {ctx.role !== "owner" && <LeaveHouseholdButton />}
          </div>
          <div className="mt-5 border-t border-white/[0.06] pt-4">
            <p className="mb-2 text-sm font-medium">Lidé s přístupem</p>
            <ul className="space-y-1.5">
              {access.map((u) => {
                const m = data.members.find((x) => x.user_id === u.user_id);
                return (
                  <li key={u.id} className="flex items-center gap-2 text-sm">
                    <span className="h-2.5 w-2.5 rounded-full" style={{ background: m?.color ?? "#6b665e" }} />
                    <span className="flex-1">{m?.name ?? "Člen bez jména"}{u.user_id === ctx.user.id && " (vy)"}</span>
                    <Badge tone={u.role === "owner" ? "gold" : "neutral"}>{u.role === "owner" ? "vlastník" : "připojen(a)"}</Badge>
                    <span className="hidden text-[11px] text-ink-3 sm:inline">od {formatDate(u.created_at.slice(0, 10))}</span>
                    {ctx.role === "owner" && u.user_id !== ctx.user.id && <RemoveAccessButton userId={u.user_id} name={m?.name ?? "člena"} />}
                  </li>
                );
              })}
            </ul>
          </div>
          {ctx.role === "owner" && <div className="mt-5 border-t border-white/[0.06] pt-4"><p className="mb-2 text-sm font-medium">Pozvat člena s vlastním přihlášením</p><InviteBox /></div>}
          <div className="mt-5 border-t border-white/[0.06] pt-4"><p className="mb-2 text-sm font-medium">Přidat se do jiné domácnosti</p><JoinHouseholdForm /></div>
        </Card>

        <Card id="clenove" title="Členové domácnosti" subtitle="Kdo platí a komu patří příjmy" action={<SetupButton kind="member" label="Přidat" />}>
          <ul className="divide-y divide-white/[0.05]">
            {data.members.map((m) => (
              <li key={m.id} className="flex items-center gap-3 py-2">
                <span className="h-3 w-3 rounded-full" style={{ background: m.color }} />
                <span className="flex-1 text-sm">{m.name} {m.user_id === ctx.user.id ? <Badge>vy</Badge> : m.user_id ? <Badge tone="gold">připojen(a) účtem</Badge> : null} {!m.is_active && <Badge>neaktivní</Badge>}</span>
                <SetupButton kind="member" initial={m} size="icon" variant="ghost" />
                <ActionButton action={deleteSetupItem.bind(null, "members", m.id)} confirm="Smazat člena? U záznamů zůstane prázdné pole „kdo“." size="icon" icon={<Trash2 className="h-4 w-4" />} />
              </li>
            ))}
          </ul>
        </Card>

        <Card id="ucty" title="Bankovní účty a hotovost" subtitle="Výchozí zůstatek platí k uvedenému datu" action={<SetupButton kind="account" label="Přidat" />} className="xl:col-span-2">
          <ul className="divide-y divide-white/[0.05]">
            {data.accounts.map((a) => (
              <li key={a.id} className="flex flex-wrap items-center gap-x-3 gap-y-1 py-2.5">
                <div className="min-w-0 flex-1">
                  <p className="text-sm">{a.name} <Badge>{ACCOUNT_KIND_LABEL[a.kind]}</Badge> {!a.include_in_available && <Badge tone="info">mimo disponibilní</Badge>} {!a.is_active && <Badge>archiv</Badge>}</p>
                  <p className="text-[11px] text-ink-3">výchozí zůstatek <Money value={a.opening_balance} /> k {formatDate(a.opening_date)}</p>
                </div>
                <div className="text-right"><p className="text-[11px] text-ink-3">aktuálně</p><Money value={s.balance.byAccount[a.id] ?? 0} className="font-semibold" /></div>
                <SetupButton kind="account" initial={a} size="icon" variant="ghost" />
                <ActionButton action={deleteSetupItem.bind(null, "accounts", a.id)} confirm="Smazat účet? Účet s transakcemi smazat nelze – použijte archivaci." size="icon" icon={<Trash2 className="h-4 w-4" />} />
              </li>
            ))}
            {!data.accounts.length && <li className="py-3 text-sm text-ink-3">Zatím žádný účet – bez něj nelze počítat zůstatky.</li>}
          </ul>
        </Card>

        <Card id="prijmy" title="Měsíční a pravidelné příjmy" action={<SetupButton kind="income" label="Přidat" />}>
          <ul className="divide-y divide-white/[0.05]">
            {data.incomeSources.map((i) => (
              <li key={i.id} className="flex items-center gap-2 py-2 text-sm">
                <span className="flex-1">{i.name} <span className="text-xs text-ink-3">· {FREQUENCY_LABEL[i.frequency]}</span></span>
                <Money value={i.amount} />
                <SetupButton kind="income" initial={i} size="icon" variant="ghost" />
              </li>
            ))}
            {!data.incomeSources.length && <li className="py-2 text-sm text-ink-3">Žádné. Výplaty z Rohlíku lze evidovat v sekci Práce → Výplaty.</li>}
          </ul>
          <p className="mt-3 text-xs text-ink-3">Pravidelné výdaje a rozpočtové limity spravujete v sekcích <a href="/platby" className="text-gold underline">Pravidelné platby</a> a <a href="/rozpocty" className="text-gold underline">Rozpočty</a>, spořicí cíle ve <a href="/sporeni" className="text-gold underline">Spoření</a>.</p>
        </Card>

        <Card id="kategorie" title="Kategorie" action={<SetupButton kind="category" label="Přidat" />}>
          <div className="flex flex-wrap gap-1.5">
            {data.categories.map((c) => (
              <span key={c.id} className={`inline-flex items-center gap-1.5 rounded-full border border-white/10 bg-white/[0.04] py-0.5 pl-2.5 pr-0.5 text-xs ${c.is_archived ? "opacity-40" : ""}`}>
                <span className="h-2 w-2 rounded-full" style={{ background: c.color }} />{c.name}{c.kind === "income" && <span className="text-ink-3">(příjem)</span>}
                <SetupButton kind="category" initial={c} size="icon" variant="ghost" />
              </span>
            ))}
          </div>
        </Card>

        <Card id="planovani" title="Rezerva a upozornění">
          <div className="grid gap-3 sm:grid-cols-2">
            <AutosaveField field="safety_buffer" label="Bezpečnostní rezerva" type="money" initial={st.safety_buffer} hint="vždy zůstane na účtu" />
            <AutosaveField field="notify_due_days" label="Upozornit na splatnost (dní předem)" type="number" initial={st.notify_due_days} />
            <AutosaveField field="food_warn_percent" label="Varovat u jídla od (% rozpočtu)" type="number" initial={st.food_warn_percent} />
            <AutosaveField field="pace_tolerance_percent" label="Tolerance tempa útraty (%)" type="number" initial={st.pace_tolerance_percent} />
          </div>
          <div className="mt-3 space-y-1">
            <AutosaveToggle field="notify_payments" label="Upozornění na blížící se platby" initial={st.notify_payments} />
            <AutosaveToggle field="notify_food" label="Upozornění na rozpočet na jídlo" initial={st.notify_food} />
            <AutosaveToggle field="notify_invoices" label="Upozornění na faktury po splatnosti" initial={st.notify_invoices} />
          </div>
          <p className="mt-2 text-xs text-ink-3">Upozornění se zobrazují na přehledu a ve Finančním asistentovi.</p>
        </Card>

        <Card id="fakturace" title="Fakturační údaje" subtitle="Vaše údaje jako osoby samostatně výdělečně činné">
          <div className="grid gap-3 sm:grid-cols-2">
            <AutosaveField field="billing_name" label="Jméno / obchodní firma" initial={st.billing_name} />
            <AutosaveField field="billing_ico" label="IČO" initial={st.billing_ico} hint="OCR ho pozná a vynechá" />
            <AutosaveField field="billing_dic" label="DIČ" initial={st.billing_dic} />
            <AutosaveField field="billing_bank_account" label="Číslo účtu" initial={st.billing_bank_account} />
            <AutosaveField field="billing_address" label="Adresa" initial={st.billing_address} />
            <AutosaveField field="invoice_number_prefix" label="Předpona čísla faktury" initial={st.invoice_number_prefix} />
          </div>
        </Card>

        <Card id="prace" title="Pracovní nastavení" className="xl:col-span-2"><WorkSettingsForm /></Card>

        <Card id="banka" title="Bankovní transakce">
          <p className="text-sm text-ink-2">Výpis z internetového bankovnictví exportujte jako CSV a naimportujte. Duplicity se rozpoznají a opakovaný import nic nezdvojí.</p>
          <div className="mt-3"><BankImportButton /></div>
          <div className="mt-4 flex gap-3 rounded-2xl border border-dashed border-white/15 p-3">
            <Landmark className="h-5 w-5 shrink-0 text-ink-3" />
            <div className="text-sm"><p className="font-medium text-ink-2">Automatická synchronizace s bankou <Badge>připravujeme</Badge></p><p className="text-xs text-ink-3">Napojení přes PSD2 API je připravené jako budoucí rozšíření a zatím není aktivní. Aplikace plně funguje bez něj.</p></div>
          </div>
        </Card>

        <Card id="zaloha" title="Export a záloha">
          <div className="flex flex-wrap gap-2">
            <LinkButton href="/api/zaloha" size="sm" icon={<Download className="h-4 w-4" />}>Záloha (JSON)</LinkButton>
            <LinkButton href="/api/zaloha?soubory=1" size="sm" icon={<Download className="h-4 w-4" />}>Záloha vč. dokumentů</LinkButton>
            <LinkButton href="/api/export/transakce" size="sm" icon={<Download className="h-4 w-4" />}>Transakce CSV</LinkButton>
            <LinkButton href="/api/export/faktury" size="sm" icon={<Download className="h-4 w-4" />}>Faktury CSV</LinkButton>
            <LinkButton href="/api/export/smeny" size="sm" icon={<Download className="h-4 w-4" />}>Směny CSV</LinkButton>
            <LinkButton href="/api/export/vyplaty" size="sm" icon={<Download className="h-4 w-4" />}>Výplaty CSV</LinkButton>
          </div>
          {ctx.role === "owner" && <div className="mt-5 border-t border-white/[0.06] pt-4"><p className="mb-2 text-sm font-medium">Obnova ze zálohy</p><RestoreForm /></div>}
        </Card>

        <Card id="ucet" title="Uživatelský účet" subtitle={ctx.user.email}>
          <PasswordForm />
          <p className="mt-3 text-xs text-ink-3">Režim: {ctx.store.mode === "supabase" ? "Supabase (produkční databáze s Row Level Security)" : "lokální vývojový režim (soubor .data/homeos.json)"}.</p>
        </Card>
      </div>
    </div>
  );
}
