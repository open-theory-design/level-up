# CLAUDE.md — Level Up (habit-tracking PWA template)

## What this is
Level Up (a.k.a. PostureFlow) is a zero-build, offline-capable PWA for daily-habit
tracking (posture/mobility exercise consistency). **It is intended as a reusable
model for other small, similar tracking apps** — copy the folder, swap the domain
content (exercises → whatever is being tracked), and keep the architecture below.

## Architecture (keep this shape in derived apps)
- **No framework, no build step.** Plain HTML/CSS/vanilla JS. `index.html` loads the
  scripts in order; each `js/*.js` file is an IIFE that hangs exactly one global off
  `window`.
- **Derive state, don't store counters.** localStorage is the source of truth
  (key `postureflow_state_v1`). Everything user-facing — streak, freezes, stats,
  heatmap, stars — is *recomputed* from a per-day log by `js/streak.js`
  (`computeDerived`), never persisted as a running total. This is why retroactive
  edits and the 4am day-boundary "just work": nothing is a stored counter.
- **Sync is optional and zero-login.** `js/store.js` mirrors localStorage to Supabase
  under a private 6-char sync code. Conflict policy = last-write-wins per day / per
  entry (union-merge for monotonic things like seen badges). With no Supabase creds
  in `config.js`, the app runs local-only and everything still works.
- **Module → global map:**
  - `config.js` → `POSTUREFLOW_CONFIG` (Supabase URL + anon key)
  - `js/streak.js` → `PFStreak` (dates, Monday-based week math, derived state — the engine)
  - `js/exercises.js` → `PF_EXERCISES`, `PF_LIFTS`, `PF_IMAGES` (+ `PF_COLOR_ART`)
  - `js/illustrations-color.js` → `PF_COLOR_ART`
  - `js/badges.js` → `PFBadges`
  - `js/store.js` → `PFStore` (persistence + Supabase sync)
  - `js/app.js` → UI IIFE (views: dashboard | flow | stats | settings; event-delegated)

## Conventions
- Logical day runs 4:00am→3:59am local (`PFStreak.logicalDateStr`). Weeks are
  **Monday-based** (`PFStreak.mondayOf`); required days are Mon/Wed/Thu.
- Dates are `YYYY-MM-DD` strings everywhere; derive them with `PFStreak.addDays`,
  not raw `Date` arithmetic.
- UI is string-templated HTML re-rendered on each change; escape any user-facing
  string with `esc()`.

## ⚠️ Supabase setup gotcha (cost a real bug — do NOT skip)
Enabling RLS + permissive policies is only **half** of Postgres permissions. The
`anon` role (the publishable key) also needs table **GRANTs**, or every request 401s
with `42501 permission denied for table …` and the app silently shows
"Code not found". Setup SQL must include BOTH halves (see `DEPLOY.md`):

```sql
alter table <t> enable row level security;
create policy "anon all" on <t> for all using (true) with check (true);
grant usage on schema public to anon;
grant select, insert, update, delete on public.<t> to anon;   -- the easily-forgotten half
```

Debug a "silently won't sync" report by probing the REST API directly *before*
touching app code:

```bash
curl "$SUPABASE_URL/rest/v1/profile?select=*&limit=1" \
  -H "apikey: $KEY" -H "Authorization: Bearer $KEY"
# 42501 / HTTP 401  → missing GRANTs
# []    / HTTP 200  → access is fine, look elsewhere
```

The `sb_publishable_…` anon key committed in `config.js` is safe to expose: data is
scoped by the private sync code, not the key (an accepted MVP trade-off — see PRD).

## Deploy
Static host (Vercel or GitHub Pages). **Two independent systems:** the GitHub→Vercel
pipeline ships *app code*; Supabase holds *data*. A DB change (like the grants above)
is live immediately with no code push; a UI change needs commit + push + redeploy.

## Reference docs
- `PostureFlow-PRD.md` — product spec (streak/freeze rules, views, data model)
- `DEPLOY.md` — Supabase schema + hosting + PWA install walkthrough
- `BUILD-SPEC-heatmap-milestones-celebrations.md` — heatmap / badges / celebration details
