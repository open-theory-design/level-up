# PostureFlow — Build Spec for Claude Code

**Scope:** three additions to the existing PostureFlow app — (1) a consistency heatmap, (2) a milestones/badges system, and (3) a day-completion celebration animation selectable in Settings.

This is an implementation spec for a coding agent working in this repo. It assumes the product decisions in `PostureFlow-PRD.md` (streak engine, palette, dashboard Variant B, Supabase sync). Read that first for shared context.

---

## 0. Existing architecture (work within this)

Current file layout:

```
index.html                 app shell; loads scripts in order below
config.js                  Supabase URL + anon key (or local-only mode)
css/styles.css             all styling (clinical-minimalist palette)
js/streak.js               PURE streak engine — derives streak/freezes/stats from day_log
js/exercises.js            exercise data + form cues + dose
js/illustrations-color.js  colored illustration set
js/store.js                state + Supabase sync + localStorage fallback
js/app.js                  UI rendering + view routing
manifest.json / sw.js      PWA
schema.sql                 Supabase tables (profile, day_log, strength_log)
```

**Core principle to preserve:** streak, freezes, lifetime stats, and now heatmap state + badges are all **derived by recomputing from `day_log`** (plus `strength_log`). Do not store counters that can drift. This is what makes retroactive edits and the 4am rollover correct for free. All three features below read from the same derived layer.

**Palette (already in `styles.css` as CSS vars — reuse, do not hardcode new hexes):**

| Meaning | Hex |
|---|---|
| Required day done (1×) | `#2A9D8F` |
| 2× / gold | `#E9C46A` |
| Freeze used | `#BFD8F0` |
| Bonus day done | `#C9EDE1` |
| Missed / rest / empty | `#EEF0F3` |
| Slate (primary) | `#2B4C7E` |
| Teal (accent) | `#00A896` |

---

## 1. Feature: Consistency heatmap

### 1.1 Goal
A calendar grid where each cell is one logical day, colored by what was completed, so the user sees consistency at a glance and watches it grow denser over time.

### 1.2 Data source
Extend the streak engine to expose a **per-date state map** rather than only the current-week strip. Add to `js/streak.js` a function that returns, for every date in a requested range, one of:

`gold | required-done | bonus-done | freeze | missed | rest | today-pending | future`

Where:
- `required-done` = reps ≥ 1 on a Mon/Wed/Thu.
- `bonus-done` = reps ≥ 1 on Tue/Fri/Sat/Sun.
- `gold` = reps == 2 (any day).
- `freeze` = a required day that was missed but protected by a freeze (from the forward walk).
- `missed` = a required day missed with no freeze (streak reset here).
- `rest` = a bonus day not completed (never penalized).
- `today-pending` = today, not yet completed.
- `future` = later than today (render faint or omit).

The dashboard's 7-day strip (Variant B) and the heatmap must both read from this single map — no second implementation.

### 1.3 Layout
- **Range (default):** rolling **16 weeks** ending this week. Chosen for phone fit with no horizontal scroll. (See Open Decision D1.)
- Grid: 7 rows (Mon→Sun top to bottom), one column per week, cells ~13px with ~3px gap, `rz`/`rx` 3px.
- Left column: single-letter weekday labels (M T W T F S S).
- Top: month labels aligned to the first column of each month.
- Render as inline SVG (matches the mockup approach) inside a card on a new **Stats** view (or a section of it), not the main dashboard.

### 1.4 Color
Default **graded** (reuses the state colors in §0). Legend row beneath the grid: Required day, Bonus day, 2× day, Freeze used, Missed/rest. (See Open Decision D2 for the simpler alternatives.)

### 1.5 Interaction
- Tap/click a cell → small popover or inline caption: the date + what happened ("Wed 14 May · completed 2×", "Mon 12 May · freeze used", "Sat · rest day"). Desktop shows the same on hover.
- No cell is interactive-to-edit here; retroactive edits happen on the dashboard/day view, and the heatmap reflects them on next render.

### 1.6 Empty & first-run states
- Before any history: show the empty grid (all `rest`/`empty` styling) with a one-line hint: "Your consistency fills in here as you log sessions."
- Weeks before the user's first log render as empty, not `missed` (no penalty for pre-history).

