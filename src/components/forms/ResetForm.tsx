"use client";
import { AlertTriangle, RotateCcw } from "lucide-react";
import { useRouter } from "next/navigation";
import { useRef, useState } from "react";
import { resetHousehold } from "@/lib/actions/reset";
import { Button } from "@/components/ui/Button";
import { FormError, Input, Segmented, Toggle } from "@/components/ui/Field";
import { Modal } from "@/components/ui/Modal";
import { useFormAction } from "@/components/ui/useFormAction";
import { cn } from "@/components/ui/cn";

const PARTS: { key: string; label: string; detail: string }[] = [
  { key: "transactions", label: "Příjmy a výdaje", detail: "všechny pohyby, storna, označení plateb" },
  { key: "accounts", label: "Účty a zůstatky", detail: "smaže účty – lze jen spolu s pohyby" },
  { key: "recurring", label: "Pravidelné platby a příjmy", detail: "nájem, předplatné, mzdy…" },
  { key: "budgets", label: "Rozpočty", detail: "rozpočet na jídlo, limity kategorií" },
  { key: "savings", label: "Spoření", detail: "cíle a všechny vklady" },
  { key: "planning", label: "Nákupy a plánování", detail: "nákupy, nábytek, nákupní seznamy, cenová paměť" },
  { key: "travel", label: "Cestování", detail: "cesty, trasy a výdaje na cestách (výdaje v transakcích zůstanou)" },
  { key: "wealth", label: "Majetek, dluhy a termíny", detail: "majetek, dluhy, historie čistého jmění, hlídané termíny" },
  { key: "work", label: "Práce", detail: "směny a výplaty" },
  { key: "invoices", label: "Faktury", detail: "všechny faktury" },
  { key: "documents", label: "Dokumenty", detail: "soubory, účtenky, fotky" },
  { key: "categories", label: "Kategorie", detail: "vrátí výchozí kategorie" },
  { key: "members", label: "Členové bez účtu", detail: "členové s vlastním přihlášením zůstanou" },
  { key: "settings", label: "Nastavení", detail: "rezerva, upozornění, fakturační údaje, sazby práce (IČO zůstane)" },
];

