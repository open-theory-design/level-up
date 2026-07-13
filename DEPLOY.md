# Level Up — deploy & sync setup

The app is fully static. With `config.js` left as-is it runs in **local-only
mode** (everything works on one device via localStorage). To get phone ↔
desktop sync, set up the free Supabase backend (~5 minutes), then host the
folder anywhere static (Vercel recommended).

---

## 1. Supabase (free tier)

1. Create a project at [supabase.com](https://supabase.com) (any name/region).
2. Open **SQL Editor** → paste and run the schema below.
3. Open **Project Settings → API** and copy:
   - **Project URL** → `SUPABASE_URL` in `config.js`
   - **anon / public key** → `SUPABASE_ANON_KEY` in `config.js`

The anon key is designed to be public; your data is scoped by the private
sync code, not by the key.

### Schema

```sql
create table profile (
  sync_code   text primary key,
  created_at  timestamptz default now(),
  updated_at  timestamptz default now(),
  settings    jsonb,
  freezes     int default 0,
  earn_counter int default 0,
  lifetime    jsonb,
  timing      jsonb,             -- flow timing averages (syncs across devices)
  timing_updated_at timestamptz, -- last-write-wins marker for timing
  badges_seen jsonb              -- milestone ids already revealed (union-merged)
);

create table day_log (
  sync_code     text references profile(sync_code) on delete cascade,
  log_date      date,
  reps          int default 0,        -- 0 not done, 1 green, 2 gold
  is_required   boolean,
  freeze_used   boolean default false,
  exercises_done jsonb,
  updated_at    timestamptz default now(),
  primary key (sync_code, log_date)
);

create table strength_log (
  id         uuid primary key,
  sync_code  text references profile(sync_code) on delete cascade,
  logged_at  timestamptz,
  lift       text,                    -- ytw | face_pull | hip_thrust | squat | deadlift
  weight_kg  numeric,
  reps       int,
  sets       int
);

-- MVP access model (PRD §2.1, accepted trade-off): unauthenticated anon
-- access, data scoped only by knowing the sync code. RLS is enabled with
-- permissive policies so the v2 hardening path (longer token + real
-- policies) is a policy change, not a schema change.
alter table profile      enable row level security;
alter table day_log      enable row level security;
alter table strength_log enable row level security;

create policy "anon all" on profile      for all using (true) with check (true);
create policy "anon all" on day_log      for all using (true) with check (true);
create policy "anon all" on strength_log for all using (true) with check (true);
```

> **Known limitation (accepted for MVP):** a 6-char code is enumerable and
> the rows are unauthenticated — anyone who guesses the code could
> read/write the data. Fine for personal, low-stakes data. v2 hardening:
> longer random token + real RLS policies.

## 2. Hosting on Vercel

```bash
npm i -g vercel      # once
cd pt-app
vercel               # preview deploy
vercel --prod        # production
```

No build step, no framework — Vercel serves the folder as static files.
(GitHub Pages works too: push the folder and enable Pages.)

## 3. Install as a PWA

- **iOS Safari:** Share → *Add to Home Screen*.
- **Android Chrome:** menu → *Install app*.
- **Desktop Chrome:** install icon in the address bar.

Offline: the service worker caches the app shell, so it opens without a
network connection; sync resumes when you're back online.

> Reminders fire **while the app is open / recently foregrounded** only.
> Closed-app scheduled push is not possible for a serverless PWA and is
> explicitly out of scope for v1 (PRD §2.2).

## 4. Syncing a second device

1. Open the deployed site on device B.
2. Tap the sync-code chip (top right) → **Sync** section.
3. Type device A's 6-character code → **Sync device**.

Both devices now read/write the same rows. Conflicts resolve
last-write-wins per day/entry.

## 5. Image styles

Three styles ship, switchable in Settings → *Image style*:

- **Line art** — bundled clinical SVG line drawings (default). Full set of 12.
- **Color** — bundled flat colored SVG figures (`js/illustrations-color.js`). Full set of 12.
- **Photos** — real photos from `photos/<exercise_id>.jpg`. **5 are included**
  (lat stretch, pec stretch, neck stretch, wall angels, chin tucks); the other
  7 show a flagged placeholder until you add them.

### Adding / replacing photos

Drop a JPG named for the exercise id into `photos/` and it appears
automatically (the app loads `photos/<id>.jpg`, placeholder otherwise):

```
lat_stretch.jpg  pec_stretch.jpg  neck_stretch.jpg  wall_angels.jpg
chin_tucks.jpg   external_rotations.jpg  psoas_stretch.jpg  cat_cow.jpg
planks.jpg       bird_dogs.jpg    clamshells.jpg    hip_thrusts.jpg
```

Raw source images live in `photos-src/` (not used at runtime). The included
photos were normalized to a uniform 800×600 (4:3), subject-focused crop. To
regenerate after dropping new sources, re-run the crop script referenced in
the project notes, or crop by hand to 800×600.

> **Licensing:** the included photos are third-party stock/web images kept for
> personal use. Replace them with properly-licensed assets before any public
> deployment.
