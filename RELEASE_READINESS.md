# Préparation à une publication

État au 11 octobre 2026 : prototype remis en état, publication publique encore conditionnelle.

## Vérifications réalisées

- Dépendances backend et frontend installées avec npm ; lockfiles npm disponibles.
- Compilation TypeScript backend réussie après correction des paramètres Express 5.
- `npm --prefix backend test` : compilation réussie et 5 tests natifs Node réussis (identifiants de ressources, configuration JWT, inscription étudiante, protection de la modification de profil et exclusion des secrets JSON).
- Aucun fichier `.env`, export SQL/CSV/XLSX ou clé PEM suivi détecté dans ce sous-projet via `git ls-files`. Ce contrôle ne constitue pas un audit de l’historique.
- Les indicateurs fictifs de l’accueil, le lien Google absent et les logs de données utilisateur dans le contexte de session ont été retirés.
- Les inscriptions publiques et OAuth créent des étudiants ; les enseignants se provisionnent uniquement par commande locale de confiance.
- Les uploads ne sont plus exposés statiquement ; leur téléchargement contrôle la session, l’appartenance au groupe ou la propriété du projet et le chemin du fichier.
- Le propriétaire a confirmé les droits nécessaires et choisi Apache 2.0. Les attributions et licences tierces doivent être conservées.

- `npm --prefix frontend run build` : réussi avec validation TypeScript et pré-rendu de 15 pages ; les routes dynamiques sont générées pour le rendu à la demande. Le build Windows a nécessité une exécution avec accès élargi après une erreur EPERM dans les fichiers générés.
- Les gardes de session corrigent les six appels avec jeton nullable. L’alias `@/` est explicite et les utilitaires de date ne sont plus exportés depuis les pages App Router.
- Démarrage de l’interface compilée sur un port local de revue (3011) et requête HTTP : statut 200. Cela confirme le service HTTP, pas une connexion utilisateur ni une validation visuelle.

## Avant publication sur GitHub

Les essais avec MySQL n’ont pas été exécutés : `docker info` échoue car le pipe `dockerDesktopLinuxEngine` est absent (daemon Docker Desktop non démarré). Aucun conteneur ni aucune base existante n’a été modifié.

- Vérifier que les attributions historiques et les licences tierces accompagnent bien la publication Apache 2.0.
- Examiner tout l’historique Git et les médias pour les secrets/données personnelles ; révoquer tout secret réellement publié.
- Auditer les dépendances et leur maintenance. La branche historique de Next.js et les bibliothèques de traitement de fichiers nécessitent une revue avant exposition.
- Valider le build frontend et les parcours réels sur MySQL jetable : enseignant, promotion, étudiants, groupe, projet, livrable, rapport, notation, soutenance et rafraîchissement de session.
- Vérifier toutes les autorisations par ressource et tester les protections des inscriptions et téléchargements avec plusieurs comptes.
- Créer et tester des migrations, désactiver toute synchronisation destructive, tester sauvegarde/restauration et configurer SMTP/OAuth si utilisés.
- Exécuter la CI fournie après export dans un dépôt autonome ; ne pas afficher de badge vert avant un run vérifié.

Aucun déploiement, push GitHub ou message LinkedIn n’a été réalisé. Les propositions de texte sont préparées dans `LINKEDIN.md`.

Le projet utilise désormais npm comme gestionnaire unique ; le lockfile pnpm historique a été retiré. Les scripts de lint sans configuration et de seed sans implémentation ont été retirés.
