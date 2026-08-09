import crypto from 'crypto';

const MAX_SKEW_SEC = 300;

export function signEdgePayload(secret: string, body: string): { timestamp: string; signature: string } {
  const timestamp = Math.floor(Date.now() / 1000).toString();
  const signature = crypto
    .createHmac('sha256', secret)
    .update(`${timestamp}.${body}`)
    .digest('hex');
  return { timestamp, signature };
}

export function verifyEdgeSignature(
  secret: string,
  body: string,
  timestamp: string | undefined,
  signature: string | undefined,
): boolean {
  if (!secret || !timestamp || !signature) return false;
  const ts = parseInt(timestamp, 10);
  if (Number.isNaN(ts) || Math.abs(Date.now() / 1000 - ts) > MAX_SKEW_SEC) return false;
  const expected = crypto.createHmac('sha256', secret).update(`${timestamp}.${body}`).digest('hex');
  try {
    return crypto.timingSafeEqual(Buffer.from(expected, 'hex'), Buffer.from(signature, 'hex'));
  } catch {
    return false;
  }
}

export function getEdgeUrl(): string | null {
  const url = process.env.CBIOS_EDGE_URL?.trim();
  return url || null;
}

export function getEdgeSecret(): string | null {
  const secret = process.env.CBIOS_EDGE_SECRET?.trim();
  return secret || null;
}

export async function fetchViaEdge(path: string, init?: RequestInit): Promise<Response> {
  const base = getEdgeUrl();
  if (!base) throw new Error('CBIOS_EDGE_URL not configured');
  return fetch(`${base.replace(/\/$/, '')}${path}`, init);
}
