import "server-only";

/** Tajné proměnné – nikdy se neposílají do prohlížeče. */
export const serverEnv = {
  supabaseServiceRoleKey: process.env.SUPABASE_SERVICE_ROLE_KEY ?? "",
  resendApiKey: process.env.RESEND_API_KEY ?? "",
  /** Odesílatel, musí být z domény ověřené v Resend, např. "Restaurace Rybníky <menu@rybnickarestaurace.cz>" */
  emailFrom: process.env.EMAIL_FROM ?? "",
  /** Sůl pro anonymizaci IP adres u poptávek (rate limiting). */
  ipHashSalt: process.env.IP_HASH_SALT ?? "rybniky",
};
