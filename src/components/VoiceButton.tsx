"use client";
import { Mic, MicOff } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { useT } from "@/components/I18n";

type Rec = { lang: string; interimResults: boolean; continuous: boolean; start(): void; stop(): void; onresult: ((e: { results: ArrayLike<ArrayLike<{ transcript: string }> & { isFinal: boolean }> }) => void) | null; onend: (() => void) | null; onerror: ((e: { error: string }) => void) | null };
type RecCtor = new () => Rec;

const HINT = "Hlasové zadávání tady prohlížeč nepovoluje – klepněte do pole a použijte mikrofon 🎤 na klávesnici telefonu.";

/**
 * Hlasový zápis (Web Speech API – Chrome, Edge, Safari). V aplikaci přidané na plochu iPhonu
 * Apple rozpoznávání řeči nepovoluje → tlačítko zaměří pole a poradí diktování z klávesnice.
 */
export function VoiceButton({ onText, inputRef, className = "" }: { onText: (text: string, final: boolean) => void; inputRef?: React.RefObject<HTMLInputElement | null>; className?: string }) {
  const { locale } = useT();
  const [ctor, setCtor] = useState<RecCtor | null | undefined>(undefined);
  const [on, setOn] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const rec = useRef<Rec | null>(null);
  useEffect(() => {
    const w = window as unknown as { SpeechRecognition?: RecCtor; webkitSpeechRecognition?: RecCtor };
    const standaloneIOS = (navigator as unknown as { standalone?: boolean }).standalone === true;
    const C = standaloneIOS ? null : w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null;
    // eslint-disable-next-line react-hooks/set-state-in-effect -- dostupnost API se zjistí až v prohlížeči
    setCtor(() => C);
    return () => rec.current?.stop();
  }, []);
  useEffect(() => { if (!msg) return; const t = setTimeout(() => setMsg(null), 6000); return () => clearTimeout(t); }, [msg]);
  if (ctor === undefined) return null;
  const fallback = () => { inputRef?.current?.focus(); setMsg(HINT); };
  const toggle = () => {
    if (!ctor) return fallback();
    if (on) { rec.current?.stop(); return; }
    try {
      const r = new ctor();
      r.lang = locale === "sk" ? "sk-SK" : locale === "en" ? "en-US" : "cs-CZ";
      r.interimResults = true;
      r.continuous = false;
      let got = false;
      r.onresult = (e) => {
        const res = Array.from(e.results);
        got = true;
        onText(res.map((x) => x[0].transcript).join(" ").trim(), res.every((x) => x.isFinal));
      };
      r.onerror = (e) => {
        if (e.error === "not-allowed") setMsg("Povolte mikrofon v nastavení prohlížeče (u adresy stránky).");
        else if (e.error === "no-speech") setMsg("Nic jsem neslyšel – zkuste to znovu a mluvte hned po pípnutí.");
        else if (e.error !== "aborted") fallback();
      };
      r.onend = () => { setOn(false); if (got) inputRef?.current?.focus(); };
      rec.current = r;
      setMsg(null);
      setOn(true);
      r.start();
    } catch {
      setOn(false);
      fallback();
    }
  };
  return (
    <span className={`relative ${className}`}>
      <button type="button" onClick={toggle} className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-full border ${on ? "animate-pulse border-neg/60 bg-neg/20 text-neg" : "border-white/10 text-ink-2 hover:text-ink"}`} aria-label={on ? "Zastavit diktování" : "Diktovat hlasem"} aria-pressed={on} title="Diktovat hlasem">
        {on ? <MicOff className="h-5 w-5" /> : <Mic className="h-5 w-5" />}
      </button>
      {on && <span className="absolute bottom-full right-0 mb-2 whitespace-nowrap rounded-lg bg-black/85 px-2 py-1 text-[11px] text-ink">Poslouchám…</span>}
      {msg && <span role="status" className="absolute bottom-full right-0 mb-2 w-64 rounded-lg bg-black/90 px-3 py-2 text-xs text-ink">{msg}</span>}
    </span>
  );
}
