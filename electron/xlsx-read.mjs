/**
 * Lecture d'un classeur `.xlsx` **sans aucune dépendance**.
 *
 * Un `.xlsx` est une archive ZIP contenant du XML. Ce module en extrait les
 * lignes de la **première feuille** et les restitue en **texte tabulé** — la même
 * forme qu'un export « Texte (séparateur de tabulation) » d'Excel. Le reste de
 * l'import (lecture du gabarit, contrôles) est donc inchangé : un classeur devient
 * un export comme un autre.
 *
 * Ce qui est géré :
 *   - chaînes partagées (`sharedStrings.xml`), chaînes en ligne, formules
 *     (valeur mise en cache), booléens ;
 *   - **dates** : une cellule date est rendue `jj/mm/aaaa` (format français) ;
 *   - cellules vides conservées (les colonnes ne se décalent pas) ;
 *   - cellules fusionnées : la valeur reste sur la première colonne, comme Excel
 *     les écrit dans le XML — donc le gabarit est respecté.
 *
 * Ce qui n'est pas géré : `.xls` (ancien format binaire), classeurs protégés,
 * formules sans valeur mise en cache (Excel l'écrit toujours), ZIP64.
 */
import { inflateRawSync } from "node:zlib";

const EOCD_SIG = 0x06054b50;
const CD_SIG = 0x02014b50;
const LOCAL_SIG = 0x04034b50;

/** Entrées de l'archive : nom → contenu décompressé. */
export function unzipEntries(buffer) {
  const eocd = findEocd(buffer);
  if (eocd < 0) throw new Error("Archive .xlsx illisible (fin d'archive introuvable).");

  const entryCount = buffer.readUInt16LE(eocd + 10);
  const cdOffset = buffer.readUInt32LE(eocd + 16);
  const entries = new Map();

  let cursor = cdOffset;
  for (let index = 0; index < entryCount; index += 1) {
    if (cursor + 46 > buffer.length || buffer.readUInt32LE(cursor) !== CD_SIG) break;
    const method = buffer.readUInt16LE(cursor + 10);
    const compressedSize = buffer.readUInt32LE(cursor + 20);
    const nameLength = buffer.readUInt16LE(cursor + 28);
    const extraLength = buffer.readUInt16LE(cursor + 30);
    const commentLength = buffer.readUInt16LE(cursor + 32);
    const localOffset = buffer.readUInt32LE(cursor + 42);
    const name = buffer.toString("utf8", cursor + 46, cursor + 46 + nameLength);

    if (localOffset + 30 <= buffer.length && buffer.readUInt32LE(localOffset) === LOCAL_SIG) {
      const localNameLength = buffer.readUInt16LE(localOffset + 26);
      const localExtraLength = buffer.readUInt16LE(localOffset + 28);
      const dataStart = localOffset + 30 + localNameLength + localExtraLength;
      const raw = buffer.subarray(dataStart, dataStart + compressedSize);
      try {
        entries.set(name, method === 0 ? raw : inflateRawSync(raw));
      } catch {
        /* entrée illisible : ignorée */
      }
    }
    cursor += 46 + nameLength + extraLength + commentLength;
  }
  return entries;
}

function findEocd(buffer) {
  const limit = Math.max(0, buffer.length - 66_000);
  for (let i = buffer.length - 22; i >= limit; i -= 1) {
    if (buffer.readUInt32LE(i) === EOCD_SIG) return i;
  }
  return -1;
}

const ENTITIES = {
  amp: "&",
  lt: "<",
  gt: ">",
  quot: '"',
  apos: "'",
};

export function xmlUnescape(value) {
  return String(value).replace(/&(#x?[0-9a-fA-F]+|[a-zA-Z]+);/g, (match, entity) => {
    if (entity.startsWith("#x") || entity.startsWith("#X")) {
      return String.fromCodePoint(parseInt(entity.slice(2), 16));
    }
    if (entity.startsWith("#")) {
      return String.fromCodePoint(parseInt(entity.slice(1), 10));
    }
    return ENTITIES[entity] ?? match;
  });
}

function textOf(xml) {
  let out = "";
  const re = /<t(?:\s[^>]*)?>([\s\S]*?)<\/t>/g;
  let match;
  while ((match = re.exec(xml)) !== null) out += xmlUnescape(match[1]);
  return out;
}

export function parseSharedStrings(xml) {
  const list = [];
  if (!xml) return list;
  const re = /<si(?:\s[^>]*)?>([\s\S]*?)<\/si>/g;
  let match;
  while ((match = re.exec(xml)) !== null) list.push(textOf(match[1]));
  return list;
}

/** Indices de colonne d'une référence de cellule (`A1` → 0, `AB12` → 27). */
export function columnIndexOf(ref) {
  const letters = /^([A-Z]+)/i.exec(String(ref ?? ""))?.[1];
  if (!letters) return -1;
  let index = 0;
  for (const char of letters.toUpperCase()) {
    index = index * 26 + (char.charCodeAt(0) - 64);
  }
  return index - 1;
}

/**
 * Sérial Excel → `jj/mm/aaaa`.
 *
 * Excel compte `1 = 01/01/1900` et croit à un 29 février 1900 : au-delà du
 * sérial 60 — donc pour toutes les dates modernes — le décalage est de deux
 * jours, en deçà d'un seul. Les deux cas sont gérés, pour rester exact.
 */
export function excelSerialToDay(serial) {
  const value = Math.round(Number(serial));
  if (!Number.isFinite(value)) return null;
  const base = value < 61 ? Date.UTC(1899, 11, 31) : Date.UTC(1899, 11, 30);
  const date = new Date(base + value * 86_400_000);
  if (Number.isNaN(date.getTime())) return null;
  const pad = (n) => String(n).padStart(2, "0");
  return `${pad(date.getUTCDate())}/${pad(date.getUTCMonth() + 1)}/${date.getUTCFullYear()}`;
}

