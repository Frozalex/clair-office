// @vitest-environment jsdom
import { describe, it, expect } from "vitest";
import { safeHtml } from "../src/lib/import";
import { generateJSON } from "@tiptap/react";
import { extensions } from "../src/lib/tiptap";
describe("Untrusted document imports", () => {
  it("removes scripts, event handlers, unsafe links and remote images", () => {
    const html = safeHtml(
      '<p onclick="alert(1)">Salut</p><script>alert(1)</script><img src="https://tracker.test/pixel"><a href="javascript:alert(1)">Lien</a><iframe src="https://test.test"></iframe>',
    );
    expect(html).not.toMatch(/script|onclick|tracker|iframe/);
    expect(html).toContain("Salut");
  });
  it("retains semantic structure in the editor schema", () => {
    const json = generateJSON(
      safeHtml(
        "<h1>Titre</h1><p>Bonjour <strong>vous</strong></p><table><tr><th>Colonne</th></tr><tr><td>Valeur</td></tr></table>",
      ),
      extensions,
    );
    expect(json.content?.[0].type).toBe("heading");
    expect(JSON.stringify(json)).toContain("bold");
    expect(json.content?.[2].type).toBe("table");
  });
});
import { createPptx, createDocx } from "../src/lib/export";
import { newPresentation, newDocument } from "../src/lib/model";
import { importPptx } from "../src/lib/import-pptx";
import { importDocx } from "../src/lib/import";
import { validateOfficeZip } from "../src/lib/office-zip";
import { Blob as NodeBlob } from "node:buffer";
describe("Office file import", () => {
  it("rejects non-ZIP content before expansion", () => {
    expect(() => validateOfficeZip(new Uint8Array([1, 2, 3]).buffer)).toThrow();
  });
  it("reopens editable PowerPoint text, shapes and notes in the correct order", async () => {
    const old = globalThis.Blob;
    globalThis.Blob = NodeBlob as unknown as typeof Blob;
    try {
      const original = newPresentation("pitch");
      original.slides[1].notes = "Une note de présentation";
      const blob = await createPptx(original);
      const buffer = Uint8Array.from(
        new Uint8Array(await blob.arrayBuffer()),
      ).buffer;
      const result = await importPptx({
        name: "Mon projet.pptx",
        arrayBuffer: async () => buffer,
      } as File);
      expect(result.item.slides).toHaveLength(3);
      expect(result.item.slides[1].notes).toContain("Une note de présentation");
      expect(
        result.item.slides[0].elements
          .filter((e) => e.type === "text")
          .map((e) => e.text)
          .join(" "),
      ).toContain("De nouvelles perspectives.");
      expect(
        result.item.slides[0].elements.some((e) => e.type === "shape"),
      ).toBe(true);
    } finally {
      globalThis.Blob = old;
    }
  });
  it("reopens Word headings and rich text as an editable document", async () => {
    const old = globalThis.Blob;
    globalThis.Blob = NodeBlob as unknown as typeof Blob;
    try {
      const original = newDocument("brief");
      const blob = await createDocx(original);
      const buffer = Uint8Array.from(
        new Uint8Array(await blob.arrayBuffer()),
      ).buffer;
      const result = await importDocx({
        name: "Essai.docx",
        size: buffer.byteLength,
        arrayBuffer: async () => buffer,
      } as File);
      expect(result.content.content?.[0].type).toBe("heading");
      expect(JSON.stringify(result.content)).toContain("Les prochaines étapes");
    } finally {
      globalThis.Blob = old;
    }
  });
});
