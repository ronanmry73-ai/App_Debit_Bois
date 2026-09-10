# Débit Bois

Calculateur de débit de panneaux (2500 × 400 mm et 2500 × 600 mm), plans de découpe, devis HT/TTC et stocks atelier. Tout tourne dans le navigateur : débit, prix et stocks sont enregistrés en `localStorage`. Pas de compte, pas de base distante.

## Lancer en local

Node 22+ recommandé.

```bash
npm install
npm run dev
```

Ouvre l’adresse indiquée par Vite (souvent `http://localhost:8080`).

Autres commandes :

```bash
npm run build       # production (sortie Vercel / Nitro)
npm run typecheck
```

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
| `src/lib/pricing.ts` | Prix de vente, TVA |
| `src/lib/stock.ts` | Stocks panneaux et quincaillerie |
| `src/routes/index.tsx` | Page unique |
| `public/og.jpg` | Image de partage |

Unités en millimètres. Impression / PDF via le navigateur.
