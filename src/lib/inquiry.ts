import { z } from "zod";
import { isValidIsoDate } from "@/lib/time";

const optionalText = (max: number) =>
  z
    .string()
    .trim()
    .max(max)
    .optional()
    .transform((v) => (v ? v : null));

export const inquirySchema = z.object({
  kind: z.enum(["reservation", "event"]),
  name: z.string().trim().min(2, "Vyplňte prosím jméno.").max(120),
  phone: z
    .string()
    .trim()
    .min(5, "Vyplňte prosím telefon.")
    .max(40)
    .regex(/^[+0-9 ()/-]+$/, "Telefon obsahuje neplatné znaky."),
  email: z
    .string()
    .trim()
    .max(200)
    .optional()
    .transform((v) => (v ? v : null))
    .refine((v) => v === null || /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(v), "Neplatný e-mail."),
  eventDate: z
    .string()
    .optional()
    .transform((v) => (v ? v : null))
    .refine((v) => v === null || isValidIsoDate(v), "Neplatné datum."),
  eventTime: optionalText(20),
  guests: z.coerce.number().int().min(1).max(1000).optional().or(z.literal("").transform(() => undefined)),
  space: optionalText(80),
  message: optionalText(4000),
  /** honeypot – skutečný člověk toto pole nevidí */
  website: z.string().max(500).optional(),
  consent: z.literal(true, { error: "Pro odeslání je nutný souhlas se zpracováním údajů." }),
});

export type InquiryInput = z.infer<typeof inquirySchema>;
