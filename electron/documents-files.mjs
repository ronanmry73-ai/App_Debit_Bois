/**
 * Fichiers du registre de documents (côté PC).
 *
 * Répartition des rôles :
 *   - **ce module** ne fait que du disque : lire un export, classer un
 *     justificatif dans `factures/<année>/`, calculer une empreinte, lister ;
 *   - le **rendu** (lecture du gabarit, contrôles, fusion) vit dans
 *     `src/lib/documents.ts`, pour rester testable sans toucher au disque.
 *
 * Arborescence, sous le dossier Drive « Sauvegarde Débit Bois ERP » :
 *
 *   factures/
 *   ├── 2026/FAC-2026-0002.pdf      justificatif classé
 *   ├── fournisseurs/2026/FF-....pdf
 *   └── _a_classer/                 dépôt : fichiers en attente d'indexation
 */
import { createHash } from "node:crypto";
import { existsSync } from "node:fs";
import { copyFile, mkdir, readFile, readdir, stat } from "node:fs/promises";
import path from "node:path";

export const DOCUMENTS_DIR_NAME = "factures";
export const INBOX_DIR_NAME = "_a_classer";
export const SUPPLIER_DIR_NAME = "fournisseurs";

const KIND_PREFIX = {
  facture_client: "FAC",
  avoir_client: "AV",
  facture_fournisseur: "FF",
  ticket: "TCK",
  autre: "DOC",
};

/** Racine du registre : `<dossier de sauvegarde>/factures`. */
export function documentsRoot(dir) {
  return path.join(String(dir || ""), DOCUMENTS_DIR_NAME);
}

/** Dossier de dépôt : les fichiers déposés là attendent d'être indexés. */
export function inboxPath(dir) {
  return path.join(documentsRoot(dir), INBOX_DIR_NAME);
}

export async function ensureDir(dir) {
  await mkdir(dir, { recursive: true });
  return dir;
}

export function empreinteBuffer(buffer) {
  return createHash("sha256").update(buffer).digest("hex").slice(0, 32);
}

export async function empreinteFichier(file) {
  const buffer = await readFile(file);
  return { empreinte: empreinteBuffer(buffer), taille: buffer.length };
}

function anneeDe(dateDocument) {
  const d = dateDocument ? new Date(dateDocument) : new Date();
  return Number.isNaN(d.getTime()) ? new Date().getFullYear() : d.getFullYear();
}

/** Nom normalisé : `FAC-2026-0002.pdf`, `TCK-2026-...`, `FF-2026-...`. */
export function documentFileName({
  kind = "autre",
  numero = "",
  dateDocument = null,
  extension = ".pdf",
  empreinte = "",
} = {}) {
  const year = anneeDe(dateDocument);
  const prefix = KIND_PREFIX[kind] ?? KIND_PREFIX.autre;
  const clean = String(numero || "")
    .trim()
    .replace(/[^\w-]+/g, "-");
  const ref = clean
    ? /^\d+$/.test(clean)
      ? clean.padStart(4, "0")
      : clean
    : empreinte
      ? empreinte.slice(0, 6)
      : "sans-numero";
  return `${prefix}-${year}-${ref}${extension}`;
}

/** Chemin relatif (dans le dossier Drive) où ranger un document. */
export function documentRelativePath({ kind = "autre", dateDocument = null, fileName }) {
  const year = anneeDe(dateDocument);
  if (kind === "facture_fournisseur" || kind === "ticket") {
    return path
      .join(DOCUMENTS_DIR_NAME, SUPPLIER_DIR_NAME, String(year), fileName)
      .split(path.sep)
      .join("/");
  }
  return path.join(DOCUMENTS_DIR_NAME, String(year), fileName).split(path.sep).join("/");
}

/**
 * Classe un fichier dans le registre. Idempotent : un fichier dont l'empreinte
 * est déjà présente n'est pas dupliqué, son chemin existant est renvoyé.
 */
export async function storeDocumentFile({
  dir,
  sourcePath,
  kind = "autre",
  numero = "",
  dateDocument = null,
} = {}) {
  if (!dir || !sourcePath) {
    return { ok: false, error: "Dossier ou fichier manquant." };
  }
  if (!existsSync(sourcePath)) {
    return { ok: false, error: "Fichier source introuvable." };
  }
  try {
    const { empreinte, taille } = await empreinteFichier(sourcePath);
    const extension = (path.extname(sourcePath) || ".pdf").toLowerCase();

    // Déjà classé ? (même contenu) → on réutilise le chemin existant.
    const existing = await findFileByEmpreinte(documentsRoot(dir), empreinte, {
      base: String(dir),
    });
    if (existing) {
      return { ok: true, chemin: existing.chemin, empreinte, taille, created: false };
    }

    const fileName = documentFileName({ kind, numero, dateDocument, extension, empreinte });
    const relative = documentRelativePath({ kind, dateDocument, fileName });
    const target = path.join(String(dir), ...relative.split("/"));
    await ensureDir(path.dirname(target));

    let finalTarget = target;
    let finalRelative = relative;
    let suffix = 2;
    while (existsSync(finalTarget)) {
      const ext = path.extname(fileName);
      const base = fileName.slice(0, -ext.length);
      const altName = `${base}-${suffix}${ext}`;
      const altRelative = documentRelativePath({ kind, dateDocument, fileName: altName });
      finalTarget = path.join(String(dir), ...altRelative.split("/"));
      finalRelative = altRelative;
      suffix += 1;
    }

    await copyFile(sourcePath, finalTarget);
    return {
      ok: true,
      chemin: finalRelative,
      empreinte,
      taille,
      created: true,
    };
  } catch (err) {
    const message = err && typeof err === "object" && "message" in err ? String(err.message) : String(err);
    return { ok: false, error: `Classement impossible : ${message}` };
  }
}

