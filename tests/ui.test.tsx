// @vitest-environment jsdom
import { beforeEach, afterEach, describe, it, expect, vi } from "vitest";
import {
  render,
  screen,
  fireEvent,
  cleanup,
  waitFor,
  configure,
} from "@testing-library/react";
import App from "../src/App";
import { STORAGE_KEY } from "../src/lib/storage";
configure({ asyncUtilTimeout: 6000 });
beforeEach(() => {
  const values = new Map<string, string>();
  vi.stubGlobal("localStorage", {
    getItem: (k: string) => values.get(k) ?? null,
    setItem: (k: string, v: string) => values.set(k, v),
    clear: () => values.clear(),
    removeItem: (k: string) => values.delete(k),
  });
  HTMLDialogElement.prototype.showModal = function () {
    this.setAttribute("open", "");
  };
  HTMLDialogElement.prototype.close = function () {
    this.removeAttribute("open");
  };
  HTMLElement.prototype.scrollIntoView = () => {};
  vi.stubGlobal(
    "fetch",
    vi
      .fn()
      .mockResolvedValue({
        ok: false,
        json: async () => ({ available: false }),
      }),
  );
});
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});
describe("Main user journeys", () => {
  it("creates a presentation, edits it, duplicates a slide, and persists it", async () => {
    render(<App />);
    fireEvent.click(
      screen.getByRole("button", { name: /Une présentation Vos idées/ }),
    );
    await screen.findByRole("button", { name: "Présenter" });
    const name = screen.getByRole("textbox", { name: "Nom du fichier" });
    fireEvent.change(name, { target: { value: "Mon exposé" } });
    fireEvent.click(
      screen.getByRole("button", { name: "Dupliquer la diapositive" }),
    );
    expect(await screen.findByText("Diapositive 2 sur 2")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Texte" }));
    const text = await screen.findByRole("textbox", {
      name: "Texte de l’élément",
    });
    fireEvent.change(text, { target: { value: "Une idée lisible" } });
    await waitFor(() =>
      expect(localStorage.getItem(STORAGE_KEY)).toContain("Une idée lisible"),
    );
    fireEvent.click(screen.getByRole("button", { name: "Annuler" }));
    expect(
      screen
        .getByRole("textbox", { name: "Texte de l’élément" })
        .getAttribute("value"),
    ).toBeNull();
    expect(
      (
        screen.getByRole("textbox", {
          name: "Texte de l’élément",
        }) as HTMLTextAreaElement
      ).value,
    ).toBe("Votre texte");
    fireEvent.click(
      screen.getByRole("button", { name: "Retour aux fichiers" }),
    );
    expect(screen.getByRole("button", { name: "Mon exposé" })).toBeTruthy();
  });
  it("creates a blank document with a live editor and accessible toolbar", async () => {
    render(<App />);
    fireEvent.click(
      screen.getByRole("button", { name: /Un document Une page blanche/ }),
    );
    await screen.findByRole("textbox", { name: "Contenu du document" });
    expect(screen.getByRole("button", { name: "Gras (Ctrl+B)" })).toBeTruthy();
    expect(
      screen.getByRole("button", { name: "Insérer un tableau 3 × 3" }),
    ).toBeTruthy();
    fireEvent.click(
      screen.getByRole("button", { name: "Insérer un tableau 3 × 3" }),
    );
    await waitFor(() =>
      expect(document.querySelectorAll(".tiptap td,.tiptap th").length).toBe(9),
    );
  });
  it("searches and changes theme without losing saved files", async () => {
    render(<App />);
    fireEvent.change(
      screen.getByRole("textbox", { name: "Rechercher un fichier" }),
      { target: { value: "Rapport" } },
    );
    expect(
      screen.getByRole("button", { name: "Rapport de projet" }),
    ).toBeTruthy();
    expect(
      screen.queryByRole("button", { name: "De nouvelles perspectives" }),
    ).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Thème sombre" }));
    expect(document.documentElement.dataset.theme).toBe("dark");
    await waitFor(() =>
      expect(JSON.parse(localStorage.getItem(STORAGE_KEY)!).items).toHaveLength(
        3,
      ),
    );
  });
  it("leaves corrupt storage untouched and makes the error visible", async () => {
    localStorage.setItem(STORAGE_KEY, "broken");
    render(<App />);
    expect(screen.getByRole("alert").textContent).toContain(
      "conservée intacte",
    );
    expect(localStorage.getItem(STORAGE_KEY)).toBe("broken");
  });
  it("does not offer conversion as ready when the local engine is missing", async () => {
    render(<App />);
    fireEvent.click(screen.getByRole("button", { name: /Conversion Office/ }));
    await screen.findByText("Moteur LibreOffice local non disponible");
    expect(
      (
        screen.getByRole("button", {
          name: "Convertir la copie",
        }) as HTMLButtonElement
      ).disabled,
    ).toBe(true);
  });
});
