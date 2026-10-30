import { describe, it, expect } from "vitest";
import JSZip from "jszip";
import { createDocx, createPptx } from "../src/lib/export";
import { newDocument, newPresentation } from "../src/lib/model";
import { writeFileSync, mkdirSync } from "node:fs";
const out = "/tmp/clair-office-fixtures";
mkdirSync(out, { recursive: true });
describe("Office exports are valid editable OOXML packages", () => {
  it("writes headings, lists, emphasis and metadata in DOCX", async () => {
    const doc = newDocument("brief");
    doc.content.content!.push({
      type: "paragraph",
      content: [
        {
          type: "text",
          text: "Texte accentué échec & succès",
          marks: [{ type: "bold" }],
        },
      ],
    });
    const blob = await createDocx(doc),
      bytes = await blob.arrayBuffer();
    const zip = await JSZip.loadAsync(bytes);
    const xml = await zip.file("word/document.xml")!.async("text");
    expect(xml).toContain("Heading1");
    expect(xml).toContain("w:numPr");
    expect(xml).toContain("Texte accentué échec &amp; succès");
    expect(xml).toContain("<w:b");
    expect(await zip.file("docProps/core.xml")!.async("text")).toContain(
      doc.title,
    );
    writeFileSync(`${out}/document.docx`, new Uint8Array(bytes));
  });
  it("writes every slide, editable shapes, positions and notes in PPTX", async () => {
    const deck = newPresentation("pitch");
    deck.slides[1].notes = "Un repère pour parler.";
    const blob = await createPptx(deck),
      bytes = await blob.arrayBuffer();
    const zip = await JSZip.loadAsync(bytes);
    expect(
      Object.keys(zip.files).filter((n) =>
        /^ppt\/slides\/slide\d+\.xml$/.test(n),
      ),
    ).toHaveLength(3);
    const xml = await zip.file("ppt/slides/slide1.xml")!.async("text");
    expect(xml).toContain("De nouvelles perspectives.");
    expect(xml).toContain("p:sp");
    expect(xml).toContain("E7EDE5");
    expect(xml).toContain("a:off");
    expect(
      await zip.file("ppt/notesSlides/notesSlide2.xml")!.async("text"),
    ).toContain("Un repère pour parler.");
    writeFileSync(`${out}/presentation.pptx`, new Uint8Array(bytes));
  });
});