const DATE_FORMAT_IDS = new Set([
  ...Array.from({ length: 9 }, (_, i) => 14 + i), // 14..22
  27, 30, 36, 45, 46, 47, 50, 57,
]);

/** Identifiants de format considérés comme des dates (intégrés + personnalisés). */
export function dateFormatIds(stylesXml) {
  const ids = new Set(DATE_FORMAT_IDS);
  if (!stylesXml) return ids;
  const re = /<numFmt[^>]*numFmtId="(\d+)"[^>]*formatCode="([^"]*)"/g;
  let match;
  while ((match = re.exec(stylesXml)) !== null) {
    const code = match[2].toLowerCase().replace(/\[[^\]]*\]/g, "").replace(/"[^"]*"/g, "");
    if (/[dmy]/.test(code) && !/^[#0.,%\s]+$/.test(code)) ids.add(Number(match[1]));
  }
  return ids;
}

/** Pour chaque style de cellule (`cellXfs`), l'identifiant de format numérique. */
export function cellFormatIds(stylesXml) {
  const list = [];
  if (!stylesXml) return list;
  const block = /<cellXfs[^>]*>([\s\S]*?)<\/cellXfs>/.exec(stylesXml)?.[1] ?? "";
  const re = /<xf\b[^>]*numFmtId="(\d+)"/g;
  let match;
  while ((match = re.exec(block)) !== null) list.push(Number(match[1]));
  return list;
}

function attributesOf(source) {
  const attrs = {};
  const re = /([\w:]+)="([^"]*)"/g;
  let match;
  while ((match = re.exec(source)) !== null) attrs[match[1]] = match[2];
  return attrs;
}

/** Chemin XML de la première feuille du classeur. */
export function firstSheetPath(entries) {
  const workbook = entries.get("xl/workbook.xml")?.toString("utf8") ?? "";
  const rels = entries.get("xl/_rels/workbook.rels")?.toString("utf8") ?? "";
  const sheetTag = /<sheet\b[^>]*>/i.exec(workbook)?.[0] ?? "";
  const relId = attributesOf(sheetTag)["r:id"];
  if (relId && rels) {
    const relTag = new RegExp(`<Relationship\\b[^>]*Id="${relId}"[^>]*>`, "i").exec(rels)?.[0];
    const target = attributesOf(relTag ?? "").Target;
    if (target) {
      const clean = target.replace(/^\/?xl\//, "").replace(/^\//, "");
      return `xl/${clean}`;
    }
  }
  if (entries.has("xl/worksheets/sheet1.xml")) return "xl/worksheets/sheet1.xml";
  const any = [...entries.keys()].find((name) => /^xl\/worksheets\/sheet\d+\.xml$/.test(name));
  return any ?? null;
}

/**
 * Lit la première feuille et renvoie du **texte tabulé** (une ligne par ligne
 * d'Excel, cellules vides conservées), directement consommable par le lecteur de
 * gabarit.
 */
export function xlsxToTabbedText(buffer) {
  const entries = unzipEntries(buffer);
  const sheetPath = firstSheetPath(entries);
  if (!sheetPath) throw new Error("Aucune feuille trouvée dans le classeur.");

  const shared = parseSharedStrings(entries.get("xl/sharedStrings.xml")?.toString("utf8"));
  const styles = entries.get("xl/styles.xml")?.toString("utf8") ?? "";
  const formats = cellFormatIds(styles);
  const dates = dateFormatIds(styles);

  const sheet = entries.get(sheetPath)?.toString("utf8") ?? "";
  const lines = [];
  const rowRe = /<row\b[^>]*>([\s\S]*?)<\/row>/g;
  let rowMatch;
  while ((rowMatch = rowRe.exec(sheet)) !== null) {
    const cells = [];
    const cellRe = /<c\b([^>]*?)(?:\/>|>([\s\S]*?)<\/c>)/g;
    let cellMatch;
    while ((cellMatch = cellRe.exec(rowMatch[1])) !== null) {
      const attrs = attributesOf(cellMatch[1] ?? "");
      const inner = cellMatch[2] ?? "";
      const index = columnIndexOf(attrs.r);
      if (index < 0 || index > 200) continue;

      let value = "";
      if (attrs.t === "s") {
        const key = Number(/<v>([\s\S]*?)<\/v>/.exec(inner)?.[1] ?? "-1");
        value = shared[key] ?? "";
      } else if (attrs.t === "inlineStr") {
        value = textOf(inner);
      } else if (attrs.t === "b") {
        value = /<v>\s*1\s*<\/v>/.test(inner) ? "VRAI" : "FAUX";
      } else {
        const raw = /<v>([\s\S]*?)<\/v>/.exec(inner)?.[1] ?? "";
        if (raw !== "") {
          const styleIndex = attrs.s === undefined ? -1 : Number(attrs.s);
          const formatId = styleIndex >= 0 ? formats[styleIndex] : undefined;
          if (formatId !== undefined && dates.has(formatId) && Number.isFinite(Number(raw))) {
            value = excelSerialToDay(raw) ?? raw;
          } else {
            value = xmlUnescape(raw);
          }
        }
      }
      cells[index] = value.replace(/\t/g, " ").replace(/\r?\n/g, " ");
    }
    while (cells.length > 0 && (cells[cells.length - 1] ?? "") === "") cells.pop();
    lines.push(cells.map((cell) => cell ?? "").join("\t"));
  }
  return lines.join("\n");
}
