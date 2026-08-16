# BUILD SPEC — Notifications

Replaces the current reminder system (generic posture/desk pings on a 7-day
cadence, plus a hardcoded 18:00 evening check and a Sunday "last chance") with a
small, state-aware set that only ever says true things.

Status: **built.** Verified by `node scripts/test-notifications.mjs` (includes the
engine-parity guard) plus browser checks of the migration, Settings and deep link.
The Edge Function still needs a redeploy — see §9.

---

## 1. Goal & principles

The app's model is: **Mon/Wed/Thu are required, everything else is bonus and
never penalised** ([js/streak.js:8](js/streak.js:8), [js/streak.js:89](js/streak.js:89)).
Notifications should reflect that model exactly.

1. **Never say something that isn't true.** No reminder after the flow is done,
   no "you'll lose your streak" when a freeze will cover it, no promise of a
   perfect week that's already impossible.
2. **Only key days generate demand.** Tue/Fri/Sat/Sun are silent.
3. **Escalate once, not three times.** One nudge in the morning, one warning in
   the evening — and the warning only if there is something real to lose.
4. **One positive beat a week.** The Sunday recap is the only push that isn't a
   demand.
5. **Copy varies.** A rotating pool per key day, overridden by state-specific
   copy when something more specific is true.

**Volume:** 4/week on a good week, 7/week worst case, down from ~18.

| Week | Pushes |
|---|---|
| Perfect (all three key days done) | **4** — Mon/Wed/Thu nudges + Sunday recap |
| One key day missed | **5** |
| All three missed | **7** |
| Tue / Fri / Sat | **0** |

---

## 2. What is removed

### Deleted outright

| Thing | Location | Why |
|---|---|---|
| Sunday "Last chance ⏳" push | [logic.js:171](supabase/functions/send-reminders/logic.js:171) | **Measures something the app doesn't have.** It counts *any* 3 sessions in the week, but a perfect week requires Mon **and** Wed **and** Thu specifically ([js/streak.js:141](js/streak.js:141)). And by Sunday every outcome is already locked — you cannot retro-complete Wednesday. The push promises a "full week" it cannot deliver. |
| `weeklyLastChanceBody()` | [logic.js:130](supabase/functions/send-reminders/logic.js:130) | Only consumer was the above. |
| Posture / desk-break bodies | [logic.js:149-151](supabase/functions/send-reminders/logic.js:149) | Generic, daily, ignorable. Their existence trains the user to swipe away the streak warning too. |
| In-app reminder polling loop | [js/app.js:1852-1867](js/app.js:1852) | 20s poll matching an exact `HH:MM` string — silently misses when the tab is throttled. Also the source of the triple-fire (toast + local Notification + push). |
| `REMINDER_MSGS`, `firedReminders`, `reminderCounter` | [js/app.js:13](js/app.js:13), [js/app.js:60](js/app.js:60) | Dead with the loop. |
| Cold permission prompt on first click | [js/app.js:1871-1876](js/app.js:1871) | Asked with zero context on any first tap → high denial rate, and denial is permanent. Moves to the Settings push toggle. |
| `toast()`'s `"reminder"` kind + `.toast.reminder` CSS | [js/app.js:135](js/app.js:135) | Only caller was the deleted loop. |
| `EVENING_CHECK` constant | [logic.js:9](supabase/functions/send-reminders/logic.js:9) | Becomes a user setting. |

### Fixed

- **The toggle lies.** `remindersEnabled` currently gates only the reminder
  *times* ([index.ts:99](supabase/functions/send-reminders/index.ts:99)); the
  evening branch fires regardless. The new master switch governs **all** pushes.
- **Test push sprays every device.** [index.ts:68](supabase/functions/send-reminders/index.ts:68)
  loops all subscriptions. It should take `?test=1&endpoint=<encoded>` and send
  to that one endpoint only.

---

## 3. The notification set

Three pushes. All are suppressed when the master switch is off, and all are
evaluated in the device's own timezone via the existing `localNow()`.

| # | Slot key | When | Fires only if |
|---|---|---|---|
| 1 | `<date> keyday` | `notify.keyDayTime`, Mon/Wed/Thu | flow not done today · has history |
| 2 | `<date> warn` | `notify.warningTime`, Mon/Wed/Thu | flow not done today · **streak ≥ 1** |
| 3 | `<date> recap` | `notify.warningTime`, Sunday | `notify.recapEnabled` · has history |

