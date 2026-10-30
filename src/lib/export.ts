import type { JSONContent } from "@tiptap/react";
import type { DocumentItem, PresentationItem } from "./model";
import { plainText } from "./model";
import { imageDimensions, containedSize } from "./image";

export async function createDocx(item: DocumentItem): Promise<Blob> {
  const d = await import("docx");
  const inline = (
    node: JSONContent,
  ): (
    | InstanceType<typeof d.TextRun>
    | InstanceType<typeof d.ExternalHyperlink>
    | InstanceType<typeof d.ImageRun>
  )[] => {
    if (node.type === "text") {
      const marks = node.marks ?? [];
      const run = new d.TextRun({
        text: node.text ?? "",
        bold: marks.some((m) => m.type === "bold"),
        italics: marks.some((m) => m.type === "italic"),
        strike: marks.some((m) => m.type === "strike"),
        underline: marks.some((m) => m.type === "underline") ? {} : undefined,
        highlight: marks.some((m) => m.type === "highlight")
          ? "yellow"
          : undefined,
        font: marks.some((m) => m.type === "code") ? "Courier New" : undefined,
      });
      const link = marks.find((m) => m.type === "link")?.attrs?.href;
      if (typeof link === "string" && /^(https?:|mailto:)/i.test(link))
        return [new d.ExternalHyperlink({ children: [run], link })];
      return [run];
    }
    if (node.type === "hardBreak") return [new d.TextRun({ break: 1 })];
    if (node.type === "image") {
      const src = String(node.attrs?.src ?? ""),
        match = src.match(/^data:image\/(png|jpeg);base64,(.+)$/);
      if (!match)
        return [
          new d.TextRun({
            text: `[Image : ${node.attrs?.alt ?? "illustration"}]`,
          }),
        ];
      const bytes = Uint8Array.from(atob(match[2]), (c) => c.charCodeAt(0));
      const dimensions = imageDimensions(bytes);
      return [
        new d.ImageRun({
          type: match[1] === "jpeg" ? "jpg" : "png",
          data: bytes,
          transformation: containedSize(dimensions.width, dimensions.height),
          altText: {
            title: String(node.attrs?.alt ?? ""),
            description: String(node.attrs?.alt ?? ""),
            name: "image",
          },
        }),
      ];
    }
    return (node.content ?? []).flatMap(inline);
  };
  let sequence = 0;
  const numbering: {
    reference: string;
    levels: {
      level: number;
      format: "decimal";
      text: string;
      alignment: "start";
      style: { paragraph: { indent: { left: number; hanging: number } } };
    }[];
  }[] = [];
  const blocks = (
    nodes: JSONContent[],
    depth = 0,
  ): (InstanceType<typeof d.Paragraph> | InstanceType<typeof d.Table>)[] =>
    nodes.flatMap((node) => {
      if (node.type === "bulletList" || node.type === "orderedList") {
        const reference = `list-${sequence++}`;
        if (node.type === "orderedList")
          numbering.push({
            reference,
            levels: [
              {
                level: 0,
                format: "decimal",
                text: "%1.",
                alignment: "start",
                style: { paragraph: { indent: { left: 720, hanging: 260 } } },
              },
            ],
          });
        return (node.content ?? []).flatMap((li) =>
          (li.content ?? []).flatMap((p, i) =>
            p.type === "bulletList" || p.type === "orderedList"
              ? blocks([p], depth + 1)
              : [
                  new d.Paragraph({
                    children: inline(p),
                    bullet:
                      node.type === "bulletList" && i === 0
                        ? { level: Math.min(depth, 8) }
                        : undefined,
                    numbering:
                      node.type === "orderedList" && i === 0
                        ? { reference, level: 0 }
                        : undefined,
                    spacing: { after: 100 },
                  }),
                ],
          ),
        );
      }
      if (node.type === "table")
        return [
          new d.Table({
            width: { size: 100, type: d.WidthType.PERCENTAGE },
            rows: (node.content ?? []).map(
              (row) =>
                new d.TableRow({
                  children: (row.content ?? []).map(
                    (cell) =>
                      new d.TableCell({
                        children: blocks(cell.content ?? []),
                        shading:
                          cell.type === "tableHeader"
                            ? { fill: "E7EDE5" }
                            : undefined,
                      }),
                  ),
                }),
            ),
          }),
        ];
      if (node.type === "blockquote")
        return [
          new d.Paragraph({
            children: inline(node),
            indent: { left: 480 },
            border: {
              left: {
                color: "49705B",
                size: 18,
                style: d.BorderStyle.SINGLE,
                space: 12,
              },
            },
            spacing: { after: 200 },
          }),
        ];
      const align = String(node.attrs?.textAlign ?? "left");
      return [
        new d.Paragraph({
          children: inline(node),
          alignment:
            align === "center"
              ? d.AlignmentType.CENTER
              : align === "right"
                ? d.AlignmentType.RIGHT
                : align === "justify"
                  ? d.AlignmentType.JUSTIFIED
                  : d.AlignmentType.LEFT,
          heading:
            node.type === "heading"
              ? [
                  d.HeadingLevel.HEADING_1,
                  d.HeadingLevel.HEADING_2,
                  d.HeadingLevel.HEADING_3,
                ][Math.max(0, Math.min(2, Number(node.attrs?.level ?? 1) - 1))]
              : undefined,
          spacing: { after: 200, line: 420 },
          border:
            node.type === "horizontalRule"
              ? {
                  bottom: {
                    color: "49705B",
                    size: 6,
                    style: d.BorderStyle.SINGLE,
                  },
                }
              : undefined,
        }),
      ];
    });
  const children = blocks(item.content.content ?? []);
  const file = new d.Document({
    creator: "Clair Office",
    title: item.title,
    description: "Créé avec Clair Office",
    styles: {
      default: {
        document: { run: { font: "Georgia", size: 24, color: "2B3930" } },
        heading1: {
          run: { font: "Georgia", size: 54, color: "2B3930", bold: false },
          paragraph: { spacing: { before: 0, after: 360, line: 640 } },
        },
        heading2: {
          run: { font: "Arial", size: 28, color: "2B3930", bold: true },
          paragraph: { spacing: { before: 360, after: 200 } },
        },
        heading3: {
          run: { font: "Arial", size: 26, color: "2B3930", bold: true },
        },
      },
    },
    numbering: { config: numbering },
    sections: [
      {
        properties: {
          page: {
            size: { width: 11906, height: 16838 },
            margin: { top: 1134, right: 1134, bottom: 1134, left: 1134 },
          },
        },
        children,
      },
    ],
  });
  return d.Packer.toBlob(file);
}

