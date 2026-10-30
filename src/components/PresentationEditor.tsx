import { useEffect, useRef, useState } from "react";
import {
  Plus,
  Copy,
  Trash2,
  Type,
  Square,
  Circle,
  ImagePlus,
  Undo2,
  Redo2,
  Play,
  ArrowUp,
  ArrowDown,
  X,
  ChevronLeft,
  ChevronRight,
  Layers,
  Bold,
  AlignLeft,
  AlignCenter,
  AlignRight,
} from "lucide-react";
import {
  palettes,
  newSlide,
  textElement,
  uid,
  type PresentationItem,
  type SlideElement,
  type Palette,
} from "../lib/model";
import { imageData } from "../lib/import";
import { useHistory } from "../lib/history";
import { IconButton, Dialog } from "./UI";
import { SlideCanvas } from "./SlideCanvas";
export default function PresentationEditor({
  item,
  onChange,
  notify,
}: {
  item: PresentationItem;
  onChange: (item: PresentationItem) => void;
  notify: (message: string) => void;
}) {
  const [index, setIndex] = useState(0),
    [selected, setSelected] = useState<string | null>(null),
    [presenting, setPresenting] = useState(false),
    [confirmDelete, setConfirmDelete] = useState(false);
  const file = useRef<HTMLInputElement>(null),
    history = useHistory(item, onChange);
  const slideIndex = Math.min(index, item.slides.length - 1),
    slide = item.slides[slideIndex],
    el = slide.elements.find((e) => e.id === selected);
  const patchSlide = (patch: Partial<typeof slide>) =>
    history.commit({
      ...item,
      slides: item.slides.map((s, i) =>
        i === slideIndex ? { ...s, ...patch } : s,
      ),
    });
  const patchElement = (id: string, patch: Partial<SlideElement>) =>
    patchSlide({
      elements: slide.elements.map((e) =>
        e.id === id ? ({ ...e, ...patch } as SlideElement) : e,
      ),
    });
  const addElement = (e: SlideElement) => {
    if (slide.elements.length >= 100) {
      notify("Limite de 100 éléments par diapositive.");
      return;
    }
    patchSlide({ elements: [...slide.elements, e] });
    setSelected(e.id);
  };
  const insertSlide = (duplicate = false) => {
    if (item.slides.length >= 200) {
      notify("Limite de 200 diapositives atteinte.");
      return;
    }
    const next = duplicate
      ? {
          ...structuredClone(slide),
          id: uid(),
          elements: slide.elements.map((e) => ({ ...e, id: uid() })),
        }
      : newSlide(item.palette);
    history.commit({
      ...item,
      slides: [
        ...item.slides.slice(0, slideIndex + 1),
        next,
        ...item.slides.slice(slideIndex + 1),
      ],
    });
    setIndex(slideIndex + 1);
    setSelected(null);
  };
  const reorder = (direction: number) => {
    const target = slideIndex + direction;
    if (target < 0 || target >= item.slides.length) return;
    const slides = [...item.slides];
    [slides[target], slides[slideIndex]] = [slides[slideIndex], slides[target]];
    history.commit({ ...item, slides });
    setIndex(target);
  };
  useEffect(() => {
    if (!presenting) return;
    const keyboard = (e: KeyboardEvent) => {
      if (e.key === "Escape") setPresenting(false);
      if (["ArrowRight", "ArrowDown", " "].includes(e.key)) {
        e.preventDefault();
        setIndex((i) => Math.min(item.slides.length - 1, i + 1));
      }
      if (["ArrowLeft", "ArrowUp"].includes(e.key)) {
        e.preventDefault();
        setIndex((i) => Math.max(0, i - 1));
      }
      if (e.key === "Home") setIndex(0);
      if (e.key === "End") setIndex(item.slides.length - 1);
    };
    window.addEventListener("keydown", keyboard);
    return () => window.removeEventListener("keydown", keyboard);
  }, [presenting, item.slides.length]);
  useEffect(() => {
    const listener = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement;
      if (
        target.closest('input,textarea,[contenteditable="true"]') ||
        presenting
      )
        return;
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "z") {
        e.preventDefault();
        e.shiftKey ? history.redo() : history.undo();
      }
    };
    window.addEventListener("keydown", listener);
    return () => window.removeEventListener("keydown", listener);
  });
  return (
    <div className="presentation-workspace">
      <div
        className="format-bar"
        role="toolbar"
        aria-label="Outils de présentation"
      >
        <div className="tool-group">
          <IconButton
            icon={Undo2}
            label="Annuler"
            disabled={!history.canUndo}
            onClick={history.undo}
          />
          <IconButton
            icon={Redo2}
            label="Rétablir"
            disabled={!history.canRedo}
            onClick={history.redo}
          />
        </div>
        <button className="toolbar-action" onClick={() => insertSlide()}>
          <Plus size={17} />
          Diapositive
        </button>
        <div className="tool-group">
          <button
            className="toolbar-action"
            onClick={() =>
              addElement(
                textElement(
                  "Votre texte",
                  12,
                  40,
                  65,
                  20,
                  28,
                  palettes[item.palette].ink,
                ),
              )
            }
          >
            <Type size={18} />
            Texte
          </button>
          <IconButton
            icon={Square}
            label="Ajouter un rectangle"
            onClick={() =>
              addElement({
                id: uid(),
                type: "shape",
                shape: "rectangle",
                x: 30,
                y: 30,
                w: 30,
                h: 30,
                color: palettes[item.palette].accent,
              })
            }
          />
          <IconButton
            icon={Circle}
            label="Ajouter un cercle"
            onClick={() =>
              addElement({
                id: uid(),
                type: "shape",
                shape: "ellipse",
                x: 30,
                y: 30,
                w: 22.5,
                h: 40,
                color: palettes[item.palette].accent,
              })
            }
          />
          <IconButton
            icon={ImagePlus}
            label="Ajouter une image"
            onClick={() => file.current?.click()}
          />
        </div>
        <span className="toolbar-spacer" />
        <button className="primary small" onClick={() => setPresenting(true)}>
          <Play size={15} />
          Présenter
        </button>
      </div>
      <div className="slides-body">
        <aside className="slide-list" aria-label="Diapositives">
          <div className="panel-label">
            <span>DIAPOSITIVES</span>
            <span>{item.slides.length}</span>
          </div>
          {item.slides.map((s, i) => (
            <button
              key={s.id}
              className={`slide-thumbnail ${i === slideIndex ? "active" : ""}`}
              onClick={() => {
                setIndex(i);
                setSelected(null);
              }}
              aria-label={`Diapositive ${i + 1}`}
              aria-current={i === slideIndex ? "true" : undefined}
            >
              <span>{String(i + 1).padStart(2, "0")}</span>
              <SlideCanvas slide={s} />
            </button>
          ))}
          <button className="add-slide" onClick={() => insertSlide()}>
            <Plus size={16} />
            Ajouter
          </button>
          <div className="slide-list-tools">
            <IconButton
              icon={Copy}
              label="Dupliquer la diapositive"
              onClick={() => insertSlide(true)}
            />
            <IconButton
              icon={ArrowUp}
              label="Monter la diapositive"
              disabled={slideIndex === 0}
              onClick={() => reorder(-1)}
            />
            <IconButton
              icon={ArrowDown}
              label="Descendre la diapositive"
              disabled={slideIndex === item.slides.length - 1}
              onClick={() => reorder(1)}
            />
            <IconButton
              icon={Trash2}
              label="Supprimer la diapositive"
              disabled={item.slides.length === 1}
              onClick={() => setConfirmDelete(true)}
            />
          </div>
        </aside>
        <div className="slide-stage">
          <div className="stage-caption">
            <span>DIAPOSITIVE {String(slideIndex + 1).padStart(2, "0")}</span>
            <span>16:9 · Grand écran</span>
          </div>
          <SlideCanvas
            slide={slide}
            selected={selected}
            onSelect={setSelected}
            onMove={patchElement}
            editable
          />
          <p className="canvas-help">
            Sélectionnez un élément pour le modifier. Déplacez-le à la souris ou
            avec les flèches.
          </p>
          <label className="speaker-notes">
            <span>NOTES DE PRÉSENTATION</span>
            <textarea
              value={slide.notes}
              placeholder="Un repère pour votre prise de parole…"
              onChange={(e) => patchSlide({ notes: e.target.value })}
              maxLength={20000}
            />
          </label>
        </div>
        <aside className="inspector">
          <div className="panel-label">
            <span>{el ? "ÉLÉMENT" : "APPARENCE"}</span>
            <Layers size={15} />
          </div>
          {el ? (
            <>
              <button className="text-button" onClick={() => setSelected(null)}>
                ← Retour au thème
              </button>
              {el.type === "text" && (
                <>
                  <label className="field">
                    Texte
                    <textarea
                      aria-label="Texte de l’élément"
                      value={el.text}
                      onChange={(e) =>
                        patchElement(el.id, { text: e.target.value })
                      }
                      maxLength={10000}
                      rows={6}
                    />
                  </label>
                  <div className="two-fields">
                    <label className="field">
                      Taille
                      <input
                        type="number"
                        min={12}
                        max={96}
                        value={el.fontSize}
                        onChange={(e) =>
                          patchElement(el.id, {
                            fontSize: Math.min(
                              96,
                              Math.max(12, Number(e.target.value)),
                            ),
                          })
                        }
                      />
                    </label>
                    <label className="field">
                      Couleur
                      <input
                        type="color"
                        value={el.color}
                        onChange={(e) =>
                          patchElement(el.id, { color: e.target.value })
                        }
                      />
                    </label>
                  </div>
                  <div className="inspector-tools">
                    <IconButton
                      icon={Bold}
                      label="Gras"
                      active={el.bold}
                      onClick={() => patchElement(el.id, { bold: !el.bold })}
                    />
                    {(
                      [
                        ["left", AlignLeft],
                        ["center", AlignCenter],
                        ["right", AlignRight],
                      ] as const
                    ).map(([align, icon]) => (
                      <IconButton
                        key={align}
                        icon={icon}
                        label={`Alignement ${align === "left" ? "gauche" : align === "right" ? "droite" : "centré"}`}
                        active={el.align === align}
                        onClick={() => patchElement(el.id, { align })}
                      />
                    ))}
                  </div>
                </>
              )}
              {el.type === "shape" && (
                <label className="field">
                  Couleur de la forme
                  <input
                    type="color"
                    value={el.color}
                    onChange={(e) =>
                      patchElement(el.id, { color: e.target.value })
                    }
                  />
                </label>
              )}
              {el.type === "image" && (
                <label className="field">
                  Description de l’image
                  <input
                    value={el.alt}
                    onChange={(e) =>
                      patchElement(el.id, { alt: e.target.value })
                    }
                    maxLength={500}
                  />
                </label>
              )}
              <div className="two-fields">
                {(["x", "y", "w", "h"] as const).map((key) => (
                  <label key={key} className="field">
                    {
                      {
                        x: "Position X",
                        y: "Position Y",
                        w: "Largeur",
                        h: "Hauteur",
                      }[key]
                    }{" "}
                    (%)
                    <input
                      type="number"
                      min={key === "w" || key === "h" ? 2 : 0}
                      max={100}
                      step={0.5}
                      value={Number(el[key].toFixed(1))}
                      onChange={(e) =>
                        patchElement(el.id, {
                          [key]: Math.min(
                            100,
                            Math.max(
                              key === "w" || key === "h" ? 2 : 0,
                              Number(e.target.value),
                            ),
                          ),
                        })
                      }
                    />
                  </label>
                ))}
              </div>
              <div className="stack">
                <button
                  className="secondary"
                  onClick={() => {
                    const elements = slide.elements.filter(
                      (e) => e.id !== el.id,
                    );
                    patchSlide({ elements: [...elements, el] });
                  }}
                >
                  Placer au premier plan
                </button>
                <button
                  className="secondary"
                  onClick={() => {
                    const elements = slide.elements.filter(
                      (e) => e.id !== el.id,
                    );
                    patchSlide({ elements: [el, ...elements] });
                  }}
                >
                  Placer à l’arrière-plan
                </button>
                <button
                  className="danger-text"
                  onClick={() => {
                    patchSlide({
                      elements: slide.elements.filter((e) => e.id !== el.id),
                    });
                    setSelected(null);
                  }}
                >
                  <Trash2 size={15} />
                  Supprimer l’élément
                </button>
              </div>
            </>
          ) : (
            <>
              <h3>Une ambiance, votre style.</h3>
              <p className="muted">
                Le thème s’applique aux couleurs du fond et du texte de toute la
                présentation.
              </p>
              <div className="palette-grid">
                {(Object.keys(palettes) as Palette[]).map((key) => (
                  <button
                    key={key}
                    className={`palette ${item.palette === key ? "active" : ""}`}
                    onClick={() => {
                      const old = palettes[item.palette],
                        next = palettes[key];
                      history.commit({
                        ...item,
                        palette: key,
                        slides: item.slides.map((s) => ({
                          ...s,
                          background:
                            s.background === old.background
                              ? next.background
                              : s.background,
                          elements: s.elements.map((e) =>
                            e.type !== "image"
                              ? {
                                  ...e,
                                  color:
                                    e.color === old.ink
                                      ? next.ink
                                      : e.color === old.accent
                                        ? next.accent
                                        : e.color,
                                }
                              : e,
                          ),
                        })),
                      });
                    }}
                  >
                    <span
                      style={{
                        background: palettes[key].background,
                        color: palettes[key].ink,
                      }}
                    >
                      Aa
                    </span>
                    {palettes[key].name}
                  </button>
                ))}
              </div>
              <label className="field">
                Fond de cette diapositive
                <input
                  type="color"
                  value={slide.background}
                  onChange={(e) => patchSlide({ background: e.target.value })}
                />
              </label>
              <div className="inspector-tip">
                Un message clair, un titre court, de l’espace pour respirer.
              </div>
            </>
          )}
        </aside>
      </div>
      <footer className="editor-status">
        <span>
          Diapositive {slideIndex + 1} sur {item.slides.length}
        </span>
        <span>{slide.elements.length} éléments</span>
        <span>Flèches : déplacer · Maj : accélérer</span>
      </footer>
      <input
        type="file"
        hidden
        ref={file}
        accept="image/png,image/jpeg,image/webp"
        onChange={async (e) => {
          const f = e.target.files?.[0];
          if (f)
            try {
              addElement({
                id: uid(),
                type: "image",
                src: await imageData(f),
                alt: f.name.replace(/\.[^.]+$/, ""),
                x: 20,
                y: 20,
                w: 60,
                h: 60,
              });
            } catch (error) {
              notify((error as Error).message);
            }
          e.target.value = "";
        }}
      />
      {confirmDelete && (
        <Dialog
          title="Supprimer cette diapositive ?"
          onClose={() => setConfirmDelete(false)}
        >
          <p>Vous pourrez annuler cette action dans l’éditeur.</p>
          <div className="dialog-actions">
            <button
              className="secondary"
              onClick={() => setConfirmDelete(false)}
            >
              Conserver
            </button>
            <button
              className="danger"
              onClick={() => {
                history.commit({
                  ...item,
                  slides: item.slides.filter((_, i) => i !== slideIndex),
                });
                setIndex(Math.max(0, slideIndex - 1));
                setSelected(null);
                setConfirmDelete(false);
              }}
            >
              Supprimer
            </button>
          </div>
        </Dialog>
      )}
      {presenting && (
        <Dialog title="Présentation" wide onClose={() => setPresenting(false)}>
          <div className="presenter">
            <SlideCanvas slide={slide} />
            <div className="presenter-controls">
              <IconButton
                icon={ChevronLeft}
                label="Diapositive précédente"
                disabled={!slideIndex}
                onClick={() => setIndex(slideIndex - 1)}
              />
              <span aria-live="polite">
                {slideIndex + 1} / {item.slides.length}
              </span>
              <IconButton
                icon={ChevronRight}
                label="Diapositive suivante"
                disabled={slideIndex === item.slides.length - 1}
                onClick={() => setIndex(slideIndex + 1)}
              />
              <IconButton
                icon={X}
                label="Quitter la présentation"
                onClick={() => setPresenting(false)}
              />
            </div>
            <details>
              <summary>Afficher mes notes</summary>
              <p className="presenter-notes">
                {slide.notes || "Aucune note pour cette diapositive."}
              </p>
            </details>
          </div>
        </Dialog>
      )}
      <div className="print-slides">
        {item.slides.map((s) => (
          <div className="print-slide" key={s.id}>
            <SlideCanvas slide={s} />
          </div>
        ))}
      </div>
    </div>
  );
}
