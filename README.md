# Farm Manager — Gestion d'exploitation avicole

Application web de gestion pour un élevage de poulets de chair : suivi des bandes,
dépenses, ventes, investissements, chantiers de construction et trésorerie.
Interface entièrement en français.

Le projet est livré **sans aucune donnée** : au premier démarrage, seuls un compte
administrateur et des paramètres de référence sont créés. Toutes les données de
l'exploitation se saisissent depuis l'application.

---

## Fonctionnalités

| Module | Description |
| --- | --- |
| **Tableau de bord** | Caisse disponible, investissements, dépenses, bandes en cours, prochaines vaccinations |
| **Bandes de poulets** | Cycles de production : mortalité journalière, pesées, consommation aliment et eau, indice de conversion, traitements, journal d'observations, calendrier vaccinal |
| **Dépenses & ventes** | Saisie par catégorie avec suggestions de désignations, export PDF et Excel |
| **Financement** | Investissements, remboursements, soldes par investisseur |
| **Infrastructure** | Chantiers de construction découpés en lots, devis budgétaire, suivi d'avancement, création d'actifs amortissables |
| **Stocks** | Aliments et médicaments/vaccins, entrées/sorties, alertes de péremption |
| **Trésorerie** | Historique complet des mouvements, prévisions, comparaison entre bandes |
| **Simulation & planification** | Simulateur de rentabilité, seuil de rentabilité, calendrier des bandes futures |
| **Administration** | Utilisateurs et rôles, journal d'activité, paramètres configurables |

**Rôles** : `admin` (accès complet), `gestionnaire` (dépenses et ventes),
`investisseur` (lecture seule), `lecteur` (lecture seule, attribué aux comptes
créés par auto-inscription).

---

## Prérequis

- **Node.js 24** ou supérieur
- **pnpm 9** ou supérieur — `npm install -g pnpm`
- **PostgreSQL 16** ou supérieur

---

## Installation

```bash
pnpm install
```

Créez la base de données puis le fichier de configuration :

```bash
createdb farm_manager && cp .env.example .env
```

Ouvrez `.env` et renseignez au minimum `DATABASE_URL`. Créez ensuite les tables :

```bash
pnpm run db:push
```

---

## Démarrage en développement

Deux processus, dans deux terminaux :

```bash
pnpm run dev
```

```bash
pnpm run dev:web
```

Le premier lance l'API sur le port 8080, le second l'interface sur le port 5173
(les appels `/api` y sont automatiquement redirigés vers l'API).

Ouvrez ensuite <http://localhost:5173>.

### Première connexion

Identifiants par défaut : **`admin`** / **`admin`**.

> **Changez ce mot de passe immédiatement.** Pour définir d'autres identifiants
> dès le départ, renseignez `ADMIN_USERNAME` et `ADMIN_PASSWORD` dans `.env`
> **avant** le tout premier démarrage.

### Personnaliser le nom de l'exploitation

Connectez-vous en tant qu'admin, allez dans **Paramètres → Identité** et modifiez
`nom_ferme`. Le nom apparaît alors dans la barre latérale, sur l'écran de
connexion, dans l'onglet du navigateur et en en-tête des rapports PDF exportés.

La devise (`FCFA` par défaut) se règle au même endroit.

---

## Mise en production

```bash
pnpm run build
```

Le build produit :

- `artifacts/api-server/dist/index.mjs` — serveur API (bundle Node)
- `artifacts/web/dist/public/` — fichiers statiques du frontend

Démarrage du serveur API :

```bash
NODE_ENV=production node --enable-source-maps artifacts/api-server/dist/index.mjs
```

Variables d'environnement requises en production : `DATABASE_URL`, `PORT`,
`SESSION_SECRET` (au moins 32 caractères aléatoires — le serveur refuse de
démarrer sans). Servez le contenu de `artifacts/web/dist/public/` via votre
serveur web (nginx, Caddy…) en redirigeant `/api` vers le serveur Node et toutes
les autres routes vers `index.html`.

---

## Fonctionnalité optionnelle : scan des fiches papier (OCR)

L'application peut lire une photo de fiche de suivi manuscrite et en extraire
automatiquement les données (aliment, eau, mortalité, poids, observations) via
l'API Gemini de Google.

Pour l'activer, créez une clé sur <https://aistudio.google.com/apikey> et
renseignez `GEMINI_API_KEY` dans `.env`. Sans cette clé, tout le reste de
l'application fonctionne normalement — seul le bouton de scan renvoie une erreur.

---

## Import d'un historique existant

Si vous tenez déjà un suivi dans un classeur Excel, la page **Bandes** propose
un bouton *Importer historique*. Chaque feuille du classeur est importée comme
une bande distincte. Les colonnes (jour, date, effectif, mortalité, aliment, eau,
poids, traitements, observations) sont détectées automatiquement depuis la ligne
d'en-tête. Les feuilles sans données exploitables sont ignorées.

---

## Documentation technique

L'architecture du monorepo, les conventions TypeScript et le détail des paquets
sont décrits dans [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md).

---

## Licence

MIT.
