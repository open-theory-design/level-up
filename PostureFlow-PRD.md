# PostureFlow — Product Requirements Document (v2, refined)

Personal posture-correction and strength tracker. Single user (you), your phone + desktop.
Targets Upper Crossed Syndrome (rounded shoulders, hunched back) and Lower Crossed Syndrome (anterior pelvic tilt, weak glutes).

This is a rewrite of the original PRD with the ambiguities resolved and the technically-impossible parts corrected. Decisions locked during review are captured inline; a summary of what changed from v1 is at the end.

---

## 1. Product philosophy

- **Low screen-time, high intent.** No countdown timers, no ticking clocks, no autoplay. The app is an interactive checklist that guides intentional execution and gets you off the screen fast.
- **Frictionless access.** No usernames, passwords, or emails.
- **Psychology-driven consistency.** A flexible streak engine that holds you accountable on required days, rewards extra effort, and lets minor life disruptions slide without breaking momentum.

---

## 2. Technical architecture

### 2.1 Hosting + sync
Static frontend (HTML/CSS/JS), hosted on **Vercel** (recommended over GitHub Pages for smoother deploys; either works). Data synced through **Supabase free tier** (Postgres).

**Zero-login sync (kept simple, per decision):**
1. First open generates a **6-character sync code**, stored in `localStorage`, and creates one unauthenticated row in Supabase.
2. To add a device: open the site → "Sync device" → type the code. Both devices now read/write the same row.

> **Known limitation (accepted for MVP):** a 6-char code is enumerable, and the row is unauthenticated, so anyone who guesses it could read/write your data. Acceptable because this is personal, low-stakes data. **v2 hardening path:** longer random token + Supabase Row Level Security. Documented, not built.

> **Multi-device writes:** last-write-wins. Fine for a single user who rarely edits two devices at the same second. Timestamped field-level merge is a future option, not MVP.

### 2.2 Notifications — corrected
The original spec promised scheduled local notifications that fire when the app is fully closed. **PWAs cannot do this reliably** — the OS kills the Service Worker and `setTimeout`-style timers don't survive it. True timed pushes require a backend (server + VAPID keys), which conflicts with the zero-server goal.

**Decision: in-app reminders only.** Reminders fire while the app is open/recently foregrounded. The app is still installable as a PWA (home-screen icon, offline shell), but "buzz me when the app is closed" is explicitly out of scope for v1. See §5.5.

---

## 3. Design language

**Aesthetic:** "Clinical Minimalist" — a crisp, high-end physical-therapy-clinic feel. Explicitly *not* earthy/yoga.

- **Background:** pure white `#FFFFFF`, soft gray `#F8F9FA`.
- **Primary / accent:** medical slate blue `#2B4C7E`, functional teal `#00A896`.
- **Streak states:** forest green `#2A9D8F` (standard success), amber/gold `#E9C46A` (2× "overachiever"), light blue `#E6F1FB` (freeze-protected).
- **Typography:** Inter / system geometric sans.
- **Layout:** heavy white space, large rounded buttons (12px radius), crisp dividers, zero clutter.

---

## 4. Scheduling & streak engine

This is the heart of the app. All logic below is derived from a completion log, not a stored counter — which makes retroactive edits and the 4am boundary trivial to handle (just recompute).

### 4.1 Definitions
- **Logical day:** runs **4:00am → 3:59am** local time. A session logged at 1am counts for the *previous* calendar day.
- **Required days (streak can break):** **Monday, Wednesday, Thursday.**
- **Bonus days (always safe):** **Tuesday, Friday, Saturday, Sunday.**
- **"Completed" a day:** performing *some* of the daily flow (≥1 exercise logged) marks the day complete. Full completion once = **green (1×)**; completing the full flow twice in one day = **gold (2× overachiever)**.

### 4.2 The streak counter
The streak = count of consecutive **kept** days. Each completed day adds **+1**, regardless of whether it's required or bonus.

| Event | Effect on streak |
|---|---|
| Complete a required day | +1 |
| Complete a bonus day | +1 |
| Miss a bonus day | no change (never penalized) |
| Miss a required day, freeze available | freeze consumed; streak **holds flat** (no +1, no reset) |
| Miss a required day, no freeze | streak **resets to 0** |

`2×` (gold) does **not** double the streak — it's still +1 for the day. Gold is a quality flag tracked in lifetime stats (§4.5).

Worked example (your scenario): Mon done → 1, Wed done → 2, Thu missed but freeze used → holds at 2, Sat done → 3, Sun off (safe) → 3, Tue done → 4, then Thu missed with no freeze → resets to 0.

