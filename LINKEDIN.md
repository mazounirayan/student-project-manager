# Angles LinkedIn

Ces propositions décrivent les constats de la remise en état, sans attribuer la conception historique à une personne. À adapter après vérification des contributions de l’équipe.

## Un écran crédible commence par ses données

« En reprenant une plateforme de projets étudiants, j’ai retrouvé un tableau de bord qui affichait des nombres et des échéances codés en dur. J’ai remplacé ces indicateurs par des accès utiles vers les espaces métier. La prochaine étape est de brancher des indicateurs issus de l’API, avec leurs états de chargement et d’erreur. »

Preuve : `frontend/app/page.tsx`. Ne pas annoncer d’amélioration d’engagement sans mesure.

## Un port peut bloquer toute une application

« Les clients HTTP attendaient le backend sur 4000 ; le serveur utilisait 3000, comme l’interface. La remise en état a commencé par aligner le démarrage, les exemples de configuration et la documentation. Une petite incohérence peut masquer une architecture pourtant déjà présente. »

Preuves : `backend/src/server.ts`, `frontend/.env.local.example`, README.

## Préparer un projet d’équipe à la publication

« Nettoyer un dépôt ne suffit pas à le rendre publiable : il faut aussi décrire les limites, vérifier les droits de l’équipe et éviter les données étudiantes dans les exemples. J’ai préparé les instructions locales et une liste des vérifications restantes, sans présenter ce prototype comme un service déjà exploité. »

Preuves : README, SECURITY et RELEASE_READINESS. Les droits ont été confirmés par le propriétaire et Apache 2.0 a été choisi ; la publication GitHub elle-même reste une étape distincte.
