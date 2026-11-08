import Link from "next/link";
import { redirect } from "next/navigation";
import { getUser } from "@/lib/auth";
import { AuthCard } from "../AuthCard";
import { RegisterForm } from "../AuthForms";
import { getT } from "@/lib/i18n/server";

export const metadata = { title: "Registrace" };
export const dynamic = "force-dynamic";

export default async function RegisterPage() {
  if (await getUser()) redirect("/");
  const { t } = await getT();
  return (
    <AuthCard title={t("auth.newAccount")} subtitle={t("auth.registerSub")} footer={<>{t("auth.haveAccount")} <Link href="/prihlaseni" className="text-gold hover:underline">{t("auth.login")}</Link></>}>
      <RegisterForm />
    </AuthCard>
  );
}
