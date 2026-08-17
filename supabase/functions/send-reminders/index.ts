// Level Up — scheduled Web Push sender (Supabase Edge Function).
//
// Invoked every 5 minutes by pg_cron (see DEPLOY.md "Push notifications").
// For each subscribed device it works out, in THAT device's timezone, whether
// a key-day nudge, streak warning or Sunday recap is due, and sends it via Web
// Push (VAPID). Design + copy: BUILD-SPEC-notifications.md.
//
// Order of operations matters: the clock is checked BEFORE any day_log fetch,
// so the ~285 daily cron ticks that can't possibly send anything cost one small
// profile read instead of a full history pull.
//
// Secrets required (Dashboard -> Edge Functions -> Secrets):
//   VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY, VAPID_SUBJECT (mailto:you@example.com)
// SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY are injected automatically.
//
// Test mode: POST/GET with ?test=1&endpoint=<encoded> sends an immediate push
// to that ONE subscription (no slot checks, no dedup) — used by the in-app test
// button. Without `endpoint` it falls back to every subscription.

import { createClient } from "npm:@supabase/supabase-js@2";
import webpush from "npm:web-push@3.6.7";
import {
  localNow,
  notifySettings,
  slotCouldFire,
  computeDerived,
  weekProgress,
  dueNotifications,
  progressionFromRows
} from "./logic.js";

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

async function sendTo(sub: Sub, title: string, body: string, url = "./"): Promise<boolean> {
  try {
    await webpush.sendNotification(
      { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
      JSON.stringify({ title, body, url })
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
  const params = new URL(req.url).searchParams;
  const test = params.get("test") === "1";
  const testEndpoint = params.get("endpoint");

  const { data: subs, error } = await db
    .from("push_subscriptions")
    .select("endpoint, sync_code, p256dh, auth, tz");
  if (error) return new Response(JSON.stringify({ error: error.message }), { status: 500 });
  if (!subs?.length) return new Response(JSON.stringify({ sent: 0, note: "no subscriptions" }));

  let sent = 0;

  if (test) {
    // Only the requesting device, when it tells us which one it is.
    const targets = (subs as Sub[]).filter((s) => !testEndpoint || s.endpoint === testEndpoint);
    for (const sub of targets) {
      if (await sendTo(sub, "Level Up", "Test notification — push is working on this device ✓")) sent++;
    }
    return new Response(JSON.stringify({ sent, test: true, targeted: !!testEndpoint }));
  }

  const nowMs = Date.now();
  // Several devices can share one sync code — read each profile at most once.
  const profiles = new Map<string, Record<string, unknown> | null>();

  for (const sub of subs as Sub[]) {
    const local = localNow(nowMs, sub.tz || "UTC");

    if (!profiles.has(sub.sync_code)) {
      const { data } = await db
        .from("profile").select("settings").eq("sync_code", sub.sync_code).maybeSingle();
      profiles.set(sub.sync_code, (data?.settings ?? null) as Record<string, unknown> | null);
    }
    const settings = profiles.get(sub.sync_code);
    const notify = notifySettings(settings);

    // Clock check before any history fetch — this is the whole point of the
    // ordering. Nothing can be due, so don't pay for the data.
    if (!slotCouldFire(local, notify)) continue;

    // One query serves both the streak engine and the progression check.
    const { data: rows } = await db
      .from("day_log").select("log_date, reps, sets_log")
      .eq("sync_code", sub.sync_code)
      .order("log_date", { ascending: false });

    const dayLog: Record<string, { reps: number }> = {};
    for (const r of rows ?? []) dayLog[r.log_date] = { reps: r.reps ?? 0 };

    const derived = computeDerived(dayLog, local.logicalDate);
    const week = weekProgress(dayLog, local.logicalDate);
    const s = settings as {
      holdSecs?: Record<string, number>;
      exLevel?: Record<string, number>;
    } | null;
    const progression = progressionFromRows(
      (rows ?? []).filter((r) => r.sets_log),
      s?.holdSecs,
      s?.exLevel // ladder positions — qualification is per level
    );

    const due = dueNotifications(local, notify, derived, week, progression);
    for (const n of due) {
      // Idempotency: first inserter of (endpoint, slot) wins; duplicates skip.
      const ins = await db.from("push_log").insert({ endpoint: sub.endpoint, slot: n.slot });
      if (ins.error) continue; // 23505 duplicate (already sent) or transient — skip
      if (await sendTo(sub, n.title, n.body, n.url)) sent++;
    }
  }

  return new Response(JSON.stringify({ sent }));
});
