export type OpeningInterval = { open: string; close: string };

export type OpeningDay = {
  /** 1 = pondělí … 7 = neděle */
  day: number;
  closed: boolean;
  intervals: OpeningInterval[];
};

export type Service = { key: string; label: string; enabled: boolean };

export type SiteTexts = {
  hero_eyebrow?: string;
  hero_title?: string;
  hero_subtitle?: string;
  about_title?: string;
  about_text?: string;
  menu_note?: string;
  spaces_intro?: string;
  sport_intro?: string;
  contact_note?: string;
};

export const TEXT_FIELDS: { key: keyof SiteTexts; label: string; multiline?: boolean }[] = [
  { key: "hero_eyebrow", label: "Úvod – horní řádek" },
  { key: "hero_title", label: "Úvod – hlavní nadpis" },
  { key: "hero_subtitle", label: "Úvod – podnadpis", multiline: true },
  { key: "about_title", label: "O nás – nadpis" },
  { key: "about_text", label: "O nás – text", multiline: true },
  { key: "menu_note", label: "Poznámka pod denním menu", multiline: true },
  { key: "spaces_intro", label: "Prostory – úvodní text", multiline: true },
  { key: "sport_intro", label: "Sportovní přenosy – úvodní text", multiline: true },
  { key: "contact_note", label: "Kontakt – poznámka", multiline: true },
];

export type SiteSettings = {
  restaurant_name: string;
  phone: string;
  email: string;
  address_street: string;
  address_zip: string;
  address_city: string;
  latitude: number | null;
  longitude: number | null;
  opening_hours: OpeningDay[];
  opening_hours_note: string | null;
  services: Service[];
  texts: SiteTexts;
  logo_path: string | null;
  hero_image_path: string | null;
  facebook_url: string | null;
  instagram_url: string | null;
  updated_at?: string;
};

export type PrivateSettings = {
  menu_email_recipient: string;
  menu_email_enabled: boolean;
  inquiry_email_recipient: string;
};

export type EmailStatus = "pending" | "sending" | "sent" | "failed" | "skipped";

export type DailyMenu = {
  id: string;
  menu_date: string;
  storage_path: string;
  original_filename: string;
  file_size: number;
  width: number | null;
  height: number | null;
  sha256: string | null;
  uploaded_at: string;
  uploaded_by: string | null;
  is_current: boolean;
  first_published_at: string | null;
  published_at: string | null;
  publish_count: number;
  email_status: EmailStatus;
  email_recipient: string | null;
  email_sent_at: string | null;
  email_provider_id: string | null;
  email_last_error: string | null;
  email_attempts: number;
  email_claimed_at: string | null;
};

export type MenuKind = "food" | "drink";

export type MenuCategory = {
  id: string;
  kind: MenuKind;
  name: string;
  description: string | null;
  sort_order: number;
  is_visible: boolean;
};

export type MenuItem = {
  id: string;
  category_id: string;
  name: string;
  description: string | null;
  portion: string | null;
  price: number | null;
  price_note: string | null;
  allergens: string | null;
  sort_order: number;
  is_visible: boolean;
};

export type CategoryWithItems = MenuCategory & { items: MenuItem[] };

export type Space = {
  id: string;
  slug: string;
  name: string;
  description: string | null;
  capacity: number | null;
  capacity_note: string | null;
  cover_path: string | null;
  sort_order: number;
  is_visible: boolean;
};

export const GALLERY_CATEGORIES = [
  { key: "restaurace", label: "Restaurace" },
  { key: "jidlo", label: "Jídlo" },
  { key: "napoje", label: "Nápoje" },
  { key: "prostory", label: "Prostory" },
  { key: "akce", label: "Akce" },
] as const;

export type GalleryCategory = (typeof GALLERY_CATEGORIES)[number]["key"];

export type GalleryPhoto = {
  id: string;
  storage_path: string;
  alt: string;
  category: GalleryCategory;
  space_id: string | null;
  width: number | null;
  height: number | null;
  sort_order: number;
  is_visible: boolean;
  created_at: string;
};

export type SportEvent = {
  id: string;
  starts_at: string;
  sport: string;
  title: string;
  description: string | null;
  is_visible: boolean;
};

export type Inquiry = {
  id: string;
  kind: "reservation" | "event";
  name: string;
  phone: string;
  email: string | null;
  event_date: string | null;
  event_time: string | null;
  guests: number | null;
  space: string | null;
  message: string | null;
  status: "new" | "handled";
  email_notified: boolean;
  created_at: string;
};
