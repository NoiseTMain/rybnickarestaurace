import { downloadFileUrl, publicFileUrl } from "@/lib/storage";
import { pragueToday } from "@/lib/time";
import type { DailyMenu } from "@/lib/types";
import { MenuAutoRefresh, MenuViewer, type MenuView } from "./MenuViewer";

export function toMenuView(menu: DailyMenu | null): MenuView | null {
  if (!menu) return null;
  const url = publicFileUrl("menus", menu.storage_path);
  if (!url) return null;
  const downloadName = `denni-menu-rybniky-${menu.menu_date}.png`;
  return {
    id: menu.id,
    menuDate: menu.menu_date,
    // verze v URL zajistí, že se po znovuzveřejnění nenačte starý obrázek z cache
    url: `${url}?v=${encodeURIComponent(menu.published_at ?? menu.uploaded_at)}`,
    downloadUrl: downloadFileUrl("menus", menu.storage_path, downloadName) ?? url,
    downloadName,
    width: menu.width,
    height: menu.height,
  };
}

export function DailyMenuBlock({ menu, compact }: { menu: DailyMenu | null; compact?: boolean }) {
  return (
    <>
      <MenuViewer menu={toMenuView(menu)} serverToday={pragueToday()} compact={compact} />
      <MenuAutoRefresh currentId={menu?.id ?? null} />
    </>
  );
}
