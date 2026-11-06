"use server";
import { requireContext } from "@/lib/context";
import { loadSnapshot } from "@/lib/data";
import { answer, type AssistantAnswer } from "@/lib/assistant";

export async function askAssistant(question: string): Promise<AssistantAnswer> {
  const ctx = await requireContext();
  const { data, snapshot } = await loadSnapshot(ctx);
  return answer(String(question).slice(0, 500), snapshot, data);
}
