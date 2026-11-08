"use client";
import { LanguageSwitcher, useT } from "@/components/I18n";

export function LanguageCard() {
  const { t } = useT();
  return (
    <div className="space-y-2">
      <LanguageSwitcher className="text-lg" />
      <p className="text-xs text-ink-3">{t("lang.note")}</p>
    </div>
  );
}
