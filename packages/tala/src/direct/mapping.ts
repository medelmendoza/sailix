/**
 * Tala's raw data into the shapes the screens use: a port of the mapping half of backend/app/Modules/Tala/TalaGateway.php
 * (course, materials, parseProgress, progressById, materialStats). Pure: no network.
 */
export type Json = Record<string, unknown>;

export const isObject = (v: unknown): v is Json => v !== null && typeof v === 'object' && !Array.isArray(v);

/** Material kinds shown: video, pdf, the new quizzes and flashcards. EPUB and legacy quizzes are left out. */
const TYPES: Record<string, string> = { video: 'video', pdf: 'pdf', up_quiz: 'quiz', up_card: 'flashcards' };

export const str = (v: unknown): string | null =>
  typeof v === 'string' && v !== '' ? v.slice(0, 2000) : typeof v === 'number' ? String(v) : null;

/** PHP's (int) cast: leading digits, else 0. */
export const toInt = (v: unknown): number => Number.parseInt(String(v ?? ''), 10) || 0;

/** Only https addresses are passed on (no javascript:, data:, http:). */
export function https(v: unknown): string | null {
  if (typeof v !== 'string' || v.length > 2000 || !/^https:\/\//i.test(v)) return null;
  try {
    new URL(v);
    return v;
  } catch {
    return null;
  }
}

/** Dates in Tala's course list are `YYYY-MM-DD`; anything else is not guessed at. */
export function isoDate(v: unknown): string | null {
  if (typeof v !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(v)) return null;
  const d = new Date(`${v}T00:00:00Z`);
  return Number.isNaN(d.getTime()) || d.toISOString().slice(0, 10) !== v ? null : v;
}

/** A short, stable fingerprint of what a screen shows, to notice a document that changed meanwhile. */
export function fingerprint(value: unknown): string {
  const s = JSON.stringify(value);
  let h1 = 0xdeadbeef;
  let h2 = 0x41c6ce57;
  for (let i = 0; i < s.length; i++) {
    const c = s.charCodeAt(i);
    h1 = Math.imul(h1 ^ c, 2654435761);
    h2 = Math.imul(h2 ^ c, 1597334677);
  }
  h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507) ^ Math.imul(h2 ^ (h2 >>> 13), 3266489909);
  h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507) ^ Math.imul(h1 ^ (h1 >>> 13), 3266489909);
  return ((h2 >>> 0).toString(16).padStart(8, '0') + (h1 >>> 0).toString(16).padStart(8, '0')).slice(0, 16);
}

/** Tala's own counter is "done/total" (null for a course never started). */
export function parseProgress(progress: unknown, fallbackTotal: number): [number, number] {
  const m = typeof progress === 'string' ? /^\s*(\d{1,5})\s*\/\s*(\d{1,5})\s*$/.exec(progress) : null;
  return m ? [Number(m[1]), Number(m[2])] : [0, Math.max(0, fallbackTotal)];
}

export interface MaterialSummary {
  id: string;
  type: string;
  name: string;
  description: string | null;
  thumbnail_url: string | null;
  viewable: boolean;
}

export function materials(
  assignment: Json,
  progressWrites: boolean,
): { visible: MaterialSummary[]; hidden: number } {
  const course = isObject(assignment.course) ? assignment.course : {};
  const details = Array.isArray(course.materialDetails) ? course.materialDetails : [];
  const visible: MaterialSummary[] = [];
  let hidden = 0;
  for (const d of details) {
    const type = isObject(d) ? (TYPES[String(d.materialType ?? '').toLowerCase()] ?? null) : null;
    const id = isObject(d) ? str(d.materialId) : null;
    if (!isObject(d) || type === null || id === null || !/^[A-Za-z0-9_-]{1,64}$/.test(id)) {
      hidden++;
      continue;
    }
    visible.push({
      id,
      type,
      name: str(d.materialName) ?? '',
      description: str(d.materialDescription),
      thumbnail_url: https(d.materialThumbnailUrl),
      // quizzes and flashcards write their result back, so they need progress writes on
      viewable: !['quiz', 'flashcards'].includes(type) || progressWrites,
    });
  }
  return { visible, hidden };
}

export function course(a: Json, progressWrites: boolean) {
  const c = isObject(a.course) ? a.course : {};
  const [completed, total] = parseProgress(a.progress, toInt(c.totalMaterial));
  return {
    id: String(a.assignId ?? ''),
    name: str(c.courseName) ?? '',
    description: str(c.courseDescription),
    thumbnail_url: https(c.courseThumbnailUrl),
    creator: str(c.courseCreator),
    date_from: isoDate(a.dateFrom),
    date_to: isoDate(a.dateTo),
    status: str(a.status),
    progress: str(a.progress),
    completed,
    total,
    percent: total > 0 ? Math.round((Math.min(completed, total) / total) * 100) : 0,
    state:
      String(a.status ?? '').toUpperCase() === 'COMPLETED'
        ? 'completed'
        : completed > 0
          ? 'in_progress'
          : 'not_started',
    total_materials: materials(a, progressWrites).visible.length,
  };
}

export interface StoredProgress {
  progress: string | null;
  status: string | null;
  stats: Json | null;
}

/** What the learner achieved on one material, from Tala's stored row (read-only; shown on My Stats). */
export function materialStats(group: string, row: Json): Json | null {
  const int = (v: unknown) => (v !== '' && v !== null && !Number.isNaN(Number(v)) ? Math.max(0, Math.trunc(Number(v))) : 0);
  const num = (v: unknown) => (v !== '' && v !== null && v !== undefined && !Number.isNaN(Number(v)) ? Number(v) : null);
  switch (group) {
    case 'videos': {
      const f = num(row.feedback);
      return { rating: f !== null && f >= 1 ? f : null };
    }
    case 'quizzes': {
      const avg = num(row.average);
      return {
        correct: int(row.correct),
        wrong: int(row.wrong),
        average: avg === null ? null : Math.round(avg * 100) / 100,
        remarks: row.remarks === 'PASSED' || row.remarks === 'FAILED' ? row.remarks : null,
      };
    }
    case 'cards':
      return { easy: int(row.easy), medium: int(row.medium), hard: int(row.hard), notseen: int(row.notseen) };
    default:
      return null;
  }
}

export function progressById(stored: Json): Record<string, StoredProgress> {
  const out: Record<string, StoredProgress> = {};
  const all = isObject(stored.materials) ? stored.materials : {};
  const groups = { videos: 'videoId', pdfs: 'pdfId', quizzes: 'quizId', cards: 'cardId' } as const;
  for (const [group, idKey] of Object.entries(groups)) {
    const rows = Array.isArray(all[group]) ? (all[group] as unknown[]) : [];
    for (const row of rows) {
      if (isObject(row) && typeof row[idKey] === 'string') {
        out[row[idKey]] = {
          progress: str(row.progress),
          status: str(row.status),
          stats: materialStats(group, row),
        };
      }
    }
  }
  return out;
}
