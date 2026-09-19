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

## Suivi des chantiers

Chaque projet peut être **clôturé** : bouton **Terminer le chantier** (date de fin, remarque facultative), puis **Historique des chantiers** dans la section Projets.

- **Écran Historique** : filtres *Tous / En cours / Terminés*, recherche, tri (date de fin, dernière modification, nom, client) et compte des chantiers.
- **Un chantier terminé n'est pas verrouillé** : il reste ouvrable et modifiable, et se **rouvre** depuis l'historique — la clôture est alors effacée.
- **Deux états distincts** : l'état de vie (*en cours* / *terminé*) et l'avancement du dossier (*calepiné*, *stock déduit*, *devis émis*) sont affichés côte à côte. Un chantier peut être terminé sans que le devis ait été émis.
- **Téléphone** : l'état est **affiché** dans l'en-tête ; la clôture se fait **sur le PC** uniquement.
- Supprimer un chantier terminé demande une confirmation explicite : la suppression efface aussi son historique.

## Registre des documents

L'application **n'émet pas** les factures : elle **importe**, indexe et conserve les pièces produites ailleurs (factures clients, factures fournisseurs, tickets) et garde la copie dans le dossier Drive.

- **Import d'un dossier d'exports** : un fichier = une facture. Formats acceptés : `.csv`, `.tsv`, `.txt` et **classeur Excel `.xlsx`** (lu directement, sans dépendance ajoutée). La lecture repère les **libellés** (client, numéro, date, produits, totaux) quelle que soit la disposition — ancien gabarit en blocs comme feuille à libellés en colonne — avec séparateur tabulation ou point-virgule, écritures françaises (virgule décimale, `jj/mm/aaaa`, encodage Windows-1252) et **guillemets CSV respectés** (une adresse contenant `;` ne décale plus les colonnes).
- **Totaux recalculés depuis les lignes** : si le `Total HT` de la feuille ne correspond pas à la somme des lignes, la pièce est acceptée **avec un avertissement** (les montants retenus sont ceux des lignes) — de quoi repérer une formule erronée dans le classeur.
- **Saisie manuelle** : une pièce que l'application n'émet pas — **facture fournisseur, ticket de caisse, avoir** — s'ajoute en quelques champs (type, date, fournisseur, montant TTC, taux de TVA, désignation). Le HT est calculé depuis le taux, l'identité suit les mêmes règles que l'import (numéro, sinon identifiant interne), et le justificatif (photo, scan) se rattache ensuite depuis « À classer ».
- **Trois contrôles avant d'accepter un fichier** : `Total` de ligne = `Quantité` × `TTC` · taux de TVA légal (0 · 2,1 · 5,5 · 8,5 · 10 · 20 %) · `Total` de pied = somme des lignes. Un export incohérent est **refusé avec son motif**, les autres fichiers du dossier sont importés quand même.
- **Ré-import sans doublon** : la clé est le numéro de facture, donc un ré-import met à jour au lieu d'empiler. Si un montant déjà indexé change, c'est signalé comme **conflit** et l'existant est conservé — une facture ne se réécrit pas en silence.
- **Copies classées dans le dossier Drive** : `factures/<année>/FAC-2026-0002.pdf`, `factures/fournisseurs/<année>/`, et `factures/_a_classer/` pour les pièces en attente.
- **Rattachement** : un justificatif déposé dans `_a_classer` se rattache à une pièce depuis l'écran ; s'il porte le même nom que l'export, il est classé automatiquement pendant l'import.

Accès par **Registre des documents** dans la section Projets (sur le PC : l'import et le classement se font à l'atelier ; le téléphone consulte l'index).

## Trésorerie

L'argent qui bouge réellement : **mouvements** (encaissements, décaissements) et **lettrage** — relier un mouvement à une ou plusieurs pièces.

- **Aucun solde n'est saisi** : le reste dû est toujours recalculé (`montant de la pièce − somme des affectations`). Facture réglée en deux fois, virement couvrant deux factures, acompte, avoir : tout passe par des **affectations** (mouvement → pièce, avec un montant).
- **Écran Trésorerie** : tuiles *Facturé aux clients · Encaissé · Reste à encaisser · Dont en retard · Sorties · Solde suivi* ; saisie d'un mouvement (sens, date, montant, compte, moyen, référence) ; liste **À encaisser** avec lettrage en deux clics (montant pré-rempli au plus petit des deux restes) ; liste des mouvements avec leur **reste non affecté** ; **soldes suivis** par compte (ouverture + entrées − sorties).
- **Échéances** : celle de la pièce si elle en porte une, sinon **date + 30 jours** ; les retards sont signalés en rouge.
- **Solde suivi, pas solde bancaire** : il ne connaît que ce que tu saisis. Le pointage viendra plus tard.

Accès par **Trésorerie** dans la barre du haut (sur le PC).

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

Sur un écran étroit, l’interface terrain s’active automatiquement. Le bouton **Vue atelier / Vue terrain** de l’en-tête force l’une ou l’autre vue, et **Auto** revient à la détection automatique (`?terrain=1` ou `?terrain=0` dans l’adresse). Le bouton **Lien téléphone**, sur le poste atelier, affiche et copie l’adresse à ouvrir sur le téléphone.

### Fiabilité de la synchronisation

- **Carnet jamais écrasé à l’aveugle** : si un nouveau carnet arrive pendant que le PC applique le précédent, il est conservé tel quel et traité au cycle suivant (les mouvements déjà appliqués sont dédupliqués).
- **Lectures tolérantes** : Drive écrit les fichiers en place (le `rename` y est peu fiable), donc un fichier lu pendant une écriture est relu au lieu d’être déclaré corrompu. S’il reste illisible, le PC le signale et le téléphone propose **Réparer le carnet**.
- **Lignes inexploitables annoncées** : une ligne sans référence ou à quantité nulle est comptée et affichée, plus jamais écartée en silence (le fichier brut reste archivé dans `historique/`).
- **Envois regroupés** : une salve de saisies sur le téléphone produit un seul envoi, espacé d’au moins 5 s du précédent.
- **Dossiers homonymes** : si plusieurs dossiers `Sauvegarde Débit Bois ERP` existent, seul celui qui contient le miroir est lié ; sinon la liaison est refusée plutôt que choisie au hasard.
- **Portée Google** : la liaison demande l’accès complet au Drive (`…/auth/drive`), car le dossier et le miroir `debit-bois-dernier.json` sont créés par le PC — l’accès limité aux fichiers créés par l’application ne le permet pas. Le jeton reste en mémoire, expire en ~1 h et est révoqué à la déconnexion.

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
