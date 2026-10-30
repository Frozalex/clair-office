import { useState } from "react";
import { FileText, ArrowRightLeft, Upload } from "lucide-react";
import { Dialog } from "./UI";
import { newDocument, type OfficeItem } from "../lib/model";
export default function ImportDialog({
  file,
  onClose,
  onImport,
  onConvert,
}: {
  file: File;
  onClose: () => void;
  onImport: (item: OfficeItem) => void;
  onConvert: () => void;
}) {
  const [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [result, setResult] = useState<{
      item: OfficeItem;
      warnings: string[];
    } | null>(null);
  const prepare = async () => {
    setBusy(true);
    setError("");
    try {
      let input = file;
      const source = file.name.split(".").pop()?.toLowerCase();
      if (["doc", "ppt", "odt", "odp", "rtf"].includes(source ?? "")) {
        const to = ["ppt", "odp"].includes(source!) ? "pptx" : "docx";
        const response = await fetch(
          `/api/convert?to=${to}&name=${encodeURIComponent(file.name)}`,
          {
            method: "POST",
            headers: { "Content-Type": "application/octet-stream" },
            body: file,
            signal: AbortSignal.timeout(100_000),
          },
        );
        if (!response.ok)
          throw new Error(
            "Le moteur LibreOffice local est nécessaire pour ouvrir ce format. Lancez python3 server/converter.py après avoir installé LibreOffice.",
          );
        input = new File(
          [await response.blob()],
          file.name.replace(/\.[^.]+$/, `.${to}`),
        );
      }
      if (/\.docx$/i.test(input.name)) {
        const { importDocx } = await import("../lib/import");
        const parsed = await importDocx(input);
        setResult({
          item: {
            ...newDocument(),
            title:
              file.name.replace(/\.[^.]+$/, "").slice(0, 160) ||
              "Document importé",
            content: parsed.content,
          },
          warnings: [
            "Le texte, les titres, les listes et les tableaux sont repris.",
            "Pagination, colonnes, en-têtes, pieds de page, suivi des modifications et objets complexes peuvent être modifiés ou perdus.",
            ...(parsed.warnings
              ? [
                  `${parsed.warnings} avertissement(s) supplémentaire(s) signalé(s) par le moteur d’import.`,
                ]
              : []),
          ],
        });
      } else if (/\.pptx$/i.test(input.name)) {
        const { importPptx } = await import("../lib/import-pptx");
        setResult(await importPptx(input));
      } else throw new Error("Format non pris en charge par cet éditeur.");
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  };
  return (
    <Dialog title="Ouvrir une copie Office" onClose={onClose}>
      <p>
        <FileText size={16} /> <strong>{file.name}</strong>
      </p>
      <p>
        Choisissez selon votre objectif. Votre original n’est jamais remplacé.
      </p>
      <div className="conversion-intro">
        <strong>Pour conserver davantage de propriétés du fichier</strong>
        <p>
          Convertissez directement l’original avec LibreOffice, puis vérifiez le
          PDF ou le fichier obtenu.
        </p>
        <button className="secondary" onClick={onConvert}>
          <ArrowRightLeft size={16} />
          Conversion de l’original
        </button>
      </div>
      <h3>Pour modifier le contenu dans Clair</h3>
      <p>
        Créez une copie adaptée aux fonctions de cet éditeur.{" "}
        <strong>
          La mise en page et les éléments avancés peuvent changer.
        </strong>
      </p>
      {error && (
        <p role="alert" className="conversion-warning">
          {error}
        </p>
      )}
      {result ? (
        <>
          <div className="conversion-warning">
            <strong>Avant d’ouvrir cette copie :</strong>
            <ul>
              {result.warnings.map((w) => (
                <li key={w}>{w}</li>
              ))}
            </ul>
          </div>
          <div className="dialog-actions">
            <button className="secondary" onClick={onClose}>
              Annuler
            </button>
            <button className="primary" onClick={() => onImport(result.item)}>
              Ouvrir la copie modifiable
            </button>
          </div>
        </>
      ) : (
        <button className="primary" disabled={busy} onClick={prepare}>
          <Upload size={16} />
          {busy ? "Préparation de la copie…" : "Préparer une copie modifiable"}
        </button>
      )}
    </Dialog>
  );
}