### 4.3 Freeze economy
- **Earn:** +1 freeze for every **3 required days completed in a row**. The earn-counter resets to 0 after each grant.
- **Cap:** maximum **2** freezes.
- **Consume:** automatic on a missed required day.
- A missed required day breaks the "3 in a row" earn-counter (resets it to 0) even when a freeze protected the streak — you didn't actually complete that day.

### 4.4 Retroactive edits
Allowed. You can toggle any past day's completion (e.g., you forgot to log yesterday). Because the streak, freezes, and stats are all **recomputed from the completion log**, editing a past day simply re-runs the calculation forward. No special-casing needed.

### 4.5 Lifetime stats (never reset)
Kept separately so nothing is ever "lost" when a streak resets to 0:
- Total sessions, total completed days, total gold (2×) days, total bonus days.
- Longest streak ever.
- Freezes earned / freezes used.
- Per-exercise completion counts.
- Strength PRs (from §6).

---

## 5. Screens & modules

### 5.1 Main dashboard
Optimized for immediate, low-resistance use on open.

- **Header:** "PostureFlow" + sync code chip.
- **Streak block:** big current-streak number (green) + freeze bank (snowflake icons).
- **7-day strip — Variant B (chosen):** all seven days shown in one row. Required days (Mon/Wed/Thu) render at normal weight; bonus days (Tue/Fri/Sat/Sun) render lighter/softer. Completions highlight the same way regardless of day type: green check (1×), gold double-check (2×), light-blue snowflake (freeze-protected), muted empty cell (not done). No dashed outlines, no separate bonus badges.
- **Daily posture flow:** big "Start daily flow" button (launches §5.3) + an inline manual checklist (tap once = 1×/green, twice = 2×/gold, third tap = reset).
- **Ad-hoc strength card:** collapsed by default; shows "Last logged: N days ago"; never flags as overdue (§6).
- **Stats:** entry point to lifetime stats (§4.5).

### 5.2 (reserved)

### 5.3 "Start daily flow" — full-screen carousel
- One exercise at a time, large static image (from the active image set, §5.6) showing correct form.
- **No countdown timers** — you move at your own pace.
- **Massive "Next" button** at the bottom. Tapping Next saves that exercise's completion and slides to the next.
- **Persistent form cue** hardcoded in bold under each image.
- Finishing the sequence marks the day complete (green; a second full pass that day → gold).

**Fixed sequence (authoritative — reordered and with sets/reps from review):**

| # | Exercise | Dose | Form cue |
|---|---|---|---|
| 1 | Lat Stretch | self-paced | Elbows on table, elbows tucked inward. |
| 2 | Pec Stretch | self-paced | Keep shoulders down away from ears. Don't force the joint. |
| 3 | Neck Stretch | self-paced | Drop the opposite arm all the way down, tilt head sideways, then gently twist chin downward. |
| 4 | Wall Angels | self-paced | Press your lower back flat against the wall. Don't let your ribs flare out. |
| 5 | Chin Tucks | hold 3–5s | Pull your head straight back like making a double chin. |
| 6 | External Rotations | self-paced | Towel on fist, press into the wall, move up and down with controlled scapular tension. |
| 7 | Kneeling Psoas Stretch | 2 × 45s per leg | Squeeze the glute of the *stretching* leg to push the hip forward. Don't arch your lower back. |
| 8 | Cat/Cow | 10 slow transitions | Move slowly through your full spinal range of motion. |
| 9 | Planks / Half Side Planks | 3 × 30–45s | Tuck your tailbone, squeeze your glutes, pull elbows toward toes. No sagging lower back. |
| 10 | Bird Dogs | 2 × 10 per side | Torso perfectly still like a tabletop. Move slowly. |
| 11 | Banded Clamshells | 2 × 15 per side | Don't rotate your torso. Isolate the burn to the side of your glute. |
| 12 | Leg-Out Hip Thrusts (unweighted) | 2 × 12 per leg | Drive through your heel. Keep your gaze forward, not at the ceiling. |

Doses display as static text cues (no auto-timer) consistent with the low-screen-time philosophy.

### 5.4 (folded into §6)

### 5.5 In-app reminders
- Configurable times (default **11:00** and **15:00**).
- Fire while the app is open/recently foregrounded (documented limitation, §2.2).
- Message templates:
  - A: "Posture check: drop your shoulders, tuck your chin."
  - B: "Desk break: stand up and squeeze your glutes for 10 seconds."
- Toggle on/off and edit times in Settings.

