import { getLocale } from "@/lib/i18n/server";
import Anthropic from "@anthropic-ai/sdk";
import { z } from "zod";
import { apiContext } from "@/lib/context";
import { loadSnapshot } from "@/lib/data";
import { getPremium } from "@/lib/premium";
import { AI_MONTHLY_LIMIT } from "@/lib/plans";
import { aiEnabled } from "@/lib/ai";
import { friendlyError, runChat, systemPrompt, type ChatMessage } from "@/lib/assistant-ai/chat";
import type { ToolEnv } from "@/lib/assistant-ai/tools";

export const maxDuration = 60;

const body = z.object({
  messages: z.array(z.object({ role: z.enum(["user", "assistant"]), content: z.string().max(8000) })).min(1).max(60),
});

// jednoduchý limit: 20 dotazů za 5 minut na uživatele (v rámci jedné instance)
const hits = new Map<string, number[]>();
function limited(userId: string): boolean {
  const now = Date.now();
  const list = (hits.get(userId) ?? []).filter((t) => now - t < 300_000);
  list.push(now);
  hits.set(userId, list);
  return list.length > 20;
}

let client: Anthropic | null = null;

/** Normalizace historie: začíná uživatelem, role se střídají, posledních 30 zpráv. */
function cleanHistory(msgs: ChatMessage[]): ChatMessage[] {
  const out: ChatMessage[] = [];
  for (const m of msgs.slice(-30)) {
    const content = m.content.trim().slice(0, 4000);
    if (!content) continue;
    if (out.length && out[out.length - 1].role === m.role) out[out.length - 1] = { role: m.role, content: `${out[out.length - 1].content}\n\n${content}` };
    else out.push({ role: m.role, content });
  }
  while (out.length && out[0].role !== "user") out.shift();
  return out;
}

export async function POST(req: Request) {
  if (!aiEnabled()) return Response.json({ error: "AI není zapnutá" }, { status: 501 });
  const ctx = await apiContext();
  if (ctx instanceof Response) return ctx;
  const parsed = body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return Response.json({ error: "Neplatný požadavek" }, { status: 400 });
  const history = cleanHistory(parsed.data.messages);
  if (!history.length || history[history.length - 1].role !== "user") return Response.json({ error: "Chybí otázka" }, { status: 400 });
  if (!(await getPremium(ctx)).household) return Response.json({ error: "AI asistent je součástí Premium." }, { status: 402 });
  if (limited(ctx.user.id)) return Response.json({ error: "Příliš mnoho dotazů, zkuste to za pár minut." }, { status: 429 });
  const used = await ctx.store.bumpAiUsage().catch(() => 0);
  if (used > AI_MONTHLY_LIMIT) return Response.json({ error: `Tento měsíc jste vyčerpali ${AI_MONTHLY_LIMIT} dotazů na AI. Od prvního dne dalšího měsíce zase naplno.` }, { status: 429 });

  const { data, snapshot, today } = await loadSnapshot(ctx);
  const travel = data.travel;
  const env: ToolEnv = { data, snapshot, today, travel, drafts: [] };
  const me = data.members.find((m) => m.user_id === ctx.user.id)?.name ?? ctx.user.email.split("@")[0];
  const system = systemPrompt(env, ctx.household.name, me, await getLocale());
  client ??= new Anthropic({ timeout: 55_000, maxRetries: 1 });

  const enc = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      const send = (o: unknown) => controller.enqueue(enc.encode(JSON.stringify(o) + "\n"));
      try {
        for await (const ev of runChat(client!, env, system, history)) send(ev);
      } catch (e) {
        console.warn("AI chat:", e instanceof Anthropic.APIError ? e.status : e);
        const { logAppError } = await import("@/lib/errors-log");
        await logAppError({ message: `AI chat: ${e instanceof Anthropic.APIError ? `${e.status} ${e.message}` : e instanceof Error ? e.message : String(e)}`, path: "/api/assistant/chat", userId: ctx.user.id });
        send({ t: "error", text: friendlyError(e) });
      }
      controller.close();
    },
  });
  return new Response(stream, { headers: { "Content-Type": "application/x-ndjson; charset=utf-8", "Cache-Control": "no-store" } });
}
