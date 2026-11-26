# Sécurité

Ce projet d'études n'a pas été audité pour traiter de vraies données étudiantes.

Ce qui est en place :

- deux secrets JWT distincts, d'au moins 32 caractères, obligatoires au démarrage ;
- la synchronisation automatique du schéma est refusée en production ;
- l'inscription publique et la connexion Google créent uniquement des comptes étudiants ;
- chaque route enseignant vérifie que le projet appartient à l'enseignant connecté ;
- un étudiant n'accède qu'aux rendus, rapports et notes de son groupe, et seulement aux notes publiées ;
- les fichiers rendus ne sont pas servis publiquement ;
- les envois de fichiers sont limités en type et en taille, et les chemins de fichiers ne sont jamais renvoyés au client ;
- les mots de passe, jetons de réinitialisation (stockés hachés) et identifiants OAuth ne sont jamais sérialisés ;
- les routes d'authentification sont limitées en débit.

Ce qui reste à faire avant un usage réel :

- la révocation des jetons de rafraîchissement ;
- la vérification de l'adresse e-mail pour la connexion Microsoft ;
- le remplacement de `xlsx`, qui a des avis de sécurité connus et n'est utilisé que pour l'import de listes d'étudiants par un enseignant ;
- une politique de conservation des fichiers.

Pour signaler un problème, ouvrez une issue sans y mettre de secret ni de donnée personnelle.
