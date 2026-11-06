"use client";
import { useActionState, useCallback, useEffect, useRef } from "react";
import type { ActionResult } from "@/lib/actions/result";
import { initialResult } from "@/lib/actions/result";
import { useToast } from "./Toast";

/**
 * Napojení formuláře na serverovou akci: chyby polí, toast, zavření dialogu.
 * Toast a onSuccess se volají hned po návratu akce – i když komponenta po
 * přepočtu dat zmizí (např. zaplacený termín už tlačítko nemá).
 */
export function useFormAction(action: (prev: ActionResult, fd: FormData) => Promise<ActionResult>, onSuccess?: (r: ActionResult) => void) {
  const toast = useToast();
  const cb = useRef(onSuccess);
  useEffect(() => {
    cb.current = onSuccess;
  }, [onSuccess]);
  const wrapped = useCallback(
    async (prev: ActionResult, fd: FormData) => {
      const r = await action(prev, fd);
      if (r.ok) {
        if (r.message) toast(r.message);
        cb.current?.(r);
      }
      return r;
    },
    [action, toast],
  );
  const [state, formAction, pending] = useActionState(wrapped, initialResult);
  const fe = (name: string) => (state.ok ? undefined : state.fieldErrors?.[name]);
  return { state, formAction, pending, fe };
}
