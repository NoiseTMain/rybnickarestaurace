"use client";

/** Výdaje zapsané bez připojení – drží se v tomto zařízení a odešlou se po připojení. */
export type OfflineKind = "trip_expense" | "transaction";
export interface OfflineItem { id: string; kind: OfflineKind; label: string; entries: [string, string][]; createdAt: string }

const KEY = "homeos_offline_queue";
export const OFFLINE_EVENT = "homeos-offline-queue";

export function readQueue(): OfflineItem[] {
  try {
    return JSON.parse(localStorage.getItem(KEY) ?? "[]") as OfflineItem[];
  } catch {
    return [];
  }
}

function write(list: OfflineItem[]) {
  try {
    localStorage.setItem(KEY, JSON.stringify(list));
  } catch {
    /* plné úložiště / soukromý režim */
  }
  window.dispatchEvent(new Event(OFFLINE_EVENT));
}

export function enqueue(kind: OfflineKind, form: HTMLFormElement, label: string) {
  const entries = [...new FormData(form).entries()].filter((e): e is [string, string] => typeof e[1] === "string" && !e[0].startsWith("$ACTION"));
  write([...readQueue(), { id: crypto.randomUUID(), kind, label, entries, createdAt: new Date().toISOString() }]);
}

export function removeFromQueue(id: string) {
  write(readQueue().filter((i) => i.id !== id));
}

/** Pro formuláře: bez připojení uloží data do fronty a vrátí true (formulář se pak neodesílá). */
export function queueIfOffline(e: React.FormEvent<HTMLFormElement>, kind: OfflineKind, label: string): boolean {
  if (typeof navigator === "undefined" || navigator.onLine) return false;
  e.preventDefault();
  enqueue(kind, e.currentTarget, label);
  return true;
}
