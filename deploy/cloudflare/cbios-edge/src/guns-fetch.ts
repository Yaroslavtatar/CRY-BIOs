import { json } from './auth';

export async function handleGunsFetch(username: string): Promise<Response> {
  const clean = username.toLowerCase().replace(/[^a-z0-9_-]/g, '');
  if (!clean || clean.length > 32) {
    return json({ error: 'Invalid username' }, 400);
  }

  try {
    const response = await fetch(`https://guns.lol/${clean}`, {
      redirect: 'follow',
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.5',
      },
    });

    if (!response.ok) {
      return json({ error: `guns.lol returned HTTP ${response.status}` }, response.status === 404 ? 404 : 502);
    }

    const html = await response.text();
    return json({ success: true, username: clean, html });
  } catch (err: any) {
    return json({ error: err.message || 'Fetch failed' }, 502);
  }
}
