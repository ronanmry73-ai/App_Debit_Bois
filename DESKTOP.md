# Débit Bois — application desktop

L’app Grok est une appli web (Vite + React) qui enregistre tout en `localStorage`.
Aucune base distante n’est requise. Pour en faire une appli bureau, trois voies.

## 1. La plus simple : installer comme application (PWA)

Chrome ou Edge, une fois l’app ouverte (`npm run dev` ou le site déployé) :

1. Icône **installer** dans la barre d’adresse, ou menu ⋮ → **Installer Débit Bois**.
2. L’app s’ouvre dans sa propre fenêtre, sans barre d’URL.
3. Les données restent dans le navigateur (même profil).

Sur Windows, un raccourci apparaît dans le menu Démarrer.

## 2. Fenêtre native Electron (recommandé en local)

Prérequis : [Node.js 22+](https://nodejs.org/).

```bash
git clone https://github.com/ronanmry73-ai/App_Debit_Bois.git
cd App_Debit_Bois
npm install
npm run desktop
```

`npm run desktop` démarre le serveur Vite s’il n’est pas déjà lancé, puis ouvre
une fenêtre **Débit Bois** (menus Fichier / Impression PDF inclus, `Ctrl+P`).

Le serveur web et la fenêtre Electron sont deux processus. Fermer la fenêtre
arrête Electron ; le serveur Vite lancé à part continue jusqu’à `Ctrl+C`.

### Deux terminaux (debug)

```bash
npm run dev          # http://127.0.0.1:8080
npm run desktop:win  # ouvre Electron sur cette URL
```

## 3. Installateur .exe / .dmg / AppImage

Sur **la machine cible** (Windows pour un .exe, macOS pour un .dmg) :

```bash
npm install
npm run build
npm run desktop:dist
```

Les fichiers sortent dans `release/` :

| OS | Fichier |
|---|---|
| Windows | `release/Débit Bois Setup x.y.z.exe` (NSIS) |
| macOS | `release/Débit Bois-x.y.z.dmg` |
| Linux | `release/Débit Bois-x.y.z.AppImage` |

L’installeur embarque Chromium. Taille typique : 150–200 Mo.

Vous pouvez aussi lancer le workflow GitHub Actions **Desktop packages**
(onglet Actions → *Run workflow*). Les artefacts se téléchargent depuis le run.

## Données

Tout reste **local**, hors ligne, sans compte.

| Contexte | Emplacement |
|---|---|
| Navigateur / PWA | `localStorage`, clé `debit-bois-v5` (migration auto depuis `debit-bois-v4`) |
| Electron | Fichier `debit-bois-store.json` dans le dossier **userData** de l’application, *et* `localStorage` en miroir |
| Copie Drive (Windows) | Miroir **après** l’écriture locale, jamais lu au démarrage : `H:\Mon Drive\Sauvegarde Débit Bois ERP\debit-bois-dernier.json` + `historique\` (30 instantanés, au plus un toutes les 10 min). Carnet téléphone : `mouvements-pending.json` (lecture PC, jamais dans dernier.json). Si H: est absent, l’app continue en local. |
| Téléphone (PWA) | Même build web (Cloudflare Pages). Mode Terrain si écran < 768 px ou `?terrain=1`. **Envoyer le carnet** → `mouvements-pending.json` dans le dossier Drive. Le PC le lit au focus / toutes les 2 min, bandeau **Appliquer**, puis archive dans `historique\`. Secours : **Importer le carnet**. |

Sur Windows, le fichier Electron se trouve typiquement dans :

`%APPDATA%\Débit Bois\debit-bois-store.json`

(ou `%APPDATA%\app-builder-workspace\` selon le nom interne d’Electron.)

Ce fichier contient le catalogue (familles + références), la liste des projets, le projet en cours et la session. Fermer ou relancer l’app ne perd pas le travail : la session est enregistrée automatiquement.

Export / import d’un projet : fichier JSON (dialogue natif dans Electron, téléchargement dans le navigateur).

## Limites

- L’app d’origine cible Vercel / Nitro. Electron s’en sert comme serveur local.
- Un `.exe` « double-clic sans Node » suppose `npm run desktop:dist` sur Windows.
- L’impression PDF utilise le dialogue natif (comme dans Chrome).
