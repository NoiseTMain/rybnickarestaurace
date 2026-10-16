import { ResetForm } from "./ResetForm";

export const dynamic = "force-dynamic";
export const metadata = { title: "Obnova hesla" };

export default function ResetPage() {
  return (
    <main className="flex min-h-dvh items-center justify-center px-4 py-10">
      <div className="w-full max-w-sm">
        <h1 className="mb-6 text-center font-display text-3xl font-semibold text-pond-950">Obnova hesla</h1>
        <ResetForm />
      </div>
    </main>
  );
}