export async function createPptx(item: PresentationItem): Promise<Blob> {
  const { default: PptxGenJS } = await import("pptxgenjs");
  const pptx = new PptxGenJS();
  pptx.layout = "LAYOUT_WIDE";
  pptx.author = "Clair Office";
  pptx.subject = item.title;
  pptx.title = item.title;
  for (const source of item.slides) {
    const slide = pptx.addSlide();
    slide.background = { color: source.background.slice(1) };
    slide.addNotes(source.notes);
    for (const el of source.elements) {
      const box = {
        x: (el.x / 100) * 13.333333,
        y: (el.y / 100) * 7.5,
        w: (el.w / 100) * 13.333333,
        h: (el.h / 100) * 7.5,
      };
      if (el.type === "text")
        slide.addText(el.text, {
          ...box,
          fontFace: "Arial",
          fontSize: el.fontSize,
          color: el.color.slice(1),
          bold: el.bold,
          align: el.align,
          valign: "top",
          margin: 0,
          breakLine: false,
          paraSpaceAfter: 0,
          lang: "fr-FR",
        });
      else if (el.type === "shape")
        slide.addShape(
          el.shape === "ellipse" ? pptx.ShapeType.ellipse : pptx.ShapeType.rect,
          {
            ...box,
            fill: { color: el.color.slice(1) },
            line: { color: el.color.slice(1), transparency: 100 },
          },
        );
      else
        slide.addImage({
          data: el.src,
          ...box,
          altText: el.alt,
          sizing: { type: "contain", w: box.w, h: box.h },
        });
    }
  }
  return (await pptx.write({ outputType: "blob" })) as Blob;
}
export const createText = (item: DocumentItem) =>
  new Blob([plainText(item.content)], { type: "text/plain;charset=utf-8" });
