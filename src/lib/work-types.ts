/** Typy práce v sekci Práce. */
export const JOB_TYPES = {
  employee: { label: "Zaměstnání / brigáda", detail: "HPP, DPP, DPČ – hodiny a mzda" },
  shifts: { label: "Práce na směny", detail: "obchod, gastro, výroba… – hodiny a výdělek za směnu" },
  courier: { label: "Kurýr / řidič", detail: "trasy, objednávky, špička, auto a km" },
  freelance: { label: "OSVČ / na volné noze", detail: "zakázky, hodiny, faktury" },
} as const;
export type JobType = keyof typeof JOB_TYPES;
