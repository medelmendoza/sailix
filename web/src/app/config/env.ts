import { z } from 'zod';

const schema = z.object({ VITE_API_BASE_URL: z.url() });

export const parseEnv = (raw: Record<string, unknown>) => {
  const parsed = schema.parse(raw);
  return { apiBaseUrl: parsed.VITE_API_BASE_URL.replace(/\/$/, '') };
};

export const env = () =>
  parseEnv({ VITE_API_BASE_URL: 'http://localhost:8000', ...import.meta.env });
