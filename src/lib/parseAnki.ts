import JSZip from 'jszip';
import initSqlJs, { type Database } from 'sql.js';
import sqlWasmUrl from 'sql.js/dist/sql-wasm-browser.wasm?url';

export interface AnkiCard {
  front: string;
  back: string;
}

export interface AnkiDeck {
  id: string;
  name: string;
  cards: AnkiCard[];
}

type ModelInfo = { fields: string[]; qfmt: string; afmt: string };

export async function parseAnkiFile(file: File): Promise<AnkiDeck[]> {
  const zip = await JSZip.loadAsync(file);

  // Newer Anki (23.10+) exports TWO database files in the same .apkg:
  //   collection.anki21  – a stub with one note saying "Please update to the latest Anki version"
  //   collection.anki21b – the real collection in the new schema
  // Older Anki exports only collection.anki21 or collection.anki2, which contain the real data.
  // Try the newest format first so we always reach the real notes.
  const candidates = [
    zip.file('collection.anki21b'),
    zip.file('collection.anki21'),
    zip.file('collection.anki2'),
  ].filter((f): f is JSZip.JSZipObject => f !== null);

  if (candidates.length === 0) {
    throw new Error('Invalid .apkg file: no Anki database found inside the archive.');
  }

  const SQL = await initSqlJs({ locateFile: () => sqlWasmUrl });

  let db: Database | null = null;
  for (const candidate of candidates) {
    let candidateDb: Database | null = null;
    try {
      candidateDb = new SQL.Database(new Uint8Array(await candidate.async('arraybuffer')));

      // Skip the backward-compat stub Anki injects for older importers
      const countResult = candidateDb.exec('SELECT COUNT(*) FROM notes');
      const noteCount = (countResult?.[0]?.values?.[0]?.[0] as number) ?? 0;
      if (noteCount === 1) {
        const fldsResult = candidateDb.exec('SELECT flds FROM notes LIMIT 1');
        const flds = String(fldsResult?.[0]?.values?.[0]?.[0] ?? '');
        if (flds.toLowerCase().includes('please update')) {
          candidateDb.close();
          continue;
        }
      }
      if (noteCount === 0) {
        candidateDb.close();
        continue;
      }

      db = candidateDb;
      break;
    } catch {
      candidateDb?.close();
    }
  }

  if (!db) {
    throw new Error(
      'No card data found. In Anki, re-export the deck and check "Support older Anki versions" in the export dialog — the newer format is not yet supported.'
    );
  }

  const modelInfo = buildModelInfo(db);
  const deckMap = buildDeckMap(db);

  const result: AnkiDeck[] = [];

  for (const [did, deckName] of deckMap.entries()) {
    if (!deckName) continue;

    const q = db.exec(
      `SELECT n.flds, n.mid FROM notes n WHERE n.id IN (SELECT DISTINCT nid FROM cards WHERE did = ${did})`
    );
    if (!q.length || !q[0].values.length) continue;

    const cards: AnkiCard[] = [];
    for (const row of q[0].values) {
      const flds = (row[0] as string).split('\x1f');
      const mid = String(row[1]);
      const info = modelInfo[mid];

      let front: string;
      let back: string;

      if (info) {
        const fieldMap: Record<string, string> = {};
        info.fields.forEach((name, i) => { fieldMap[name] = stripAnkiHtml(flds[i] ?? ''); });
        front = renderAnkiTemplate(info.qfmt, fieldMap).trim();
        back = renderAnkiTemplate(info.afmt, fieldMap)
          .replace(/\{\{FrontSide\}\}/gi, front)
          .replace(/\{\{type:[^}]+\}\}/gi, '')
          .trim();
      } else {
        // Model info unavailable — use first field as front, rest as back
        front = stripAnkiHtml(flds[0] ?? '').trim();
        back = flds.slice(1).map(f => stripAnkiHtml(f)).filter(Boolean).join('\n').trim();
      }

      // Handle cloze deletions: {{c1::answer::hint}} → front shows [...], back shows answer
      if (front.includes('{{c') || back.includes('{{c')) {
        const raw = front || back;
        front = stripAnkiHtml(raw.replace(/\{\{c\d+::(.*?)(?:::[^}]*)?\}\}/g, '[...]')).trim();
        back = stripAnkiHtml(raw.replace(/\{\{c\d+::(.*?)(?:::[^}]*)?\}\}/g, '$1')).trim();
      }

      if (front || back) cards.push({ front, back });
    }

    if (cards.length > 0) result.push({ id: did, name: deckName, cards });
  }

  db.close();
  result.sort((a, b) => a.name.localeCompare(b.name));
  return result;
}

