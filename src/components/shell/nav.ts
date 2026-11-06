import {
  Bot, Briefcase, CalendarClock, FileText, FolderArchive, Home, LayoutDashboard, PiggyBank, Receipt, Settings, ShoppingBag, Wallet,
} from "lucide-react";

export const NAV = [
  { href: "/", label: "Přehled", icon: LayoutDashboard },
  { href: "/domacnost", label: "Domácnost", icon: Home },
  { href: "/transakce", label: "Příjmy a výdaje", icon: Wallet },
  { href: "/prace", label: "Práce", icon: Briefcase },
  { href: "/faktury", label: "Faktury", icon: Receipt },
  { href: "/nakupy", label: "Nákupy", icon: ShoppingBag },
  { href: "/sporeni", label: "Spoření", icon: PiggyBank },
  { href: "/rozpocty", label: "Rozpočty", icon: FileText },
  { href: "/platby", label: "Pravidelné platby", icon: CalendarClock },
  { href: "/asistent", label: "Finanční asistent", icon: Bot },
  { href: "/dokumenty", label: "Dokumenty", icon: FolderArchive },
  { href: "/nastaveni", label: "Nastavení", icon: Settings },
] as const;

export const MOBILE_TABS = ["/", "/transakce", "/rozpocty", "/asistent"] as const;
