"use client";

import { getBrowserClient } from "@/lib/supabase/browser";

const EXT: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "image/avif": "avif",
  "image/svg+xml": "svg",
};

export type UploadedImage = { path: string; width: number; height: number };

async function loadImage(file: Blob): Promise<HTMLImageElement> {
  const url = URL.createObjectURL(file);
  try {
    const img = new Image();
    img.src = url;
    await img.decode();
    return img;
  } finally {
    URL.revokeObjectURL(url);
  }
}

/**
 * Zmenší fotografii v prohlížeči (max. 2400 px, WebP/JPEG) – rychlejší
 * nahrávání z telefonu a menší data pro web. Logo se NEupravuje.
 */
export async function optimizePhoto(file: File, maxSide = 2400): Promise<{ blob: Blob; type: string; width: number; height: number }> {
  if (file.type === "image/svg+xml") throw new Error("Fotografie musí být JPG, PNG nebo WebP.");
  const img = await loadImage(file);
  const scale = Math.min(1, maxSide / Math.max(img.naturalWidth, img.naturalHeight));
  const width = Math.round(img.naturalWidth * scale);
  const height = Math.round(img.naturalHeight * scale);
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Prohlížeč nepodporuje úpravu obrázků.");
  ctx.imageSmoothingQuality = "high";
  ctx.drawImage(img, 0, 0, width, height);
  for (const type of ["image/webp", "image/jpeg"]) {
    const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, type, 0.86));
    if (blob && blob.type === type) return { blob, type, width, height };
  }
  throw new Error("Obrázek se nepodařilo zpracovat.");
}

/** Nahraje obrázek do bucketu „media“ do složky prefix/ s náhodným názvem. */
export async function uploadMedia(prefix: "gallery" | "hero" | "logo" | "spaces", file: File, opts: { optimize: boolean }): Promise<UploadedImage> {
  if (file.size > 25 * 1024 * 1024) throw new Error("Soubor je příliš velký (max. 25 MB).");
  let blob: Blob = file;
  let type = file.type;
  let width = 0;
  let height = 0;
  if (opts.optimize) {
    ({ blob, type, width, height } = await optimizePhoto(file));
  } else {
    if (!EXT[type]) throw new Error("Nepodporovaný formát. Použijte SVG, PNG, JPG nebo WebP.");
    if (type !== "image/svg+xml") {
      const img = await loadImage(file);
      width = img.naturalWidth;
      height = img.naturalHeight;
    }
  }
  if (blob.size > 10 * 1024 * 1024) throw new Error("Soubor je i po zmenšení větší než 10 MB.");
  const path = `${prefix}/${crypto.randomUUID()}.${EXT[type]}`;
  const { error } = await getBrowserClient().storage.from("media").upload(path, blob, { contentType: type, cacheControl: "31536000", upsert: false });
  if (error) throw new Error(`Nahrání selhalo: ${error.message}`);
  return { path, width, height };
}
