import type { Env } from './auth';
import { json, isAuthorized } from './auth';
import { handleGunsFetch } from './guns-fetch';

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);
    const path = url.pathname.replace(/\/+$/, '') || '/';

    if (path === '/health') {
      return json({ ok: true, service: 'cbios-edge' });
    }

    const gunsMatch = path.match(/^\/guns\/fetch\/([a-z0-9_-]+)$/i);
    if (gunsMatch) {
      if (!isAuthorized(request, env)) return json({ error: 'Unauthorized' }, 401);
      return handleGunsFetch(gunsMatch[1]);
    }

    return json({ error: 'Not found' }, 404);
  },
};