**No collisions.** The recap lands on Sunday, which has no nudge and no warning
(Sunday is a bonus day). Monday keeps its own nudge and its own copy pool. The
recap borrows `warningTime` rather than adding a fifth Settings row — 18:00 on a
Sunday, when the week is settled and Monday is in view.

**Warning requires `streak ≥ 1`.** At zero there is nothing to lose, and the
morning nudge already carries the restart framing. This is what "only if I'll
actually lose it" means in code.

**"Has history"** = `derived.firstLog != null`. A user who has never logged a
session gets nothing at all.

---

## 4. Copy

### 4.1 Key-day nudge — selection ladder

First match wins. Everything below the match is skipped.

| # | Condition | Body |
|---|---|---|
| 1 | Today's session lands on a streak tier (`streak + 1` ∈ `[3,7,14,30,60,100]`) | "Today makes {N}. {tier name}." |
| 2 | **Thu** · Mon+Wed done this week | "One session from a perfect week. Last key day." |
| 3 | `totalSessions + 1` lands on a sessions tier | "One more session for {badge name}. Today's the day." |
| 4 | Progression advice available | "{Day} — key day. And {advice}." |
| 5 | `streak ≥ 7` | Number-led day pool (see below) |
| 6 | `streak === 0` and history exists | "Streak's at zero. {Day}'s the cheapest day to restart it." |
| 7 | — | Day pool (see below) |

Tier names come from [js/badges.js](js/badges.js) — same source as the in-app
badges, so the copy can never name a badge that doesn't exist.

**Rule 2 guard:** if the perfect week is already dead (Monday or Wednesday
missed), Thursday must **not** promise one. It falls through to:
> "Monday's gone, but the streak isn't. Today keeps it."

**Rule 5** wraps the day pool line with the streak: `"Day {N}. {pool line}"` —
e.g. *"Day 14. Wednesday's the hinge — do it and Thursday's a formality."*

### 4.2 Day pools

Title for all: **"{Weekday} — key day"**.

**Monday**
1. Monday. Three key days this week — this is the first.
2. Week starts here. Mon, Wed, Thu. Get the first one down.
3. Perfect week's still on the table. It starts today.
4. First of three. The week's easy to win from here and hard to win from Wednesday.
5. Nothing skipped yet. Keep it that way.
6. Monday sets the tone. Fifteen minutes and the week's already going your way.

**Wednesday**
1. Wednesday. This is the one people skip.
2. Second of three. Halfway is where weeks fall apart.
3. Nobody skips Monday. Wednesday's the real test.
4. Wednesday's the hinge — do it and Thursday's a formality.
5. Two-thirds of the week rides on today.
6. Get through today and the week's basically yours.

**Thursday**
1. Thursday. Last key day — finish the week clean.
2. Final of three. Don't leave it at two.
3. Close it out. Nothing required after today.
4. Two down. Land this one.
5. Thursday's the payoff. The week's done after this.
6. One session between you and a clean week.

### 4.3 Rotation

**Deterministic, not random** — the streak engine must stay reproducible, and
`Math.random()` in the Edge Function would break the idempotency story.

```
weekIndex = floor(daysBetween(mondayOf(firstLog), mondayOf(logicalDate)) / 7)
line      = pool[weekIndex % pool.length]
```

Each day keeps its own pool, so Mon/Wed/Thu never collide, and with six lines a
message cannot repeat for six weeks.

### 4.4 Evening warning

Two branches, three variants each (rotated by `weekIndex` as above). `{N}` is
the current streak.

**No freeze banked** — the streak actually dies:

| Title | Body |
|---|---|
| {N} days gone tonight | No freeze left. Skip today and the streak resets to zero. |
| {N} days, one skip from zero | Nothing to catch you. The flow takes fifteen minutes. |
| This is the one that breaks it | {N} days, no freeze banked. Skip and you start again tomorrow. |

At `streak` 1–2 the "{N} days" framing is weak, so use:

| Title | Body |
|---|---|
| Don't let it die at {N} | No freeze banked. Miss today and you're starting from scratch. |

