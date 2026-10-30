import DOMPurify from "dompurify";
import type { JSONContent } from "@tiptap/react";
import { generateJSON } from "@tiptap/react";
import { extensions } from "./tiptap";
import { validateOfficeZip } from "./office-zip";
export function safeHtml(html: string): string {
  const cleaned = DOMPurify.sanitize(html, {
    USE_PROFILES: { html: true },
    FORBID_TAGS: [
      "style",
      "script",
      "iframe",
      "object",
      "form",
      "input",
      "button",
      "video",
      "audio",
    ],
    FORBID_ATTR: ["style", "srcset"],
  });
  const root = new DOMParser().parseFromString(cleaned, "text/html");
  root.querySelectorAll("img").forEach((img) => {
    if (!/^data:image\/(png|jpeg|webp);base64,/i.test(img.src)) img.remove();
  });
  return root.body.innerHTML;
}
export async function importDocx(
  file: File,
): Promise<{ content: JSONContent; warnings: number }> {
  if (file.size > 8_000_000)
    throw new Error("Import DOCX limité à 8 Mo dans cette version.");
  const { default: mammoth } = await import("mammoth/mammoth.browser.js");
  const arrayBuffer = await file.arrayBuffer();
  validateOfficeZip(arrayBuffer);
  const result = await mammoth.convertToHtml({ arrayBuffer });
  return {
    content: generateJSON(safeHtml(result.value), extensions),
    warnings: result.messages.length,
  };
}
export async function imageData(file: File): Promise<string> {
  if (!["image/png", "image/jpeg", "image/webp"].includes(file.type))
    throw new Error("Choisissez une image PNG, JPEG ou WebP.");
  if (file.size > 2_500_000)
    throw new Error("Choisissez une image de moins de 2,5 Mo.");
  const data = await new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(new Error("Impossible de lire cette image."));
    reader.readAsDataURL(file);
  });
  if (file.type !== "image/webp") return data;
  const bitmap = await createImageBitmap(file);
  const canvas = document.createElement("canvas");
  canvas.width = bitmap.width;
  canvas.height = bitmap.height;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Conversion de l’image indisponible.");
  ctx.drawImage(bitmap, 0, 0);
  bitmap.close();
  const converted = canvas.toDataURL("image/png");
  if (converted.length > 4_000_000)
    throw new Error(
      "L’image est trop grande après conversion PNG. Réduisez sa résolution.",
    );
  return converted;
}
