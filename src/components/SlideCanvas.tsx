import { useRef, useState, type CSSProperties, type PointerEvent } from "react";
import type { Slide, SlideElement } from "../lib/model";
export function SlideCanvas({
  slide,
  selected,
  onSelect,
  onMove,
  editable = false,
}: {
  slide: Slide;
  selected?: string | null;
  onSelect?: (id: string | null) => void;
  onMove?: (id: string, patch: Partial<SlideElement>) => void;
  editable?: boolean;
}) {
  const canvas = useRef<HTMLDivElement>(null);
  const [drag, setDrag] = useState<{ id: string; x: number; y: number } | null>(
    null,
  );
  const start = (e: PointerEvent<HTMLDivElement>, el: SlideElement) => {
    if (!editable || e.button !== 0) return;
    e.stopPropagation();
    onSelect?.(el.id);
    const box = canvas.current!.getBoundingClientRect(),
      origin = { x: e.clientX, y: e.clientY };
    let next = { x: el.x, y: el.y };
    e.currentTarget.setPointerCapture(e.pointerId);
    const target = e.currentTarget;
    const move = (ev: globalThis.PointerEvent) => {
      next = {
        x: Math.max(
          0,
          Math.min(
            100 - el.w,
            el.x + ((ev.clientX - origin.x) / box.width) * 100,
          ),
        ),
        y: Math.max(
          0,
          Math.min(
            100 - el.h,
            el.y + ((ev.clientY - origin.y) / box.height) * 100,
          ),
        ),
      };
      setDrag({ id: el.id, ...next });
    };
    const end = () => {
      target.removeEventListener("pointermove", move);
      target.removeEventListener("pointerup", end);
      target.removeEventListener("pointercancel", cancel);
      setDrag(null);
      if (next.x !== el.x || next.y !== el.y) onMove?.(el.id, next);
    };
    const cancel = () => {
      target.removeEventListener("pointermove", move);
      target.removeEventListener("pointerup", end);
      target.removeEventListener("pointercancel", cancel);
      setDrag(null);
    };
    target.addEventListener("pointermove", move);
    target.addEventListener("pointerup", end);
    target.addEventListener("pointercancel", cancel);
  };
  return (
    <div
      className={`slide-canvas ${editable ? "editable" : ""}`}
      ref={canvas}
      style={{ background: slide.background }}
      aria-label={
        editable
          ? "Zone de composition de la diapositive"
          : "Aperçu de la diapositive"
      }
      onPointerDown={(e) => {
        if (e.target === e.currentTarget) onSelect?.(null);
      }}
    >
      {slide.elements.map((el, index) => {
        const pos = drag?.id === el.id ? drag : el;
        const style: CSSProperties = {
          left: `${pos.x}%`,
          top: `${pos.y}%`,
          width: `${el.w}%`,
          height: `${el.h}%`,
          color: el.type === "text" ? el.color : undefined,
          background: el.type === "shape" ? el.color : undefined,
          borderRadius:
            el.type === "shape" && el.shape === "ellipse" ? "50%" : undefined,
          fontSize: el.type === "text" ? `${el.fontSize / 9.6}cqw` : undefined,
          fontWeight: el.type === "text" && el.bold ? 700 : 400,
          textAlign: el.type === "text" ? el.align : undefined,
        };
        return (
          <div
            key={el.id}
            className={`slide-element ${el.type} ${editable && selected === el.id ? "selected" : ""}`}
            style={style}
            tabIndex={editable ? 0 : undefined}
            role={editable ? "button" : undefined}
            aria-label={
              editable
                ? `${el.type === "text" ? el.text.slice(0, 50) || "Texte vide" : el.type === "image" ? el.alt || "Image" : "Forme"} — élément ${index + 1}`
                : undefined
            }
            aria-pressed={editable ? selected === el.id : undefined}
            onFocus={() => editable && onSelect?.(el.id)}
            onPointerDown={(e) => start(e, el)}
            onKeyDown={(e) => {
              if (!editable) return;
              if (e.key === "Enter" || e.key === " ") {
                e.preventDefault();
                onSelect?.(el.id);
              }
              if (
                ["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight"].includes(
                  e.key,
                )
              ) {
                e.preventDefault();
                const step = e.shiftKey ? 5 : 0.5;
                onMove?.(el.id, {
                  x: Math.max(
                    0,
                    Math.min(
                      100 - el.w,
                      el.x +
                        (e.key === "ArrowRight"
                          ? step
                          : e.key === "ArrowLeft"
                            ? -step
                            : 0),
                    ),
                  ),
                  y: Math.max(
                    0,
                    Math.min(
                      100 - el.h,
                      el.y +
                        (e.key === "ArrowDown"
                          ? step
                          : e.key === "ArrowUp"
                            ? -step
                            : 0),
                    ),
                  ),
                });
              }
            }}
          >
            {el.type === "text" ? (
              el.text
            ) : el.type === "image" ? (
              <img src={el.src} alt={el.alt} draggable={false} />
            ) : null}
          </div>
        );
      })}
    </div>
  );
}
