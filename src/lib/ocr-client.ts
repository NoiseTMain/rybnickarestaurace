"use client";

/**
 * OCR v prohlížeči – soubory s fakturami neopouštějí zařízení kvůli rozpoznání.
 * PDF s textovou vrstvou: přímé vytažení textu (unpdf). Sken / fotka: Tesseract (čeština + angličtina).
 * Jazyková data Tesseractu se stahují z CDN (jsDelivr) při prvním použití.
 */
export async function recognizeText(file: File, onProgress?: (p: number, label: string) => void): Promise<string> {
  const isPdf = file.type === "application/pdf" || file.name.toLowerCase().endsWith(".pdf");
  let image: Blob | HTMLCanvasElement = file;
  if (isPdf) {
    onProgress?.(0.05, "Čtu PDF…");
    const { getDocumentProxy, extractText } = await import("unpdf");
    const pdf = await getDocumentProxy(new Uint8Array(await file.arrayBuffer()));
    const { text } = await extractText(pdf, { mergePages: true });
    const t = Array.isArray(text) ? text.join("\n") : text;
    if (t.replace(/\s/g, "").length > 40) {
      onProgress?.(1, "Hotovo");
      return t;
    }
    // naskenované PDF → vykreslit první stranu a rozpoznat
    onProgress?.(0.15, "PDF je sken, vykresluji stránku…");
    const page = await pdf.getPage(1);
    const viewport = page.getViewport({ scale: 2.2 });
    const canvas = document.createElement("canvas");
    canvas.width = viewport.width;
    canvas.height = viewport.height;
    await page.render({ canvasContext: canvas.getContext("2d")!, viewport, canvas } as never).promise;
    image = canvas;
  }
  onProgress?.(0.2, "Načítám rozpoznávání textu…");
  const Tesseract = await import("tesseract.js");
  const worker = await Tesseract.createWorker(["ces", "eng"], 1, {
    logger: (m: { status: string; progress: number }) => {
      if (m.status === "recognizing text") onProgress?.(0.3 + m.progress * 0.7, "Rozpoznávám text…");
    },
  });
  try {
    const { data } = await worker.recognize(image as never);
    onProgress?.(1, "Hotovo");
    return data.text;
  } finally {
    await worker.terminate();
  }
}
