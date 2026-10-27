# AGENTS.md — Forestar Operator

Application interne des opérateurs terrain (saisie des réparations). Elle consomme l'API de `forestar-server`, routes `/operator/*`.

## Stack

React 18 (Create React App, `react-scripts` 5), MUI 6, TypeScript, `react-leaflet` pour les cartes, `@forestar-be/core` pour la session SSO. Pas de Redux : l'état est local aux pages. Pas de Tailwind.

## Commandes

Le gestionnaire est pnpm (`packageManager` dans `package.json`).

```bash
pnpm start            # développement
pnpm run build        # build de production
pnpm run types:check  # tsc
pnpm run lint
pnpm run format:check
pnpm run test:app-menu      # jest (jest.app-menu.config.cjs), seule zone testée
pnpm run test:print-tickets # sous-ensemble : impression des tickets
```

## Authentification

Deux chemins embarqués, un seul actif, choisi au build par `REACT_APP_AUTH_MODE` (`src/hooks/session.ts`) :

- `oidc` : session SSO via `@forestar-be/core`, rôles admis `forestar.operator` et `forestar.admin` ;
- autre valeur : ancien login (`src/pages/Login.tsx`) avec `REACT_APP_AUTH_TOKEN`.

Importer `@forestar-be/core` par sa racine, jamais par son sous-chemin `/auth` (il dépend de `next/navigation`, que ce bundle ne doit pas embarquer).

## Variables d'environnement

`REACT_APP_API_URL`, `REACT_APP_AUTH_MODE`, `REACT_APP_AUTH_TOKEN` (voir `.env.template`). Les variables `REACT_APP_*` sont figées au build.

## Mémoire du dépôt (wiki)

Avant un travail non trivial, lire le catalogue `docs/agent-memory/README.md` ; en fin de
travail, mettre à jour l'entrée concernée ou en créer une (protocole :
[.agents/guides/memory.md](.agents/guides/memory.md)). Commandes, avec Node ≥ 22.18 :
`node --disable-warning=MODULE_TYPELESS_PACKAGE_JSON tools/agent-memory/check.ts` et `node tools/agent-memory/impact.ts` (ou `pnpm run memory:check` / `memory:impact`).
