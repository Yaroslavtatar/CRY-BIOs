/** Cloudflare Worker cbios-edge теперь нужен только для импорта guns.lol (см. importHub.ts). */
export function getEdgeUrl(): string | null {
  const url = process.env.CBIOS_EDGE_URL?.trim();
  return url || null;
}

export async function fetchViaEdge(path: string, init?: RequestInit): Promise<Response> {
  const base = getEdgeUrl();
  if (!base) throw new Error('CBIOS_EDGE_URL not configured');
  return fetch(`${base.replace(/\/$/, '')}${path}`, init);
}
