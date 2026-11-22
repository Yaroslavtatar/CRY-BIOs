export interface Env {
  /** Общий секрет с Node (CBIOS_EDGE_SECRET). Если задан, запросы без заголовка x-cbios-edge-secret отклоняются. */
  CBIOS_EDGE_SECRET?: string;
}

export function json(data: unknown, status = 200, extraHeaders: Record<string, string> = {}): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json', ...extraHeaders },
  });
}

/** Сравнение без раннего выхода по первому несовпавшему символу. */
function safeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

export function isAuthorized(request: Request, env: Env): boolean {
  const expected = env.CBIOS_EDGE_SECRET;
  if (!expected) return true; // обратная совместимость: секрет не настроен
  return safeEqual(request.headers.get('x-cbios-edge-secret') || '', expected);
}
