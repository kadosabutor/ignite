/**
 * Apple Push Notification service (token alapú hitelesítés, ES256 JWT)
 *
 * Secretek: APNS_KEY_ID, APNS_TEAM_ID, APNS_PRIVATE_KEY (.p8 fájl tartalma), APNS_BUNDLE_ID
 */

const KEY_ID = Deno.env.get('APNS_KEY_ID');
const TEAM_ID = Deno.env.get('APNS_TEAM_ID');
const PRIVATE_KEY = Deno.env.get('APNS_PRIVATE_KEY');
const BUNDLE_ID = Deno.env.get('APNS_BUNDLE_ID') || 'hu.butorkadosa.ignite';

export const apnsConfigured = Boolean(KEY_ID && TEAM_ID && PRIVATE_KEY);

const HOSTS = {
  production: 'https://api.push.apple.com',
  sandbox: 'https://api.sandbox.push.apple.com',
} as const;

export type ApnsEnvironment = keyof typeof HOSTS;

const b64url = (data: ArrayBuffer | Uint8Array | string) => {
  const bytes = typeof data === 'string' ? new TextEncoder().encode(data) : new Uint8Array(data);
  let bin = '';
  for (const b of bytes) bin += String.fromCharCode(b);
  return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
};

let cachedKey: CryptoKey | null = null;
let cachedToken: { jwt: string; issuedAt: number } | null = null;

async function signingKey(): Promise<CryptoKey> {
  if (cachedKey) return cachedKey;
  const pem = PRIVATE_KEY!.replace(/\\n/g, '\n').replace(/-----[^-]+-----/g, '').replace(/\s+/g, '');
  const der = Uint8Array.from(atob(pem), (c) => c.charCodeAt(0));
  cachedKey = await crypto.subtle.importKey('pkcs8', der, { name: 'ECDSA', namedCurve: 'P-256' }, false, ['sign']);
  return cachedKey;
}

/** Az Apple 20–60 percenként enged új tokent; 50 percig újrahasznosítjuk */
async function providerToken(): Promise<string> {
  const now = Math.floor(Date.now() / 1000);
  if (cachedToken && now - cachedToken.issuedAt < 50 * 60) return cachedToken.jwt;
  const header = b64url(JSON.stringify({ alg: 'ES256', kid: KEY_ID }));
  const claims = b64url(JSON.stringify({ iss: TEAM_ID, iat: now }));
  const signature = await crypto.subtle.sign(
    { name: 'ECDSA', hash: 'SHA-256' },
    await signingKey(),
    new TextEncoder().encode(`${header}.${claims}`)
  );
  const jwt = `${header}.${claims}.${b64url(signature)}`;
  cachedToken = { jwt, issuedAt: now };
  return jwt;
}

export interface ApnsResult {
  ok: boolean;
  /** A tokent törölni kell (lejárt / érvénytelen) */
  invalidToken: boolean;
  status: number;
  reason?: string;
}

export async function sendApns(
  deviceToken: string,
  environment: ApnsEnvironment,
  notification: { title: string; body: string; type: string }
): Promise<ApnsResult> {
  const res = await fetch(`${HOSTS[environment]}/3/device/${deviceToken}`, {
    method: 'POST',
    headers: {
      authorization: `bearer ${await providerToken()}`,
      'apns-topic': BUNDLE_ID,
      'apns-push-type': 'alert',
      'apns-priority': '10',
      'content-type': 'application/json',
    },
    body: JSON.stringify({
      aps: { alert: { title: notification.title, body: notification.body }, sound: 'default' },
      type: notification.type,
    }),
  });

  if (res.ok) return { ok: true, invalidToken: false, status: res.status };

  const reason = ((await res.json().catch(() => ({}))) as { reason?: string }).reason;
  const invalidToken = res.status === 410 || reason === 'BadDeviceToken' || reason === 'Unregistered' || reason === 'DeviceTokenNotForTopic';
  return { ok: false, invalidToken, status: res.status, reason };
}
