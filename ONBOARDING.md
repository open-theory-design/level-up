# Building a tracking PWA — the reusable pattern (+ hard-won lessons)

> This guide distils a working habit-tracking PWA ("Level Up") into a reusable
> template plus the lessons that cost real debugging time. Copy it into a new
> project (rename to `CLAUDE.md` there, or keep it as a referenced doc) so the new
> project's Claude follows the same architecture and avoids the same traps.
>
> The example app tracks a daily exercise routine, but nothing here is exercise-
> specific — swap the tracked items and the motivation mechanics (streaks, stars,
> badges, whatever) and keep the shape.

---

## 1. What this pattern is

A **zero-build, offline-capable PWA** for daily-habit tracking:

- Plain HTML/CSS/vanilla JS — **no framework, no build step, no bundler**. You edit a
  file and reload.
- Works fully **local-only** (localStorage). A backend is optional.
- Optional **zero-login cross-device sync** via Supabase under a short private code.
- Optional **closed-app push notifications** via Web Push + a scheduled serverless
  function.
- Static-hosted anywhere (Vercel, GitHub Pages, Netlify).

It's deliberately small and boring in the best way: the whole app is a handful of
`<script>` files. That's a feature — keep it.

---

## 2. Architecture to keep

**No framework / no build.** `index.html` loads the scripts in order; each `js/*.js`
file is an IIFE that hangs **exactly one global** off `window`. Example map from the
reference app:

| File | Global | Role |
|---|---|---|
| `config.js` | `APP_CONFIG` | Supabase URL + publishable key + VAPID public key |
| `js/streak.js` | the "engine" | dates, week math, **derived state** |
| `js/<domain>.js` | catalog | the tracked items + their content/illustrations |
| `js/store.js` | store | persistence + Supabase sync + migrations |
| `js/app.js` | UI IIFE | views, event-delegated, string-templated render |
| `sw.js` | — | service worker (offline cache + push handlers) |

**Derive state, don't store counters.** localStorage holds a **per-day log** as the
single source of truth. Everything user-facing — streaks, totals, stats, heatmaps,
stars — is **recomputed** from that log on each render (see `js/streak.js`
`computeDerived` in the reference app), never persisted as a running total.
*Why it matters:* retroactive edits, a custom day-boundary (e.g. 4am), and undo all
"just work" because nothing is a stored counter that can drift.

**Sync is optional and zero-login.** `js/store.js` mirrors localStorage to Supabase
under a private short code. Conflict policy = last-write-wins per day / per entry
(union-merge monotonic things like "seen" flags). With no Supabase creds in
`config.js`, the app runs local-only and every feature still works. Guard every
network path with an `isConfigured()` check.

**UI is string-templated HTML**, re-rendered on each state change, with event
delegation (one document-level click listener dispatching on `data-action`). Escape
every user-facing string (`esc()`). Keep dates as `YYYY-MM-DD` strings and derive
them with a helper (`addDays`), never raw `Date` arithmetic.

---

## 3. Hard-won lessons (read before you build)

### 3.1 Supabase RLS is only HALF the permission story — GRANT too
Enabling Row Level Security + permissive policies is **not enough**. Postgres roles
also need table **GRANTs**, or every request fails with `42501 permission denied for
table …` (surfaced as HTTP 401). This bit the reference app twice:

- The **`anon`** role (your publishable key) — needed for the web client.
- The **`service_role`** — needed because **Supabase Edge Functions run as
  service_role**, and this kind of project does **not** auto-grant new tables.

Always ship BOTH halves for every table:
```sql
alter table <t> enable row level security;
create policy "anon all" on <t> for all using (true) with check (true);
grant usage on schema public to anon;
grant select, insert, update, delete on public.<t> to anon;          -- web client
grant select, insert, update, delete on public.<t> to service_role;  -- edge functions
```

### 3.2 Diagnose the backend directly — don't trust the app's error text
When something "silently won't sync/save", **probe the backend before touching app
code**:
```bash
curl "$SUPABASE_URL/rest/v1/<table>?select=*&limit=1" \
  -H "apikey: $KEY" -H "Authorization: Bearer $KEY"
# 42501 / HTTP 401 → missing GRANT     |     [] / HTTP 200 → access fine, look elsewhere
```
And **don't collapse backend errors into a generic UI string.** The reference app
showed "Code not found" for what was actually a 401 permission error — which sent
debugging in the wrong direction for a while. Distinguish not-found vs permission vs
network so the next failure is self-explanatory.

### 3.3 Theme with CSS-variable tokens — no hardcoded hex in components
Put **every colour** in two token blocks and let components reference variables only:
```css
:root { /* light theme tokens */ }
:root[data-theme="dark"] { /* dark theme tokens */ }
```
A Settings toggle stamps `document.documentElement.setAttribute('data-theme', …)` and
persists the choice. Then **re-theming, adding dark mode, or swapping a palette is a
one-block edit** — no hunting hardcoded hex across files. Token set worth having:
`bg`, `bg-soft`, `ink`/`ink-soft`/`ink-faint`, `primary`/`on-primary`, an `accent`,
`success`(+tint/border), `gold`(+ink/tint), `freeze`, `danger`, `cell`/`cell-mark`,
`line`, `img-plate` (illustration backdrop — keep it light in *both* themes so line
art never goes dark-on-dark), and any heatmap tokens.
*Gotchas that leak hardcoded colour:* inline SVGs (logo, icons, illustrations),
confetti/celebration colours, the manifest `theme_color`/`background_color`, and the
`<meta name="theme-color">` tag — update these too, and keep the meta in sync when the
theme toggles.

