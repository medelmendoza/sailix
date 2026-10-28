import axios from 'axios';

/**
 * The only code that talks to the Tala server: a port of backend/app/Modules/Tala/TalaClient.php.
 * Same endpoints, timeouts, no-redirect rule, size cap and no-retry rule for writes. Errors carry only a category.
 */

const MAX_BYTES = 5_000_000;
const TIMEOUT_MS = 15_000;

export type TalaErrorKind =
  | 'unauthorized'
  | 'unavailable'
  | 'login_rejected'
  | 'course_code_rejected';

export class TalaError extends Error {
  constructor(readonly kind: TalaErrorKind) {
    super(kind);
  }
}

export interface TalaRequest {
  method: 'GET' | 'POST';
  url: string;
  headers: Record<string, string>;
  data?: unknown;
  timeoutMs: number;
}
export interface TalaResponse {
  status: number;
  body: string;
}
export type TalaTransport = (req: TalaRequest) => Promise<TalaResponse>;

/** Redirects are never followed; every status is returned to the client to judge. */
export const axiosTransport: TalaTransport = async (req) => {
  const res = await axios.request<string>({
    method: req.method,
    url: req.url,
    headers: req.headers,
    data: req.data,
    timeout: req.timeoutMs,
    maxRedirects: 0,
    maxContentLength: MAX_BYTES,
    responseType: 'text',
    transformResponse: (d) => d,
    validateStatus: () => true,
  });
  return { status: res.status, body: typeof res.data === 'string' ? res.data : '' };
};

export interface TalaClientConfig {
  baseUrl: string;
  transport?: TalaTransport;
  /** Called whenever Tala says the token is no longer accepted (the session signs the user out of Tala). */
  onUnauthorized?: () => void;
  retryDelayMs?: number;
}

export interface TalaLogin {
  accessToken: string;
  refreshToken: string | null;
  userId: string;
}

type Json = Record<string, unknown>;

/** Reads the `exp` claim only to tell an expired token from an outage (Tala answers HTTP 500 to a bad bearer). */
export function isJwtExpired(jwt: string): boolean {
  const part = jwt.split('.')[1];
  if (jwt.split('.').length !== 3 || !part) return false;
  try {
    const exp = (JSON.parse(atob(part.replace(/-/g, '+').replace(/_/g, '/'))) as { exp?: unknown }).exp;
    return typeof exp === 'number' && exp * 1000 <= Date.now();
  } catch {
    return false;
  }
}

const seg = encodeURIComponent;
const isList = (v: unknown): v is unknown[] => Array.isArray(v);

