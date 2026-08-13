# Déploiement et garde-fous CI

## Branches

- `main` est la branche de production observée par Render.
- `dev` est la branche d'intégration.
- Les branches de travail partent de `dev`, par exemple `codex/issue-2-pwa-shell`, puis ouvrent une PR vers `dev`.
- Une mise en production passe par une PR de `dev` vers `main`.

## Règle MVP

Chaque mise à jour de `main` doit correspondre à un MVP déployable : un incrément complet, validé et utilisable en production.

Un commit ou une PR peut être mergé dans `main` seulement si :

- la CI est verte ;
- le changement ne laisse pas de parcours utilisateur cassé ou inaccessible ;
- le changement apporte une valeur exploitable en production, même limitée ;
- les migrations, variables d'environnement ou actions manuelles nécessaires sont documentées ;
- Render peut déployer le commit sans dépendre d'un artefact local non versionné.

Les commits techniques intermédiaires peuvent rester sur une branche feature ou sur `dev`. Ils ne doivent rejoindre `main` qu'une fois regroupés dans un MVP cohérent, par exemple :

- `release: responsive PWA shell MVP`
- `release: dashboard mobile MVP`
- `release: bandes responsive MVP`

## GitHub Actions

Le workflow `CI` vérifie les PR vers `dev` et `main`, ainsi que les push directs sur ces deux branches.

Il exécute :

- `pnpm install --frozen-lockfile`
- `pnpm run typecheck`
- `pnpm run test`
- `pnpm -r --if-present run build`
- un contrôle qui empêche de re-versionner les artefacts générés (`dist` et `dev-dist`)

## Protection de `main`

Pour éviter une actualisation Render avant validation, configure `main` dans GitHub avec ces règles :

- exiger une pull request avant merge ;
- exiger que les status checks passent avant merge ;
- sélectionner le check `CI / Typecheck and build` ;
- exiger que la branche soit à jour avant merge ;
- bloquer les push directs sur `main`, y compris pour les administrateurs si tu veux une protection stricte.

Avec cette configuration, Render continue d'observer `main`, mais `main` ne reçoit que du code déjà validé par la CI.