**Freeze banked** — the streak survives, but at a real cost. The honest lever is
that **a freeze day does not advance the streak** ([js/streak.js:81](js/streak.js:81)):
it holds flat, the freeze burns, and the earn counter resets to 0
([js/streak.js:77](js/streak.js:77)) so three more key days in a row are needed
before you're covered again. Three costs, no comfort required.

| Title | Body |
|---|---|
| Your only freeze is on the line | Skip and it burns. Your streak holds at {N} — it won't grow — and you're unprotected after. |
| Today costs you either way | Do it and you're at {N+1}. Skip it and you're still at {N}, with no freeze left. |
| The freeze isn't a free pass | It stops the reset. It doesn't move you forward — and it's your last one. |

### 4.5 Sunday recap

Title: **"Your week"**. Fires every Sunday at `warningTime` regardless of what
happened — it is the one non-demand push, and it reports on the week that has
just finished, while it's still fresh.

| This week | Body |
|---|---|
| 3/3 | 3 of 3. Perfect week #{n}, streak at {N}. Same again from tomorrow. |
| 2/3 | 2 of 3 — {missed day} got away. Streak at {N}. Clean sweep next week, starting Monday. |
| 1/3 | One key day out of three. That's not a habit yet. Monday, Wednesday, Thursday — all three. |
| 0/3 | Blank week. Streak's at {N}. Monday resets everything. |
| No history | *(silent)* |

`{missed day}` names the actual day — "Wednesday got away" — since with a single
miss the app knows exactly which one it was.

The week counted is the **current** Monday-based week containing this Sunday
(`mondayOf(logicalDate)`), scored on its Mon/Wed/Thu exactly the way
`perfectWeeks()` scores ([js/streak.js:141](js/streak.js:141)) — those three
specific days, not any three sessions.

**Timing note:** Sunday's logical day runs to 3:59am Monday, so a bonus session
logged after the recap won't be reflected in it. Harmless — the recap scores
Mon/Wed/Thu, all long settled by Sunday evening. Only the quoted streak number
could tick up afterwards.

---

## 5. Settings

### 5.1 New shape

Added to `state.settings` in [js/store.js:30](js/store.js:30):

```js
notify: {
  enabled: true,          // master switch — governs ALL pushes
  keyDayTime: "09:00",    // morning nudge, Mon/Wed/Thu
  warningTime: "18:00",   // evening streak warning + Sunday recap
  recapEnabled: true      // Sunday recap on/off
}
```

**`warningTime` default 18:00.** The logical day runs to 3:59am
([js/streak.js:16](js/streak.js:16)), so there is still a long runway after it
fires. A second, later "last call" was considered and **cut**: it would only
fire after two already-ignored pushes, and a third is unlikely to be the one
that lands.

### 5.2 Migration

Idempotent, in `PFStore.load()` and after `mergeRemote()`, following the
`ID_RENAMES` pattern:

- If `settings.notify` is absent, create it:
  `keyDayTime` ← `reminderTimes[0]` (or `"09:00"`), `warningTime` ← `"18:00"`,
  `enabled` ← `remindersEnabled !== false`, `recapEnabled` ← `true`.
- **Leave `remindersEnabled` and `reminderTimes` in place.** They are harmless,
  and an un-updated device syncing back won't clobber anything. The server
  prefers `notify` and falls back to legacy only when it's missing, so old
  clients keep working through the transition.

### 5.3 UI

The "Reminders & notifications" card ([js/app.js:1344](js/app.js:1344)) becomes:

| Row | Control |
|---|---|
| **Notifications** — "Key-day nudges and streak warnings. Nothing on rest days." | toggle → `notify.enabled` |
| **Key day nudge** — "Mon, Wed, Thu" | `<input type="time">` → `keyDayTime` |
| **Streak warning** — "Only when you'd actually lose it. Also sets the Sunday recap." | `<input type="time">` → `warningTime` |
| **Sunday recap** — "How the week went" | toggle → `recapEnabled` |
| Push row (existing `renderPushRow()`) | unchanged, except permission is now requested **here** |

Existing states in `renderPushRow()` are kept: unsupported browser note,
permission-denied dead-end note, busy state, test button.

---

