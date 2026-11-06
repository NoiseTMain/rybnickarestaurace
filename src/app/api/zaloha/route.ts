import { NextResponse } from "next/server";
import { apiContext } from "@/lib/context";
import { createBackup } from "@/lib/backup";
import { todayISO } from "@/lib/dates";

/** Kompletní záloha domácnosti (JSON). ?soubory=1 přibalí i dokumenty (base64). */
export async function GET(req: Request) {
  const ctx = await apiContext();
  if (ctx instanceof Response) return ctx;
  const withFiles = new URL(req.url).searchParams.get("soubory") === "1";
  const backup = await createBackup(ctx, withFiles);
  return new NextResponse(JSON.stringify(backup, null, 1), {
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Content-Disposition": `attachment; filename="homeos-zaloha-${todayISO()}${withFiles ? "-se-soubory" : ""}.json"`,
      "Cache-Control": "private, no-store",
    },
  });
}
