# Déploiement et garde-fous CI

## Branches

- `main` est la branche de production observée par Render.
- `dev` est la branche d'intégration.
- Les branches de travail partent de `dev`, par exemple `codex/issue-2-pwa-shell`, puis ouvrent une PR vers `dev`.
- Une mise en production passe par une PR de `dev` vers `main`.

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
