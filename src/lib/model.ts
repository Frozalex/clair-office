import { z } from "zod";
import type { JSONContent } from "@tiptap/react";

export const uid = () => crypto.randomUUID();
export const palettes = {
  sage: {
    name: "Sauge",
    background: "#E7EDE5",
    ink: "#223D32",
    accent: "#49705B",
  },
  sand: {
    name: "Sable",
    background: "#F3EADC",
    ink: "#453B32",
    accent: "#956348",
  },
  dusk: {
    name: "Crépuscule",
    background: "#282D42",
    ink: "#F8F5EC",
    accent: "#B9B3F8",
  },
  paper: {
    name: "Papier",
    background: "#FFFFFF",
    ink: "#202B34",
    accent: "#386758",
  },
} as const;
export type Palette = keyof typeof palettes;
const color = z.string().regex(/^#[0-9a-fA-F]{6}$/);
const baseElement = {
  id: z.string().min(1).max(80),
  x: z.number().min(0).max(100),
  y: z.number().min(0).max(100),
  w: z.number().min(2).max(100),
  h: z.number().min(2).max(100),
};
export const elementSchema = z.discriminatedUnion("type", [
  z.object({
    ...baseElement,
    type: z.literal("text"),
    text: z.string().max(10000),
    fontSize: z.number().min(12).max(96),
    bold: z.boolean(),
    color,
    align: z.enum(["left", "center", "right"]),
  }),
  z.object({
    ...baseElement,
    type: z.literal("shape"),
    shape: z.enum(["rectangle", "ellipse"]),
    color,
  }),
  z.object({
    ...baseElement,
    type: z.literal("image"),
    src: z
      .string()
      .max(4000000)
      .regex(/^data:image\/(png|jpeg|webp);base64,[A-Za-z0-9+/=]+$/),
    alt: z.string().max(500),
  }),
]);
export type SlideElement = z.infer<typeof elementSchema>;
export type TextElement = Extract<SlideElement, { type: "text" }>;
const slideSchema = z.object({
  id: z.string().min(1).max(80),
  elements: z.array(elementSchema).max(100),
  notes: z.string().max(20000),
  background: color,
});
export type Slide = z.infer<typeof slideSchema>;
const supportedNodes = new Set([
  "doc",
  "paragraph",
  "text",
  "heading",
  "bulletList",
  "orderedList",
  "listItem",
  "blockquote",
  "hardBreak",
  "horizontalRule",
  "image",
  "table",
  "tableRow",
  "tableCell",
  "tableHeader",
  "codeBlock",
]);
const supportedMarks = new Set([
  "bold",
  "italic",
  "underline",
  "strike",
  "code",
  "link",
  "highlight",
]);
const contentSchema: z.ZodType<JSONContent> = z.lazy(() =>
  z.object({
    type: z.string().refine((t) => supportedNodes.has(t)),
    text: z.string().max(200000).optional(),
    attrs: z.record(z.string(), z.unknown()).optional(),
    marks: z
      .array(
        z.object({
          type: z.string().refine((t) => supportedMarks.has(t)),
          attrs: z.record(z.string(), z.unknown()).optional(),
        }),
      )
      .max(10)
      .optional(),
    content: z.array(contentSchema).max(20000).optional(),
  }),
);
const itemBase = {
  id: z.string().min(1).max(80),
  title: z.string().min(1).max(160),
  updatedAt: z.string().datetime(),
  createdAt: z.string().datetime(),
  favorite: z.boolean(),
};
export const itemSchema = z.discriminatedUnion("kind", [
  z.object({
    ...itemBase,
    kind: z.literal("document"),
    content: contentSchema.refine((n) => n.type === "doc"),
  }),
  z.object({
    ...itemBase,
    kind: z.literal("presentation"),
    slides: z.array(slideSchema).min(1).max(200),
    palette: z.enum(["sage", "sand", "dusk", "paper"]),
  }),
]);
export type OfficeItem = z.infer<typeof itemSchema>;
export type DocumentItem = Extract<OfficeItem, { kind: "document" }>;
export type PresentationItem = Extract<OfficeItem, { kind: "presentation" }>;
export const workspaceSchema = z.object({
  version: z.literal(1),
  items: z.array(itemSchema).max(200),
});
export const backupSchema = z.object({
  format: z.literal("clair-office"),
  version: z.literal(1),
  item: itemSchema,
});

export const text = (
  value: string,
  type = "paragraph",
  attrs?: Record<string, unknown>,
): JSONContent => ({
  type,
  attrs,
  content: value ? [{ type: "text", text: value }] : undefined,
});
export const plainText = (node: JSONContent): string =>
  node.text ??
  (node.content ?? [])
    .map(plainText)
    .join(
      [
        "doc",
        "bulletList",
        "orderedList",
        "listItem",
        "table",
        "tableRow",
      ].includes(node.type ?? "")
        ? "\n"
        : "",
    );
export const wordCount = (content: JSONContent) =>
  plainText(content).trim().split(/\s+/).filter(Boolean).length;
const metadata = (title: string) => ({
  id: uid(),
  title,
  favorite: false,
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
});
export function newDocument(
  template: "blank" | "brief" | "report" = "blank",
): DocumentItem {
  const titles = {
    blank: "Document sans titre",
    brief: "Une idée qui mérite de grandir",
    report: "Rapport de projet",
  };
  const content: JSONContent[] =
    template === "blank"
      ? [text("")]
      : template === "brief"
        ? [
            text("Une idée qui mérite de grandir", "heading", { level: 1 }),
            text("NOTE D’INTENTION · ÉDITION 01"),
            text(
              "Les meilleures idées commencent souvent par quelques mots. Cet espace est le vôtre : prenez le temps de leur donner une forme.",
            ),
            text("L’essentiel, simplement", "heading", { level: 2 }),
            text(
              "Quel changement souhaitez-vous créer ? Décrivez votre idée en une phrase, puis précisez à qui elle s’adresse.",
            ),
            {
              type: "blockquote",
              content: [text("Faire de la place à ce qui compte.")],
            },
            text("Les prochaines étapes", "heading", { level: 2 }),
            {
              type: "bulletList",
              content: [
                "Explorer le besoin et écouter les personnes concernées.",
                "Construire une première version utile.",
                "Tester, apprendre et améliorer.",
              ].map((t) => ({ type: "listItem", content: [text(t)] })),
            },
          ]
        : [
            text("Rapport de projet", "heading", { level: 1 }),
            text("Contexte", "heading", { level: 2 }),
            text(
              "Présentez le sujet, les objectifs et les personnes concernées.",
            ),
            text("Méthode", "heading", { level: 2 }),
            text("Expliquez votre démarche et les moyens utilisés."),
            text("Résultats", "heading", { level: 2 }),
            text("Décrivez les faits et les enseignements principaux."),
            text("Conclusion", "heading", { level: 2 }),
            text("Proposez des prochaines étapes concrètes."),
          ];
  return {
    ...metadata(titles[template]),
    kind: "document",
    content: { type: "doc", content },
  };
}
export function textElement(
  value: string,
  x = 9,
  y = 20,
  w = 82,
  h = 28,
  size = 44,
  color = "#223D32",
): TextElement {
  return {
    id: uid(),
    type: "text",
    text: value,
    x,
    y,
    w,
    h,
    fontSize: size,
    color,
    bold: size > 30,
    align: "left",
  };
}
export function newSlide(
  palette: Palette = "sage",
  layout: "title" | "content" | "blank" = "content",
): Slide {
  const p = palettes[palette];
  return {
    id: uid(),
    notes: "",
    background: p.background,
    elements:
      layout === "blank"
        ? []
        : layout === "title"
          ? [
              textElement(
                "Une idée.\nDe nouvelles perspectives.",
                9,
                24,
                82,
                44,
                54,
                p.ink,
              ),
              textElement(
                "Votre histoire commence ici.",
                9,
                76,
                82,
                10,
                22,
                p.ink,
              ),
              {
                id: uid(),
                type: "shape",
                shape: "rectangle",
                x: 9,
                y: 15,
                w: 8,
                h: 1.5 + 0.5,
                color: p.accent,
              },
            ]
          : [
              textElement(
                "Un titre qui donne le cap",
                9,
                12,
                82,
                18,
                38,
                p.ink,
              ),
              textElement(
                "Une idée forte par diapositive.\n\nAjoutez ici vos arguments, vos exemples\nou les informations à retenir.",
                9,
                38,
                82,
                45,
                24,
                p.ink,
              ),
            ],
  };
}
export function newPresentation(
  template: "blank" | "pitch" = "blank",
  palette: Palette = "sage",
): PresentationItem {
  const first = newSlide(palette, "title");
  const slides =
    template === "pitch"
      ? [first, newSlide(palette), newSlide(palette)]
      : [first];
  if (template === "pitch") {
    (slides[1].elements[0] as TextElement).text =
      "Un problème, une possibilité.";
    (slides[2].elements[0] as TextElement).text =
      "Et maintenant, passons à l’action.";
  }
  return {
    ...metadata(
      template === "pitch"
        ? "De nouvelles perspectives"
        : "Présentation sans titre",
    ),
    kind: "presentation",
    slides,
    palette,
  };
}
export function documentToSlides(doc: DocumentItem): PresentationItem {
  const result = newPresentation();
  result.title = doc.title;
  result.slides = [];
  let title = doc.title,
    body: string[] = [];
  const flush = () => {
    if (result.slides.length >= 200)
      throw new Error("Le document dépasse la limite de 200 diapositives.");
    const p = palettes.sage;
    result.slides.push({
      id: uid(),
      notes: body.join("\n"),
      background: p.background,
      elements: [
        textElement(title.slice(0, 300), 9, 12, 82, 22, 38, p.ink),
        textElement(
          body.join("\n\n").slice(0, 10000),
          9,
          38,
          82,
          52,
          22,
          p.ink,
        ),
      ],
    });
  };
  for (const node of doc.content.content ?? []) {
    if (node.type === "heading") {
      if (body.length) {
        flush();
        body = [];
      }
      title = plainText(node);
    } else {
      const t = plainText(node);
      if (t.trim()) body.push(t);
    }
  }
  if (body.length || !result.slides.length) flush();
  return result;
}
export function serializeItem(item: OfficeItem) {
  return JSON.stringify({ format: "clair-office", version: 1, item }, null, 2);
}
export function parseItem(raw: string): OfficeItem {
  if (raw.length > 12_000_000)
    throw new Error("Ce fichier dépasse la limite de 12 Mo.");
  const parsed = backupSchema.safeParse(JSON.parse(raw));
  if (!parsed.success)
    throw new Error(
      "Ce fichier Clair est invalide ou utilise une version non prise en charge.",
    );
  const item = parsed.data.item;
  return { ...item, id: uid(), updatedAt: new Date().toISOString() };
}
export function cloneItem(item: OfficeItem): OfficeItem {
  return {
    ...structuredClone(item),
    ...metadata(`${item.title.slice(0, 145)} (copie)`),
  };
}
