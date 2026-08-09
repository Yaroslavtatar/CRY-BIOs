import { json } from './auth';

export async function handleLanyard(userId: string): Promise<Response> {
  if (!/^\d{17,19}$/.test(userId)) {
    return json({ success: false, error: 'Invalid Discord user ID' }, 400);
  }

  const cacheKey = new Request(`https://cbios-edge.internal/lanyard/${userId}`);
  const cache = caches.default;
  const cached = await cache.match(cacheKey);
  if (cached) return cached;

  const upstream = await fetch(`https://api.lanyard.rest/v1/users/${userId}`, {
    headers: { 'User-Agent': 'CRY-BIOS-Edge/1.0' },
  });

  const body = await upstream.text();
  const response = new Response(body, {
    status: upstream.status,
    headers: {
      'Content-Type': 'application/json',
      'Cache-Control': 'public, max-age=60',
    },
  });

  if (upstream.ok) {
    await cache.put(cacheKey, response.clone());
  }

  return response;
}
