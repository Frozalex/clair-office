# Sécurité et périmètre de l’alpha

Clair Office 0.1 est un atelier local. Le compagnon de conversion **n’est pas conçu pour être exposé sur Internet** ni pour traiter des documents hostiles dans une session de travail sensible.

Le front ne comporte ni compte, ni télémétrie, ni synchronisation distante. Le contenu est stocké en clair dans le navigateur. Une personne ayant accès au profil du navigateur peut le lire. Sauvegardez et retirez vos fichiers avant de partager un profil.

Les imports HTML passent par DOMPurify et le schéma Tiptap. Les images externes ne sont pas chargées par l’import DOCX ; le lecteur PPTX ne suit pas les relations externes. Les archives sont bornées avant expansion, les versions inconnues rejetées et les erreurs de sauvegarde visibles.

Le compagnon écoute uniquement sur l’interface loopback, contrôle Host/Origin, accepte un type de requête précis, limite les formats et les tailles, désactive les macros dans un profil temporaire et utilise des arguments de sous-processus sans shell. Les fichiers temporaires sont supprimés après traitement. Les liens vers des ressources externes OOXML non hypertextes sont refusés. Les formats binaires et OpenDocument ne bénéficient pas d’une analyse exhaustive de toutes leurs références ; le profil LibreOffice ne remplace pas une isolation système.

Pour traiter des documents non fiables, utilisez une machine ou un environnement éphémère sans données sensibles, sans accès réseau et avec des limites de ressources. Un service hébergé futur nécessitera authentification, isolation par tâche, restrictions réseau, quotas, mises à jour de sécurité et audit. Ne vous contentez pas de remplacer `127.0.0.1` par `0.0.0.0`.

Le navigateur utilise localStorage dans cette alpha. Les documents peuvent dépasser son quota ; l’erreur est signalée et un export Clair reste possible dans la limite du modèle. N’éditez pas simultanément le même espace dans plusieurs fenêtres.

Pour signaler une vulnérabilité, utilisez le signalement privé GitHub du dépôt s’il est activé. Sinon, demandez un canal de divulgation dans une issue sans joindre de secret, de document privé ni de charge d’exploitation.