function tableExists(db: Database, name: string): boolean {
  const r = db.exec(`SELECT 1 FROM sqlite_master WHERE type='table' AND name='${name}'`);
  return r.length > 0 && r[0].values.length > 0;
}

function buildModelInfo(db: Database): Record<string, ModelInfo> {
  // New schema (Anki 2.1.28+): separate fields + notetypes tables
  if (tableExists(db, 'fields') && tableExists(db, 'notetypes')) {
    try {
      const r = db.exec('SELECT ntid, ord, name FROM fields ORDER BY ntid, ord');
      const info: Record<string, ModelInfo> = {};
      if (r.length) {
        for (const row of r[0].values) {
          const ntid = String(row[0]);
          if (!info[ntid]) info[ntid] = { fields: [], qfmt: '', afmt: '' };
          info[ntid].fields.push(String(row[2]));
        }
      }
      // qfmt/afmt are stored as protobuf in new schema — default to field[0]/field[1]
      for (const entry of Object.values(info)) {
        entry.qfmt = `{{${entry.fields[0] ?? 'Front'}}}`;
        entry.afmt = `{{${entry.fields[1] ?? entry.fields[0] ?? 'Back'}}}`;
      }
      if (Object.keys(info).length > 0) return info;
    } catch { /* fall through */ }
  }

  // Old schema: col.models JSON
  try {
    const r = db.exec('SELECT models FROM col LIMIT 1');
    if (r.length && r[0].values.length) {
      const modelsJson: Record<string, any> = JSON.parse(r[0].values[0][0] as string);
      if (Object.keys(modelsJson).length > 0) {
        const info: Record<string, ModelInfo> = {};
        for (const [mid, model] of Object.entries(modelsJson)) {
          const fields: string[] = (model.flds ?? []).map((f: any) => String(f.name));
          const tpl = (model.tmpls ?? [])[0] ?? {};
          info[mid] = {
            fields,
            qfmt: tpl.qfmt ?? `{{${fields[0] ?? 'Front'}}}`,
            afmt: tpl.afmt ?? `{{${fields[1] ?? 'Back'}}}`,
          };
        }
        return info;
      }
    }
  } catch { /* fall through */ }

  return {};
}

function buildDeckMap(db: Database): Map<string, string> {
  // New schema (Anki 2.1.28+): decks table
  if (tableExists(db, 'decks')) {
    try {
      const r = db.exec('SELECT id, name FROM decks');
      const map = new Map<string, string>();
      if (r.length) {
        for (const row of r[0].values) {
          map.set(String(row[0]), String(row[1]));
        }
      }
      if (map.size > 0) return map;
    } catch { /* fall through */ }
  }

  // Old schema: col.decks JSON
  try {
    const r = db.exec('SELECT decks FROM col LIMIT 1');
    if (r.length && r[0].values.length) {
      const decksJson: Record<string, any> = JSON.parse(r[0].values[0][0] as string);
      const map = new Map<string, string>();
      for (const [id, deck] of Object.entries(decksJson)) {
        if (deck?.name && !deck.dyn) map.set(id, deck.name);
      }
      return map;
    }
  } catch { /* fall through */ }

  return new Map();
}

function stripAnkiHtml(html: string): string {
  return html
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<div>/gi, '\n')
    .replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

function renderAnkiTemplate(template: string, fields: Record<string, string>): string {
  return template.replace(/\{\{([^}]+)\}\}/g, (_, name) => {
    const key = name.replace(/^(type:|cloze:|hint:)/, '').trim();
    return fields[key] ?? '';
  });
}
