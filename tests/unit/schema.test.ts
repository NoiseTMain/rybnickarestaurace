import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { PRIMARY_KEY } from "@/lib/db/schema-meta";

describe("schéma databáze", () => {
  it("každá tabulka bez sloupce id má v PRIMARY_KEY svůj klíč (jinak select v Supabase spadne)", () => {
    const dir = join(process.cwd(), "supabase/migrations");
    const sql = readdirSync(dir).sort().map((f) => readFileSync(join(dir, f), "utf8")).join("\n");
    const withoutId: string[] = [];
    for (const m of sql.matchAll(/create table (?:if not exists )?public\.(\w+)\s*\(([\s\S]*?)\n\);/g)) {
      if (!/^\s*id\s+\w+[^\n]*primary key/m.test(m[2])) withoutId.push(m[1]);
    }
    expect(withoutId.length).toBeGreaterThan(0);
    for (const t of withoutId) expect(PRIMARY_KEY[t], t).toBeTruthy();
  });
});
