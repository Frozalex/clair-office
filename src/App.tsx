import { lazy, Suspense, useEffect, useRef, useState } from "react";
import {
  FileText,
  Presentation,
  Search,
  Plus,
  Upload,
  ArrowUpRight,
  Star,
  FolderOpen,
  Moon,
  Sun,
  HelpCircle,
  ArrowLeft,
  Download,
  Check,
  MoreHorizontal,
  Copy,
  Trash2,
  ArrowRightLeft,
  ShieldCheck,
  X,
  Menu,
} from "lucide-react";
import { Brand, Dialog, IconButton } from "./components/UI";
import { SlideCanvas } from "./components/SlideCanvas";
import {
  newDocument,
  newPresentation,
  cloneItem,
  documentToSlides,
  plainText,
  serializeItem,
  parseItem,
  type OfficeItem,
} from "./lib/model";
import {
  loadWorkspace,
  saveWorkspace,
  download,
  filename,
  STORAGE_KEY,
} from "./lib/storage";
const DocumentEditor = lazy(() => import("./components/DocumentEditor"));
const PresentationEditor = lazy(
  () => import("./components/PresentationEditor"),
);
const ImportDialog = lazy(() => import("./components/ImportDialog"));
const ConversionDialog = lazy(() => import("./components/ConversionDialog"));
const date = (value: string) =>
  new Intl.DateTimeFormat("fr-FR", { day: "numeric", month: "short" }).format(
    new Date(value),
  );