### 1.7 Acceptance criteria
- [ ] Grid renders 16 weeks × 7 days from the derived state map.
- [ ] Each state maps to the correct color; legend matches.
- [ ] A retroactive edit on a past day changes that cell after re-render.
- [ ] Fits a 360px-wide viewport with no horizontal scroll.
- [ ] Tapping a cell shows date + outcome.
- [ ] Pre-first-log weeks are empty, not counted as misses.

---

## 2. Feature: Milestones / badges

### 2.1 Goal
Discrete, permanent rewards unlocked at thresholds — the long-term "leveling up" the streak can't give (since streaks reset to 0). Lives on the Stats view as a badge shelf.

### 2.2 Badge catalog
All thresholds derived from `day_log` + lifetime stats. "Session" = one completed flow; a 2× day counts as **2 sessions**.

| id | Name | Dimension | Thresholds (one badge per tier) | Icon (Tabler) |
|---|---|---|---|---|
| `sessions` | Century / etc. | Cumulative sessions | 25, 100, 250, 500, 1000 | `ti-medal` |
| `streak` | First week / Month strong / etc. | Best streak ever | 7, 14, 30, 60, 100 | `ti-flame` |
| `gold` | Overachiever | Cumulative 2× days | 5, 10, 25, 50 | `ti-bolt` |
| `perfect_week` | Perfect week | Weeks with all 3 required days done | 1, 4, 12, 26 | `ti-calendar-stats` |
| `comeback` | Comeback | Rebuild a 7-day streak after a reset-to-0 | one-off | `ti-rotate-clockwise-2` |

Names per tier (suggested, editable): sessions → "Getting going / Century / 250 club / 500 club / Iron habit"; streak → "First week / Fortnight / Month strong / Two months / Centurion".

### 2.3 Earning logic
- Recompute the full earned set on every load from the derived layer (keeps retroactive edits honest).
- Best-streak-ever is tracked by the forward walk (max streak seen), so `streak` badges never un-earn if the current streak resets.
- `comeback` earns when the walk records a reset (streak → 0) that is later followed by a run reaching 7.
- **Unlock detection for celebration:** store a `badges_seen[]` list in `profile` (and mirror to localStorage). On recompute, any earned id not in `badges_seen` is newly unlocked → show the badge-reveal moment (§2.5), then append to `badges_seen`.

### 2.4 Display
- Badge shelf grid (`repeat(auto-fit, minmax(140px,1fr))`), matching the mockup.
- **Earned:** filled circle (slate for sessions, teal for streak, amber for gold, etc.), icon, name, threshold label, "✓ Earned".
- **In progress (next tier only):** muted circle, progress bar + `current / threshold` text.
- **Locked (future tiers / comeback):** muted circle + lock, no numbers until in-progress.
- Show only the next unearned tier per dimension as "in progress"; don't list every future tier at once.

### 2.5 Unlock moment
On a newly-earned badge: a brief centered reveal card (badge icon scales in, name + threshold, "Milestone unlocked"), dismiss on tap or after ~2s. Distinct from the daily completion animation (§3). Respect `prefers-reduced-motion` (show the card statically, no scale). If multiple unlock at once, queue them.

### 2.6 Reward semantics
**Default: cosmetic only** (see Open Decision D3). Badges display; they do not alter the freeze economy or gameplay. If the user later opts into functional rewards, the natural mapping is: each new `streak` tier grants +1 bonus freeze above the cap-2 — but this is **out of scope unless D3 says otherwise**.

### 2.7 Acceptance criteria
- [ ] All five dimensions compute correctly from the log.
- [ ] Streak badges persist after a streak reset (based on best-ever).
- [ ] Newly-earned badges trigger exactly one reveal, then never again.
- [ ] Retroactive edits recompute the earned set without duplicating reveals for already-seen badges.
- [ ] Progress bars show only the next tier per dimension.
- [ ] `prefers-reduced-motion` disables the scale-in.

---

## 3. Feature: Day-completion celebration animation

