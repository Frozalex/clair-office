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
  it("preserves raster bytes and aspect ratio in both Office formats", async () => {
    const png =
      "iVBORw0KGgoAAAANSUhEUgAAAAIAAAABCAIAAAB7QOjdAAAAD0lEQVR4nGP4z8DA8J8BAAf/Af8Bf4mnAAAAAElFTkSuQmCC";
    const src = `data:image/png;base64,${png}`;
    const doc = newDocument();
    doc.content.content!.push({
      type: "image",
      attrs: { src, alt: "Deux pixels" },
    });
    const doczip = await JSZip.loadAsync(
      await (await createDocx(doc)).arrayBuffer(),
    );
    const media = Object.keys(doczip.files).find(
      (n) => n.startsWith("word/media/") && n.endsWith(".png"),
    )!;
    expect(await doczip.file(media)!.async("base64")).toBe(png);
    const deck = newPresentation();
    deck.slides[0].elements = [
      {
        id: "image",
        type: "image",
        src,
        alt: "Deux pixels",
        x: 10,
        y: 10,
        w: 40,
        h: 40,
      },
    ];
    const zip = await JSZip.loadAsync(
      await (await createPptx(deck)).arrayBuffer(),
    );
    const xml = await zip.file("ppt/slides/slide1.xml")!.async("text");
    const dimensions = xml
      .slice(xml.indexOf("<p:pic>"))
      .match(/<a:ext cx="(\d+)" cy="(\d+)"/)!;
    expect(Number(dimensions[1]) / Number(dimensions[2])).toBeCloseTo(2, 4);
    const asset = Object.keys(zip.files).find(
      (n) => n.startsWith("ppt/media/") && n.endsWith(".png"),
    )!;
    expect(await zip.file(asset)!.async("base64")).toBe(png);
  });
});
