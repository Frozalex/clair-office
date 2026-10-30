# Architecture et choix des bases

## Comparaison initiale

| Base                                                                                     | Usage                                                    | Licence annoncée                                               | Choix pour Clair                                                             |
| ---------------------------------------------------------------------------------------- | -------------------------------------------------------- | -------------------------------------------------------------- | ---------------------------------------------------------------------------- |
| [ONLYOFFICE DocumentServer](https://github.com/ONLYOFFICE/DocumentServer)                | Suite collaborative et compatibilité OOXML étendue       | AGPL-3.0 et conditions supplémentaires indiquées par l’éditeur | Plus complet, mais infrastructure et interface plus couplées ; non incorporé |
| [Tiptap](https://github.com/ueberdosis/tiptap) / [ProseMirror](https://prosemirror.net/) | Édition riche sans interface imposée                     | MIT pour les composants libres retenus                         | Moteur du document, historique et schéma                                     |
| [PptxGenJS](https://github.com/gitbrent/PptxGenJS)                                       | Génération de PPTX                                       | MIT                                                            | Export d’objets modifiables                                                  |
| [docx](https://github.com/dolanmiu/docx)                                                 | Génération de DOCX                                       | MIT                                                            | Export du modèle documentaire                                                |
| [Mammoth](https://github.com/mwilliamson/mammoth.js)                                     | Import sémantique DOCX                                   | BSD-2-Clause                                                   | Contenu HTML sanitisé puis reconstruit avec le schéma Tiptap                 |
| [LibreOffice](https://www.libreoffice.org/)                                              | Lecture et conversion des formats historiques et ouverts | MPL-2.0 / licences du projet                                   | Compagnon local indépendant ; non redistribué                                |

Ces bibliothèques fournissent les fondations. L’interface, le modèle de présentation, les parcours, le stockage et le compagnon sont propres à Clair. Le projet ne copie ni code ni ressources Microsoft.

## Organisation

- `src/App.tsx` : espace de fichiers et orchestration.
- `src/components/DocumentEditor.tsx` : Tiptap, plan, outils contextuels.
- `src/components/PresentationEditor.tsx` et `SlideCanvas.tsx` : canevas 16:9, objets, notes et navigation.
- `src/lib/model.ts` : schémas Zod, modèles, conversion document → diapositives.
- `src/lib/storage.ts` : stockage versionné et erreurs explicites.
- `src/lib/export.ts` : exports DOCX/PPTX chargés à la demande.
- `src/lib/import.ts`, `import-pptx.ts`, `office-zip.ts` : imports et validation des entrées.
- `server/converter.py` : service HTTP Python local et exécution isolée par dossier/profil LibreOffice.

Le front est une application React/TypeScript construite avec Vite. Aucune API métier distante n’est requise. Les unités du canevas sont des pourcentages et une taille de texte référencée à 960 × 540. L’export utilise un format large 13⅓ × 7½ pouces et des objets natifs PowerPoint.

## Versionnement et sécurité des données

Le format `.clair` porte `format: "clair-office"`, `version: 1` et un `item`. Un numéro de version inconnu est rejeté. Les futurs changements incompatibles doivent fournir une migration. Les archives sont bornées avant expansion et les liens externes incorporés sont exclus de l’import. Le schéma n’est pas un moteur OOXML universel.

Le service de conversion n’est pas un serveur multiutilisateur de production. Voir `SECURITY.md` avant tout déploiement. Un hébergement statique n’inclut pas ce compagnon ; ne pas annoncer les conversions historiques comme disponibles sans moteur.
