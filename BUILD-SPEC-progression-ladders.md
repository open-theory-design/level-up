# BUILD SPEC — Progression ladders (exercise upgrades)

When an exercise is rated "easy" twice in a row and the current form is maxed
out, the app today shows *advice text* ("progress the variation…"). This spec
turns that advice into a **one-tap upgrade**: the exercise levels up in place —
new name, new picture, new instructions — with a "Not now" that re-offers next
session.

Status: **built.** Verified by `node scripts/test-notifications.mjs` (ladder
section + client↔server ladder-name parity) plus browser checks of the offer,
dismissal, upgrade, art variants and stats. Edge Function redeploy pending — §9.

Origin: the user hit the Side Plank 40s cap, got the push saying "progress the
variation", and had no button to press.

---

## 1. Principles

1. **Same exercise, new level.** An upgrade never creates a new exercise id.
   Lifetime counts, timing stats and the flow order are untouched; only the
   presentation (name, dose, tips, avoid, artwork) and the working baseline
   change. This respects the ID-hygiene rule in CLAUDE.md — no migrations.
2. **Levels are earned forward, never revoked.** No auto-downgrade; the level
   only moves when the user taps Upgrade. (A manual downgrade in Settings is
   out of scope — flagged in §10.)
3. **Re-qualify at the new level.** After an upgrade, progression needs two
   easy sessions *at that level* before the next offer. Otherwise the two old
   "easy" ratings would immediately re-offer level 3.
4. **"Not now" is session-scoped.** Nothing is persisted; the offer simply
   reappears the next flow, because the qualifying state still holds. (User's
   explicit choice: ask again next session.)
5. **The server mirror must know levels**, or push copy will tell a user who
   already upgraded to "progress the variation" they're already doing.

---

## 2. The ladders

All five tracked exercises. Level 1 is the current exercise verbatim. Doses,
targets and hold structure (sets × secs, min/max) are **unchanged across
levels** — the movement gets harder, not longer — except where noted.
Equipment (confirmed available): heavier bands, dumbbells/plates, couch/step.

### Side Plank — `side_plank` (hold, 4 × 30s, cap 40s)
| Lvl | Name | What changes | Key tips |
|---|---|---|---|
| 1 | Side Plank | — | (current) |
| 2 | Side Plank — Top Leg Raised | Lift the top leg and hold it up; longer lever, glute-med bias. **Hold resets to 30s** (clear `holdSecs` override). | "Lift the top leg to hip height and hold it there", "Keep the hips stacked — don't roll back", "Both legs straight" |
| 3 | Side Plank — Feet Elevated | Feet on the couch/step, elbow on the floor. **Hold resets to 30s.** | "Feet on a step or couch, elbow under shoulder", "Straight line from head to heels", "The higher the feet, the harder it gets" |

At level 3 + 40s cap, the advice text becomes terminal: "Feet-elevated at 40s —
hold it there, or add a plate on your hip." No further auto-offer.

### Dead Bugs — `deadbugs` (reps, 2 × 20)
| Lvl | Name | What changes | Key tips |
|---|---|---|---|
| 1 | Dead Bugs | — | (current) |
| 2 | Tempo Dead Bugs | 4-second lowers, same 20 reps. | "Count 4 slow seconds on every lower", "Lower back stays glued to the floor", "Exhale on the way down" |
| 3 | Weighted Dead Bugs | Light dumbbell held straight over the chest in both hands; opposite arm/leg pattern becomes legs-only. | "Hold a light dumbbell straight above your chest", "Arms stay vertical — only the legs move", "If your back arches, the weight is too heavy" |

### Bird Dogs — `bird_dogs` (reps, 2 × 20)
| Lvl | Name | What changes | Key tips |
|---|---|---|---|
| 1 | Bird Dogs | — | (current) |
| 2 | Paused Bird Dogs | 3-second hold at full reach. | "Hold 3 full seconds at the top", "Reach long through fingertips and heel", "Nothing else moves" |
| 3 | Elbow-to-Knee Bird Dogs | Crunch elbow to knee under the body between reps. | "Touch elbow to knee under your body, then re-extend", "Round your back slightly on the crunch, flatten on the reach", "Slow both directions" |

### Banded Clamshells — `clamshells` (reps, 2 × 15/side)
| Lvl | Name | What changes | Key tips |
|---|---|---|---|
| 1 | Banded Clamshells | — | (current) |
| 2 | Clamshells — Heavier Band | Next band up, same reps. | "Move up to the next band", "Same strict form — no torso roll", "The last 3 reps should burn" |
| 3 | Paused Clamshells — Heavy Band | 2-second squeeze at the top on the heavier band. | "Squeeze 2 full seconds at the top", "Keep tension through the whole set — never let the band go slack" |