### 3.1 Trigger
Fires when a logical day transitions from **not-completed → completed** (reps 0 → 1), whether completion happened via the full-screen flow's final "Next" or via the manual checklist. Fires once per day. Reaching 2× (1 → 2) plays the same animation with an amber tint (the "gold" variant). Retroactive completion of a *past* day does **not** fire the animation (only "today" completions celebrate).

### 3.2 The three options (+ Off)
A Settings control `Completion celebration` with four values. Default: **Stamp**.

1. **Stamp** (default) — a crisp checkmark stamps into the day cell / center with a single expanding ring pulse in teal. Fast (~600ms), clinical, on-brand. Gold variant uses amber.
2. **Confetti** — a short burst of small teal + gold particles from the completed cell, falling and fading (~1s). The most celebratory.
3. **Ripple** — a calm single wash of teal expanding across the screen like a breath, then fading (~900ms). Minimal, no particles — fits the low-screen-time ethos.
4. **Off** — no animation; the state just updates. (Always available for a distraction-free option.)

### 3.3 Technical
- Prefer CSS transitions/keyframes for Stamp and Ripple; a lightweight `<canvas>` or transformed divs for Confetti (no external library — keep the zero-dependency footprint; supabase-js is the only CDN dep).
- Animation must be **non-blocking and skippable**: a tap anywhere dismisses it immediately; it never gates getting to the next screen (consistent with "get off the screen fast").
- Duration cap ~1s. No sound.
- Respect `prefers-reduced-motion`: force behavior equivalent to **Off** (or a single static checkmark for Stamp) regardless of the setting.
- No `localStorage`/DOM-storage beyond the existing store patterns; the chosen option lives in `profile.settings.celebration`.

### 3.4 Acceptance criteria
- [ ] Setting persists in `profile.settings.celebration` and syncs across devices.
- [ ] Correct animation plays on 0→1 today; amber variant on 1→2.
- [ ] No animation on retroactive past-day completion.
- [ ] Tap dismisses instantly; never blocks navigation.
- [ ] `prefers-reduced-motion` overrides to Off/static.
- [ ] Off truly plays nothing.

---

## 4. Settings additions
Add to the existing Settings view:
- `Completion celebration`: Off · Stamp · Confetti · Ripple (default Stamp).
- (If D1 is opened up) `Heatmap range`: 16 weeks · Full year. MVP: fixed at 16 weeks, no control.

Existing settings unchanged: image style (illustration/photo), reminders (times + on/off).

---

## 5. Data-model impact
Minimal — mostly derived. Only additions to the `profile.settings` / `profile` JSON:

```jsonc
// profile.settings
{
  "celebration": "stamp",        // off | stamp | confetti | ripple
  "image_style": "illustration",
  "reminders_enabled": true,
  "reminder_times": ["11:00", "15:00"]
}
// profile (top level)
"badges_seen": ["streak_7", "sessions_100"]   // for one-time unlock detection
```

No new tables. Heatmap and badge state are computed from `day_log` (+ `strength_log` if a future strength badge is added) at render time.

---

## 6. Non-goals (this spec)
- Strength-PR badges and the strength progression chart (deferred; different data path).
- The straightening-avatar growth feature (separate spec).
- Functional badge rewards (bonus freezes / unlocks) unless D3 is changed.
- Configurable heatmap range beyond the D1 default.
- Full-year horizontal-scroll grid on mobile.

---

## 7. Open decisions (defaults chosen — override in one line if wanted)
- **D1 — Heatmap range:** default **rolling 16 weeks** (mobile-first). Alt: full calendar year (needs horizontal scroll) or all-time scrollable.
- **D2 — Heatmap color detail:** default **graded** (required/bonus/2×/freeze distinct). Alt: simple done/not-done, or single-color intensity (darker = 2×).
- **D3 — Badge reward:** default **cosmetic only**. Alt: streak tiers grant a bonus freeze, or milestones unlock avatar stages / color themes.
- **D4 — Celebration default:** **Stamp**. (All four options ship regardless; this is just the out-of-box value.)
- **D5 — Badge naming:** clean-clinical with light flavor (names in §2.2). Alt: plain numeric only ("100 sessions", "30-day streak").
