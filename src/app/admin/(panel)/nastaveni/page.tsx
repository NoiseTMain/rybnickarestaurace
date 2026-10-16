import { ActionForm, PageTitle, Panel, SubmitButton } from "@/components/admin/ui";
import { requireAdmin } from "@/lib/auth";
import { FALLBACK_SETTINGS } from "@/lib/data/public";
import { isEmailConfigured } from "@/lib/email/menu-email";
import { publicFileUrl } from "@/lib/storage";
import { DAY_LABELS } from "@/lib/time";
import { TEXT_FIELDS, type PrivateSettings, type SiteSettings } from "@/lib/types";
import { saveContact, saveEmailSettings, saveOpeningHours, saveServices, saveTexts } from "../../actions";
import { BrandImageField } from "./BrandImageField";

export const metadata = { title: "Nastavení" };

export default async function SettingsPage() {
  const { supabase } = await requireAdmin();
  const [{ data: site }, { data: priv }] = await Promise.all([
    supabase.from("site_settings").select("*").eq("id", 1).maybeSingle(),
    supabase.from("private_settings").select("*").eq("id", 1).maybeSingle(),
  ]);
  const s = { ...FALLBACK_SETTINGS, ...(site as SiteSettings | null) };
  const p = (priv as PrivateSettings | null) ?? { menu_email_recipient: "info@rybnickarestaurace.cz", inquiry_email_recipient: "info@rybnickarestaurace.cz", menu_email_enabled: true };
  const hours = Array.from({ length: 7 }, (_, i) => s.opening_hours.find((d) => d.day === i + 1));

  return (
    <>
      <PageTitle title="Nastavení" intro="Změny se na webu projeví okamžitě po uložení." />
      <nav className="mb-6 flex flex-wrap gap-2 text-sm" aria-label="Sekce nastavení">
        {[["#email", "E-mail menu"], ["#hodiny", "Otevírací doba"], ["#kontakt", "Kontakt"], ["#texty", "Texty webu"], ["#sluzby", "Služby"], ["#logo", "Logo a úvodní foto"]].map(([href, label]) => (
          <a key={href} href={href} className="rounded-full border border-line bg-white px-4 py-2 font-medium hover:border-pond-500">{label}</a>
        ))}
      </nav>

      <div className="space-y-6">
        <div id="email" className="scroll-mt-24">
          <Panel title="E-mail s denním menu" description="Na tuto adresu se po každém zveřejnění automaticky odešle PNG menu k tisku.">
            {!isEmailConfigured() && (
              <p className="mb-4 rounded-xl bg-amber-300/30 px-4 py-3 text-sm text-amber-700">
                E-mailová služba Resend zatím není nastavená na serveru (proměnné RESEND_API_KEY a EMAIL_FROM). Postup je v README.
              </p>
            )}
            <ActionForm action={saveEmailSettings}>
              <div className="grid gap-5 sm:grid-cols-2">
                <div>
                  <label className="field-label" htmlFor="menu_email_recipient">Příjemce denního menu</label>
                  <input id="menu_email_recipient" name="menu_email_recipient" type="email" required defaultValue={p.menu_email_recipient} className="field" />
                </div>
                <div>
                  <label className="field-label" htmlFor="inquiry_email_recipient">Příjemce poptávek a rezervací</label>
                  <input id="inquiry_email_recipient" name="inquiry_email_recipient" type="email" required defaultValue={p.inquiry_email_recipient} className="field" />
                </div>
              </div>
              <label className="flex items-center gap-3 text-sm font-medium">
                <input type="checkbox" name="menu_email_enabled" defaultChecked={p.menu_email_enabled} className="h-5 w-5 accent-pond-700" />
                Automaticky odesílat menu e-mailem po zveřejnění
              </label>
              <SubmitButton>Uložit e-mail</SubmitButton>
            </ActionForm>
          </Panel>
        </div>

        <div id="hodiny" className="scroll-mt-24">
          <Panel title="Otevírací doba" description="Druhý časový úsek vyplňte jen při polední pauze. Čas přes půlnoc zadejte např. 17:00–01:00.">
            <ActionForm action={saveOpeningHours}>
              <div className="divide-y divide-line">
                {hours.map((d, i) => {
                  const day = i + 1;
                  return (
                    <fieldset key={day} className="grid items-center gap-3 py-3 sm:grid-cols-[8rem_7rem_1fr]">
                      <legend className="sr-only">{DAY_LABELS[day]}</legend>
                      <span className="font-semibold">{DAY_LABELS[day]}</span>
                      <label className="flex items-center gap-2 text-sm">
                        <input type="checkbox" name={`closed_${day}`} defaultChecked={d?.closed ?? false} className="h-5 w-5 accent-pond-700" />
                        Zavřeno
                      </label>
                      <div className="grid grid-cols-2 gap-3 sm:flex sm:flex-wrap">
                        {[1, 2].map((n) => (
                          <div key={n} className="col-span-2 flex items-center gap-2 sm:col-span-1">
                            <input type="time" aria-label={`${DAY_LABELS[day]} – otevření ${n}`} name={`open_${day}_${n}`} defaultValue={d?.intervals[n - 1]?.open ?? ""} className="field !w-auto flex-1" />
                            <span aria-hidden>–</span>
                            <input type="time" aria-label={`${DAY_LABELS[day]} – zavření ${n}`} name={`close_${day}_${n}`} defaultValue={d?.intervals[n - 1]?.close ?? ""} className="field !w-auto flex-1" />
                          </div>
                        ))}
                      </div>
                    </fieldset>
                  );
                })}
              </div>
              <div>
                <label className="field-label" htmlFor="opening_hours_note">Poznámka (např. „Kuchyně do 21:00“, svátky)</label>
                <input id="opening_hours_note" name="opening_hours_note" defaultValue={s.opening_hours_note ?? ""} maxLength={200} className="field" />
              </div>
              <label className="flex items-center gap-3 text-sm text-ink-soft">
                <input type="checkbox" name="clear" className="h-5 w-5 accent-pond-700" />
                Otevírací dobu na webu nezobrazovat (zobrazí se „sdělíme telefonicky“)
              </label>
              <SubmitButton>Uložit otevírací dobu</SubmitButton>
            </ActionForm>
          </Panel>
        </div>

        <div id="kontakt" className="scroll-mt-24">
          <Panel title="Kontaktní údaje">
            <ActionForm action={saveContact}>
              <div className="grid gap-5 sm:grid-cols-2">
                <Field name="restaurant_name" label="Název" value={s.restaurant_name} required />
                <Field name="phone" label="Telefon" value={s.phone} type="tel" required />
                <Field name="email" label="E-mail (veřejný)" value={s.email} type="email" required />
                <Field name="address_street" label="Ulice a číslo" value={s.address_street} required />
                <Field name="address_zip" label="PSČ" value={s.address_zip} required />
                <Field name="address_city" label="Obec" value={s.address_city} required />
                <Field name="latitude" label="Zeměpisná šířka (nepovinné, např. 49.78)" value={s.latitude?.toString() ?? ""} inputMode="decimal" />
                <Field name="longitude" label="Zeměpisná délka (nepovinné, např. 14.17)" value={s.longitude?.toString() ?? ""} inputMode="decimal" />
                <Field name="facebook_url" label="Facebook (odkaz)" value={s.facebook_url ?? ""} type="url" />
                <Field name="instagram_url" label="Instagram (odkaz)" value={s.instagram_url ?? ""} type="url" />
              </div>
              <SubmitButton>Uložit kontakt</SubmitButton>
            </ActionForm>
          </Panel>
        </div>

        <div id="texty" className="scroll-mt-24">
          <Panel title="Texty webu">
            <ActionForm action={saveTexts}>
              {TEXT_FIELDS.map((f) => (
                <div key={f.key}>
                  <label className="field-label" htmlFor={`t-${f.key}`}>{f.label}</label>
                  {f.multiline ? (
                    <textarea id={`t-${f.key}`} name={f.key} defaultValue={s.texts[f.key] ?? ""} maxLength={2000} className="field" rows={3} />
                  ) : (
                    <input id={`t-${f.key}`} name={f.key} defaultValue={s.texts[f.key] ?? ""} maxLength={200} className="field" />
                  )}
                </div>
              ))}
              <SubmitButton>Uložit texty</SubmitButton>
            </ActionForm>
          </Panel>
        </div>

        <div id="sluzby" className="scroll-mt-24">
          <Panel title="Služby" description="Zaškrtnuté služby se zobrazují na webu. Odškrtněte ty, které už nenabízíte.">
            <ActionForm action={saveServices}>
              <ul className="grid gap-3 sm:grid-cols-2">
                {s.services.map((svc) => (
                  <li key={svc.key} className="flex items-center gap-3">
                    <input type="hidden" name="service_key" value={svc.key} />
                    <input type="checkbox" name={`service_enabled_${svc.key}`} defaultChecked={svc.enabled} aria-label={`Zobrazit ${svc.label}`} className="h-5 w-5 shrink-0 accent-pond-700" />
                    <input name={`service_label_${svc.key}`} defaultValue={svc.label} aria-label="Název služby" maxLength={80} className="field" />
                  </li>
                ))}
              </ul>
              <div>
                <label className="field-label" htmlFor="new_service">Přidat službu</label>
                <input id="new_service" name="new_service" maxLength={80} placeholder="např. Parkoviště" className="field" />
              </div>
              <p className="text-xs text-ink-soft">Službu odstraníte smazáním jejího názvu a uložením.</p>
              <SubmitButton>Uložit služby</SubmitButton>
            </ActionForm>
          </Panel>
        </div>

        <div id="logo" className="scroll-mt-24 grid gap-6 lg:grid-cols-2">
          <Panel title="Logo" description="Nahrajte originální logo restaurace (ideálně SVG nebo PNG s průhledným pozadím). Soubor se nijak neupravuje.">
            <BrandImageField kind="logo" currentUrl={publicFileUrl("media", s.logo_path)} />
          </Panel>
          <Panel title="Úvodní fotografie" description="Velká fotografie na úvodní stránce. Ideálně na šířku, alespoň 1920 px.">
            <BrandImageField kind="hero" currentUrl={publicFileUrl("media", s.hero_image_path)} />
          </Panel>
        </div>
      </div>
    </>
  );
}

function Field({
  name,
  label,
  value,
  type = "text",
  required,
  inputMode,
}: {
  name: string;
  label: string;
  value: string;
  type?: string;
  required?: boolean;
  inputMode?: "decimal";
}) {
  return (
    <div>
      <label className="field-label" htmlFor={`f-${name}`}>{label}</label>
      <input id={`f-${name}`} name={name} type={type} defaultValue={value} required={required} inputMode={inputMode} className="field" />
    </div>
  );
}
