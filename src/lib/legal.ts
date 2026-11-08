/** Údaje provozovatele pro podmínky a zásady (nastavte v proměnných prostředí). */
export const OPERATOR = {
  name: process.env.OPERATOR_NAME ?? "Adam Horváth",
  ico: process.env.OPERATOR_ICO ?? "",
  address: process.env.OPERATOR_ADDRESS ?? "",
  email: process.env.OPERATOR_EMAIL ?? "adamhorvath07@icloud.com",
};
export const LEGAL_UPDATED = "8. 11. 2026";
