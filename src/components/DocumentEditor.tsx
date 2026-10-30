import { useRef, useState } from "react";
import { EditorContent, useEditor, useEditorState } from "@tiptap/react";
import {
  AlignLeft,
  AlignCenter,
  AlignRight,
  Bold,
  Italic,
  Underline,
  List,
  ListOrdered,
  Quote,
  Table2,
  ImagePlus,
  Undo2,
  Redo2,
  Highlighter,
  Link2,
  Minus,
  Maximize2,
  Minimize2,
  Presentation,
  Trash2,
} from "lucide-react";
import { extensions } from "../lib/tiptap";
import { plainText, wordCount, type DocumentItem } from "../lib/model";
import { imageData } from "../lib/import";
import { IconButton, Dialog } from "./UI";
export default function DocumentEditor({
  item,
  onChange,
  onConvert,
  notify,
}: {
  item: DocumentItem;
  onChange: (item: DocumentItem) => void;
  onConvert: () => void;
  notify: (message: string) => void;
}) {
  const [focus, setFocus] = useState(false),
    [zoom, setZoom] = useState(100),
    [linkOpen, setLinkOpen] = useState(false),
    [href, setHref] = useState("");
  const file = useRef<HTMLInputElement>(null),
    current = useRef(item);
  current.current = item;
  const editor = useEditor({
    extensions,
    content: item.content,
    editorProps: {
      attributes: {
        "aria-label": "Contenu du document",
        role: "textbox",
        "aria-multiline": "true",
        spellcheck: "true",
      },
    },
    onUpdate: ({ editor: ed }) =>
      onChange({ ...current.current, content: ed.getJSON() }),
  });
  const state = useEditorState({
    editor,
    selector: ({ editor: ed }) =>
      ed
        ? {
            bold: ed.isActive("bold"),
            italic: ed.isActive("italic"),
            underline: ed.isActive("underline"),
            highlight: ed.isActive("highlight"),
            bullet: ed.isActive("bulletList"),
            ordered: ed.isActive("orderedList"),
            quote: ed.isActive("blockquote"),
            align:
              ed.getAttributes("paragraph").textAlign ??
              ed.getAttributes("heading").textAlign ??
              "left",
            heading: ed.isActive("heading")
              ? ed.getAttributes("heading").level
              : "p",
            canUndo: ed.can().undo(),
            canRedo: ed.can().redo(),
            table: ed.isActive("table"),
          }
        : null,
  });
  if (!editor || !state) return <p>Ouverture du document…</p>;
  const headings = (item.content.content ?? []).filter(
    (n) => n.type === "heading",
  );
  return (
    <div className={`document-workspace ${focus ? "focus-mode" : ""}`}>
      <div
        className="format-bar"
        role="toolbar"
        aria-label="Mise en forme du document"
      >
        <div className="tool-group">
          <IconButton
            icon={Undo2}
            label="Annuler (Ctrl+Z)"
            disabled={!state.canUndo}
            onClick={() => editor.chain().focus().undo().run()}
          />
          <IconButton
            icon={Redo2}
            label="Rétablir (Ctrl+Maj+Z)"
            disabled={!state.canRedo}
            onClick={() => editor.chain().focus().redo().run()}
          />
        </div>
        <select
          aria-label="Style du paragraphe"
          value={state.heading}
          onChange={(e) =>
            e.target.value === "p"
              ? editor.chain().focus().setParagraph().run()
              : editor
                  .chain()
                  .focus()
                  .toggleHeading({ level: Number(e.target.value) as 1 | 2 | 3 })
                  .run()
          }
        >
          <option value="p">Texte normal</option>
          <option value="1">Titre 1</option>
          <option value="2">Titre 2</option>
          <option value="3">Titre 3</option>
        </select>
        <div className="tool-group">
          <IconButton
            icon={Bold}
            label="Gras (Ctrl+B)"
            active={state.bold}
            onClick={() => editor.chain().focus().toggleBold().run()}
          />
          <IconButton
            icon={Italic}
            label="Italique (Ctrl+I)"
            active={state.italic}
            onClick={() => editor.chain().focus().toggleItalic().run()}
          />
          <IconButton
            icon={Underline}
            label="Souligner (Ctrl+U)"
            active={state.underline}
            onClick={() => editor.chain().focus().toggleUnderline().run()}
          />
          <IconButton
            icon={Highlighter}
            label="Surligner"
            active={state.highlight}
            onClick={() => editor.chain().focus().toggleHighlight().run()}
          />
        </div>
        <div className="tool-group">
          <IconButton
            icon={AlignLeft}
            label="Aligner à gauche"
            active={state.align === "left"}
            onClick={() => editor.chain().focus().setTextAlign("left").run()}
          />
          <IconButton
            icon={AlignCenter}
            label="Centrer"
            active={state.align === "center"}
            onClick={() => editor.chain().focus().setTextAlign("center").run()}
          />
          <IconButton
            icon={AlignRight}
            label="Aligner à droite"
            active={state.align === "right"}
            onClick={() => editor.chain().focus().setTextAlign("right").run()}
          />
        </div>
        <div className="tool-group">
          <IconButton
            icon={List}
            label="Liste à puces"
            active={state.bullet}
            onClick={() => editor.chain().focus().toggleBulletList().run()}
          />
          <IconButton
            icon={ListOrdered}
            label="Liste numérotée"
            active={state.ordered}
            onClick={() => editor.chain().focus().toggleOrderedList().run()}
          />
          <IconButton
            icon={Quote}
            label="Citation"
            active={state.quote}
            onClick={() => editor.chain().focus().toggleBlockquote().run()}
          />
        </div>
        <div className="tool-group">
          <IconButton
            icon={Link2}
            label="Ajouter ou modifier un lien"
            onClick={() => {
              setHref(editor.getAttributes("link").href ?? "");
              setLinkOpen(true);
            }}
          />
          <IconButton
            icon={ImagePlus}
            label="Insérer une image"
            onClick={() => file.current?.click()}
          />
          <IconButton
            icon={Table2}
            label="Insérer un tableau 3 × 3"
            onClick={() =>
              editor
                .chain()
                .focus()
                .insertTable({ rows: 3, cols: 3, withHeaderRow: true })
                .run()
            }
          />
          <IconButton
            icon={Minus}
            label="Insérer une séparation"
            onClick={() => editor.chain().focus().setHorizontalRule().run()}
          />
        </div>
        <IconButton
          icon={focus ? Minimize2 : Maximize2}
          label={focus ? "Quitter le mode concentration" : "Mode concentration"}
          active={focus}
          onClick={() => setFocus(!focus)}
        />
      </div>
      {state.table && (
        <div className="context-bar">
          <span>Tableau</span>
          <button onClick={() => editor.chain().focus().addRowAfter().run()}>
            + Ligne
          </button>
          <button onClick={() => editor.chain().focus().addColumnAfter().run()}>
            + Colonne
          </button>
          <button onClick={() => editor.chain().focus().deleteRow().run()}>
            Supprimer la ligne
          </button>
          <button onClick={() => editor.chain().focus().deleteColumn().run()}>
            Supprimer la colonne
          </button>
          <IconButton
            icon={Trash2}
            label="Supprimer le tableau"
            onClick={() => editor.chain().focus().deleteTable().run()}
          />
        </div>
      )}
      <div className="document-body">
        <aside className="outline">
          <span className="eyebrow">DANS CE DOCUMENT</span>
          {headings.length ? (
            headings.map((n, i) => (
              <button
                key={i}
                className={n.attrs?.level === 1 ? "outline-title" : ""}
                onClick={() => {
                  const h = editor.view.dom.querySelectorAll("h1,h2,h3")[i];
                  h?.scrollIntoView({ block: "center", behavior: "smooth" });
                }}
              >
                {plainText(n)}
              </button>
            ))
          ) : (
            <p>Vos titres apparaîtront ici.</p>
          )}
          <div className="outline-tip">
            <Presentation size={22} />
            <h3>Une idée à partager ?</h3>
            <p>
              Transformez les sections du document en diapositives modifiables.
            </p>
            <button className="text-button" onClick={onConvert}>
              Créer une présentation <span aria-hidden="true">↗</span>
            </button>
          </div>
        </aside>
        <div className="paper-scroll">
          <div className="paper-meta">
            <span>DOCUMENT · A4</span>
            <span>À vous d’écrire</span>
          </div>
          <div className="paper" style={{ fontSize: `${zoom}%` }}>
            <EditorContent editor={editor} />
          </div>
          <p className="paper-hint">Vos idées ont de la place pour grandir.</p>
        </div>
      </div>
      <footer className="editor-status">
        <span>
          {wordCount(item.content)} mots <span className="status-dot">·</span>{" "}
          Français
        </span>
        <span className="status-middle">Mise en page continue</span>
        <label>
          Zoom{" "}
          <select
            value={zoom}
            onChange={(e) => setZoom(Number(e.target.value))}
          >
            {[80, 100, 125, 150].map((n) => (
              <option key={n} value={n}>
                {n} %
              </option>
            ))}
          </select>
        </label>
      </footer>
      <input
        ref={file}
        type="file"
        accept="image/png,image/jpeg,image/webp"
        hidden
        onChange={async (e) => {
          const f = e.target.files?.[0];
          if (f)
            try {
              editor
                .chain()
                .focus()
                .setImage({
                  src: await imageData(f),
                  alt: f.name.replace(/\.[^.]+$/, ""),
                })
                .run();
            } catch (err) {
              notify((err as Error).message);
            }
          e.target.value = "";
        }}
      />
      {linkOpen && (
        <Dialog title="Lien du texte" onClose={() => setLinkOpen(false)}>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              if (href && !/^(https?:\/\/|mailto:)/i.test(href)) {
                notify("Utilisez un lien https://, http:// ou mailto:.");
                return;
              }
              if (href)
                editor
                  .chain()
                  .focus()
                  .extendMarkRange("link")
                  .setLink({ href })
                  .run();
              else
                editor
                  .chain()
                  .focus()
                  .extendMarkRange("link")
                  .unsetLink()
                  .run();
              setLinkOpen(false);
            }}
          >
            <label className="field">
              Adresse
              <input
                autoFocus
                value={href}
                onChange={(e) => setHref(e.target.value)}
                placeholder="https://exemple.fr"
              />
            </label>
            <p className="muted">
              Laissez vide pour retirer le lien. Sélectionnez d’abord le texte à
              relier.
            </p>
            <button className="primary" type="submit">
              Appliquer
            </button>
          </form>
        </Dialog>
      )}
    </div>
  );
}
