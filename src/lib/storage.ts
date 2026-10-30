import { workspaceSchema, type OfficeItem } from "./model";
export const STORAGE_KEY = "clair-office.workspace.v1";
export type StorageLike = Pick<Storage, "getItem" | "setItem">;
export function loadWorkspace(storage: StorageLike): {
  items: OfficeItem[] | null;
  error?: string;
} {
  try {
    const raw = storage.getItem(STORAGE_KEY);
    if (!raw) return { items: null };
    const result = workspaceSchema.safeParse(JSON.parse(raw));
    if (!result.success) throw new Error("invalid");
    return { items: result.data.items };
  } catch {
    return {
      items: [],
      error:
        "La sauvegarde locale ne peut pas être lue. Elle est conservée intacte. Exportez-la avant de réinitialiser cet espace.",
    };
  }
}
export function saveWorkspace(
  storage: StorageLike,
  items: OfficeItem[],
): { ok: boolean; error?: string } {
  try {
    storage.setItem(STORAGE_KEY, JSON.stringify({ version: 1, items }));
    return { ok: true };
  } catch {
    return {
      ok: false,
      error:
        "Sauvegarde locale impossible (espace plein ou accès refusé). Exportez vos fichiers Clair pour conserver vos modifications.",
    };
  }
}
export function download(blob: Blob, name: string) {
  const url = URL.createObjectURL(blob),
    a = document.createElement("a");
  a.href = url;
  a.download = name;
  document.body.append(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 30000);
}
export const filename = (name: string) =>
  name
    .replace(/[<>:"/\\|?*\x00-\x1F]/g, "-")
    .trim()
    .slice(0, 120) || "clair-office";
