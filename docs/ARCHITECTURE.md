# Architecture

Monorepo pnpm en TypeScript. Chaque paquet gère ses propres dépendances.

## Stack

- **Monorepo** : pnpm workspaces
- **Node.js** : 24
- **TypeScript** : 5.9
- **API** : Express 5
- **Base de données** : PostgreSQL + Drizzle ORM (sessions stockées en base via `connect-pg-simple`)
- **Validation** : Zod (`zod/v4`), `drizzle-zod`
- **Codegen API** : Orval (à partir du spec OpenAPI)
- **Build API** : esbuild
- **Frontend** : React 19 + Vite + Tailwind CSS 4 + shadcn/ui

## Structure

```text
farm-manager/
├── artifacts/              # Applications déployables
│   ├── api-server/         # Serveur API Express
│   └── web/                # Interface React + Vite
├── lib/                    # Bibliothèques partagées
│   ├── api-spec/           # Spec OpenAPI + config Orval
│   ├── api-client-react/   # Hooks React Query générés
│   ├── api-zod/            # Schémas Zod générés depuis l'OpenAPI
│   ├── db/                 # Schéma Drizzle ORM + connexion
│   └── integrations-gemini-ai/  # Client Gemini (OCR des fiches)
├── scripts/                # Scripts utilitaires
├── pnpm-workspace.yaml     # Workspace pnpm
├── tsconfig.base.json      # Options TS partagées
└── tsconfig.json           # Références de projets TS
```

## TypeScript & projets composites

Chaque paquet étend `tsconfig.base.json`, qui active `composite: true`. Le
`tsconfig.json` racine liste tous les paquets en références de projets.

- **Toujours typechecker depuis la racine** — `pnpm run typecheck` lance
  `tsc --build`, qui construit le graphe de dépendances complet pour que les
  imports inter-paquets se résolvent. Lancer `tsc` dans un seul paquet échoue
  si ses dépendances n'ont pas été construites.
- **`emitDeclarationOnly`** — seuls les `.d.ts` sont émis au typecheck ; le
  bundling réel est fait par esbuild et Vite.
- **Références de projets** — si A dépend de B, le `tsconfig.json` de A doit
  lister B dans son tableau `references`.

## Scripts racine

| Commande | Effet |
| --- | --- |
| `pnpm run dev` | Serveur API en développement |
| `pnpm run dev:web` | Interface web en développement |
| `pnpm run db:push` | Applique le schéma Drizzle à la base |
| `pnpm run build` | Typecheck puis build de tous les paquets |
| `pnpm run typecheck` | `tsc --build` sur les références de projets |

## Paquets

### `artifacts/api-server` (`@workspace/api-server`)

Serveur Express 5. Les routes sont dans `src/routes/` et utilisent
`@workspace/api-zod` pour la validation des requêtes/réponses et
`@workspace/db` pour la persistance.

- `src/index.ts` — lit `PORT`, exécute le seed puis démarre Express
- `src/app.ts` — CORS, parsing JSON/urlencoded, sessions, montage des routes sur `/api`
- `src/lib/seed.ts` — table de sessions, paramètres par défaut, compte admin initial
- `src/lib/parametres.ts` — cache des paramètres (TTL 60 s), courbe de poids de référence COBB 500
- `src/routes/health.ts` — `GET /api/healthz`

### `artifacts/web` (`@workspace/web`)

Interface React + Vite en français.

**Pages** : `/dashboard`, `/financement`, `/devis`, `/depenses`, `/infrastructure`,
`/bandes`, `/bandes/:id`, `/stocks`, `/simulation`, `/tresorerie`, `/planification`,
`/historique-caisse`, `/comparaison-bandes`, `/activity-log`, `/utilisateurs`,
`/parametres`.

**Authentification** : session par cookie (express-session), mots de passe hachés
avec bcrypt.

**Exports** : PDF via `jspdf` + `jspdf-autotable`, Excel via `xlsx`. Les rapports
agrègent par catégorie + désignation avec sous-totaux et total général. L'en-tête
reprend le paramètre `nom_ferme`.

