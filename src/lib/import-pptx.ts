import {
  newPresentation,
  uid,
  textElement,
  type Slide,
  type SlideElement,
} from "./model";
import { readOfficeZip } from "./office-zip";
import type JSZip from "jszip";
const elements = (root: ParentNode, name: string) =>
  Array.from((root as Document | Element).getElementsByTagNameNS("*", name));
const first = (root: ParentNode, name: string) => elements(root, name)[0];
const number = (root: Element | undefined, attr: string, fallback: number) => {
  const value = Number(root?.getAttribute(attr));
  return root?.hasAttribute(attr) && Number.isFinite(value) ? value : fallback;
};
const clamp = (n: number, min: number, max: number) =>
  Math.max(min, Math.min(max, n));
function xml(value: string) {
  const result = new DOMParser().parseFromString(value, "application/xml");
  if (result.getElementsByTagName("parsererror").length)
    throw new Error("XML PowerPoint endommagé.");
  return result;
}
async function readXML(zip: JSZip, name: string) {
  const value = await zip.file(name)?.async("string");
  if (!value)
    throw new Error(
      "Le fichier ne contient pas les données PowerPoint attendues.",
    );
  if (value.length > 5_000_000)
    throw new Error("Une diapositive est trop volumineuse.");
  return xml(value);
}
function resolve(base: string, target: string) {
  const path: string[] = [];
  for (const p of `${base}/${target}`.split("/")) {
    if (p === "..") path.pop();
    else if (p !== "." && p) path.push(p);
  }
  return path.join("/");
}
async function rels(zip: JSZip, name: string) {
  const raw = await zip.file(name)?.async("string");
  return new Map(
    raw
      ? elements(xml(raw), "Relationship")
          .filter((e) => e.getAttribute("TargetMode") !== "External")
          .map((e) => [
            e.getAttribute("Id")!,
            {
              target: e.getAttribute("Target")!,
              type: e.getAttribute("Type")!,
            },
          ])
      : [],
  );
}
export async function importPptx(file: File) {
  const zip = await readOfficeZip(await file.arrayBuffer());
  const pres = await readXML(zip, "ppt/presentation.xml"),
    links = await rels(zip, "ppt/_rels/presentation.xml.rels");
  const ids = elements(pres, "sldId");
  if (!ids.length || ids.length > 200)
    throw new Error(
      "Une présentation doit contenir entre 1 et 200 diapositives.",
    );
  const size = first(pres, "sldSz"),
    width = number(size, "cx", 12192000),
    height = number(size, "cy", 6858000);
  if (width <= 0 || height <= 0)
    throw new Error("Dimensions de présentation invalides.");
  const warnings = new Set<string>([
    "Polices, styles de texte mélangés, masques et mises en page héritées sont simplifiés.",
  ]);
  if (Math.abs(width / height - 16 / 9) > 0.01)
    warnings.add("Le format d’origine est adapté au canevas 16:9.");
  const deck = newPresentation();
  deck.title =
    file.name.replace(/\.pptx$/i, "").slice(0, 160) || "Présentation importée";
  deck.slides = [];
  for (const id of ids) {
    const relationship = links.get(id.getAttribute("r:id") ?? "");
    if (!relationship) throw new Error("Ordre des diapositives incomplet.");
    const path = resolve("ppt", relationship.target),
      source = await readXML(zip, path),
      base = path.slice(0, path.lastIndexOf("/"));
    const related = await rels(
      zip,
      `${base}/_rels/${path.split("/").pop()}.rels`,
    );
    const background = first(source, "bg"),
      bgColor = background
        ? first(background, "srgbClr")?.getAttribute("val")
        : null;
    const slide: Slide = {
      id: uid(),
      background:
        bgColor && /^[a-f\d]{6}$/i.test(bgColor) ? `#${bgColor}` : "#FFFFFF",
      notes: "",
      elements: [],
    };
    const tree = first(source, "spTree");
    for (const shape of Array.from(tree?.children ?? [])) {
      if (["nvGrpSpPr", "grpSpPr"].includes(shape.localName)) continue;
      if (!["sp", "pic"].includes(shape.localName)) {
        warnings.add(
          "Des tableaux, groupes, graphiques ou objets complexes ne sont pas repris dans la copie modifiable.",
        );
        continue;
      }
      const xfrm = first(shape, "xfrm"),
        off = xfrm ? first(xfrm, "off") : undefined,
        ext = xfrm ? first(xfrm, "ext") : undefined;
      const box = {
        x: clamp((number(off, "x", width * 0.09) / width) * 100, 0, 98),
        y: clamp((number(off, "y", height * 0.15) / height) * 100, 0, 98),
        w: clamp((number(ext, "cx", width * 0.82) / width) * 100, 2, 100),
        h: clamp((number(ext, "cy", height * 0.3) / height) * 100, 2, 100),
      };
      if (xfrm?.hasAttribute("rot"))
        warnings.add("Les rotations sont supprimées dans la copie modifiable.");
      if (shape.localName === "pic") {
        const link = related.get(
          first(shape, "blip")?.getAttribute("r:embed") ?? "",
        );
        if (!link) {
          warnings.add("Une image liée ou externe n’a pas été importée.");
          continue;
        }
        const asset = resolve(base, link.target),
          suffix = asset.split(".").pop()?.toLowerCase();
        if (!["png", "jpg", "jpeg"].includes(suffix ?? "")) {
          warnings.add(
            "Une image utilise un format non pris en charge (seuls PNG et JPEG sont repris).",
          );
          continue;
        }
        const data = await zip.file(asset)?.async("base64");
        if (!data || data.length > 4_000_000) {
          warnings.add(
            "Une image manquante ou trop volumineuse n’a pas été importée.",
          );
          continue;
        }
        slide.elements.push({
          id: uid(),
          type: "image",
          ...box,
          src: `data:image/${suffix === "png" ? "png" : "jpeg"};base64,${data}`,
          alt: first(shape, "cNvPr")?.getAttribute("descr") ?? "Image importée",
        });
        if (first(shape, "srcRect"))
          warnings.add("Le recadrage de certaines images n’est pas repris.");
      } else {
        const body = first(shape, "txBody"),
          value = body
            ? elements(body, "p")
                .map((p) =>
                  elements(p, "t")
                    .map((t) => t.textContent ?? "")
                    .join(""),
                )
                .join("\n")
            : "";
        if (value.trim()) {
          const props = first(shape, "rPr") ?? first(shape, "defRPr"),
            color = props ? first(props, "srgbClr")?.getAttribute("val") : null;
          const fontSize = clamp(
            (number(props, "sz", 2800) / 100) * (12192000 / width),
            12,
            96,
          );
          const el = textElement(
            value.slice(0, 10000),
            box.x,
            box.y,
            box.w,
            box.h,
            fontSize,
            color && /^[a-f\d]{6}$/i.test(color) ? `#${color}` : "#223D32",
          );
          el.bold = props?.getAttribute("b") === "1";
          const align = first(shape, "pPr")?.getAttribute("algn");
          el.align =
            align === "ctr" ? "center" : align === "r" ? "right" : "left";
          slide.elements.push(el);
        } else {
          const geometry = first(shape, "prstGeom")?.getAttribute("prst"),
            color = first(shape, "solidFill")
              ? first(first(shape, "solidFill")!, "srgbClr")?.getAttribute(
                  "val",
                )
              : null;
          if (
            geometry &&
            ["rect", "ellipse", "roundRect"].includes(geometry) &&
            color &&
            /^[a-f\d]{6}$/i.test(color)
          )
            slide.elements.push({
              id: uid(),
              type: "shape",
              ...box,
              shape: geometry === "ellipse" ? "ellipse" : "rectangle",
              color: `#${color}`,
            });
          else warnings.add("Une forme décorative n’a pas été reprise.");
        }
      }
      if (slide.elements.length > 100)
        throw new Error("Une diapositive contient plus de 100 éléments.");
    }
    if (first(source, "timing") || first(source, "transition"))
      warnings.add("Les animations et transitions ne sont pas reprises.");
    const notes = [...related.values()].find((r) =>
      r.type.endsWith("/notesSlide"),
    );
    if (notes) {
      const noteXML = await readXML(zip, resolve(base, notes.target));
      slide.notes = elements(noteXML, "sp")
        .filter((s) => first(s, "ph")?.getAttribute("type") !== "sldNum")
        .flatMap((s) =>
          elements(s, "p").map((p) =>
            elements(p, "t")
              .map((t) => t.textContent ?? "")
              .join(""),
          ),
        )
        .join("\n")
        .slice(0, 20000);
    }
    deck.slides.push(slide);
  }
  return { item: deck, warnings: [...warnings] };
}
