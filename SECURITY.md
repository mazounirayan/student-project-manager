# Sécurité

Ce prototype ne doit pas traiter de vraies données étudiantes avant un audit des autorisations et des fichiers déposés. Signaler un problème de sécurité en privé au propriétaire du dépôt via un canal vérifié ; aucun contact officiel n’est établi dans ce dossier. Ne pas mettre de jeton, mot de passe ou donnée personnelle dans une issue publique.

Les secrets JWT doivent contenir au moins 32 caractères et être différents pour l’accès et le rafraîchissement. Les exemples d’environnement ne sont pas des secrets utilisables. Le serveur refuse de démarrer sans secrets suffisamment longs. La synchronisation automatique du schéma est bloquée en production.

Les inscriptions publiques et OAuth créent uniquement des étudiants. Un enseignant doit être provisionné par un opérateur local. Les uploads ne sont plus servis publiquement : le téléchargement d’un dépôt nécessite une session et l’appartenance au groupe ou la propriété du projet enseignant. Les chemins sortant du dossier uploads sont rejetés.

La modification de profil accepte seulement le prénom et le nom : elle ne permet pas de modifier le rôle ou le mot de passe. Les mots de passe et jetons de réinitialisation sont exclus de la sélection par défaut et de la sérialisation JSON des utilisateurs.

Points à traiter avant exposition : audit complet des autorisations par ressource, sessions stockées dans localStorage, révocation des refresh tokens, configuration SMTP, OAuth et politique de conservation.

Si un secret a déjà été publié, le retirer du fichier actuel ne suffit pas : le révoquer puis examiner l’historique Git avant de publier. Aucun audit complet de l’historique n’est revendiqué ici.
