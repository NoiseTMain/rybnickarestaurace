"use client";
import { Mic, MicOff } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { useT } from "@/components/I18n";

type Rec = { lang: string; interimResults: boolean; continuous: boolean; start(): void; stop(): void; onresult: ((e: { results: ArrayLike<ArrayLike<{ transcript: string }> & { isFinal: boolean }> }) => void) | null; onend: (() => void) | null; onerror: ((e: { error: string }) => void) | null };
type RecCtor = new () => Rec;

/** Hlasový zápis (Web Speech API) – v Chrome, Edge a Safari. Text se jen vloží, nic se neodešle samo. */
export function VoiceButton({ onText, className = "" }: { onText: (text: string, final: boolean) => void; className?: string }) {
  const { locale } = useT();
  const [ctor, setCtor] = useState<RecCtor | null>(null);
  const [on, setOn] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const rec = useRef<Rec | null>(null);
  useEffect(() => {
    const w = window as unknown as { SpeechRecognition?: RecCtor; webkitSpeechRecognition?: RecCtor };
    const C = w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null;
    // eslint-disable-next-line react-hooks/set-state-in-effect -- dostupnost API se zjistí až v prohlížeči
    setCtor(() => C);
    return () => rec.current?.stop();
  }, []);
  if (!ctor) return null;
  const toggle = () => {
    if (on) { rec.current?.stop(); return; }
    const r = new ctor();
    r.lang = locale === "sk" ? "sk-SK" : locale === "en" ? "en-US" : "cs-CZ";
    r.interimResults = true;
    r.continuous = false;
    r.onresult = (e) => {
      const res = Array.from(e.results);
      onText(res.map((x) => x[0].transcript).join(" ").trim(), res.every((x) => x.isFinal));
    };
    r.onerror = (e) => setError(e.error === "not-allowed" ? "Povolte mikrofon v prohlížeči." : null);
    r.onend = () => setOn(false);
    rec.current = r;
    setError(null);
    setOn(true);
    r.start();
  };
  return (
    <span className={`relative ${className}`}>
      <button type="button" onClick={toggle} className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-full border ${on ? "animate-pulse border-neg/60 bg-neg/20 text-neg" : "border-white/10 text-ink-2 hover:text-ink"}`} aria-label={on ? "Zastavit diktování" : "Diktovat hlasem"} aria-pressed={on} title="Diktovat hlasem">
        {on ? <MicOff className="h-5 w-5" /> : <Mic className="h-5 w-5" />}
      </button>
      {error && <span className="absolute bottom-full right-0 mb-1 whitespace-nowrap rounded-lg bg-black/80 px-2 py-1 text-[11px] text-neg">{error}</span>}
    </span>
  );
}