## 6. Server architecture

### 6.1 The freeze problem

To say *"no freeze left, this kills it"* the server must know the freeze count —
and freezes are **derived from full history**, never stored
([js/streak.js:37](js/streak.js:37)). The function currently fetches only the
current week ([index.ts:86](supabase/functions/send-reminders/index.ts:86)), so
it cannot tell.

**Caching a snapshot in `profile.settings` does not work.** If the user misses
Monday without opening the app, the snapshot still says "1 freeze" while reality
is "0, auto-consumed" — the freeze is spent by the *engine* walking the log, not
by any user action. Any cached value is wrong exactly when it matters.

**Decision: mirror `computeDerived` into `logic.js` and fetch the full
`day_log`.** One row per logged day — a few hundred rows even after years. This
keeps the app's "derive, don't store" principle intact on both sides.

**Cost:** a second keep-in-sync pair alongside the existing progression mirror.
`js/streak.js` and `logic.js` must not drift. Mitigated by the parity test in §8.

### 6.2 Port notes

Port `computeDerived`, `perfectWeeks`, `isRequired`, `mondayOf` — but **reuse
`logic.js`'s existing UTC-anchored date helpers** (`addDaysStr`, `DOW_INDEX`)
rather than the client's `new Date(dateStr + "T12:00:00")` form, which parses as
server-local. Both produce identical `YYYY-MM-DD` arithmetic; the explicit-UTC
version is unambiguous under Deno.

`todayStr` for the port is `localNow(nowMs, sub.tz).logicalDate` — already
computed per subscription.

### 6.3 Query reduction (do this while you're in there)

Today the function runs **three queries per subscription on every 5-minute
tick** — 288 ticks/day × 3 = ~864 queries/day/device, to send at most a handful
of pushes.

New order of operations:

1. Compute `localNow()` for the subscription. **Cheap, no I/O.**
2. Fetch `profile.settings` (needed for the times).
3. **If the current slot matches none of `keyDayTime` / `warningTime`, stop.**
4. Only then fetch the full `day_log` (`log_date, reps, sets_log` in one query —
   this also replaces the separate 12-row progression query) and run the engine.

That takes the heavy query from ~288/day to ~2–3/day per device.

### 6.4 `dueNotifications` signature

Replaces the current `(local, reminderTimes, flowDoneToday, weekSessions, progression)`:

```js
dueNotifications(local, notify, derived, week, progression)
```

- `local` — existing `localNow()` result
- `notify` — the settings block from §5.1
- `derived` — result of the ported `computeDerived` (streak, freezes,
  longestStreak, perfectWeeks, totalSessions, firstLog, states…)
- `week` — `{ monDone, wedDone, thuDone }` for the current Monday-based week;
  drives both the Thursday perfect-week check and the Sunday recap
- `progression` — unchanged, from `progressionFromRows`

Returns `[{ slot, title, body }]` as today. Slot keys per §3 — unique per
calendar occurrence, so the existing `push_log` dedup
([index.ts:102](supabase/functions/send-reminders/index.ts:102)) is unchanged.

---

## 7. Client changes

### 7.1 Foreground suppression

With the polling loop gone, a push arriving while the app is open would still
raise an OS notification over the UI. Guard it in the service worker
([sw.js:42](sw.js:42)):

- `clients.matchAll({ type: "window" })` → if a **visible** client exists,
  `postMessage` the payload to it and **skip** `showNotification`; the page shows
  an in-app toast instead.
- Otherwise show the notification as today.

