import Link from "next/link";
import { redirect } from "next/navigation";
import { getUser } from "@/lib/auth";
import { AuthCard } from "../AuthCard";
import { RegisterForm } from "../AuthForms";

export const metadata = { title: "Registrace" };
export const dynamic = "force-dynamic";

export default async function RegisterPage() {
  if (await getUser()) redirect("/");
  return (
    <AuthCard title="Nový účet" subtitle="Vaše data vidíte jen vy a členové, které pozvete." footer={<>Už máte účet? <Link href="/prihlaseni" className="text-gold hover:underline">Přihlaste se</Link></>}>
      <RegisterForm />
    </AuthCard>
  );
}
