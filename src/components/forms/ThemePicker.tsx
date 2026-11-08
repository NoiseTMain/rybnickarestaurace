"use client";
import { Check, FlaskConical, ImagePlus, Loader2 } from "lucide-react";
import { Crown } from "lucide-react";
import { FREE_ACCENTS, FREE_BACKGROUNDS, FREE_SCENES } from "@/lib/plans";
import { useState, type ReactNode } from "react";
import { saveTheme } from "@/lib/actions/theme";
import { ACCENTS, BACKGROUNDS, SCENES, rootFontSize, sceneUrl, themeVars, type Accent, type Background, type Scene, type Theme } from "@/lib/theme";
import { uploadDocument } from "@/lib/upload-client";
import { useLookups } from "@/components/Lookups";
import { Segmented, Toggle } from "@/components/ui/Field";
import { cn } from "@/components/ui/cn";
import { useToast } from "@/components/ui/Toast";

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div>
      <p className="mb-2 text-xs font-medium uppercase tracking-wider text-ink-3">{title}</p>
      {children}
    </div>
  );
}

/** Výběr vzhledu – změna se projeví okamžitě a uloží se na tomto zařízení. */
export function ThemePicker({ initial, premium = true }: { initial: Theme; premium?: boolean }) {
  const [t, setT] = useState<Theme>(initial);
  const [uploading, setUploading] = useState(false);
  const lk = useLookups();
  const toast = useToast();

  const locked = (patch: Partial<Theme>) => !premium && ((patch.accent && !FREE_ACCENTS.includes(patch.accent)) || (patch.bg && !FREE_BACKGROUNDS.includes(patch.bg)) || (patch.scene && !FREE_SCENES.includes(patch.scene)));
  const lock = (on: boolean) => on && <Crown className="absolute left-1.5 top-1.5 h-3.5 w-3.5 text-gold" aria-label="Premium" />;
  const apply = async (patch: Partial<Theme>) => {
    if (locked(patch)) { toast("Tato možnost je součást Premium", "error"); return; }
    const next = { ...t, ...patch };
    setT(next);
    const root = document.documentElement;
    for (const [k, v] of Object.entries(themeVars(next))) root.style.setProperty(k, v);
    root.style.setProperty("font-size", rootFontSize(next));
    root.setAttribute("data-accent", next.accent);
    root.setAttribute("data-bg", next.bg);
    root.setAttribute("data-privacy", next.privacy ? "1" : "0");
    root.setAttribute("data-motion", next.motion ? "on" : "off");
    const scene = document.getElementById("ambient-scene");
    const url = sceneUrl(next);
    if (scene) {
      scene.style.display = url ? "" : "none";
      scene.style.backgroundImage = url ? `url("${url}")` : "";
    }
    document.querySelector('meta[name="theme-color"]')?.setAttribute("content", BACKGROUNDS[next.bg].base);
    window.dispatchEvent(new Event("homeos-theme"));
    const r = await saveTheme(next);
    if (r.ok) toast("Vzhled uložen");
  };

  return (
    <div className="space-y-6">
      <Section title="Barva zvýraznění">
        <div className="grid grid-cols-3 gap-2 sm:grid-cols-5">
          {(Object.keys(ACCENTS) as Accent[]).map((a) => (
            <button key={a} type="button" onClick={() => apply({ accent: a })} aria-pressed={t.accent === a}
              className={cn("relative flex flex-col items-center gap-2 rounded-2xl border p-3 text-xs transition", locked({ accent: a }) && "opacity-60", t.accent === a ? "border-ink/60 bg-white/[0.07]" : "border-white/10 hover:bg-white/[0.04]")}>
              <span className="flex h-10 w-10 items-center justify-center rounded-full shadow-lg" style={{ background: `linear-gradient(135deg, ${ACCENTS[a].bright}, ${ACCENTS[a].deep})` }}>
                {t.accent === a && <Check className="h-5 w-5 text-[#1b1407]" />}
              </span>
              <span className="text-center text-ink-2">{ACCENTS[a].label}</span>
              {lock(Boolean(locked({ accent: a })))}
            </button>
          ))}
        </div>
      </Section>

      <Section title="Barva pozadí">
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          {(Object.keys(BACKGROUNDS) as Background[]).map((b) => (
            <button key={b} type="button" onClick={() => apply({ bg: b })} aria-pressed={t.bg === b}
              className={cn("relative overflow-hidden rounded-2xl border text-left text-xs transition", t.bg === b ? "border-ink/60" : "border-white/10", locked({ bg: b }) && "opacity-60")}>
              {lock(Boolean(locked({ bg: b })))}
              <span className="block h-12" style={{ background: `radial-gradient(circle at 20% 0%, ${ACCENTS[t.accent].gold}40, transparent 70%), ${BACKGROUNDS[b].base}` }} />
              <span className="flex items-center justify-between gap-1 bg-white/[0.04] px-3 py-2 text-ink-2">{BACKGROUNDS[b].label}{t.bg === b && <Check className="h-3.5 w-3.5 text-gold" />}</span>
            </button>
          ))}
        </div>
      </Section>

      <Section title="Obrázek na pozadí">
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          {(Object.keys(SCENES) as Scene[]).map((s) => (
            <button key={s} type="button" onClick={() => apply({ scene: s })} aria-pressed={t.scene === s}
              className={cn("relative overflow-hidden rounded-2xl border text-left text-xs transition", t.scene === s ? "border-ink/60" : "border-white/10", locked({ scene: s }) && "opacity-60")}>
              {lock(Boolean(locked({ scene: s })))}
              <span className="block h-20 bg-cover bg-center" style={SCENES[s].file ? { backgroundImage: `url("${SCENES[s].file}")`, filter: "blur(2px) brightness(.7)" } : { background: BACKGROUNDS[t.bg].base }} />
              {SCENES[s].file && (
                <span className="absolute right-1.5 top-1.5 inline-flex items-center gap-0.5 rounded-full bg-black/70 px-1.5 py-0.5 text-[9px] font-semibold tracking-wide text-warn" title="Ukázkový ilustrační obrázek">
                  <FlaskConical className="h-2.5 w-2.5" />DEMO
                </span>
              )}
              <span className="flex items-center justify-between gap-1 bg-white/[0.04] px-3 py-2 text-ink-2">{SCENES[s].label}{t.scene === s && <Check className="h-3.5 w-3.5 shrink-0 text-gold" />}</span>
            </button>
          ))}
          <label className={cn("relative flex cursor-pointer flex-col overflow-hidden rounded-2xl border text-left text-xs transition", t.scene === "photo" ? "border-ink/60" : "border-white/10")}>
            <span className="flex h-20 items-center justify-center bg-white/[0.04] bg-cover bg-center" style={t.photo ? { backgroundImage: `url("/api/files/${t.photo}")` } : undefined}>
              {uploading ? <Loader2 className="h-5 w-5 animate-spin" /> : !t.photo && <ImagePlus className="h-6 w-6 text-gold" />}
            </span>
            <span className="flex items-center justify-between gap-1 bg-white/[0.04] px-3 py-2 text-ink-2">Vlastní fotka{t.scene === "photo" && <Check className="h-3.5 w-3.5 text-gold" />}</span>
            <input type="file" accept="image/*" className="sr-only" disabled={uploading || !premium} onChange={async (e) => {
              const f = e.target.files?.[0];
              if (!f) return;
              setUploading(true);
              try { const id = await uploadDocument(f, "other", lk, "Pozadí aplikace"); await apply({ scene: "photo", photo: id }); }
              catch (err) { toast(err instanceof Error ? err.message : "Nahrání selhalo", "error"); }
              setUploading(false);
              e.target.value = "";
            }} />
          </label>
        </div>
        <p className="mt-2 text-xs text-ink-3">Obrázky označené DEMO jsou ukázkové ilustrace. Vlastní fotku (třeba vašeho obýváku) uvidí jen členové domácnosti.</p>
      </Section>

      <div className="grid gap-5 sm:grid-cols-3">
        <Section title="Průhlednost karet">
          <Segmented name="glass" value={t.glass} onChange={(v) => apply({ glass: v })} options={[{ value: "soft", label: "Jemná" }, { value: "medium", label: "Střední" }, { value: "strong", label: "Výrazná" }]} />
        </Section>
        <Section title="Rohy">
          <Segmented name="radius" value={t.radius} onChange={(v) => apply({ radius: v })} options={[{ value: "round", label: "Zaoblené" }, { value: "sharp", label: "Ostřejší" }]} />
        </Section>
        <Section title="Velikost písma">
          <Segmented name="font" value={t.font} onChange={(v) => apply({ font: v })} options={[{ value: "normal", label: "Běžná" }, { value: "large", label: "Větší" }]} />
        </Section>
      </div>

      <div className="space-y-1">
        <Toggle label="Skrýt částky" description="Částky se rozmažou a ukážou až po klepnutí – hodí se na veřejnosti" checked={t.privacy} onChange={(e) => apply({ privacy: e.target.checked })} />
        <Toggle label="Animace" description="Plynulé přechody a efekty" checked={t.motion} onChange={(e) => apply({ motion: e.target.checked })} />
      </div>
    </div>
  );
}