/**
 * Cherche un fichier déjà classé par son empreinte (parcours borné).
 * `base` sert à exprimer le chemin **relatif au dossier Drive** (donc avec le
 * préfixe `factures/`), pas relatif à la racine du registre.
 */
export async function findFileByEmpreinte(root, empreinte, { base = root } = {}) {
  if (!empreinte) return null;
  const stack = [root];
  let visited = 0;
  while (stack.length > 0 && visited < 4000) {
    const current = stack.pop();
    let entries = [];
    try {
      entries = await readdir(current, { withFileTypes: true });
    } catch {
      continue;
    }
    for (const entry of entries) {
      visited += 1;
      const full = path.join(current, entry.name);
      if (entry.isDirectory()) {
        if (entry.name === INBOX_DIR_NAME) continue;
        stack.push(full);
        continue;
      }
      if (!entry.isFile()) continue;
      try {
        const { empreinte: hash } = await empreinteFichier(full);
        if (hash === empreinte) {
          return { chemin: path.relative(base, full).split(path.sep).join("/"), path: full };
        }
      } catch {
        /* fichier illisible : ignoré */
      }
    }
  }
  return null;
}

/** Contenu du dossier de dépôt, du plus récent au plus ancien. */
export async function listInbox(dir) {
  const inbox = inboxPath(dir);
  if (!existsSync(inbox)) return { ok: true, dir: inbox, files: [] };
  try {
    const entries = await readdir(inbox, { withFileTypes: true });
    const files = [];
    for (const entry of entries) {
      if (!entry.isFile()) continue;
      const full = path.join(inbox, entry.name);
      const info = await stat(full);
      files.push({
        name: entry.name,
        path: full,
        taille: info.size,
        mtime: info.mtime.toISOString(),
      });
    }
    files.sort((a, b) => b.mtime.localeCompare(a.mtime));
    return { ok: true, dir: inbox, files };
  } catch (err) {
    const message = err && typeof err === "object" && "message" in err ? String(err.message) : String(err);
    return { ok: false, dir: inbox, files: [], error: message };
  }
}

/** Lecture d'un fichier texte : UTF-8, repli Windows-1252 (exports français). */
export async function readTextSmart(file) {
  try {
    const buffer = await readFile(file);
    let text;
    let encoding = "utf-8";
    if (buffer.length >= 3 && buffer[0] === 0xef && buffer[1] === 0xbb && buffer[2] === 0xbf) {
      text = buffer.subarray(3).toString("utf8");
    } else {
      try {
        text = new TextDecoder("utf-8", { fatal: true }).decode(buffer);
      } catch {
        text = new TextDecoder("windows-1252").decode(buffer);
        encoding = "windows-1252";
      }
    }
    return { ok: true, text, encoding, taille: buffer.length };
  } catch (err) {
    const message = err && typeof err === "object" && "message" in err ? String(err.message) : String(err);
    return { ok: false, text: "", error: message };
  }
}

export const EXPORT_EXTENSIONS = [".csv", ".tsv", ".txt"];
export const JUSTIFICATIF_EXTENSIONS = [".pdf", ".jpg", ".jpeg", ".png", ".webp"];

/** Liste les fichiers d'un dossier choisi, filtrés par extension. */
export async function listFolder(folder, extensions = JUSTIFICATIF_EXTENSIONS) {
  if (!folder || !existsSync(folder)) {
    return { ok: false, files: [], error: "Dossier introuvable." };
  }
  try {
    const entries = await readdir(folder, { withFileTypes: true });
    const files = [];
    for (const entry of entries) {
      if (!entry.isFile()) continue;
      const ext = path.extname(entry.name).toLowerCase();
      if (extensions.length > 0 && !extensions.includes(ext)) continue;
      const full = path.join(folder, entry.name);
      const info = await stat(full);
      files.push({
        name: entry.name,
        path: full,
        taille: info.size,
        mtime: info.mtime.toISOString(),
      });
    }
    files.sort((a, b) => a.name.localeCompare(b.name, "fr"));
    return { ok: true, files };
  } catch (err) {
    const message = err && typeof err === "object" && "message" in err ? String(err.message) : String(err);
    return { ok: false, files: [], error: message };
  }
}