**Nom de l'exploitation** : `src/lib/ferme.ts` expose `useNomFerme()` (hook,
met aussi à jour le titre de l'onglet), `getNomFerme()` (lecture synchrone pour
les exports PDF) et `setNomFerme()` (à appeler après modification du paramètre).
La valeur est mise en cache dans `sessionStorage`.

**Graphiques** : recharts (courbes de mortalité et de croissance, répartition des
coûts, simulations, trésorerie).

**Stocks** : API personnalisée hors OpenAPI — tables `stock_aliments` et
`stock_medicaments`, hooks dans `src/lib/stocks-api.ts`.

### `lib/db` (`@workspace/db`)

Couche base de données Drizzle ORM + PostgreSQL.

- `src/index.ts` — `Pool` pg + instance Drizzle, réexporte le schéma
- `src/schema/index.ts` — barrel des modèles
- `drizzle.config.ts` — config Drizzle Kit (requiert `DATABASE_URL`)
- Application du schéma : `pnpm run db:push` (ou `push-force` en dernier recours)

### `lib/api-spec` (`@workspace/api-spec`)

Détient `openapi.yaml` et `orval.config.ts`. Le codegen alimente deux paquets
frères : `lib/api-client-react/src/generated/` et `lib/api-zod/src/generated/`.

Régénérer après modification du spec :

```bash
pnpm --filter @workspace/api-spec run codegen
```

### `lib/api-zod` / `lib/api-client-react`

Code **généré** — ne pas éditer à la main. Schémas Zod d'un côté, hooks React
Query et client fetch de l'autre.

### `lib/integrations-gemini-ai` (`@workspace/integrations-gemini-ai`)

Client Gemini pour l'OCR des fiches de suivi papier.

- `src/config.ts` — lit `GEMINI_API_KEY` (obligatoire) et `GEMINI_BASE_URL` (optionnel)
- Chargement paresseux depuis `routes/ocr-fiche.ts` : si la clé est absente,
  seule cette route échoue, le serveur démarre normalement
- Route : `POST /api/ocr-fiche` (multipart, champ `photo`, 8 Mo max, authentification requise)

## Logique métier

### Trésorerie

```
soldeCourant = totalFinancement
             - totalConstruction
             - totalDepensesBandes
             - totalDepensesVente
             + totalRecettesBandes
             - totalRemboursements
```

`caisseDisponible` sur le tableau de bord applique la même formule.
`/historique-caisse` couvre toutes les catégories : financement, sorties d'argent,
carburant, remboursements, construction (bâtiment + puits), production
(dépenses de bandes), ventes et frais de vente.

### Infrastructure (chantiers)

Tables `chantiers`, `chantier_lots`, `chantier_depenses`, `chantier_devis_lignes`.
La clôture d'un chantier crée une entrée dans `actifs` pour le suivi de
l'amortissement. `bande_actifs` relie un actif à une bande via `fraction_utilisee`.

### Suivi de production

Tables `mortalite_journaliere`, `consommation_aliment`, `consommation_eau`,
`pesees`, `traitements`, `observations_journal`, `vaccinations`.

- Analyse de mortalité par phase : démarrage (J1-15), croissance (J16-28),
  finition (J29-45), réformé (J46+)
- Pesées comparées à la courbe de référence COBB 500 (`REFERENCE_WEIGHT_CURVE`)
- Indice de conversion (IC) calculé par phase, seuils configurables

### Paramètres configurables

Table `parametres`, éditable depuis `/parametres` (lecture pour tous les rôles,
écriture réservée à l'admin). Catégories : Identité (`nom_ferme`, `devise`),
Charges fixes, Alertes, Indice de conversion, Budget construction, Calendrier
vaccinal.

Les nouveaux paramètres ajoutés au fil des versions sont insérés au démarrage
sans écraser les valeurs déjà réglées par l'exploitant (voir `seedParametres`
dans `src/lib/seed.ts`).

## Conventions

- Montants en devise configurable (`FCFA` par défaut), interface en français
- Pas d'emoji dans l'interface
- Typographie : Inter (corps), Fraunces (titres h1-h3)
- Palette : vert forêt (primaire), ambre doré (secondaire), terracotta (accent),
  crème chaud (fond)
