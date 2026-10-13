import { api } from '@/services/api/client';
import { useSessionStore } from '@/store/sessionStore';
import {
  demoAnnouncements,
  demoTodos,
  demoCourses,
  demoDeck,
  demoDetail,
  demoMe,
  demoQuiz,
} from './data';

/** Answers every request the app makes with sample data, in place of the network. Demo mode only. */
function respond(method: string, path: string): unknown {
  if (method === 'GET' && path === '/me') return { data: demoMe };
  if (method === 'GET' && path === '/modules/tala/courses') return { data: demoCourses };
  if (method === 'GET' && path === '/announcements')
    return {
      data: demoAnnouncements,
      links: {},
      meta: { current_page: 1, per_page: 20, total: 3, last_page: 1 },
      unread_count: demoAnnouncements.filter((a) => !a.is_read).length,
    };
  if (method === 'GET' && path === '/todos') {
    const open = demoTodos.filter((t) => !t.is_done);
    return {
      data: demoTodos,
      links: {},
      meta: { current_page: 1, per_page: 20, total: demoTodos.length, last_page: 1 },
      open_count: open.length,
      overdue_count: 1,
    };
  }
  const note = /^\/announcements\/(\w+)(\/read)?$/.exec(path);
  if (note)
    return { data: demoAnnouncements.find((a) => a.id === note[1]) ?? demoAnnouncements[0] };
  const detail = /^\/modules\/tala\/courses\/([A-Za-z0-9_-]+)$/.exec(path);
  if (method === 'GET' && detail) return { data: demoDetail(detail[1]!) };
  if (method === 'GET' && /\/quizzes\//.test(path)) return { data: demoQuiz };
  if (method === 'GET' && /\/flashcards\//.test(path)) return { data: demoDeck };
  if (method === 'POST' && /\/progress$/.test(path))
    return { data: { progress: '3/4', status: 'NOT YET COMPLETED', completed: [] } };
  if (method === 'POST' && /\/ratings$/.test(path))
    return { data: { progress: '3/4', status: 'NOT YET COMPLETED', easy: 1, medium: 1, hard: 1 } };
  if (method === 'POST' && /\/attempts$/.test(path))
    return {
      data: {
        progress: '3/4',
        status: 'NOT YET COMPLETED',
        correct: 3,
        wrong: 0,
        total: 3,
        average: 100,
        passed: true,
      },
    };
  return { data: {} };
}

/** Signs in with sample data and routes every API call to it. Never touches the network or secure storage. */
export function installDemo(): void {
  api.defaults.adapter = async (config) => {
    const body = respond((config.method ?? 'get').toUpperCase(), config.url ?? '');
    return { data: body, status: 200, statusText: 'OK', headers: {}, config };
  };
  useSessionStore.setState({
    status: 'authenticated',
    me: demoMe as never,
    notice: null,
    credential: {
      token: 'demo',
      expiresAt: null,
      membershipId: 'm1',
      tenantId: 't1',
      tenantCode: 'SFAI',
    },
  });
}