const initial = () => {
  try {
    return loadWorkspace(localStorage);
  } catch {
    return {
      items: [] as OfficeItem[],
      error:
        "Le stockage local est indisponible. Exportez vos fichiers pour les conserver.",
    };
  }
};
export default function App() {
  const [loaded] = useState(initial);
  const [officeImport, setOfficeImport] = useState<File | null>(null),
    [conversionFile, setConversionFile] = useState<File | null>(null);
  const [items, setItems] = useState<OfficeItem[]>(
    loaded.items ?? [
      newDocument("brief"),
      newPresentation("pitch"),
      newDocument("report"),
    ],
  );
  const [activeId, setActiveId] = useState<string | null>(null),
    [filter, setFilter] = useState("all"),
    [search, setSearch] = useState(""),
    [createOpen, setCreateOpen] = useState(false),
    [help, setHelp] = useState(false),
    [command, setCommand] = useState(false),
    [conversion, setConversion] = useState(false),
    [deleteId, setDeleteId] = useState<string | null>(null),
    [toast, setToast] = useState(""),
    [storageError, setStorageError] = useState(loaded.error ?? ""),
    [readBlocked, setReadBlocked] = useState(!!loaded.error),
    [saved, setSaved] = useState(false),
    [busy, setBusy] = useState(false),
    [mobileNav, setMobileNav] = useState(false);
  const [dark, setDark] = useState(() => {
    try {
      return localStorage.getItem("clair-office.theme") === "dark";
    } catch {
      return false;
    }
  });
  const importInput = useRef<HTMLInputElement>(null),
    latest = useRef(items);
  latest.current = items;
  const active = items.find((i) => i.id === activeId);
  const notify = (message: string) => setToast(message);
  useEffect(() => {
    document.documentElement.dataset.theme = dark ? "dark" : "light";
    try {
      localStorage.setItem("clair-office.theme", dark ? "dark" : "light");
    } catch {
      /* The workspace banner reports unavailable storage. */
    }
  }, [dark]);
  useEffect(() => {
    if (readBlocked) return;
    setSaved(false);
    const timer = window.setTimeout(() => {
      const result = saveWorkspace(localStorage, items);
      setSaved(result.ok);
      setStorageError(result.error ?? "");
    }, 200);
    return () => window.clearTimeout(timer);
  }, [items, readBlocked]);
  useEffect(() => {
    const persist = () => {
      if (!readBlocked) saveWorkspace(localStorage, latest.current);
    };
    window.addEventListener("pagehide", persist);
    return () => {
      persist();
      window.removeEventListener("pagehide", persist);
    };
  }, [readBlocked]);
  useEffect(() => {
    if (!toast) return;
    const timer = window.setTimeout(() => setToast(""), 6500);
    return () => window.clearTimeout(timer);
  }, [toast]);
  useEffect(() => {
    const shortcuts = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setCommand((v) => !v);
      }
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "s") {
        e.preventDefault();
        if (active) backup(active);
      }
    };
    window.addEventListener("keydown", shortcuts);
    return () => window.removeEventListener("keydown", shortcuts);
  });
  const update = (item: OfficeItem) =>
    setItems((old) =>
      old.map((i) =>
        i.id === item.id ? { ...item, updatedAt: new Date().toISOString() } : i,
      ),
    );
  const add = (item: OfficeItem) => {
    if (items.length >= 200) {
      notify(
        "Limite de 200 fichiers atteinte. Exportez puis supprimez des fichiers pour libérer de la place.",
      );
      return;
    }
    setItems((old) => [item, ...old]);
    setActiveId(item.id);
    setCreateOpen(false);
  };
  const backup = (item: OfficeItem) => {
    download(
      new Blob([serializeItem(item)], { type: "application/json" }),
      `${filename(item.title)}.clair`,
    );
    notify("Fichier Clair exporté. Vous pourrez le rouvrir avec Importer.");
  };
  const exportOffice = async (item: OfficeItem) => {
    setBusy(true);
    try {
      const { createDocx, createPptx } = await import("./lib/export");
      const blob =
        item.kind === "document"
          ? await createDocx(item)
          : await createPptx(item);
      download(
        blob,
        `${filename(item.title)}.${item.kind === "document" ? "docx" : "pptx"}`,
      );
      notify("Export terminé. Vérifiez le rendu dans votre logiciel habituel.");
    } catch {
      notify(
        "L’export a échoué. Votre fichier reste disponible au format Clair.",
      );
    } finally {
      setBusy(false);
    }
  };
  const importFile = async (f: File) => {
    setBusy(true);
    try {
      if (f.size > 12_000_000)
        throw new Error("Choisissez un fichier de moins de 12 Mo.");
      if (/\.(clair|json)$/i.test(f.name)) {
        add(parseItem(await f.text()));
        notify("Fichier Clair importé.");
      } else if (/\.(doc|docx|ppt|pptx|odt|odp|rtf)$/i.test(f.name)) {
        setOfficeImport(f);
      } else
        throw new Error(
          "Choisissez un fichier Clair ou un document Office pris en charge.",
        );
    } catch (e) {
      notify((e as Error).message);
    } finally {
      setBusy(false);
    }
  };
  const filtered = items
    .filter(
      (i) =>
        (filter === "all" ||
          filter === i.kind ||
          (filter === "favorites" && i.favorite)) &&
        i.title
          .toLocaleLowerCase("fr")
          .includes(search.toLocaleLowerCase("fr")),
    )
    .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
  const go = (next: string) => {
    setFilter(next);
    setActiveId(null);
    setSearch("");
    setMobileNav(false);
  };
  return (
    <div
      className={`app-shell ${active ? "editing" : ""} ${mobileNav ? "nav-open" : ""}`}
    >
      <a className="skip-link" href="#main">
        Aller au contenu
      </a>
      <aside className="sidebar">
        <button
          className="brand-button"
          onClick={() => go("all")}
          aria-label="Clair Office, accueil"
        >
          <Brand />
        </button>
        <div className="workspace-label">
          <span className="workspace-avatar">M</span>
          <div>
            Mon espace<span>Personnel · sur cet appareil</span>
          </div>
        </div>
        <button
          className="primary new-button"
          onClick={() => setCreateOpen(true)}
        >
          <Plus size={18} />
          Créer un fichier
        </button>
        <nav aria-label="Navigation principale">
          {[
            ["all", FolderOpen, "Tous les fichiers"],
            ["document", FileText, "Documents"],
            ["presentation", Presentation, "Présentations"],
            ["favorites", Star, "Favoris"],
          ].map(([value, Icon, label]) => {
            const I = Icon as typeof FolderOpen;
            return (
              <button
                key={String(value)}
                className={filter === value && !active ? "active" : ""}
                onClick={() => go(String(value))}
              >
                <I size={18} />
                <span>{String(label)}</span>
                {value === "all" && <small>{items.length}</small>}
              </button>
            );
          })}
        </nav>
        <div className="sidebar-section">
          <span className="eyebrow">LES OUTILS CLAIR</span>
          <button onClick={() => setConversion(true)}>
            <ArrowRightLeft size={18} />
            Conversion Office<span className="new-badge">LOCAL</span>
          </button>
          <button onClick={() => importInput.current?.click()}>
            <Upload size={18} />
            Importer un fichier
          </button>
        </div>
        <div className="sidebar-bottom">
          <div className="local-note">
            <ShieldCheck size={18} />
            <p>
              Vos idées restent chez vous.
              <span>Fichiers enregistrés dans ce navigateur.</span>
            </p>
          </div>
          <div className="sidebar-controls">
            <button onClick={() => setHelp(true)}>
              <HelpCircle size={17} />
              Aide et raccourcis
            </button>
            <IconButton
              icon={dark ? Sun : Moon}
              label={dark ? "Thème clair" : "Thème sombre"}
              onClick={() => setDark(!dark)}
            />
          </div>
          <span className="version-label">
            CLAIR OFFICE <span>LIBRE · v0.1</span>
          </span>
        </div>
      </aside>
      <div className="main-column">
        <header className="topbar">
          <IconButton
            className="mobile-menu"
            icon={Menu}
            label="Afficher la navigation"
            onClick={() => setMobileNav(!mobileNav)}
          />
          {active ? (
            <>
              <IconButton
                icon={ArrowLeft}
                label="Retour aux fichiers"
                onClick={() => setActiveId(null)}
              />
              <span className={`file-icon tiny ${active.kind}`}>
                {active.kind === "document" ? (
                  <FileText size={18} />
                ) : (
                  <Presentation size={18} />
                )}
              </span>
              <input
                className="title-input"
                aria-label="Nom du fichier"
                value={active.title}
                maxLength={160}
                onChange={(e) =>
                  update({ ...active, title: e.target.value || "Sans titre" })
                }
              />
              <span
                className={`save-status ${!saved ? "unsaved" : ""}`}
                role="status"
              >
                <Check size={14} />
                {saved ? "Enregistré" : "Sauvegarde…"}
              </span>
              <div className="topbar-actions">
                <IconButton
                  icon={Star}
                  label={
                    active.favorite
                      ? "Retirer des favoris"
                      : "Ajouter aux favoris"
                  }
                  active={active.favorite}
                  onClick={() =>
                    update({ ...active, favorite: !active.favorite })
                  }
                />
                <details className="export-menu">
                  <summary className="secondary">
                    <Download size={16} />
                    Exporter
                  </summary>
                  <div className="dropdown">
                    <button
                      disabled={busy}
                      onClick={() => exportOffice(active)}
                    >
                      {active.kind === "document"
                        ? "Word (.docx)"
                        : "PowerPoint (.pptx)"}
                    </button>
                    <button onClick={() => backup(active)}>
                      Clair (.clair) — sauvegarde complète
                    </button>
                    <button onClick={() => window.print()}>
                      Imprimer / PDF du navigateur
                    </button>
                    <button onClick={() => setConversion(true)}>
                      Autres formats Office…
                    </button>
                  </div>
                </details>
              </div>
            </>
          ) : (
            <>
              <div className="breadcrumb">
                Mon espace <span>/</span>
                <strong>
                  {
                    {
                      all: "Tous les fichiers",
                      document: "Documents",
                      presentation: "Présentations",
                      favorites: "Favoris",
                    }[filter]
                  }
                </strong>
              </div>
              <button
                className="search-trigger"
                onClick={() => setCommand(true)}
              >
                <Search size={16} />
                <span>Rechercher ou naviguer</span>
                <kbd>Ctrl K</kbd>
              </button>
            </>
          )}
        </header>
        {storageError && (
          <div className="storage-warning" role="alert">
            <span>{storageError}</span>
            {readBlocked && (
              <>
                <button
                  onClick={() => {
                    try {
                      download(
                        new Blob([localStorage.getItem(STORAGE_KEY) ?? ""], {
                          type: "application/json",
                        }),
                        "clair-sauvegarde-a-recuperer.json",
                      );
                    } catch {
                      notify(
                        "La sauvegarde est inaccessible dans ce navigateur.",
                      );
                    }
                  }}
                >
                  Exporter la sauvegarde brute
                </button>
                <button
                  onClick={() => {
                    if (
                      window.confirm(
                        "Réinitialiser cet espace local ? Exportez d’abord la sauvegarde brute pour la conserver.",
                      )
                    ) {
                      setReadBlocked(false);
                      setStorageError("");
                    }
                  }}
                >
                  Réinitialiser
                </button>
              </>
            )}
          </div>
        )}
        <main id="main" tabIndex={-1}>
          {active ? (
            <Suspense
              fallback={
                <div className="loading">Ouverture de votre espace…</div>
              }
            >
              {active.kind === "document" ? (
                <DocumentEditor
                  key={active.id}
                  item={active}
                  onChange={update}
                  onConvert={() => {
                    try {
                      add(documentToSlides(active));
                      notify(
                        "Présentation créée. Ajustez la quantité de texte et la disposition avant de la présenter.",
                      );
                    } catch (error) {
                      notify((error as Error).message);
                    }
                  }}
                  notify={notify}
                />
              ) : (
                <PresentationEditor
                  key={active.id}
                  item={active}
                  onChange={update}
                  notify={notify}
                />
              )}
            </Suspense>
          ) : (
            <div className="home-content">
              <section className="welcome">
                <div>
                  <span className="eyebrow">UN ESPACE POUR CRÉER</span>
                  <h1>
                    De la place pour
                    <br />
                    <em>vos idées.</em>
                  </h1>
                  <p>
                    Écrivez, présentez, donnez forme à ce qui compte.
                    <br />
                    Les bons outils, tout simplement.
                  </p>
                  <button
                    className="text-button"
                    onClick={() => setCreateOpen(true)}
                  >
                    Commençons quelque chose <ArrowUpRight size={18} />
                  </button>
                </div>
                <div className="welcome-art" aria-hidden="true">
                  <div className="art-sheet">
                    <span>
                      Une idée,
                      <br />
                      mille possibles.
                    </span>
                    <i />
                    <i />
                    <i />
                    <div className="art-stamp">c</div>
                  </div>
                  <div className="art-slide">
                    <span className="art-caption">PERSPECTIVES / 01</span>
                    <span>
                      Voir
                      <br />
                      plus grand.
                    </span>
                    <div className="art-circle" />
                    <span className="art-arrow">↗</span>
                  </div>
                  <span className="art-spark">✳</span>
                </div>
              </section>
              <section className="quick-start" aria-label="Créer rapidement">
                <button
                  className="start-card write-card"
                  onClick={() => add(newDocument())}
                >
                  <span className="file-icon document">
                    <FileText />
                  </span>
                  <div>
                    <h2>Un document</h2>
                    <p>Une page blanche, des possibilités.</p>
                  </div>
                  <Plus size={20} />
                </button>
                <button
                  className="start-card present-card"
                  onClick={() => add(newPresentation())}
                >
                  <span className="file-icon presentation">
                    <Presentation />
                  </span>
                  <div>
                    <h2>Une présentation</h2>
                    <p>Vos idées prennent la parole.</p>
                  </div>
                  <Plus size={20} />
                </button>
                <button
                  className="start-card import-card"
                  onClick={() => importInput.current?.click()}
                  disabled={busy}
                >
                  <span className="file-icon neutral">
                    <Upload />
                  </span>
                  <div>
                    <h2>Importer</h2>
                    <p>Reprenez le fil de votre travail.</p>
                  </div>
                  <ArrowUpRight size={20} />
                </button>
              </section>
              <section className="files-section">
                <div className="section-header">
                  <div>
                    <h2>
                      {
                        {
                          all: "Vos fichiers",
                          document: "Vos documents",
                          presentation: "Vos présentations",
                          favorites: "Vos favoris",
                        }[filter]
                      }{" "}
                      <span>{filtered.length}</span>
                    </h2>
                    <p>Tout ce que vous imaginez, au même endroit.</p>
                  </div>
                  <label className="search-field">
                    <Search size={17} />
                    <input
                      placeholder="Rechercher un fichier…"
                      aria-label="Rechercher un fichier"
                      value={search}
                      onChange={(e) => setSearch(e.target.value)}
                    />
                    {search && (
                      <IconButton
                        icon={X}
                        label="Effacer la recherche"
                        onClick={() => setSearch("")}
                      />
                    )}
                  </label>
                </div>
                <div className="filter-tabs" aria-label="Filtrer les fichiers">
                  {[
                    ["all", "Tout"],
                    ["document", "Documents"],
                    ["presentation", "Présentations"],
                    ["favorites", "Favoris"],
                  ].map(([f, label]) => (
                    <button
                      key={f}
                      aria-pressed={filter === f}
                      className={filter === f ? "active" : ""}
                      onClick={() => setFilter(f)}
                    >
                      {label}
                    </button>
                  ))}
                </div>
                {filtered.length ? (
                  <div className="file-grid">
                    {filtered.map((item) => (
                      <article className="file-card" key={item.id}>
                        <button
                          className={`file-preview ${item.kind}`}
                          onClick={() => setActiveId(item.id)}
                          aria-label={`Ouvrir ${item.title}`}
                        >
                          {item.kind === "document" ? (
                            <div className="mini-document">
                              <span>{item.title}</span>
                              <p>{plainText(item.content).slice(0, 230)}</p>
                              <i />
                              <i />
                              <i />
                            </div>
                          ) : (
                            <SlideCanvas slide={item.slides[0]} />
                          )}
                          <span className="preview-open">
                            <ArrowUpRight size={18} />
                          </span>
                        </button>
                        <div className="file-card-info">
                          <span className={`file-icon tiny ${item.kind}`}>
                            {item.kind === "document" ? (
                              <FileText size={17} />
                            ) : (
                              <Presentation size={17} />
                            )}
                          </span>
                          <div>
                            <button
                              className="file-title"
                              onClick={() => setActiveId(item.id)}
                            >
                              {item.title}
                            </button>
                            <span>
                              {item.kind === "document"
                                ? "Document"
                                : `${item.slides.length} diapositives`}{" "}
                              <b>·</b> {date(item.updatedAt)}
                            </span>
                          </div>
                          <details className="file-menu">
                            <summary aria-label={`Actions pour ${item.title}`}>
                              <MoreHorizontal size={19} />
                            </summary>
                            <div className="dropdown">
                              <button
                                onClick={() =>
                                  update({ ...item, favorite: !item.favorite })
                                }
                              >
                                <Star size={15} />
                                {item.favorite
                                  ? "Retirer des favoris"
                                  : "Ajouter aux favoris"}
                              </button>
                              <button onClick={() => add(cloneItem(item))}>
                                <Copy size={15} />
                                Dupliquer
                              </button>
                              <button onClick={() => backup(item)}>
                                <Download size={15} />
                                Sauvegarder (.clair)
                              </button>
                              <button
                                className="danger-text"
                                onClick={() => setDeleteId(item.id)}
                              >
                                <Trash2 size={15} />
                                Supprimer
                              </button>
                            </div>
                          </details>
                        </div>
                        {item.favorite && (
                          <span className="favorite-mark" aria-label="Favori">
                            <Star size={13} fill="currentColor" />
                          </span>
                        )}
                      </article>
                    ))}
                  </div>
                ) : (
                  <div className="empty-state">
                    <FolderOpen size={34} />
                    <h3>
                      {search
                        ? "Aucun fichier correspondant"
                        : "La suite s’écrit ici."}
                    </h3>
                    <p>
                      {search
                        ? "Essayez un autre nom de fichier."
                        : "Créez un fichier ou importez votre travail pour commencer."}
                    </p>
                    <button
                      className="secondary"
                      onClick={() => setCreateOpen(true)}
                    >
                      Créer un fichier
                    </button>
                  </div>
                )}
              </section>
              <footer className="home-footer">
                <span>Moins de distractions. Plus de création.</span>
                <span>Ouvert par nature. Libre par choix.</span>
              </footer>
            </div>
          )}
        </main>
      </div>
      <input
        hidden
        ref={importInput}
        type="file"
        accept=".clair,.json,.docx,.doc,.ppt,.pptx,.odt,.odp,.rtf"
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) void importFile(f);
          e.target.value = "";
        }}
      />
      {busy && (
        <div className="busy-indicator" role="status">
          Traitement du fichier…
        </div>
      )}
      {toast && (
        <div className="toast" role="status">
          <span>{toast}</span>
          <IconButton
            icon={X}
            label="Fermer la notification"
            onClick={() => setToast("")}
          />
        </div>
      )}
      {createOpen && (
        <Dialog
          title="Qu’allez-vous créer ?"
          onClose={() => setCreateOpen(false)}
          wide
        >
          <p className="muted">
            Partez d’une page blanche ou prenez une longueur d’avance.
          </p>
          <div className="template-grid">
            {[
              [
                "Page blanche",
                "Un document à votre image.",
                "document",
                "blank",
              ],
              [
                "Note d’intention",
                "Clarifiez et structurez votre idée.",
                "document",
                "brief",
              ],
              [
                "Rapport de projet",
                "Du contexte à la conclusion.",
                "document",
                "report",
              ],
              [
                "Présentation libre",
                "Votre première diapositive.",
                "presentation",
                "blank",
              ],
              [
                "De nouvelles perspectives",
                "Trois diapositives pour convaincre.",
                "presentation",
                "pitch",
              ],
            ].map(([title, description, kind, template]) => (
              <button
                key={title}
                onClick={() =>
                  add(
                    kind === "document"
                      ? newDocument(template as "blank" | "brief" | "report")
                      : newPresentation(template as "blank" | "pitch"),
                  )
                }
              >
                <span className={`file-icon ${kind}`}>
                  {kind === "document" ? <FileText /> : <Presentation />}
                </span>
                <h3>{title}</h3>
                <p>{description}</p>
                <ArrowUpRight size={18} />
              </button>
            ))}
          </div>
        </Dialog>
      )}
      {command && (
        <Dialog title="Retrouver un fichier" onClose={() => setCommand(false)}>
          <label className="search-field command-search">
            <Search size={18} />
            <input
              autoFocus
              placeholder="Nom du fichier…"
              aria-label="Rechercher dans tous les fichiers"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </label>
          <div className="command-results">
            {items
              .filter((i) =>
                i.title.toLowerCase().includes(search.toLowerCase()),
              )
              .map((i) => (
                <button
                  key={i.id}
                  onClick={() => {
                    setActiveId(i.id);
                    setCommand(false);
                    setSearch("");
                  }}
                >
                  {i.kind === "document" ? (
                    <FileText size={18} />
                  ) : (
                    <Presentation size={18} />
                  )}
                  <span>{i.title}</span>
                  <ArrowUpRight size={16} />
                </button>
              ))}
          </div>
          <button
            className="text-button"
            onClick={() => {
              setCommand(false);
              setCreateOpen(true);
            }}
          >
            + Créer un fichier
          </button>
        </Dialog>
      )}
      {help && (
        <Dialog
          title="Bienvenue dans Clair Office"
          onClose={() => setHelp(false)}
        >
          <p>
            Clair réunit un éditeur de texte et un atelier de présentation. Vous
            pouvez créer, importer, modifier et exporter votre travail sans
            compte.
          </p>
          <h3>Vos fichiers, sur cet appareil</h3>
          <p>
            La sauvegarde automatique reste dans ce navigateur. Exportez
            régulièrement au format <strong>.clair</strong> : effacer les
            données du navigateur efface aussi cet espace. Utilisez une seule
            fenêtre d’édition pour éviter les conflits.
          </p>
          <h3>Raccourcis</h3>
          <dl className="shortcuts">
            <dt>Ctrl / ⌘ + K</dt>
            <dd>Rechercher un fichier</dd>
            <dt>Ctrl / ⌘ + S</dt>
            <dd>Exporter une sauvegarde Clair</dd>
            <dt>Ctrl / ⌘ + Z</dt>
            <dd>Annuler dans l’éditeur</dd>
            <dt>Tab / Maj + Tab</dt>
            <dd>Naviguer entre les commandes</dd>
            <dt>Flèches / Échap</dt>
            <dd>Naviguer / quitter la présentation</dd>
          </dl>
          <h3>Compatibilité</h3>
          <p>
            L’import DOCX reprend le contenu et sa structure, pas toute la mise
            en page Word. Les exports DOCX/PPTX restent modifiables. Le module
            Office convertit les fichiers DOC, DOCX, PPT, PPTX, ODT et ODP avec
            LibreOffice local. Aucun format ne garantit une fidélité
            universelle.
          </p>
          <a
            href="https://github.com/Frozalex/clair-office"
            target="_blank"
            rel="noreferrer"
          >
            Code source et documentation ↗
          </a>
        </Dialog>
      )}
      {deleteId && (
        <Dialog
          title="Supprimer ce fichier de l’espace ?"
          onClose={() => setDeleteId(null)}
        >
          <p>
            « {items.find((i) => i.id === deleteId)?.title} » sera retiré de ce
            navigateur. Vous pouvez en télécharger une copie avant de continuer.
          </p>
          <div className="dialog-actions">
            <button
              className="secondary"
              onClick={() => {
                const i = items.find((i) => i.id === deleteId);
                if (i) backup(i);
              }}
            >
              Sauvegarder une copie
            </button>
            <button
              className="danger"
              onClick={() => {
                setItems((old) => old.filter((i) => i.id !== deleteId));
                setDeleteId(null);
              }}
            >
              Supprimer
            </button>
          </div>
        </Dialog>
      )}
      {officeImport && (
        <Suspense
          fallback={
            <div className="busy-indicator">Ouverture de l’import…</div>
          }
        >
          <ImportDialog
            file={officeImport}
            onClose={() => setOfficeImport(null)}
            onImport={(item) => {
              add(item);
              setOfficeImport(null);
              notify(
                "Copie importée. Comparez-la à votre original avant de la partager.",
              );
            }}
            onConvert={() => {
              setConversionFile(officeImport);
              setOfficeImport(null);
              setConversion(true);
            }}
          />
        </Suspense>
      )}
      {conversion && (
        <Suspense
          fallback={
            <div className="busy-indicator">Ouverture de la conversion…</div>
          }
        >
          <ConversionDialog
            item={active}
            initialFile={conversionFile}
            onClose={() => {
              setConversion(false);
              setConversionFile(null);
            }}
            notify={notify}
          />
        </Suspense>
      )}
    </div>
  );
}