### 3.4 ID hygiene + migrate on rename
A stored id must **name the real thing**. If you rename or repurpose one, existing
localStorage and synced rows still hold the old key. Add a **one-time, idempotent
migration** that remaps old→new keys (in `load()` and after any remote merge), and
persist it. Don't migrate across a genuine *swap* (different item) — that would
misrepresent history; just retire the old id and start the new one fresh. (Reference
app: `external_rotations` → `band_raises` had a migration; `planks` → `deadbugs` was a
swap with none.)

### 3.5 Service worker: network-first + cache-bump, and cache-bust when testing
Use a **network-first** service worker so app updates are picked up immediately, with
cache as an offline fallback. **Bump the `CACHE` version** whenever you change assets.
And when testing locally, embedded/in-app browsers happily serve **stale JS** — force
a truly fresh load with: unregister the SW, clear the Cache API, and
`fetch(url, {cache:'reload'})` each asset before reloading. (This wasted real time
until understood.)

### 3.6 Verify by exercising the real thing
Prove changes by **driving the real UI and probing the real backend**, not by
assuming. Pure logic (date/timezone math, migrations, scheduling) → deterministic
Node harnesses. The REST/function layer → `curl`. UI → actually click through it.

---

## 4. Supabase setup (portable)

Two independent systems — keep them straight:
- **Code**: Git → static host. A UI change needs commit + push + redeploy.
- **Data**: Supabase. A DB change (grants, schema) is live immediately, **no code
  push needed**.

Minimum tables mirror the local state: a `profile` row per sync code (settings +
derived lifetime stats), a `day_log` (per code, per date), plus whatever domain log
you need. Apply the RLS + **both** grant halves from §3.1 to every table. The
publishable/anon key is safe to commit — data is scoped by the private sync code, an
accepted trade-off for low-stakes personal data (harden later with a longer token).

---

## 5. Push notifications (closed-app)

Architecture (all reusable as-is; see `supabase/functions/send-reminders/` and
`DEPLOY.md §5` in the reference app):

- **Web Push + VAPID.** Generate a VAPID keypair; public key in `config.js`, private
  key **only** in the Edge Function's secrets (never committed).
- Store subscriptions (`endpoint`, `p256dh`, `auth`, **device timezone**, sync code)
  in a table.
- A **Supabase Edge Function** iterates subscriptions and sends pushes, evaluating
  each device's reminder times **in that device's timezone**.
- **pg_cron** invokes the function on a schedule (e.g. every 5 min).
- Make it **idempotent**: a `push_log` keyed by `(endpoint, slot)` so cron reruns
  never double-send. Prune subscriptions on 404/410 (device unsubscribed). Offer a
  `?test=1` mode for an instant test push.

The backend above is **platform-agnostic** — identical for Android and iOS. Only the
**client subscribe flow + install requirement** differ (next section).

---

## 6. iOS notifications — the key difference (verified against WebKit, 2026)

If the new app targets iPhone, the Supabase/VAPID backend is unchanged, but the client
has hard iOS rules:

- **iOS/iPadOS 16.4+** supports Web Push — **only for a web app added to the Home
  Screen** (Share → *Add to Home Screen*). A regular Safari tab gets **no** push.
  ([WebKit](https://webkit.org/blog/13878/web-push-for-web-apps-on-ios-and-ipados/))
- The permission request **must come from a direct user gesture** (a tap on your own
  "Enable notifications" button). iOS will **not** allow `Notification.requestPermission()`
  on page load or via `setTimeout` — unlike Android. Wire it straight to a click handler.
- Requires a valid **manifest**, **HTTPS**, and `display: "standalone"`.
- **Declarative Web Push** (Safari **18.4+**) is a newer, simpler option that can show
  a notification **without a service worker** — worth considering if you don't need
  custom SW logic. ([WebKit 18.4](https://webkit.org/blog/16574/webkit-features-in-safari-18-4/))
- **Re-verify on-device**: there have been region-specific (EU/DMA) disruptions to
  installed-PWA push in the past. Check current behaviour on a real device in your
  region.
- **Testing must be on a physical iPhone** — you cannot validate iOS push from a
  desktop browser. Install to Home Screen, tap your enable button, then fire the
  function's `?test=1`.

Practical UI implication: on iOS, detect "not installed to Home Screen" and show a
"Add to Home Screen to enable notifications" hint instead of a dead toggle.

---

## 7. New-app checklist

1. Copy the shape: `index.html` + ordered `js/*.js` IIFEs + `sw.js` + `config.js` +
   `manifest.json` + an app icon.
2. Swap the **domain module** (the catalog of tracked items + their content) and the
   **motivation mechanics** in the engine (`computeDerived`), keeping derive-don't-store.
3. Build the UI as string-templated, event-delegated views with `esc()`.
4. Theme with CSS-variable tokens (light + dark blocks) from day one — §3.3.
5. (Optional) Wire Supabase sync: create tables, apply RLS **+ both grant halves**
   (§3.1), fill `config.js`. Probe with `curl` before trusting the app (§3.2).
6. (Optional) Push notifications: VAPID keys → subscriptions table → Edge Function →
   pg_cron → `push_log` idempotency. On iOS, honour §6.
7. Deploy static; remember code and data are independent systems (§4).

---

## 8. Anti-patterns to avoid

- Storing running counters instead of deriving them.
- Hardcoding colours in components / SVGs / manifest instead of theme tokens.
- Shipping RLS policies without the matching GRANTs (and forgetting `service_role`).
- Swallowing backend errors into one vague message.
- Requesting notification permission without a user gesture (fatal on iOS).
- Forgetting to bump the service-worker cache version on an asset change.
