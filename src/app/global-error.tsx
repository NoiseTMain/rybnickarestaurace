"use client";
import { useEffect } from "react";
import { reportError } from "@/components/ErrorReporter";

export default function GlobalError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => { reportError(error.message || "Kritická chyba", error.stack, error.digest); }, [error]);
  return (
    <html lang="cs">
      <body style={{ background: "#0b0d12", color: "#e8e8ea", fontFamily: "system-ui, sans-serif", display: "grid", placeItems: "center", minHeight: "100vh", margin: 0 }}>
        <div style={{ textAlign: "center", padding: 24 }}>
          <h1 style={{ fontSize: 20 }}>Něco se pokazilo</h1>
          <p style={{ opacity: 0.7, fontSize: 14 }}>Chybu jsme zaznamenali. Zkuste stránku načíst znovu.</p>
          <button onClick={reset} style={{ marginTop: 12, padding: "8px 16px", borderRadius: 12, border: 0, background: "#d4af37", fontWeight: 600 }}>Zkusit znovu</button>
        </div>
      </body>
    </html>
  );
}
