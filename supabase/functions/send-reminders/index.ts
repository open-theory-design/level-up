// Level Up — scheduled Web Push sender (Supabase Edge Function).
//
// Invoked every 5 minutes by pg_cron (see DEPLOY.md "Push notifications").
// For each subscribed device it works out, in THAT device's timezone, whether
// a reminder or streak-saver push is due, and sends it via Web Push (VAPID).
//
// Secrets required (Dashboard -> Edge Functions -> Secrets):
//   VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY, VAPID_SUBJECT (mailto:you@example.com)
// SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY are injected automatically.
//
// Test mode: POST/GET with ?test=1 sends an immediate push to every
// subscription (no slot checks, no dedup) — used by the in-app test button.

import { createClient } from "npm:@supabase/supabase-js@2";
import webpush from "npm:web-push@3.6.7";
import { localNow, dueNotifications, weekDates } from "./logic.js";

webpush.setVapidDetails(
  Deno.env.get("VAPID_SUBJECT") ?? "mailto:joe@upheal.io",
  Deno.env.get("VAPID_PUBLIC_KEY") ?? "",
  Deno.env.get("VAPID_PRIVATE_KEY") ?? ""
);

const db = createClient(
  Deno.env.get("SUPABASE_URL") ?? "",
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
);

type Sub = {
  endpoint: string;
  sync_code: string;
  p256dh: string;
  auth: string;
  tz: string;
};

async function sendTo(sub: Sub, title: string, body: string): Promise<boolean> {
  try {
    await webpush.sendNotification(
      { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
      JSON.stringify({ title, body, url: "./" })
    );
    return true;
  } catch (err) {
    const code = (err as { statusCode?: number }).statusCode;
    if (code === 404 || code === 410) {
      // Device unsubscribed / endpoint expired — drop the row.
      await db.from("push_subscriptions").delete().eq("endpoint", sub.endpoint);
    } else {
      console.error("push failed", sub.endpoint.slice(-12), code, String(err));
    }
    return false;
  }
}

Deno.serve(async (req) => {
  const test = new URL(req.url).searchParams.get("test") === "1";

  const { data: subs, error } = await db
    .from("push_subscriptions")
    .select("endpoint, sync_code, p256dh, auth, tz");
  if (error) return new Response(JSON.stringify({ error: error.message }), { status: 500 });
  if (!subs?.length) return new Response(JSON.stringify({ sent: 0, note: "no subscriptions" }));

  let sent = 0;

  if (test) {
    for (const sub of subs as Sub[]) {
      if (await sendTo(sub, "Level Up", "Test notification — push is working on this device ✓")) sent++;
    }
    return new Response(JSON.stringify({ sent, test: true }));
  }

  const nowMs = Date.now();
  for (const sub of subs as Sub[]) {
    const local = localNow(nowMs, sub.tz || "UTC");

    // Profile settings carry the reminder times (synced from the app).
    const { data: profile } = await db
      .from("profile").select("settings").eq("sync_code", sub.sync_code).maybeSingle();
    const times: string[] = profile?.settings?.reminderTimes ?? [];
    const remindersOn: boolean = profile?.settings?.remindersEnabled !== false;

    // Streak-saver needs today's status; weekly last-chance needs the week's count.
    const week = weekDates(local.logicalDate, local.logicalDow);
    const { data: days } = await db
      .from("day_log").select("log_date, reps")
      .eq("sync_code", sub.sync_code).in("log_date", week);
    const flowDone = (days ?? []).some((r) => r.log_date === local.logicalDate && (r.reps ?? 0) >= 1);
    const weekSessions = (days ?? []).filter((r) => (r.reps ?? 0) >= 1).length;

    const due = dueNotifications(local, remindersOn ? times : [], flowDone, weekSessions);
    for (const n of due) {
      // Idempotency: first inserter of (endpoint, slot) wins; duplicates skip.
      const ins = await db.from("push_log").insert({ endpoint: sub.endpoint, slot: n.slot });
      if (ins.error) continue; // 23505 duplicate (already sent) or transient — skip
      if (await sendTo(sub, n.title, n.body)) sent++;
    }
  }

  return new Response(JSON.stringify({ sent }));
});
