import { useEffect, useState } from "react";
import {
  ArrowRightLeft,
  Download,
  ShieldCheck,
  CircleAlert,
  CheckCircle2,
} from "lucide-react";
import type { OfficeItem } from "../lib/model";
import { download, filename } from "../lib/storage";
import { Dialog } from "./UI";
const writer = ["docx", "doc", "odt", "pdf", "rtf", "txt", "html"];
const impress = ["pptx", "ppt", "odp", "pdf"];
const labels: Record<string, string> = {
  docx: "Word moderne (.docx)",
  doc: "Word 97–2003 (.doc)",
  odt: "OpenDocument texte (.odt)",
  pdf: "PDF — lecture, mise en page figée",
  rtf: "Texte enrichi (.rtf)",
  txt: "Texte brut (.txt) — sans mise en forme",
  html: "Page web (.html / archive ZIP)",
  pptx: "PowerPoint moderne (.pptx)",
  ppt: "PowerPoint 97–2003 (.ppt)",
  odp: "OpenDocument présentation (.odp)",
};
export default function ConversionDialog({
  item,
  initialFile,
  onClose,
  notify,
}: {
  item?: OfficeItem;
  initialFile?: File | null;
  onClose: () => void;
  notify: (message: string) => void;
}) {
  const [health, setHealth] = useState<"checking" | "ready" | "unavailable">(
      "checking",
    ),
    [file, setFile] = useState<File | null>(initialFile ?? null),
    [source, setSource] = useState(item && !initialFile ? "current" : "file"),
    [format, setFormat] = useState("pdf"),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [result, setResult] = useState<{
      blob: Blob;
      name: string;
      url: string;
      pdf: boolean;
    } | null>(null);
  const check = async () => {
    setHealth("checking");
    try {
      const r = await fetch("/api/health", {
        signal: AbortSignal.timeout(4000),
      });
      const data = await r.json();
      setHealth(r.ok && data.available ? "ready" : "unavailable");
    } catch {
      setHealth("unavailable");
    }
  };
  useEffect(() => {
    void check();
  }, []);
  useEffect(
    () => () => {
      if (result) URL.revokeObjectURL(result.url);
    },
    [result],
  );
  const ext =
    source === "current" && item
      ? item.kind === "document"
        ? "docx"
        : "pptx"
      : file?.name.split(".").pop()?.toLowerCase();
  const family =
    ext && ["ppt", "pptx", "odp"].includes(ext) ? "presentation" : "document";
  const formats = family === "presentation" ? impress : writer;
  const convert = async () => {
    setError("");
    setBusy(true);
    setResult(null);
    try {
      let input: Blob, name: string;
      if (source === "current" && item) {
        const { createDocx, createPptx } = await import("../lib/export");
        input =
          item.kind === "document"
            ? await createDocx(item)
            : await createPptx(item);
        name = `${filename(item.title)}.${ext}`;
      } else if (file) {
        input = file;
        name = file.name;
      } else throw new Error("Choisissez le fichier à convertir.");
      if (input.size > 20_000_000)
        throw new Error(
          "Le module de conversion accepte les fichiers jusqu’à 20 Mo.",
        );
      const response = await fetch(
        `/api/convert?to=${encodeURIComponent(format)}&name=${encodeURIComponent(name)}`,
        {
          method: "POST",
          headers: { "Content-Type": "application/octet-stream" },
          body: input,
          signal: AbortSignal.timeout(100_000),
        },
      );
      if (!response.ok) {
        const data = await response.json().catch(() => null);
        throw new Error(
          data?.error ??
            "La conversion n’a pas abouti. Vérifiez que le moteur local est lancé.",
        );
      }
      const blob = await response.blob(),
        output = response.headers.get("X-Output-Extension") ?? format;
      const resultName = `${filename(name.replace(/\.[^.]+$/, ""))}.${output}`;
      setResult({
        blob,
        name: resultName,
        url: URL.createObjectURL(blob),
        pdf: output === "pdf",
      });
      notify(
        "Conversion terminée. Contrôlez le résultat avant de le partager.",
      );
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  };
  return (
    <Dialog title="Convertir, en gardant l’original" onClose={onClose} wide>
      <div className={`conversion-status ${health}`}>
        {health === "ready" ? (
          <CheckCircle2 size={17} />
        ) : (
          <CircleAlert size={17} />
        )}
        <span>
          {health === "checking"
            ? "Recherche du moteur local…"
            : health === "ready"
              ? "Moteur LibreOffice disponible sur cet appareil"
              : "Moteur LibreOffice local non disponible"}
        </span>
        <button onClick={check} disabled={busy}>
          Revérifier
        </button>
      </div>
      <p className="conversion-intro">
        DOC, DOCX, PPT et PPTX, ainsi que les formats ouverts. La conversion
        travaille sur une copie : votre fichier d’origine n’est jamais remplacé.
      </p>
      {item && (
        <div className="conversion-choice">
          <label>
            <input
              type="radio"
              name="source"
              checked={source === "current"}
              onChange={() => {
                setSource("current");
                setFormat("pdf");
                setResult(null);
              }}
            />
            La création Clair ouverte
          </label>
          <label>
            <input
              type="radio"
              name="source"
              checked={source === "file"}
              onChange={() => {
                setSource("file");
                setFormat("pdf");
                setResult(null);
              }}
            />
            Un fichier existant
          </label>
        </div>
      )}
      {source === "file" && (
        <label className="conversion-file">
          <span>
            {file ? `Fichier sélectionné : ${file.name} · ` : ""}Choisir un
            fichier DOC, DOCX, PPT, PPTX, ODT, ODP ou RTF · 20 Mo maximum
          </span>
          <input
            type="file"
            accept=".doc,.docx,.ppt,.pptx,.odt,.odp,.rtf"
            onChange={(e) => {
              setFile(e.target.files?.[0] ?? null);
              setFormat("pdf");
              setResult(null);
              setError("");
            }}
          />
        </label>
      )}
      {source === "current" && item && (
        <p>
          <strong>{item.title}</strong> ·{" "}
          {item.kind === "document" ? "Document" : "Présentation"}
        </p>
      )}
      <label className="field">
        Format de destination
        <select
          value={format}
          onChange={(e) => {
            setFormat(e.target.value);
            setResult(null);
          }}
        >
          {formats.map((f) => (
            <option key={f} value={f}>
              {labels[f]}
            </option>
          ))}
        </select>
      </label>
      <div className="conversion-warning">
        <strong>
          {format === "txt"
            ? "Le texte brut supprime toute mise en forme."
            : format === "pdf"
              ? "Le PDF fige le rendu obtenu par LibreOffice."
              : "La fidélité dépend du contenu et du format choisi."}
        </strong>
        <br />
        {format === "pdf"
          ? "Il ne conserve pas les animations ni l’édition des objets Office. Contrôlez les polices, les pages et les éléments graphiques dans l’aperçu."
          : "Polices manquantes, graphiques, champs, transitions, macros et objets incorporés peuvent changer ou être perdus. Aucune conversion universelle sans perte n’est possible."}
      </div>
      <div className="conversion-original">
        <ShieldCheck size={18} />
        <span>
          Original intact · Traitement local · Aucun envoi vers un service de
          conversion externe
        </span>
      </div>
      {health === "unavailable" && (
        <details className="conversion-engine" open>
          <summary>Activer le moteur sur cet ordinateur</summary>Installez
          LibreOffice, puis lancez depuis le dépôt :
          <code>python3 server/converter.py</code>Le serveur Vite redirige les
          requêtes vers le moteur local. Pour une installation hébergée,
          consultez la documentation du dépôt. Les exports DOCX/PPTX et Clair
          restent disponibles sans ce module.
        </details>
      )}
      {error && (
        <p role="alert" className="conversion-warning">
          {error}
        </p>
      )}
      <div className="dialog-actions">
        <button className="secondary" onClick={onClose}>
          Fermer
        </button>
        <button
          className="primary"
          disabled={health !== "ready" || busy || (source === "file" && !file)}
          onClick={convert}
        >
          <ArrowRightLeft size={16} />
          {busy ? "Conversion en cours…" : "Convertir la copie"}
        </button>
      </div>
      {result && (
        <div className="conversion-result">
          <h3>Votre copie est prête</h3>
          <p>{result.name}</p>
          <button
            className="primary"
            onClick={() => download(result.blob, result.name)}
          >
            <Download size={16} />
            Télécharger
          </button>
          {file && source === "file" && (
            <button
              className="text-button"
              style={{ marginLeft: 16 }}
              onClick={() => download(file, file.name)}
            >
              Télécharger aussi l’original
            </button>
          )}
          {result.pdf && (
            <iframe src={result.url} title="Aperçu du PDF converti" />
          )}
        </div>
      )}
    </Dialog>
  );
}
