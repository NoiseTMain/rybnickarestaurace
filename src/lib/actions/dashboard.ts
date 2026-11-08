"use server";
import { cookies } from "next/headers";
import { DASH_COOKIE } from "@/lib/dashboard-mode";

/** Zapamatuje si zvolené zobrazení Přehledu. */
export async function setDashboardMode(mode: "simple" | "detailed"): Promise<void> {
  (await cookies()).set(DASH_COOKIE, mode === "detailed" ? "detailed" : "simple", { path: "/", maxAge: 31_536_000, sameSite: "lax", httpOnly: true });
}
