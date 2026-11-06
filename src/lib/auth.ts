import "server-only";
import { createHmac, randomUUID, scrypt as scryptCb, timingSafeEqual, randomBytes } from "node:crypto";
import { promisify } from "node:util";
import { cookies } from "next/headers";
import { cache } from "react";
import { appMode } from "@/lib/env";
import { createSessionClient } from "@/lib/supabase/server";

const scrypt = promisify(scryptCb) as (pw: string, salt: Buffer, len: number) => Promise<Buffer>;

export interface AppUser {
  id: string;
  email: string;
}

export const LOCAL_SESSION_COOKIE = "homeos_local_session";
const SESSION_DAYS = 30;

async function localSecret(): Promise<string> {
  if (process.env.LOCAL_SESSION_SECRET) return process.env.LOCAL_SESSION_SECRET;
  const { readLocal } = await import("@/lib/db/local-store");
  return readLocal((d) => d.secret);
}

function sign(payload: string, secret: string) {
  return createHmac("sha256", secret).update(payload).digest("base64url");
}

export async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(16);
  const hash = await scrypt(password, salt, 64);
  return `scrypt:${salt.toString("base64")}:${hash.toString("base64")}`;
}

export async function verifyPassword(password: string, stored: string): Promise<boolean> {
  const [algo, saltB64, hashB64] = stored.split(":");
  if (algo !== "scrypt") return false;
  const expected = Buffer.from(hashB64, "base64");
  const actual = await scrypt(password, Buffer.from(saltB64, "base64"), expected.length);
  return timingSafeEqual(expected, actual);
}

export async function createLocalSession(userId: string) {
  const exp = Date.now() + SESSION_DAYS * 86_400_000;
  const payload = Buffer.from(JSON.stringify({ sub: userId, exp, n: randomUUID() })).toString("base64url");
  const value = `${payload}.${sign(payload, await localSecret())}`;
  const jar = await cookies();
  jar.set(LOCAL_SESSION_COOKIE, value, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production" && process.env.HOMEOS_INSECURE_COOKIES !== "1",
    path: "/",
    maxAge: SESSION_DAYS * 86_400,
  });
}

async function localUser(): Promise<AppUser | null> {
  const jar = await cookies();
  const raw = jar.get(LOCAL_SESSION_COOKIE)?.value;
  if (!raw) return null;
  const [payload, sig] = raw.split(".");
  if (!payload || !sig) return null;
  const expected = sign(payload, await localSecret());
  const a = Buffer.from(sig), b = Buffer.from(expected);
  if (a.length !== b.length || !timingSafeEqual(a, b)) return null;
  try {
    const { sub, exp } = JSON.parse(Buffer.from(payload, "base64url").toString()) as { sub: string; exp: number };
    if (exp < Date.now()) return null;
    const { readLocal } = await import("@/lib/db/local-store");
    const user = await readLocal((d) => d.users.find((u) => u.id === sub));
    return user ? { id: user.id, email: user.email } : null;
  } catch {
    return null;
  }
}

/**
 * Přihlášený uživatel, nebo null. Token se ověřuje kryptograficky (podpis JWT
 * přes veřejné klíče projektu, které se ukládají do mezipaměti) – bez dalšího
 * dotazu na Auth server při každém kliknutí. Data stejně chrání RLS v databázi.
 */
export const getUser = cache(async (): Promise<AppUser | null> => {
  if (appMode() === "local") return localUser();
  const supabase = await createSessionClient();
  const { data, error } = await supabase.auth.getClaims();
  const claims = data?.claims;
  if (error || !claims?.sub) return null;
  return { id: claims.sub, email: typeof claims.email === "string" ? claims.email : "" };
});
