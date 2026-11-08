import { redirect } from "next/navigation";
import { getUser, mfaPending } from "@/lib/auth";
import { AuthCard } from "../../AuthCard";
import { MfaLoginForm } from "@/components/forms/SecurityForms";

export const metadata = { title: "Ověření" };
export const dynamic = "force-dynamic";

export default async function MfaPage() {
  if (!(await getUser())) redirect("/prihlaseni");
  if (!(await mfaPending())) redirect("/");
  return (
    <AuthCard title="Dvoufázové ověření" subtitle="Zadejte 6místný kód z ověřovací aplikace (Google Authenticator, Microsoft Authenticator…).">
      <MfaLoginForm />
    </AuthCard>
  );
}
