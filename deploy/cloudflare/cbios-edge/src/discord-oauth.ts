import type { Env } from './auth';
import { json, signWebhookBody } from './auth';

const DISCORD_API = 'https://discord.com/api/v10';

export async function handleOAuthStart(request: Request, env: Env): Promise<Response> {
  const url = new URL(request.url);
  const state = url.searchParams.get('state');
  if (!state) return json({ error: 'Missing state' }, 400);

  const params = new URLSearchParams({
    client_id: env.DISCORD_CLIENT_ID,
    redirect_uri: env.DISCORD_REDIRECT_URI,
    response_type: 'code',
    scope: 'identify',
    state,
  });

  return Response.redirect(`https://discord.com/oauth2/authorize?${params}`, 302);
}

export async function handleOAuthCallback(request: Request, env: Env): Promise<Response> {
  const url = new URL(request.url);
  const code = url.searchParams.get('code');
  const state = url.searchParams.get('state');
  const oauthError = url.searchParams.get('error');

  const dashboardUrl = `${env.CBIOS_APP_URL.replace(/\/$/, '')}/dashboard`;

  if (oauthError || !code || !state) {
    return Response.redirect(`${dashboardUrl}?discord=error`, 302);
  }

  try {
    const tokenRes = await fetch(`${DISCORD_API}/oauth2/token`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        client_id: env.DISCORD_CLIENT_ID,
        client_secret: env.DISCORD_CLIENT_SECRET,
        grant_type: 'authorization_code',
        code,
        redirect_uri: env.DISCORD_REDIRECT_URI,
      }),
    });

    if (!tokenRes.ok) {
      console.error('Discord token exchange failed', await tokenRes.text());
      return Response.redirect(`${dashboardUrl}?discord=error`, 302);
    }

    const tokenData = await tokenRes.json() as { access_token: string };
    const userRes = await fetch(`${DISCORD_API}/users/@me`, {
      headers: { Authorization: `Bearer ${tokenData.access_token}` },
    });

    if (!userRes.ok) {
      return Response.redirect(`${dashboardUrl}?discord=error`, 302);
    }

    const user = await userRes.json() as {
      id: string;
      username: string;
      global_name?: string | null;
      avatar?: string | null;
      premium_type?: number;
      public_flags?: number;
    };

    const webhookPayload = JSON.stringify({
      state,
      discord: {
        id: user.id,
        username: user.username,
        displayName: user.global_name || user.username,
        avatarHash: user.avatar || null,
        premiumType: user.premium_type ?? 0,
        publicFlags: user.public_flags ?? 0,
        linkedAt: new Date().toISOString(),
      },
    });

    const { timestamp, signature } = await signWebhookBody(env.CBIOS_WEBHOOK_SECRET, webhookPayload);

    const webhookRes = await fetch(env.CBIOS_NODE_WEBHOOK_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Cbios-Timestamp': timestamp,
        'X-Cbios-Signature': signature,
      },
      body: webhookPayload,
    });

    if (!webhookRes.ok) {
      console.error('Node webhook failed', await webhookRes.text());
      return Response.redirect(`${dashboardUrl}?discord=error`, 302);
    }

    return Response.redirect(`${dashboardUrl}?discord=linked`, 302);
  } catch (err) {
    console.error('OAuth callback error', err);
    return Response.redirect(`${dashboardUrl}?discord=error`, 302);
  }
}
