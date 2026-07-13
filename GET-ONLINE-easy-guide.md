# Getting Level Up online — the easy, no-code guide

You'll use three free services. No coding, no terminal — just clicking and copy-paste.
Total time: about 20–30 minutes.

- **Supabase** = where your data lives (lets phone + desktop share the same info)
- **GitHub** = where your code files live online
- **Vercel** = turns those files into a real website you can open anywhere

Do the parts in order.

> **Tip before you start:** open a blank note (Notes app, or a text file) to paste
> two values into partway through. You'll copy them from Supabase and use them later.

---

## Part 1 — Set up your data (Supabase)

1. Go to **supabase.com** and click **Sign up** (signing in "with GitHub" is fine, or use email).
2. Click **New project**.
   - Name: `level-up`
   - Database password: type any password and **save it in your note** (you won't need it day-to-day, but keep it).
   - Region: pick the one closest to you.
   - Click **Create new project** and wait ~2 minutes while it sets up.
3. In the left sidebar, click **SQL Editor**, then **New query**.
4. Copy the entire block below, paste it in, and click **Run**. You should see a success message.

```sql
create table profile (
  sync_code   text primary key,
  created_at  timestamptz default now(),
  updated_at  timestamptz default now(),
  settings    jsonb,
  freezes     int default 0,
  earn_counter int default 0,
  lifetime    jsonb,
  timing      jsonb,
  timing_updated_at timestamptz,
  badges_seen jsonb
);

create table day_log (
  sync_code     text references profile(sync_code) on delete cascade,
  log_date      date,
  reps          int default 0,
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
  lift       text,
  weight_kg  numeric,
  reps       int,
  sets       int
);

alter table profile      enable row level security;
alter table day_log      enable row level security;
alter table strength_log enable row level security;

create policy "anon all" on profile      for all using (true) with check (true);
create policy "anon all" on day_log      for all using (true) with check (true);
create policy "anon all" on strength_log for all using (true) with check (true);
```

5. Now get your two keys. In the left sidebar click the **gear (Project Settings)** → **API**. Copy these into your note:
   - **Project URL** (looks like `https://abcd1234.supabase.co`)
   - **anon public** key (a long string, under "Project API keys")

> ⚠️ Copy the **anon public** key — NOT the "service_role" one. The anon key is
> safe to put in your code; the service_role one is a secret, don't use it here.

---

## Part 2 — Put your code online (GitHub)

6. Go to **github.com** and click **Sign up** (free).
7. Click the **+** (top right) → **New repository**.
   - Repository name: `level-up`
   - Leave it **Public** (that's fine — your keys are safe to share).
   - Click **Create repository**.
8. On the next page, click the link **"uploading an existing file"**.
9. Open your **pt-app** folder on your computer. Select **everything inside it**
   (all the files and the `js`, `css`, `photos` folders — but not the pt-app folder itself),
   and **drag it into the browser** window. Wait for the uploads to finish.
10. Click the green **Commit changes** button.

---

## Part 3 — Add your two keys (edit one file, in the browser)

11. In your GitHub repo, click on **config.js**.
12. Click the **pencil icon** (Edit this file), top right of the file.
13. Replace the placeholder text, keeping the quote marks:
    - `PASTE_YOUR_SUPABASE_URL_HERE` → your **Project URL**
    - `PASTE_YOUR_SUPABASE_ANON_KEY_HERE` → your **anon public** key
14. Click **Commit changes**.

---

## Part 4 — Make it a real website (Vercel)

15. Go to **vercel.com** → **Sign up** → **Continue with GitHub** (easiest — it links the two).
16. Click **Add New… → Project**.
17. Find your **level-up** repo in the list and click **Import**.
18. Don't change any settings (there's nothing to build). Click **Deploy**.
19. Wait ~30 seconds. You'll get a link like **`level-up-xxx.vercel.app`**.
    That's your live app. 🎉

---

## Part 5 — Put it on your phone and desktop

20. Open your Vercel link on each device and "install" it so it acts like an app:
    - **iPhone (Safari):** Share button → **Add to Home Screen**
    - **Android (Chrome):** menu (⋮) → **Install app**
    - **Desktop (Chrome/Edge):** the small **install icon** in the address bar
21. It works right away on the first device. To sync your **second** device:
    - Open the same link there.
    - Tap the **sync-code chip** at the top right.
    - Type the **6-character code** shown on your first device, then **Sync device**.
    - Both devices now stay in sync automatically.

---

## If something looks wrong

- **Blank page / not saving across devices:** re-check Part 3 — the URL and key must be
  inside the quote marks, with no extra spaces. Fix it in GitHub and Vercel re-deploys automatically.
- **SQL error in Part 1:** make sure you pasted the whole block, then click Run again.
- **Can't find your repo in Vercel:** make sure you signed into Vercel *with GitHub* (step 15).
- **Photos missing on some exercises:** that's expected — 5 come included, the rest show a
  placeholder until you add your own. You can switch to the illustration style in Settings anytime.

## Good to know
- Everything here stays on the **free tier**. A single user won't come close to any limit.
- Supabase pauses a project after ~1 week of zero use; since you'll use it a few times a week,
  it won't pause — and if it ever did, your data is safe and you just click "Resume".
- You already have the code on GitHub, so if you ever want to skip Vercel you could switch on
  GitHub Pages instead — but Vercel is the smoother option, so stick with it unless you're curious.
