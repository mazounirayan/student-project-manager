# Étude de cas factuelle

## Problème représenté

Le modèle distingue promotions, projets, groupes, livrables, rapports, grilles de notation et soutenances. Ce périmètre illustre la coordination pédagogique ; il ne prouve pas une utilisation en établissement.

## Choix visibles dans le code

L’interface utilise Next.js App Router, React, TypeScript, Tailwind et des composants Radix. L’API utilise Express, TypeORM et MySQL, avec JWT, contrôles de rôle et documentation Swagger. Les principales interactions sont côté client. Le projet ne possède pas de mesure documentée de temps gagné, performance ou adoption.

## Remise en état

Le démarrage backend utilisait le port 3000 alors que les clients attendaient 4000. Le port par défaut est désormais 4000. Un import inutilisé vers un fichier interne de Faker et des dépendances backend sans usage ont été retirés. Les secrets JWT n’utilisent plus de valeurs de secours publiques. La création automatique du schéma doit être activée explicitement en développement.

L’accueil présentait des nombres, événements et échéances codés en dur sans source API. Il a été remplacé par des accès vers les espaces métier. Le formulaire de connexion propose le flux réellement câblé : le bouton Google appelait une route GET absente et a été retiré. Les contrôles TypeScript du build frontend ont été rétablis.

## Attribution

Les rôles et contributions individuels ne sont pas reconstitués à partir de ce dossier. Avant une publication de portfolio, confirmer avec les membres de l’équipe ce qui peut être attribué et publié. Les captures ne doivent contenir que des données fictives.