Browsers normally penalise a push handler that shows nothing ("this site was
updated in the background"), but exempt the case where a visible client exists —
which is exactly this branch. One signal, always.

This also gives the in-app toast path a purpose again without any polling.

### 7.2 Permission

Move `Notification.requestPermission()` out of the global first-click handler and
into `enablePush()` ([js/app.js:1439](js/app.js:1439)), where it already lives —
just delete the cold-prompt listener. On iOS the prompt must follow a user
gesture and the app must be Home-Screen installed; the toggle satisfies both.

### 7.3 Deep link into the flow

`sendTo()` hardcodes `url: "./"`
([index.ts:41](supabase/functions/send-reminders/index.ts:41)), so every
notification lands on the dashboard. Carry a per-push url instead — `"./#flow"`
for nudges and warnings, `"./"` for the recap — and have the app read
`location.hash` on boot to set the initial view. `sw.js` already passes `data.url`
through to `notificationclick` ([sw.js:62](sw.js:62)), so only the sender and the
boot-time view selection change. See §10.

---

## 8. Verification

### 8.1 Node harness against `logic.js` (deterministic, no I/O)

- Nudge fires Mon/Wed/Thu at `keyDayTime`; **nothing** on Tue/Fri/Sat/Sun.
- Nudge suppressed when today's flow is done.
- Warning fires only at `warningTime`, on a key day, not done, **streak ≥ 1**.
- Warning branches: no-freeze vs freeze-banked produce different copy; `streak`
  1–2 uses the short-streak variant.
- Warning **does not fire** at streak 0, or with no history.
- Recap fires Sunday only, at `warningTime`, correct variant for 3/3, 2/3, 1/3,
  0/3, silent with no history; the 2/3 variant names the correct missed day.
- Monday produces a nudge and never a recap; Tue/Fri/Sat produce an empty array
  in every state.
- Rotation: index is stable within a week, differs across consecutive weeks,
  and cycles at 6.
- Ladder priority: milestone beats perfect-week beats badge beats progression
  beats streak-led beats pool.
- **Thursday guard:** Monday missed → no perfect-week promise.
- Slot keys unique and stable across repeated calls in the same slot (dedup).

### 8.2 Parity test — the important one

Both `js/streak.js` and `logic.js` are plain JS. The harness loads **both**, runs
them over the same day-log fixtures, and asserts identical `streak`, `freezes`,
`earnCounter`, `longestStreak`, `perfectWeeks`, `goldDays`, `totalSessions`.
Fixtures must include: a freeze consumption, a reset, a comeback, retroactive
edits, and a week straddling a month boundary.

This is the guard against mirror drift. It should fail loudly the next time
someone edits one engine and not the other.

### 8.3 Browser (412×915, light + dark)

- Settings card renders the new rows; toggles and time inputs persist and sync.
- Migration: a state with only legacy `reminderTimes` gains a correct `notify`
  block on load, and legacy keys survive.
- Permission is requested only from the push toggle.
- Test push reaches **only** the requesting device.
- Foreground push shows a toast, not an OS notification.

---

## 9. Deploy

- **No SQL.** `profile.settings` is already `jsonb`; `day_log` already has
  `log_date`, `reps`, `sets_log`. Schema unchanged.
- **Edge Function redeploy required** (`logic.js` + `index.ts`). Note one is
  *already pending* from the timer restructure — `TRACK_META` (side_plank 4 sets,
  deadbugs/bird_dogs target 20) has not shipped to the deployed function.
- **Bump `CACHE` to `levelup-v15`** in [sw.js:4](sw.js:4) — `sw.js`, `js/app.js`
  and `js/store.js` all change.
- Update [CLAUDE.md](CLAUDE.md) "Push notifications" section to reference this
  spec and to note the **second** keep-in-sync mirror (`js/streak.js` →
  `logic.js`) alongside the existing progression one.

---

## 10. Decisions

**One nudge time covers all three key days.** The question was whether
`keyDayTime` should be settable *per day* — Monday 07:00, Thursday 18:00 — not
about multiple users; the app is single-user by design (one sync code, several
devices). One time is enough. If different days ever need different times it's
`keyDayTime` → `keyDayTimes: { 1: "…", 3: "…", 4: "…" }` plus two more Settings
rows, and nothing else changes.

**Tap the notification, land in the flow.** Today `notificationclick` opens
`"./"` ([sw.js:55](sw.js:55)) — the dashboard — so a nudge costs one tap to open
and another to start. Notification **action buttons are dropped**: iOS Safari
doesn't support them, and iOS is the target platform (Home-Screen install is
already required for push at all).

The version that works everywhere: the payload already carries a `url`
([index.ts:41](supabase/functions/send-reminders/index.ts:41)), currently
hardcoded to `"./"`. Send `"./#flow"` for nudges and warnings, `"./"` for the
recap, and have the app read `location.hash` on boot to pick the initial view.
Roughly ten lines, and the nudge becomes one tap from exercising.
