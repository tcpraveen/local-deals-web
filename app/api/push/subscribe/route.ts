import { createClient } from '@supabase/supabase-js';

export const runtime = 'nodejs';

const ALLOWED_PUSH_HOSTS = [
  'fcm.googleapis.com',
  'push.services.mozilla.com',
  'updates.push.services.mozilla.com',
  'web.push.apple.com',
];

function isAllowedPushEndpoint(value: string): boolean {
  try {
    const endpoint = new URL(value);
    return (
      endpoint.protocol === 'https:' &&
      endpoint.port === '' &&
      !endpoint.username &&
      !endpoint.password &&
      ALLOWED_PUSH_HOSTS.some(
        (host) => endpoint.hostname === host || endpoint.hostname.endsWith(`.${host}`)
      )
    );
  } catch {
    return false;
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

export async function POST(request: Request) {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!supabaseUrl || !serviceRoleKey) {
    return Response.json({ error: 'Push subscription storage is not configured.' }, { status: 503 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: 'Request body must be valid JSON.' }, { status: 400 });
  }

  if (!isRecord(body) || !isRecord(body.subscription)) {
    return Response.json({ error: 'A push subscription is required.' }, { status: 400 });
  }
  const subscription = body.subscription;
  const keys = subscription.keys;
  const deviceId = body.device_id;
  if (
    typeof deviceId !== 'string' ||
    !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(deviceId) ||
    typeof subscription.endpoint !== 'string' ||
    subscription.endpoint.length > 2048 ||
    !isAllowedPushEndpoint(subscription.endpoint) ||
    !isRecord(keys) ||
    typeof keys.p256dh !== 'string' ||
    keys.p256dh.length > 256 ||
    typeof keys.auth !== 'string' ||
    keys.auth.length > 256
  ) {
    return Response.json({ error: 'The push subscription is invalid.' }, { status: 400 });
  }

  const supabase = createClient(supabaseUrl, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
  const { error } = await supabase.from('push_subscriptions').upsert(
    {
      device_id: deviceId,
      endpoint: subscription.endpoint,
      p256dh: keys.p256dh,
      auth: keys.auth,
      created_at: new Date().toISOString(),
    },
    { onConflict: 'endpoint' }
  );
  if (error) {
    console.error('Unable to store push subscription:', error);
    return Response.json({ error: 'Unable to save your push subscription.' }, { status: 500 });
  }

  return Response.json({ success: true });
}
