import type { Env } from './auth';
import { json } from './auth';
import { handleOAuthStart, handleOAuthCallback } from './discord-oauth';
import { handleLanyard } from './lanyard';
import { handleGunsFetch } from './guns-fetch';

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);
    const path = url.pathname.replace(/\/+$/, '') || '/';

    if (path === '/health') {
      return json({ ok: true, service: 'cbios-edge' });
    }

    if (path === '/oauth/start') {
      return handleOAuthStart(request, env);
    }

    if (path === '/oauth/callback') {
      return handleOAuthCallback(request, env);
    }

    const lanyardMatch = path.match(/^\/lanyard\/(\d{17,19})$/);
    if (lanyardMatch) {
      return handleLanyard(lanyardMatch[1]);
    }

    const gunsMatch = path.match(/^\/guns\/fetch\/([a-z0-9_-]+)$/i);
    if (gunsMatch) {
      return handleGunsFetch(gunsMatch[1]);
    }

    return json({ error: 'Not found' }, 404);
  },
};
