import { NextResponse } from "next/server";
import { widgetData } from "@/lib/widget";
import { formatMoney } from "@/lib/money";

/**
 * Widget na plochu (iPhone Zkratky, Android widgety): GET /api/widget/<token>
 * ?format=text → jeden řádek textu, jinak JSON. Token je tajný odkaz jen pro čtení souhrnů.
 */
export async function GET(req: Request, { params }: { params: Promise<{ token: string }> }) {
  const d = await widgetData((await params).token).catch(() => null);
  if (!d) return NextResponse.json({ error: "Neplatný nebo zrušený odkaz widgetu." }, { status: 404 });
  const kc = (c: number) => formatMoney(c, { decimals: "never" });
  const text = d.safeToSpend > 0
    ? `Dnes můžete utratit ${kc(d.perDay)} · do konce měsíce ${kc(d.safeToSpend)} (${d.daysLeft} dní) · dnes utraceno ${kc(d.spentToday)}`
    : `Pozor: do konce měsíce chybí ${kc(d.needToEarn)} · dnes utraceno ${kc(d.spentToday)}`;
  const headers = { "Cache-Control": "private, max-age=300", "X-Robots-Tag": "noindex" };
  if (new URL(req.url).searchParams.get("format") === "text") return new Response(text, { headers: { ...headers, "Content-Type": "text/plain; charset=utf-8" } });
  return NextResponse.json({ ...d, perDayText: kc(d.perDay), safeToSpendText: kc(d.safeToSpend), text }, { headers });
}
