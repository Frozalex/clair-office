import fs from "node:fs";
import path from "node:path";
const lock = JSON.parse(fs.readFileSync("package-lock.json", "utf8"));
const entries = Object.entries(lock.packages).filter(
  ([name, meta]) => name && !meta.dev && !meta.devOptional,
);
const lines = [
  "# Composants tiers de Clair Office",
  "",
  "Inventaire des dépendances de production installées, généré par `npm run licenses`. Les composants restent soumis à leurs licences respectives. Les textes fournis par les paquets sont réunis dans [docs/THIRD_PARTY_LICENSES.txt](docs/THIRD_PARTY_LICENSES.txt).",
  "",
  "| Composant | Version | Licence déclarée |",
  "| --- | --- | --- |",
];
const notices = [
  "THIRD-PARTY LICENSES — CLAIR OFFICE",
  "Generated from installed production packages. Original notices follow.",
  "",
];
const seen = new Set();
for (const [location, meta] of entries) {
  const manifest = JSON.parse(
    fs.readFileSync(path.join(location, "package.json"), "utf8"),
  );
  const key = `${manifest.name}@${manifest.version}`;
  if (seen.has(key)) continue;
  seen.add(key);
  const license =
    typeof manifest.license === "string"
      ? manifest.license
      : (manifest.license?.type ?? "See upstream");
  lines.push(
    `| ${manifest.name} | ${manifest.version} | ${license.replaceAll("|", "/")} |`,
  );
  const names = fs
    .readdirSync(location)
    .filter((n) => /^(license|licence|copying|notice)(\.|$)/i.test(n));
  notices.push("\n" + "=".repeat(70), key, `Declared license: ${license}`);
  for (const name of names) {
    const file = path.join(location, name);
    if (fs.statSync(file).isFile())
      notices.push(`\n--- ${name} ---\n`, fs.readFileSync(file, "utf8"));
  }
  if (!names.length)
    notices.push(
      "No top-level license text in package. See the upstream package repository and npm metadata.",
    );
}
lines.push(
  "",
  "LibreOffice est utilisé comme programme externe installé séparément, sans redistribution de son binaire. Voir ses [informations de licence](https://www.libreoffice.org/about-us/licenses/).",
  "",
  "`image-size` est forcé en version 2.0.4 par `overrides` pour corriger les vulnérabilités de parsing des versions antérieures signalées par npm audit. Les exports utilisent des images intégrées, pas des chemins distants.",
  "",
);
fs.writeFileSync("THIRD_PARTY_NOTICES.md", lines.join("\n"));
fs.writeFileSync(
  "docs/THIRD_PARTY_LICENSES.txt",
  notices
    .join("\n")
    .replace(/\r\n/g, "\n")
    .replace(/[ \t]+$/gm, ""),
);
console.log(`${seen.size} notices de dépendances générées.`);
