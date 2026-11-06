import Link from "next/link";
import { AuthCard } from "../AuthCard";
import { ResetForm } from "../AuthForms";

export const metadata = { title: "Obnova hesla" };

export default function ResetPage() {
  return (
    <AuthCard title="Obnova hesla" subtitle="Pošleme vám odkaz pro nastavení nového hesla." footer={<Link href="/prihlaseni" className="text-gold hover:underline">Zpět na přihlášení</Link>}>
      <ResetForm />
    </AuthCard>
  );
}