### Leg-Out Hip Thrusts — `hip_thrusts` (reps, 2 × 12/leg)
| Lvl | Name | What changes | Key tips |
|---|---|---|---|
| 1 | Leg-Out Hip Thrusts | — | (current) |
| 2 | Weighted Hip Thrusts | Dumbbell or plate across the hips. | "Rest a dumbbell or plate across your hips", "Drive through the heel, squeeze at the top", "Chin tucked, gaze forward" |
| 3 | Elevated Single-Leg Hip Thrusts | Shoulders on the couch/bench, one leg, full range. | "Shoulders on the couch, one foot planted", "Hips all the way up to a flat tabletop", "Add the dumbbell back once 12 feels easy" |

Quad Foam Roll keeps **no ladder** — soft-tissue work has no progression by
design (it's deliberately absent from progression today).

---

## 3. Data model

### 3.1 Exercise definitions — `js/exercises.js`

Each tracked exercise gains a `levels` array. Level 1 is the base definition
itself (no duplication); `levels[0]` describes level 2, and so on:

```js
{ id: "side_plank", name: "Side Plank", dose: "2 × 30s per side",
  track: { type: "hold", sets: 4, secs: 30, min: 15, max: 40 },
  tips: [...], avoid: [...],
  levels: [
    { name: "Side Plank — Top Leg Raised", dose: "2 × 30s per side",
      tips: [...], avoid: [...] },
    { name: "Side Plank — Feet Elevated", dose: "2 × 30s per side",
      tips: [...], avoid: [...] }
  ] }
```

A level object overrides `name`, `dose`, `tips`, `avoid`; everything absent
falls through to the base (`track` structure never changes per level).

### 3.2 Current level — synced settings

```js
state.settings.exLevel = { side_plank: 1, ... } // 0-based upgrade count; absent = 0
```

Lives in `settings` so it syncs through the existing profile LWW and is visible
to the Edge Function. A resolver in `js/app.js`:

```js
function levelOf(ex)  { return (state.settings.exLevel || {})[ex.id] || 0; }
function levelView(ex) { /* base fields overlaid with ex.levels[levelOf(ex)-1] when > 0 */ }
```

Every render site that shows name/dose/tips/avoid/artwork goes through
`levelView(ex)` — flow screen, done-row labels, stats Exercises card, dashboard
list.

### 3.3 Set records — level stamp

`dayLog[date].sets[exId]` is `{ s: [...], diff }` ([js/app.js:644](js/app.js:644)).
Records written at level > 0 gain `lvl`:

```js
{ s: [30, 30, 30, 30], diff: "easy", lvl: 1 }
```

Absent `lvl` = level 0. Syncs through `sets_log` unchanged (jsonb — no schema
change). This is what makes re-qualification (§1.3) and honest history possible:
a 40s hold at level 0 and a 30s hold at level 2 are different achievements.

### 3.4 Qualification filter

`lastTwoSessions` / the server's `lastTwo` loop only count records whose
`(rec.lvl || 0) === currentLevel`. One line in each engine
([js/app.js:779](js/app.js:779), `logic.js progressionFromRows`) — and the
reason an upgrade instantly silences the offer: zero records exist at the new
level yet.

---

## 4. The offer UI (flow screen)

Where the `⬆` advice line renders today ([js/app.js:962](js/app.js:962)).
When `progressionState(ex)` is truthy **and** a next level exists **and** the
offer isn't session-dismissed, the text line is replaced by an offer panel:

```
┌──────────────────────────────────────────┐
│ ⬆ Ready for the next level               │
│ Side Plank — Top Leg Raised              │
│ Longer lever, same 30s holds.            │
│ [ Upgrade ]        [ Not this time ]     │
└──────────────────────────────────────────┘
```

- **Upgrade** → `exLevel[ex.id]++`, delete `state.settings.holdSecs[ex.id]`
  (hold baseline resets), `settingsUpdatedAt` bumped, save, re-render. The
  screen updates in place — new name, art, tips — plus a toast:
  "Side Plank upgraded ✓ Holds reset to 30s".
- **Not this time** → adds the ex id to a session-scoped `upgradeDismissed`
  object (plain variable, not persisted). The panel collapses back to nothing
  for the rest of this flow run; next session it re-appears (per §1.4).
- When the exercise is at its **final level**, no panel — the advice string
  (terminal variant, §2) renders as the plain `tk-levelup` line, as today.
- Both buttons `stopPropagation` — the flow screen is a tap-to-advance target
  ([js/app.js:619](js/app.js:619)), and an accidental advance on "Upgrade"
  would be a misfire.

Exercises without a `levels` ladder but with advice (none today — all five have
ladders) would fall back to the text line; keep the fallback for derived apps.

---

## 5. Artwork

`imageFor(ex)` ([js/app.js:113](js/app.js:113)) resolves by `ex.id` into
`PF_IMAGES.illustration` / `.color` / `.photoHTML`. It changes to resolve by
**level-aware key**: `ex.id` when level 0, else `ex.id + "@" + level` with
fallback to the base id if no art exists for that key.

New art required (line art in `js/exercises.js`'s illustration map + colour in
`js/illustrations-color.js`), drawn as variants of the existing SVGs:

| Key | Art delta from base |
|---|---|
| `side_plank@1` | top leg raised to hip height |
| `side_plank@2` | feet on a block/couch, body angled down to elbow |
| `deadbugs@1` | same pose + tempo arrows / slow-motion marks |
| `deadbugs@2` | dumbbell held above chest, both arms vertical |
| `bird_dogs@1` | pause marks at full reach |
| `bird_dogs@2` | elbow and knee meeting under the body |
| `clamshells@1` | band drawn thicker/darker |
| `clamshells@2` | band thicker + squeeze/pause marks at open position |
| `hip_thrusts@1` | dumbbell resting across hips |
| `hip_thrusts@2` | shoulders on a bench/couch, single leg planted |

**Photos style:** no new photography exists, so photos fall back to the base
photo via the existing onerror/fallback chain ([js/app.js:450](js/app.js:450)).
Acceptable: the photo shows the movement family; the name/dose/tips carry the
level.

---

## 6. Server mirror — `logic.js`

Three additions, all keep-in-sync with the client:

1. **`LEVELS` mirror**: per exercise id, an array of level names + the per-level
   advice strings (§7). Small — names only, no tips.
2. **`progressionFromRows` gains the level filter**: reads
   `profile.settings.exLevel`, skips set records whose `(rec.lvl || 0)` doesn't
   match, exactly like the client.
3. **Advice per level** (§7) replaces the static `progressionAdvice` strings
   for laddered exercises.

`index.ts` passes `settings.exLevel` through — it already fetches the whole
`settings` object, so no query changes. Redeploy required (again).

`scripts/test-notifications.mjs` grows parity cases: level filter agreement
between engines, and one fixture where an upgraded exercise with two old easy
sessions produces **no** advice.

---

## 7. Copy

### Offer panel subline (client)
| Exercise → next level | Subline |
|---|---|
| Side Plank → Top Leg Raised | "Longer lever, same 30s holds." |
| Side Plank → Feet Elevated | "Feet up on the couch. Holds reset to 30s." |
| Dead Bugs → Tempo | "Same 20 reps — 4-second lowers." |
| Dead Bugs → Weighted | "Light dumbbell over your chest, legs do the work." |
| Bird Dogs → Paused | "3-second holds at full reach." |
| Bird Dogs → Elbow-to-Knee | "Crunch under, then reach. Slow both ways." |
| Clamshells → Heavier Band | "Next band up. Same strict 15s." |
| Clamshells → Paused Heavy | "2-second squeeze at the top." |
| Hip Thrusts → Weighted | "Dumbbell across the hips." |
| Hip Thrusts → Elevated Single-Leg | "Shoulders on the couch, full range." |

### Push / advice strings (server + client advice line)
Replace the static per-exercise string with per-level:
- Not at final level: "**{Exercise} has earned an upgrade — take it in your
  next flow.**" (the button lives in the app; the push just points there)
- At final level: terminal lines per §2 (e.g. Side Plank's plate-on-hip line;
  Clamshells: "top of the band ladder — chase slower, stricter reps";
  Hip Thrusts: "add weight to the single-leg version, 2kg at a time").

The notification ladder rule (BUILD-SPEC-notifications.md §4.1 item 4) is
unchanged — it just carries the new strings.

---

## 8. Stats

The Exercises card already shows the working level line and trend by totals
(structure-invariant). Changes:
- Row title goes through `levelView(ex)` → shows the current level's name.
- Sub-line gains the ladder position when > 0: "Level 2 of 3".
- Trend/sparkline: **no change** — totals remain comparable and the hold-reset
  dip after an upgrade is real and honest (you got stronger, the number
  restarts lower on a harder movement). No annotation in v1.

---

## 9. Verification

Node (`scripts/test-notifications.mjs` + new `scripts/test-ladders.mjs` if
cleaner):
- Level filter: two easy sessions at lvl 0 + `exLevel=1` → no advice (both
  engines, parity-checked).
- Two easy sessions at the current level → advice/offer returns.
- Final level → terminal advice, never an offer.
- Push copy names the *next* level correctly per `exLevel`.

Browser (412×915, light + dark):
- Qualify side plank (seed two easy 4×40s sessions) → offer panel renders on
  its flow screen; Upgrade updates name/art/tips in place, holds read 30s,
  `holdSecs` override gone, toast fires; panel gone (no records at new level).
- "Not this time" → panel gone for this run, back next run (new flow start).
- Buttons don't trigger tap-to-advance.
- Stats row shows "Side Plank — Top Leg Raised · Level 2 of 3".
- Art renders at every level in both art styles; photos fall back to base.
- Sync: `exLevel` round-trips through the profile (check localStorage after a
  pull on a second seeded state).

Housekeeping: `sw.js` CACHE → v16; Edge Function redeploy (logic.js).

---

## 10. Out of scope (v1)

- **Manual level control in Settings** (downgrade / jump). Add later if a
  variation aggravates something — until then, the ladder only moves via the
  offer.
- Per-level photo assets.
- Annotating upgrade points on the stats sparkline.
- Ladders for untracked/self-paced exercises.