export function createTalaClient(cfg: TalaClientConfig, getToken: () => Promise<string | null>) {
  if (!/^https:\/\//i.test(cfg.baseUrl)) throw new Error('The Tala address must be https.');
  const base = cfg.baseUrl.replace(/\/+$/, '');
  const transport = cfg.transport ?? axiosTransport;
  const delay = cfg.retryDelayMs ?? 200;

  const unauthorized = () => {
    cfg.onUnauthorized?.();
    return new TalaError('unauthorized');
  };

  async function send(
    method: 'GET' | 'POST',
    path: string,
    token: string | null,
    body?: unknown,
  ): Promise<TalaResponse> {
    const req: TalaRequest = {
      method,
      url: base + path,
      headers: { Accept: 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
      data: body,
      timeoutMs: TIMEOUT_MS,
    };
    let res: TalaResponse | undefined;
    for (let attempt = 0; !res; attempt++) {
      try {
        res = await transport(req);
      } catch {
        // a lost connection is retried once for a read; a write is never retried (it could be applied twice)
        if (method !== 'GET' || attempt >= 1) throw new TalaError('unavailable');
        await new Promise((r) => setTimeout(r, delay));
      }
    }
    if (res.status >= 500 && token && isJwtExpired(token)) throw unauthorized();
    if ((res.status >= 300 && res.status < 400) || res.status >= 500) throw new TalaError('unavailable');
    if (res.body.length > MAX_BYTES) throw new TalaError('unavailable');
    return res;
  }

  function json(res: TalaResponse): unknown {
    if (res.status >= 400) throw new TalaError('unavailable');
    try {
      const data: unknown = JSON.parse(res.body);
      if (data !== null && typeof data === 'object') return data;
    } catch {
      /* falls through */
    }
    throw new TalaError('unavailable');
  }

  async function authed(method: 'GET' | 'POST', path: string, body?: unknown): Promise<TalaResponse> {
    const token = await getToken();
    const res = await send(method, path, token, body);
    if (res.status === 401 || res.status === 403) throw unauthorized();
    return res;
  }

  async function getList(path: string): Promise<unknown[]> {
    const data = json(await authed('GET', path));
    if (!isList(data)) throw new TalaError('unavailable');
    return data;
  }

  async function getObject(path: string): Promise<Json> {
    const data = json(await authed('GET', path));
    if (isList(data) && data.length > 0) throw new TalaError('unavailable');
    return (isList(data) ? {} : data) as Json;
  }

  const user = (userId: string, teamId: string) => `/api/v1/auth/users/${seg(userId)}/teams/${seg(teamId)}`;
  const team = (teamId: string) => `/api/v1/auth/users/teams/${seg(teamId)}`;

  return {
    async login(username: string, password: string): Promise<TalaLogin> {
      const res = await send('POST', '/api/v1/login', null, { username, password });
      if (res.status >= 400 && res.status < 500) throw new TalaError('login_rejected');
      const d = json(res) as Json;
      const { accessToken, userId, refreshToken } = d;
      if (typeof accessToken !== 'string' || !accessToken || typeof userId !== 'string' || !userId) {
        throw new TalaError('unavailable');
      }
      return { accessToken, userId, refreshToken: typeof refreshToken === 'string' ? refreshToken : null };
    },

    /** The teams the account belongs to, with the name Tala gives each (the id when it has none). */
    async teams(userId: string): Promise<{ id: string; name: string }[]> {
      const rows = await getList(`/api/v1/auth/users/${seg(userId)}/teams`);
      return rows.flatMap((r) => {
        const row = r as Json | null;
        const id = row?.teamId;
        if (typeof id !== 'string' || !id) return [];
        return [{ id, name: typeof row?.teamName === 'string' && row.teamName ? row.teamName : id }];
      });
    },

    async teamIds(userId: string): Promise<string[]> {
      return (await this.teams(userId)).map((t) => t.id);
    },

    courses: (userId: string, teamId: string) => getList(`${user(userId, teamId)}/courses`),

    /** Tala answers 404 for a course never synced: nothing stored yet, not an outage. */
    async progress(userId: string, teamId: string, courseId: string, assignId: string): Promise<Json> {
      const res = await authed(
        'GET',
        `${user(userId, teamId)}/courses/${seg(courseId)}/sync/${seg(assignId)}/data`,
      );
      if (res.status === 404) return {};
      const data = json(res);
      if (isList(data) && data.length > 0) throw new TalaError('unavailable');
      return (isList(data) ? {} : data) as Json;
    },

    deck: (teamId: string, cardId: string) => getObject(`${team(teamId)}/upgraded_cards/${seg(cardId)}`),
    /** The quiz document includes its answer key: keep it in memory, never store it. */
    quiz: (teamId: string, quizId: string) => getObject(`${team(teamId)}/up_quizzes/${seg(quizId)}`),
    material: (teamId: string, kind: 'videos' | 'pdf', id: string) =>
      getObject(`${team(teamId)}/${kind}/${seg(id)}`),

    /** WRITE: a full course snapshot; never retried. */
    async submitSync(userId: string, teamId: string, courseItem: Json): Promise<void> {
      const res = await authed('POST', `${user(userId, teamId)}/courses/sync`, { courseList: [courseItem] });
      if (res.status !== 200) throw new TalaError('unavailable');
    },

    /** WRITE: applies to join a course by its code; never retried. */
    async applyToCourse(userId: string, teamId: string, code: string): Promise<void> {
      const res = await authed('POST', `${user(userId, teamId)}/courses/apply`, { courseCode: code });
      if (res.status >= 400) throw new TalaError('course_code_rejected');
    },
  };
}

export type TalaClient = ReturnType<typeof createTalaClient>;
