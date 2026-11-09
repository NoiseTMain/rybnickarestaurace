import { PHOTOS } from "./photos";

/** Má jídlo realistickou fotku? (jinak se ukáže ilustrace podle surovin) */
export const hasPhoto = (dishId: string) => PHOTOS.has(dishId);

/** Obrázek varianty: fotka jídla, nebo SVG ilustrace podle surovin. */
export const recipeImage = (r: { id: string; dishId: string }) => (PHOTOS.has(r.dishId) ? `/recipes/${r.dishId}.webp` : `/api/recipe-image/${r.id}.svg`);
