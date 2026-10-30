# Une politique de conversion honnête

## Trois parcours distincts

1. **Clair → Clair** : conservation du modèle natif v1 et de ses objets pris en charge. Le schéma est validé à l’import ; une copie reçoit un nouvel identifiant pour éviter l’écrasement d’un fichier existant.
2. **Office → copie éditable Clair** : conversion sémantique via Mammoth (texte) ou extraction OOXML bornée (présentation). Avertissement obligatoire avant ouverture de la copie. L’original reste sur le disque de l’utilisateur. Les objets non compris ne sont pas conservés dans le modèle natif.
3. **Office → autre format Office / PDF** : le fichier original est transmis au compagnon local. LibreOffice travaille dans un dossier temporaire et un profil neuf. Le résultat est téléchargé sous un nouveau nom ; le chemin de l’original n’est jamais communiqué au convertisseur. Les octets source ne sont pas modifiés. HTML est livré en ZIP avec ses ressources.

## La fidélité n’est pas un booléen

- **Contenu** : caractères, images, données de tableaux, notes.
- **Apparence** : positions, pagination, polices, couleurs, recadrages.
- **Éditabilité** : paragraphes, objets, styles, groupes et relations.
- **Comportement** : champs, animations, macros, médias, liens externes.

Un PDF peut préserver une apparence obtenue par le convertisseur, mais ne conserve pas les animations. Un TXT préserve du texte mais pas la mise en page. Un autre moteur peut remplacer une police manquante. Les formats ne permettent pas tous de représenter les mêmes objets.

## Ce qui est vérifié

Les tests OOXML contrôlent les parties ZIP attendues, le texte, des styles, le nombre de diapositives, leurs positions et les notes. Les tests LibreOffice contrôlent la production des destinations, la signature PDF, le retour vers un format XML et l’absence de modification des originaux. Les tests de même format comparent les octets exactement.

Ce sont des tests de cohérence, **pas une preuve de fidélité absolue**. Une comparaison raster automatique, un rapport de polices et la détection approfondie des éléments non pris en charge restent à construire.

## Recommandation d’usage

Conserver l’original, travailler sur une copie et contrôler le résultat dans le logiciel destinataire. Pour un document complexe, privilégier la conversion directe de l’original plutôt qu’un import dans le modèle simplifié de Clair. Comparer les pages et diapositives clés, en particulier celles avec graphiques, équations, images et éléments incorporés.

## Sources des limites et filtres

- [LibreOffice : formats Microsoft Office](https://help.libreoffice.org/latest/en-US/text/shared/guide/ms_user.html)
- [LibreOffice : filtres de conversion](https://help.libreoffice.org/latest/en-US/text/shared/guide/convertfilters.html)
- [Microsoft : formats et compatibilité](https://support.microsoft.com/en-us/office/collab-files/learn-about-file-formats)
- [Mammoth : conversion sémantique et sécurité](https://github.com/mwilliamson/mammoth.js)
