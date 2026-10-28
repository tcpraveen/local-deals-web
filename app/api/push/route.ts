import { createClient } from '@supabase/supabase-js';
import webpush from 'web-push';
import { slugifyStoreName } from '@/lib/deals';

export const runtime = 'nodejs';

interface PushSubscriptionRecord {
  id: string;
  endpoint: string;
  p256dh: string;
  auth: string;
}

interface PushPayload {
  title: string;
  body: string;
  url: string;
  icon: string;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function getStatusCode(error: unknown): number | null {
  if (!isRecord(error) || typeof error.statusCode !== 'number') return null;
  return error.statusCode;
}

export async function POST(request: Request) {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const vapidPublicKey = process.env.NEXT_PUBLIC_WEB_PUSH_PUBLIC_KEY;
  const vapidPrivateKey = process.env.WEB_PUSH_PRIVATE_KEY;
  if (
    !supabaseUrl ||
    !supabaseAnonKey ||
    !serviceRoleKey ||
    !vapidPublicKey ||
    !vapidPrivateKey
  ) {
    return Response.json({ error: 'Push broadcast is not configured on the server.' }, { status: 503 });
  }

  const authorization = request.headers.get('authorization');
  const accessToken = authorization?.match(/^Bearer (.+)$/i)?.[1];
  if (!accessToken) {
    return Response.json({ error: 'Merchant sign-in is required.' }, { status: 401 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: 'Request body must be valid JSON.' }, { status: 400 });
  }
  if (!isRecord(body)) {
    return Response.json({ error: 'A deal and message are required.' }, { status: 400 });
  }
  const dealId = body.deal_id;
  const message = typeof body.message === 'string' ? body.message.trim() : '';
  if (
    !(typeof dealId === 'string' && /^\d{1,20}$/.test(dealId)) &&
    !(typeof dealId === 'number' && Number.isSafeInteger(dealId) && dealId > 0)
  ) {
    return Response.json({ error: 'Select a valid offer.' }, { status: 400 });
  }
  if (!message || message.length > 240) {
    return Response.json({ error: 'Enter a message between 1 and 240 characters.' }, { status: 400 });
  }

  const authClient = createClient(supabaseUrl, supabaseAnonKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
  const { data: userData, error: authError } = await authClient.auth.getUser(accessToken);
  if (authError || !userData.user) {
    return Response.json({ error: 'Merchant sign-in is required.' }, { status: 401 });
  }

  const adminClient = createClient(supabaseUrl, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
  const { data: deal, error: dealError } = await adminClient
    .from('deals')
    .select('id,business,is_verified_merchant,is_active,expires_at')
    .eq('id', String(dealId))
    .eq('user_id', userData.user.id)
    .eq('is_verified_merchant', true)
    .maybeSingle();
  if (dealError) {
    console.error('Unable to verify merchant flash deal:', dealError);
    return Response.json({ error: 'Unable to verify this offer.' }, { status: 500 });
  }
  if (!deal || deal.is_active === false) {
    return Response.json({ error: 'This active, verified merchant offer was not found.' }, { status: 403 });
  }
  if (
    typeof deal.expires_at === 'string' &&
    Date.parse(`${deal.expires_at.slice(0, 10)}T23:59:59.999Z`) < Date.now()
  ) {
    return Response.json({ error: 'This offer has expired.' }, { status: 403 });
  }

  const subscriptions: PushSubscriptionRecord[] = [];
  for (let offset = 0; ; offset += 1000) {
    const { data, error } = await adminClient
      .from('push_subscriptions')
      .select('id,endpoint,p256dh,auth')
      .range(offset, offset + 999);
    if (error) {
      console.error('Unable to load push subscriptions:', error);
      return Response.json({ error: 'Unable to load notification subscribers.' }, { status: 500 });
    }
    subscriptions.push(...(data || []));
    if (!data || data.length < 1000) break;
  }

  try {
    webpush.setVapidDetails(
      process.env.WEB_PUSH_SUBJECT || 'mailto:support@localdealshub.com',
      vapidPublicKey,
      vapidPrivateKey
    );
  } catch (error: unknown) {
    console.error('Invalid Web Push VAPID configuration:', error);
    return Response.json({ error: 'Web Push credentials are invalid.' }, { status: 503 });
  }
  const payload: PushPayload = {
    title: `Flash deal at ${deal.business}`,
    body: message,
    url: `/store/${slugifyStoreName(deal.business)}`,
    icon: '/icon-192.png',
  };

  const results: boolean[] = [];
  for (let offset = 0; offset < subscriptions.length; offset += 50) {
    const batch = subscriptions.slice(offset, offset + 50);
    results.push(
      ...await Promise.all(
        batch.map(async (subscription) => {
          try {
            await webpush.sendNotification(
              {
                endpoint: subscription.endpoint,
                keys: { p256dh: subscription.p256dh, auth: subscription.auth },
              },
              JSON.stringify(payload)
            );
            return true;
          } catch (pushError: unknown) {
            console.error(`Unable to deliver push notification to subscription ${subscription.id}:`, pushError);
            if (getStatusCode(pushError) === 404 || getStatusCode(pushError) === 410) {
              const { error } = await adminClient
                .from('push_subscriptions')
                .delete()
                .eq('id', subscription.id);
              if (error) console.error('Unable to remove expired push subscription:', error);
            }
            return false;
          }
        })
      )
    );
  }

  const sent = results.filter(Boolean).length;
  return Response.json({
    sent,
    failed: results.length - sent,
    total: results.length,
  });
}