export function ResetHouseholdButton({ householdName }: { householdName: string }) {
  const [open, setOpen] = useState(false);
  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [mode, setMode] = useState<"partial" | "factory">("partial");
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const formRef = useRef<HTMLFormElement>(null);
  // řízená pole – po neúspěšném odeslání (špatné heslo) se nevymažou
  const [understand, setUnderstand] = useState(false);
  const [confirmText, setConfirmText] = useState("");
  const [password, setPassword] = useState("");
  const router = useRouter();
  const { state, formAction, pending, fe } = useFormAction(resetHousehold, () => { setOpen(false); router.push("/"); });
  const close = () => { setOpen(false); setStep(1); };
  const chosen = mode === "factory" ? PARTS : PARTS.filter((p) => selected.has(p.key));
  const expected = mode === "factory" ? "TOVÁRNÍ RESET" : "VYNULOVAT";
  return (
    <>
      <Button variant="danger" size="sm" icon={<RotateCcw className="h-4 w-4" />} onClick={() => setOpen(true)}>Resetovat domácnost</Button>
      <Modal open={open} onClose={close} title="Reset domácnosti" wide>
        <form ref={formRef} action={formAction} className="space-y-4">
          <input type="hidden" name="mode" value={mode} />
          {chosen.map((p) => <input key={p.key} type="hidden" name="parts" value={p.key} />)}
          <div className={cn(step !== 1 && "hidden", "space-y-4")}>
            <Segmented name="_mode" value={mode} onChange={setMode} options={[{ value: "partial", label: "Vybrat části" }, { value: "factory", label: "Tovární reset" }]} />
            {mode === "factory" ? (
              <p className="rounded-xl border border-neg/30 bg-neg/10 px-3 py-2 text-sm text-neg">Smaže všechna data domácnosti „{householdName}“ a vrátí ji do stavu jako po založení: výchozí kategorie a nastavení, žádné účty, pohyby, cíle, faktury ani dokumenty. Lidé s přístupem a IČO zůstanou.</p>
            ) : (
              <>
                <p className="text-sm text-ink-2">Zaškrtněte, co se má vynulovat. Nezaškrtnuté části zůstanou beze změny.</p>
                <div className="grid gap-2 sm:grid-cols-2">
                  {PARTS.map((p) => (
                    <label key={p.key} className={cn("flex cursor-pointer gap-3 rounded-xl border p-3 text-sm transition", selected.has(p.key) ? "border-neg/50 bg-neg/10" : "border-white/10 hover:bg-white/[0.04]")}>
                      <input type="checkbox" className="mt-0.5 accent-[var(--color-gold)]" checked={selected.has(p.key)} onChange={(e) => {
                        const n = new Set(selected);
                        if (e.target.checked) { n.add(p.key); if (p.key === "accounts") n.add("transactions"); } else { n.delete(p.key); if (p.key === "transactions") n.delete("accounts"); }
                        setSelected(n);
                      }} />
                      <span><span className="block font-medium">{p.label}</span><span className="text-xs text-ink-3">{p.detail}</span></span>
                    </label>
                  ))}
                </div>
              </>
            )}
            <div className="flex justify-end gap-2"><Button type="button" variant="ghost" onClick={close}>Zrušit</Button><Button type="button" variant="danger" disabled={!chosen.length} onClick={() => setStep(2)}>Pokračovat</Button></div>
          </div>

          <div className={cn(step !== 2 && "hidden", "space-y-4")}>
            <div className="flex gap-3 rounded-2xl border border-neg/40 bg-neg/10 p-4 text-sm text-neg">
              <AlertTriangle className="h-5 w-5 shrink-0" />
              <div>
                <p className="font-semibold">Tyto informace už NEPŮJDOU vrátit.</p>
                <p className="mt-1 text-ink-2">Smaže se: {chosen.map((p) => p.label).join(", ")}. Pokud si je chcete ponechat, nejdřív si v Nastavení → Export a záloha stáhněte zálohu.</p>
              </div>
            </div>
            <Toggle name="understand" label="Rozumím, že smazaná data nepůjdou obnovit" checked={understand} onChange={(e) => setUnderstand(e.target.checked)} error={fe("understand")} />
            <Input name="confirm" label={`Pro potvrzení napište ${expected}`} autoComplete="off" value={confirmText} onChange={(e) => setConfirmText(e.target.value)} error={fe("confirm")} />
            <Input name="password" type="password" label="Vaše heslo" autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} error={fe("password")} />
            <FormError error={state.ok ? undefined : state.error} />
            <div className="flex justify-between gap-2"><Button type="button" variant="ghost" onClick={() => setStep(1)}>Zpět</Button><Button type="button" variant="danger" disabled={!understand || !confirmText || !password} onClick={() => setStep(3)}>Pokračovat</Button></div>
          </div>

          <div className={cn(step !== 3 && "hidden", "space-y-4 text-center")}>
            <AlertTriangle className="mx-auto h-10 w-10 text-neg" />
            <p className="text-lg font-semibold">Opravdu {mode === "factory" ? "provést tovární reset" : "vynulovat vybrané části"}?</p>
            <p className="text-sm text-ink-2">Toto je poslední potvrzení. Akci nelze vrátit zpět.</p>
            <FormError error={state.ok ? undefined : state.error} />
            <div className="flex justify-center gap-2">
              <Button type="button" variant="ghost" onClick={() => setStep(2)}>Ne, zpět</Button>
              <Button type="submit" variant="danger" loading={pending}>Ano, trvale smazat</Button>
            </div>
          </div>
        </form>
      </Modal>
    </>
  );
}
