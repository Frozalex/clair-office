# Contribuer à Clair Office

1. Ouvrez une issue avec le comportement attendu, le contexte et les étapes de reproduction. Pour un problème d’import, utilisez un fichier de test sans données personnelles.
2. Travaillez sur une branche à partir de `main`.
3. Installez les dépendances avec `npm ci`.
4. Exécutez `npm run check`, `npm run build` et `python3 -m unittest discover -s server -v`.
5. Pour une modification des formats, ajoutez un test qui contrôle le contenu réellement produit. Si LibreOffice est disponible, exécutez `python3 server/smoke_office.py` après les tests JavaScript.
6. Décrivez le problème, le changement et les limites restantes dans la pull request.

Principes : commandes compréhensibles, accessibilité au clavier, origine des dépendances documentée, avertissements honnêtes sur la fidélité, aucun contenu utilisateur envoyé vers un service tiers sans action explicite.

Ne versionnez ni `node_modules`, ni fichiers privés, ni clés, ni binaires LibreOffice. Le schéma `.clair` est un contrat versionné. Toute rupture nécessite une migration. Les contributions de code original sont sous licence MIT ; conservez les notices des composants réutilisés.
