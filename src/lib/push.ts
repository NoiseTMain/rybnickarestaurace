import "server-only";

/** Push oznámení jsou volitelná – vyžadují klíče VAPID a service-role klíč pro plánovaný souhrn. */
export function pushConfigured(): boolean {
  return Boolean(process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY && process.env.VAPID_PRIVATE_KEY);
}

export function cronConfigured(): boolean {
  return pushConfigured() && Boolean(process.env.SUPABASE_SERVICE_ROLE_KEY && process.env.CRON_SECRET);
}

export async function sendPush(sub: { endpoint: string; p256dh: string; auth: string }, payload: { title: string; body: string; url?: string }) {
  const webpush = (await import("web-push")).default;
  webpush.setVapidDetails(process.env.VAPID_SUBJECT || "mailto:homeos@example.invalid", process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY!, process.env.VAPID_PRIVATE_KEY!);
  return webpush.sendNotification({ endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } }, JSON.stringify(payload), { TTL: 86_400 });
}
