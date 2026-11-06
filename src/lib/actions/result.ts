export interface ActionResult {
  ok: boolean;
  message?: string;
  error?: string;
  fieldErrors?: Record<string, string>;
  /** Identifikátor vytvořeného záznamu (např. pro navazující krok). */
  id?: string;
  /** Mění se s každým odesláním – formuláře podle něj poznají nový výsledek. */
  at?: number;
}

export const initialResult: ActionResult = { ok: false };
