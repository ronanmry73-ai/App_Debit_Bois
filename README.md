# Débit Bois

Calculateur de débit de panneaux (références paramétrables, formats d’origine 2500 × 400 mm et 2500 × 600 mm conservés), plans de découpe, devis HT/TTC, stocks atelier et projets locaux. Trois modes : **Atelier** (plans et fiche PDF), **Stock**, **Devis** (PDF client). Le projet est un fichier : nouveau / ouvrir / enregistrer. Tout tourne hors ligne : débit, prix, catalogue et projets sont enregistrés en `localStorage` (et, sous Electron, dans un fichier du dossier userData). Pas de compte, pas de base distante.

## Lancer en local

Node 22+ recommandé.

```bash
npm install
npm run dev
```

Ouvre l’adresse indiquée par Vite (souvent `http://localhost:8080`).

Autres commandes :

```bash
npm run build       # production + dossier dist/ (Cloudflare Pages)
npm run typecheck
npm run desktop     # fenêtre native Electron
```

## Application desktop

Voir [DESKTOP.md](DESKTOP.md) pour :

1. Installer comme PWA depuis Chrome / Edge
2. Lancer une fenêtre Electron (`npm run desktop`)
3. Produire un installateur `.exe` / `.dmg` / AppImage (`npm run desktop:dist`)

## Déployer sur Cloudflare Pages

Le PC Electron reste la source de vérité. Le téléphone ouvre le **même** build web, en PWA (mode Terrain).

Réglages (aussi dans `wrangler.toml`) :

| | |
|---|---|
| Commande de build | `npm run build` |
| Dossier de sortie | `dist` |

Variable d’environnement (build Pages, **pas un secret**) :

`VITE_GOOGLE_CLIENT_ID` — ID client OAuth **Application Web** (Google Cloud Console, API Drive activée). Origines JS : l’URL Pages + `http://localhost:8080`. Voir [`.env.example`](.env.example) et le commentaire en tête de [`wrangler.toml`](wrangler.toml).

Sur le téléphone : **Lier Google Drive** (dossier `Sauvegarde Débit Bois ERP`). Stock / plans / devis se lisent dans `debit-bois-dernier.json` (écriture **PC seulement**). Chaque Entrée/Sortie enrichit `mouvements-pending.json`. Sans lien : import / export JSON et **Envoyer le carnet** restent disponibles.

Un mouvement n’est retiré du téléphone qu’une fois le carnet appliqué par le PC, puis confirmé dans `debit-bois-dernier.json`. Tant qu’il ne l’est pas, il reste en attente et sera renvoyé : un envoi réussi ne vaut pas preuve d’application.

Sur le PC : le bandeau **Appliquer** apparaît au focus, ou **Importer le carnet** à la main. Un mouvement dont la référence est introuvable reste en attente au lieu d’être ignoré.

## Déployer sur Vercel

Le projet est déjà configuré avec le preset Nitro `vercel`.

1. Compte sur [vercel.com](https://vercel.com).
2. Importe le dépôt Git, **ou** depuis ce dossier :

```bash
npm i -g vercel
npx vercel
```

Aucune variable d’environnement n’est nécessaire. Le build est `npm run build`.

## Contenu utile

| Dossier | Rôle |
|---|---|
| `src/lib/packing.ts` | Calepinage 2D (MaxRects / Guillotine) |
| `src/lib/catalog.ts` | Familles et références de panneaux |
| `src/lib/projects.ts` | Projets enregistrés |
| `src/lib/persist.ts` | Sauvegarde locale (localStorage + fichier Electron) |
| `src/lib/pricing.ts` | Prix de vente, TVA |
| `src/lib/stock.ts` | Stocks panneaux et quincaillerie |
| `src/routes/index.tsx` | Page unique |
| `electron/` | Coque desktop (Electron) |
| `public/og.jpg` | Image de partage |

Unités en millimètres. Deux sorties PDF distinctes : fiche atelier (plans) et devis client. Impression via le navigateur ou `Ctrl+P` dans Electron.
