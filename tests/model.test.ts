import { describe, it, expect } from "vitest";
import {
  newDocument,
  newPresentation,
  documentToSlides,
  serializeItem,
  parseItem,
  cloneItem,
  wordCount,
  itemSchema,
} from "../src/lib/model";
import { loadWorkspace, saveWorkspace, STORAGE_KEY } from "../src/lib/storage";
import { imageDimensions, containedSize } from "../src/lib/image";
describe("Native documents and presentations", () => {
  it("round-trips documents without losing rich content", () => {
    const original = newDocument("brief");
    const result = parseItem(serializeItem(original));
    expect(result.id).not.toBe(original.id);
    expect(result.kind).toBe("document");
    if (result.kind === "document")
      expect(result.content).toEqual(original.content);
    expect(itemSchema.safeParse(result).success).toBe(true);
  });
  it("round-trips presentation elements and speaker notes", () => {
    const original = newPresentation("pitch");
    original.slides[1].notes = "Bonjour — 你好";
    const result = parseItem(serializeItem(original));
    if (result.kind !== "presentation") throw Error("wrong kind");
    expect(result.slides).toEqual(original.slides);
  });
  it("duplicates without sharing mutable content", () => {
    const original = newPresentation();
    const copy = cloneItem(original);
    if (copy.kind !== "presentation") throw Error("wrong kind");
    copy.slides[0].notes = "Edited";
    expect(original.slides[0].notes).toBe("");
    expect(copy.id).not.toBe(original.id);
  });
  it("converts structured sections into editable slides", () => {
    const doc = newDocument("report");
    const slides = documentToSlides(doc);
    expect(slides.slides).toHaveLength(4);
    expect(slides.slides[0].notes).toContain("Présentez");
    expect(slides.slides[3].notes).toContain("étapes");
    expect(itemSchema.safeParse(slides).success).toBe(true);
  });
  it("rejects invalid versions and malformed elements", () => {
    expect(() => parseItem('{"format":"clair-office","version":99}')).toThrow();
    const deck = newPresentation();
    (deck.slides[0].elements[0] as { x: number }).x = -500;
    expect(() => parseItem(serializeItem(deck))).toThrow();
  });
  it("counts words including list content", () => {
    expect(wordCount(newDocument("brief").content)).toBeGreaterThan(50);
  });
});
describe("Persistence failure handling", () => {
  const memory = () => {
    const data = new Map<string, string>();
    return {
      data,
      getItem: (k: string) => data.get(k) ?? null,
      setItem: (k: string, v: string) => {
        data.set(k, v);
      },
    };
  };
  it("restores all content", () => {
    const storage = memory(),
      items = [newDocument(), newPresentation()];
    expect(saveWorkspace(storage, items).ok).toBe(true);
    expect(loadWorkspace(storage).items).toEqual(items);
  });
  it("never overwrites a corrupt backup on load", () => {
    const storage = memory();
    storage.data.set(STORAGE_KEY, "broken");
    expect(loadWorkspace(storage).error).toBeTruthy();
    expect(storage.data.get(STORAGE_KEY)).toBe("broken");
  });
  it("reports quota or permission errors, without success", () => {
    const storage = {
      getItem: () => null,
      setItem: () => {
        throw Error("QuotaExceeded");
      },
    };
    expect(saveWorkspace(storage, [newDocument()]).ok).toBe(false);
  });
  it("distinguishes an empty workspace from first launch", () => {
    const storage = memory();
    saveWorkspace(storage, []);
    expect(loadWorkspace(storage).items).toEqual([]);
    expect(loadWorkspace(memory()).items).toBeNull();
  });
});
describe("Image proportions", () => {
  it("fits portrait and landscape without stretching", () => {
    expect(containedSize(1600, 900)).toEqual({ width: 480, height: 270 });
    expect(containedSize(900, 1600)).toEqual({ width: 360, height: 640 });
  });
  it("reads PNG dimensions", () => {
    const data = new Uint8Array(24),
      view = new DataView(data.buffer);
    view.setUint32(0, 0x89504e47);
    view.setUint32(16, 800);
    view.setUint32(20, 400);
    expect(imageDimensions(data)).toEqual({ width: 800, height: 400 });
  });
});