### 5.6 Exercise image system (dual-source, switchable)
- Every exercise has an **image slot**.
- Two bundled sets ship with the app:
  - **Illustrations** — custom uniform line-art (clinical style; sample approved during review).
  - **Photos** — free openly-licensed images where they exist; **paid-stock placeholder** for the niche moves (wall angels, banded clamshells, YTWs, etc.) that have no free coverage. Placeholders are flagged as replaceable.
- **Settings toggle:** `Image style → Illustrations | Photos`.
- **Per-exercise override (v1.1):** replace any single image with your own upload; stored in Supabase storage so it syncs across devices. MVP ships the two bundled sets; user-upload override is fast-follow.

---

## 6. Ad-hoc strength & weights bank
Lives independently from the daily habit tracker; hidden behind an expandable card / separate tab so it never clutters recovery days.

- **Never flags overdue.** Reads only the distance from your last session ("Last logged: 2 days ago").
- **Warm-up gate:** the log intentionally forces **YTWs / Face Pulls** at the top as a mandatory baseline; weight inputs unlock only after it's logged.
- **Fixed order:** (1) YTWs or Face Pulls → (2) Weighted Hip Thrusts / Glute Bridges → (3) Squats → (4) Deadlifts.
- **Progressive-overload logbook:** clean numeric inputs that pre-populate from history as placeholders.
  - Weighted Hip Thrusts: `[ ] kg × [ ] reps` (last: 70kg × 10)
  - Squats: `[ ] kg × [ ] reps` (last: 80kg × 6)
  - Deadlifts: `[ ] kg × [ ] reps` (last: 100kg × 5)
- Target cadence: 2–3× per week (informational, not streak-bearing).

---

## 7. Data schema (Supabase)

Relational, keyed by sync code. (A single-JSON-blob alternative works too, but logs are cleaner relational.)

**`profile`**
| column | type | notes |
|---|---|---|
| sync_code | text PK | 6-char code |
| created_at | timestamptz | |
| settings | jsonb | `{ image_style, reminders_enabled, reminder_times[], bonus_display }` |
| freezes | int | current balance, 0–2 (also derivable) |
| earn_counter | int | required-days-in-a-row toward next freeze, 0–2 |
| lifetime | jsonb | totals from §4.5 |

**`day_log`** — one row per logical day
| column | type | notes |
|---|---|---|
| sync_code | text FK | |
| log_date | date | the 4am-based logical date |
| reps | int | 0 = not done, 1 = green, 2 = gold |
| is_required | bool | derived from weekday, stored for clarity |
| freeze_used | bool | |
| exercises_done | jsonb | optional per-exercise detail |
| PK | (sync_code, log_date) | |

**`strength_log`**
| column | type | notes |
|---|---|---|
| id | uuid PK | |
| sync_code | text FK | |
| logged_at | timestamptz | |
| lift | text | `ytw` \| `face_pull` \| `hip_thrust` \| `squat` \| `deadlift` |
| weight_kg | numeric | |
| reps | int | |
| sets | int | optional |

Streak and freeze balance are **derived** by reading `day_log` in date order and applying §4.2–4.3, so retroactive edits recompute cleanly.

---

## 8. MVP scope

**In v1:** dashboard (Variant B strip), streak/freeze engine, daily flow carousel (12 exercises + cues), manual checklist, ad-hoc strength bank with warm-up gate + logbook, lifetime stats, 6-char sync, PWA install, in-app reminders, dual image sets + toggle (illustrations built; photos with paid-stock placeholders).

**Fast-follow / v2:** per-exercise user image upload, sync-code hardening (longer token + RLS), field-level merge for concurrent writes, and — only if you decide it's worth a tiny backend — real closed-app push notifications.

---

## Appendix — what changed from v1
1. **Notifications** downgraded from "closed-app scheduled push" (not possible without a server) to honest in-app reminders.
2. **Weekend "counts toward target" logic removed.** Weekends are now pure bonus; required days are Mon/Wed/Thu only.
3. **Streak model pinned:** +1 per completed day; miss a required day → freeze or reset to 0; bonus days never penalize; 4am rollover; retroactive edits via recompute.
4. **Freeze rules pinned:** earn per 3 required-in-a-row (counter resets after grant), cap 2, consumed day holds streak flat and breaks the earn-counter.
5. **Lifetime stats** added so resets never erase history.
6. **Exercise sequence** updated to the reordered list with explicit sets/reps (Psoas before Cat/Cow, Clamshells before Leg-Out Hip Thrusts).
7. **Dashboard bonus display** set to Variant B (single strip, lighter bonus days).
8. **Image system** made a switchable dual-source feature (illustrations + photos) with per-exercise override planned.
9. **Sync security + write-conflict** trade-offs documented and consciously accepted for a personal MVP.
10. **Data schema** fully specified (was cut off in v1).
