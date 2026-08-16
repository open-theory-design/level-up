// Pure scheduling logic for the send-reminders Edge Function.
// No imports, no I/O — shared by the Deno function (index.ts) and the local
// Node test harness. See BUILD-SPEC-notifications.md for the full design.
//
// The notification set (all times evaluated in the device's own timezone):
//   1. key-day nudge   — Mon/Wed/Thu at notify.keyDayTime, if the flow isn't done
//   2. streak warning  — Mon/Wed/Thu at notify.warningTime, if not done AND streak >= 1
//   3. Sunday recap    — Sunday at notify.warningTime
// Nothing else. Tue/Fri/Sat are silent.
//
// Mirrors the app's rules:
//   - logical day runs 4:00am -> 3:59am local (js/streak.js logicalDateStr)
//   - required days are Mon/Wed/Thu (js/streak.js REQUIRED)
//   - cron fires every 5 minutes; times are floored to their 5-min slot

// ---------------- Timezone / date helpers ----------------

// Format a UTC timestamp into parts in an IANA timezone.
function tzParts(ms, tz) {
  var fmt = new Intl.DateTimeFormat("en-GB", {
    timeZone: tz,
    year: "numeric", month: "2-digit", day: "2-digit",
    hour: "2-digit", minute: "2-digit", weekday: "short", hour12: false
  });
  var out = {};
  fmt.formatToParts(new Date(ms)).forEach(function (p) { out[p.type] = p.value; });
  // en-GB can render midnight as "24"; normalise to "00"
  if (out.hour === "24") out.hour = "00";
  return out;
}

// Floor an "HH:MM" string to its 5-minute slot ("11:03" -> "11:00").
export function floorSlot(hhmm) {
  var h = hhmm.slice(0, 2);
  var m = Number(hhmm.slice(3, 5));
  var f = m - (m % 5);
  return h + ":" + (f < 10 ? "0" : "") + f;
}

// Local view of "now" for a subscription's timezone:
//   hhmm        — current wall clock floored to the 5-min slot
//   logicalDate — YYYY-MM-DD of (now - 4h) in that tz (the app's logical day)
//   logicalDow  — Mon/Tue/... weekday of the logical date
export function localNow(nowMs, tz) {
  var now = tzParts(nowMs, tz);
  var shifted = tzParts(nowMs - 4 * 3600 * 1000, tz);
  return {
    hhmm: floorSlot(now.hour + ":" + now.minute),
    logicalDate: shifted.year + "-" + shifted.month + "-" + shifted.day,
    logicalDow: shifted.weekday // "Mon" | "Tue" | ...
  };
}

export function isRequiredDow(dow) {
  return dow === "Mon" || dow === "Wed" || dow === "Thu";
}

// Add n days to a YYYY-MM-DD string (parsed at noon UTC to dodge DST edges).
export function addDaysStr(dateStr, n) {
  var d = new Date(dateStr + "T12:00:00Z");
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

var DOW_NAME = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
var SHORT_TO_INDEX = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 };

// 0 Sun .. 6 Sat for a YYYY-MM-DD string. Anchored at noon UTC so it can never
// drift with the server's own timezone (js/streak.js uses local noon; both land
// on the same calendar day).
function dowOf(dateStr) {
  return new Date(dateStr + "T12:00:00Z").getUTCDay();
}

function daysBetween(a, b) {
  return Math.round(
    (Date.parse(b + "T12:00:00Z") - Date.parse(a + "T12:00:00Z")) / 86400000
  );
}

// ---------------- Streak engine (MIRROR of js/streak.js) ----------------
// KEEP IN SYNC with js/streak.js computeDerived(). The server needs the freeze
// count to know whether a missed key day actually breaks the streak, and
// freezes are DERIVED from full history — a cached snapshot is wrong exactly
// when it matters (the engine spends the freeze while the app is closed).
// scripts/test-notifications.mjs asserts parity between the two engines.

var REQUIRED = { 1: true, 3: true, 4: true }; // Mon, Wed, Thu
export var FREEZE_CAP = 1;
export var EARN_EVERY = 3;

function isRequiredDate(dateStr) {
  return !!REQUIRED[dowOf(dateStr)];
}

export function mondayOf(dateStr) {
  var wd = dowOf(dateStr); // 0 Sun .. 6 Sat
  return addDaysStr(dateStr, wd === 0 ? -6 : 1 - wd);
}

// Weeks in which all three required days (Mon/Wed/Thu) were completed.
function perfectWeeks(dayLog, todayStr) {
  var completed = Object.keys(dayLog)
    .filter(function (d) { return dayLog[d] && dayLog[d].reps > 0; })
    .sort();
  if (!completed.length) return 0;
  var count = 0;
  for (var wk = mondayOf(completed[0]); wk <= todayStr; wk = addDaysStr(wk, 7)) {
    var mon = dayLog[wk], wed = dayLog[addDaysStr(wk, 2)], thu = dayLog[addDaysStr(wk, 3)];
    if (mon && mon.reps >= 1 && wed && wed.reps >= 1 && thu && thu.reps >= 1) count++;
  }
  return count;
}

// dayLog: { "YYYY-MM-DD": { reps } }. Returns the same shape as the client's
// computeDerived (minus the UI-only bits), plus `doneToday`.
export function computeDerived(dayLog, todayStr) {
  dayLog = dayLog || {};
  var completedDates = Object.keys(dayLog)
    .filter(function (d) { return dayLog[d] && dayLog[d].reps > 0; })
    .sort();

  var streak = 0, freezes = 0, earn = 0, longest = 0;
  var freezesEarned = 0, freezesUsed = 0;
  var totalCompleted = 0, goldDays = 0, bonusDaysDone = 0, totalSessions = 0;
  var firstLog = completedDates.length ? completedDates[0] : null;
  var sawReset = false, comeback = false;

  if (completedDates.length) {
    var start = completedDates[0] < todayStr ? completedDates[0] : todayStr;
    for (var d = start; d <= todayStr; d = addDaysStr(d, 1)) {
      var reps = (dayLog[d] && dayLog[d].reps) || 0;
      var req = isRequiredDate(d);

      if (reps >= 1) {
        streak += 1;
        if (streak > longest) longest = streak;
        if (sawReset && streak >= 7) comeback = true;
        totalCompleted += 1;
        totalSessions += Math.min(reps, 2);
        if (reps >= 2) goldDays += 1;
        if (!req) bonusDaysDone += 1;
        if (req) {
          earn += 1;
          if (earn >= EARN_EVERY) {
            earn = 0;
            if (freezes < FREEZE_CAP) { freezes += 1; freezesEarned += 1; }
          }
        }
      } else if (d === todayStr) {
        // today is never "missed" — it isn't over yet
      } else if (req) {
        earn = 0; // a protected miss still breaks the earn-counter
        if (freezes > 0) {
          freezes -= 1;
          freezesUsed += 1; // streak holds flat
        } else {
          if (streak > 0) sawReset = true;
          streak = 0;
        }
      }
    }
  }

  return {
    streak: streak,
    freezes: freezes,
    earnCounter: earn,
    longestStreak: longest,
    freezesEarned: freezesEarned,
    freezesUsed: freezesUsed,
    totalCompleted: totalCompleted,
    goldDays: goldDays,
    bonusDaysDone: bonusDaysDone,
    totalSessions: totalSessions,
    firstLog: firstLog,
    perfectWeeks: perfectWeeks(dayLog, todayStr),
    comeback: comeback,
    doneToday: ((dayLog[todayStr] && dayLog[todayStr].reps) || 0) >= 1
  };
}

// Mon/Wed/Thu completion for the Monday-based week containing `logicalDate`.
export function weekProgress(dayLog, logicalDate) {
  dayLog = dayLog || {};
  var mon = mondayOf(logicalDate);
  function done(dateStr) {
    return ((dayLog[dateStr] && dayLog[dateStr].reps) || 0) >= 1;
  }
  return {
    monDone: done(mon),
    wedDone: done(addDaysStr(mon, 2)),
    thuDone: done(addDaysStr(mon, 3))
  };
}

// ---------------- Progression ("level up this exercise") ----------------
// KEEP IN SYNC with the mirrored rules in js/app.js (progressionFor et al).
// Group A (control drills): the Felt tap is the signal — reps are weak data.
// Group B (loadable): top-of-range reps on both sets required — add LOAD first.
// side_plank: capped at 40s; below → add time, at cap → progress the variation.
// TRACK_META mirrors the `track` fields in js/exercises.js (flow order).
export var TRACK_META = [
  { id: "deadbugs",    group: "A", sets: 2, target: 20 },
  { id: "side_plank",  group: "S", sets: 4, secs: 30 },
  { id: "bird_dogs",   group: "A", sets: 2, target: 20 },
  { id: "clamshells",  group: "B", sets: 2, target: 15 },
  { id: "hip_thrusts", group: "B", sets: 2, target: 12 }
];

export function progressionAdvice(exId, effSecs) {
  return {
    deadbugs: "Dead Bugs are getting easy — slow each lower to 4s or add a 2s pause. Don't add reps.",
    bird_dogs: "Bird Dogs are getting easy — add a 3s pause at full reach, or slow the return.",
    clamshells: "Clamshells: move up to the next band. Out of bands? Add a 2s squeeze at the top.",
    hip_thrusts: "Hip Thrusts: time to add load — a dumbbell or plate across your hips.",
    side_plank: effSecs >= 40
      ? "Side Plank: 40s is the cap — progress the variation (top leg raised, or feet elevated)."
      : "Side Plank: add 5 seconds — use the + beside the timer."
  }[exId] || null;
}

// lastTwo = two most recent COMPLETED records [{s, diff}, …] (newest first).
export function progressionFor(exId, lastTwo, meta) {
  if (!meta || !lastTwo || lastTwo.length < 2) return null;
  var bothEasy = lastTwo.every(function (r) { return r.diff === "easy"; });
  if (!bothEasy) return null;
  if (meta.group === "B") {
    var atTarget = lastTwo.every(function (r) {
      return r.s.every(function (v) { return v != null && v >= meta.target; });
    });
    if (!atTarget) return null;
  }
  return progressionAdvice(exId, meta.effSecs || 0);
}

// rows: recent day rows [{log_date, sets_log}, …] newest first.
// holdSecs: profile.settings.holdSecs (per-exercise overrides), may be undefined.
// Returns the FIRST qualifying advice in flow order, or null.
export function progressionFromRows(rows, holdSecs) {
  for (var m = 0; m < TRACK_META.length; m++) {
    var meta = TRACK_META[m];
    var lastTwo = [];
    for (var i = 0; i < (rows || []).length && lastTwo.length < 2; i++) {
      var rec = rows[i] && rows[i].sets_log && rows[i].sets_log[meta.id];
      if (!rec || !rec.s) continue;
      var complete = true;
      for (var k = 0; k < meta.sets; k++) if (rec.s[k] == null) complete = false;
      if (complete) lastTwo.push(rec);
    }
    var effSecs = meta.group === "S" ? ((holdSecs || {})[meta.id] || meta.secs) : 0;
    var adv = progressionFor(meta.id, lastTwo, { group: meta.group, target: meta.target, effSecs: effSecs });
    if (adv) return adv;
  }
  return null;
}

// ---------------- Badge tiers (MIRROR of js/badges.js) ----------------
// Only the two dimensions the copy can reference. KEEP IN SYNC with
// js/badges.js DIMENSIONS — naming a badge that doesn't exist would be a lie.
var STREAK_TIERS = [3, 7, 14, 30, 60, 100];
var STREAK_NAMES = ["Three in a row", "First week", "Fortnight", "Month strong", "Two months", "Centurion"];
var SESSION_TIERS = [1, 5, 10, 25, 100, 250, 500, 1000];
var SESSION_NAMES = ["First session", "Five down", "Double digits", "Getting going",
                     "Century", "250 club", "500 club", "Iron habit"];

function tierName(tiers, names, value) {
  var i = tiers.indexOf(value);
  return i === -1 ? null : names[i];
}

// ---------------- Copy ----------------

// Rotating pools, one per key day. `ok` is the normal set; `recover` is used
// once the clean week is already gone, so the copy never promises a perfect
// week that's mathematically dead.
var POOLS = {
  Mon: {
    ok: [
      "Monday. Three key days this week — this is the first.",
      "Week starts here. Mon, Wed, Thu. Get the first one down.",
      "Perfect week's still on the table. It starts today.",
      "First of three. The week's easy to win from here and hard to win from Wednesday.",
      "Nothing skipped yet. Keep it that way.",
      "Monday sets the tone. Fifteen minutes and the week's already going your way."
    ]
  },
  Wed: {
    ok: [
      "Wednesday. This is the one people skip.",
      "Second of three. Halfway is where weeks fall apart.",
      "Nobody skips Monday. Wednesday's the real test.",
      "Wednesday's the hinge — do it and Thursday's a formality.",
      "Two-thirds of the week rides on today.",
      "Get through today and the week's basically yours."
    ],
    recover: [
      "Monday slipped. Don't make it two.",
      "Monday's gone. Wednesday and Thursday are what's left.",
      "You can still get two of three. Starts now."
    ]
  },
  Thu: {
    ok: [
      "Thursday. Last key day — finish the week clean.",
      "Final of three. Don't leave it at two.",
      "Close it out. Nothing required after today.",
      "Two down. Land this one.",
      "Thursday's the payoff. The week's done after this.",
      "One session between you and a clean week."
    ],
    recover: [
      "The week got away. The streak doesn't have to.",
      "Clean week's off the table. Today's still worth doing.",
      "Two missed. Don't make it three."
    ]
  }
};

// Deterministic rotation — Math.random() would break the idempotency story and
// make the engine untestable. Index by weeks elapsed since the first log.
export function weekIndexFor(firstLog, logicalDate) {
  if (!firstLog) return 0;
  var n = Math.floor(daysBetween(mondayOf(firstLog), mondayOf(logicalDate)) / 7);
  return n < 0 ? 0 : n;
}

function pick(list, idx) {
  return list[((idx % list.length) + list.length) % list.length];
}

// The day's rotating line, swapped for a recovery line once the clean week is
// dead. On Thursday with exactly one key day missed we can name it.
function poolLine(dow, week, idx) {
  var p = POOLS[dow];
  if (!p) return "";
  var alive = dow === "Mon" ||
    (dow === "Wed" && week.monDone) ||
    (dow === "Thu" && week.monDone && week.wedDone);
  if (alive) return pick(p.ok, idx);
  if (dow === "Thu") {
    if (!week.monDone && week.wedDone) return "Monday's gone, but the streak isn't. Today keeps it.";
    if (week.monDone && !week.wedDone) return "Wednesday's gone, but the streak isn't. Today keeps it.";
  }
  return pick(p.recover, idx);
}

// Selection ladder — first match wins (BUILD-SPEC-notifications.md §4.1).
export function keyDayBody(dow, derived, week, progression, idx) {
  // 1. today's session lands on a streak milestone
  var milestone = tierName(STREAK_TIERS, STREAK_NAMES, derived.streak + 1);
  if (milestone) return "Today makes " + (derived.streak + 1) + ". " + milestone + ".";

  // 2. a perfect week is one session away
  if (dow === "Thu" && week.monDone && week.wedDone) {
    return "One session from a perfect week. Last key day.";
  }

  // 3. a sessions badge is one session away
  var badge = tierName(SESSION_TIERS, SESSION_NAMES, derived.totalSessions + 1);
  if (badge) return "One more session for " + badge + ". Today's the day.";

  // 4. an exercise is ready to level up — more useful than any generic line
  if (progression) {
    return derived.streak >= 7 ? "Day " + derived.streak + ". " + progression : progression;
  }

  // 5. a streak worth naming leads with the number
  if (derived.streak >= 7) return "Day " + derived.streak + ". " + poolLine(dow, week, idx);

  // 6. nothing to lose — frame it as a restart
  if (derived.streak === 0) {
    return "Streak's at zero. " + longDayName(dow) + "'s the cheapest day to restart it.";
  }

  // 7. the rotating pool
  return poolLine(dow, week, idx);
}

function longDayName(dow) {
  return DOW_NAME[SHORT_TO_INDEX[dow]];
}

// The evening warning. Only ever sent when the streak is genuinely at stake —
// see dueNotifications. A banked freeze changes the stakes, not the urgency:
// the freeze burns, the streak holds FLAT (js/streak.js:81 — it does not grow),
// and the earn counter resets, so three more key days are needed to re-bank.
export function warningCopy(derived, idx) {
  var n = derived.streak;
  if (derived.freezes > 0) {
    return pick([
      { title: "Your only freeze is on the line",
        body: "Skip and it burns. Your streak holds at " + n + " — it won't grow — and you're unprotected after." },
      { title: "Today costs you either way",
        body: "Do it and you're at " + (n + 1) + ". Skip it and you're still at " + n + ", with no freeze left." },
      { title: "The freeze isn't a free pass",
        body: "It stops the reset. It doesn't move you forward — and it's your last one." }
    ], idx);
  }
  if (n <= 2) {
    return { title: "Don't let it die at " + n,
             body: "No freeze banked. Miss today and you're starting from scratch." };
  }
  return pick([
    { title: n + " days gone tonight",
      body: "No freeze left. Skip today and the streak resets to zero." },
    { title: n + " days, one skip from zero",
      body: "Nothing to catch you. The flow takes fifteen minutes." },
    { title: "This is the one that breaks it",
      body: n + " days, no freeze banked. Skip and you start again tomorrow." }
  ], idx);
}

// Sunday recap — the one push that isn't a demand. Scores the week that just
// finished on its Mon/Wed/Thu, the same three days perfectWeeks() counts.
export function recapCopy(derived, week) {
  var days = [
    { done: week.monDone, name: "Monday" },
    { done: week.wedDone, name: "Wednesday" },
    { done: week.thuDone, name: "Thursday" }
  ];
  var hit = days.filter(function (d) { return d.done; }).length;
  var missed = days.filter(function (d) { return !d.done; });
  var n = derived.streak;

  if (hit === 3) {
    return "3 of 3. Perfect week #" + derived.perfectWeeks + ", streak at " + n +
      ". Same again from tomorrow.";
  }
  if (hit === 2) {
    return "2 of 3 — " + missed[0].name + " got away. Streak at " + n +
      ". Clean sweep next week, starting Monday.";
  }
  if (hit === 1) {
    return "One key day out of three. That's not a habit yet. Monday, Wednesday, Thursday — all three.";
  }
  return "Blank week. Streak's at " + n + ". Monday resets everything.";
}

// ---------------- Scheduling ----------------

var DEFAULTS = { enabled: true, keyDayTime: "09:00", warningTime: "18:00", recapEnabled: true };

// Read the notify block, falling back to the legacy reminder settings so a
// device that hasn't been updated yet still behaves sensibly.
export function notifySettings(settings) {
  settings = settings || {};
  var n = settings.notify;
  if (n && typeof n === "object") {
    return {
      enabled: n.enabled !== false,
      keyDayTime: n.keyDayTime || DEFAULTS.keyDayTime,
      warningTime: n.warningTime || DEFAULTS.warningTime,
      recapEnabled: n.recapEnabled !== false
    };
  }
  var legacyTimes = settings.reminderTimes || [];
  return {
    enabled: settings.remindersEnabled !== false,
    keyDayTime: legacyTimes[0] || DEFAULTS.keyDayTime,
    warningTime: DEFAULTS.warningTime,
    recapEnabled: true
  };
}

// Decide which pushes are due for one subscription at this instant.
//   local       — result of localNow()
//   notify      — result of notifySettings()
//   derived     — result of computeDerived() for this subscription's full log
//   week        — result of weekProgress() for the current Monday-based week
//   progression — advice string from progressionFromRows(), or null
// Returns [{slot, title, body, url}] — slot is the idempotency key (unique per
// endpoint per calendar occurrence).
export function dueNotifications(local, notify, derived, week, progression) {
  var due = [];
  if (!notify || !notify.enabled) return due;
  if (!derived || !derived.firstLog) return due; // no history — nothing to say

  var idx = weekIndexFor(derived.firstLog, local.logicalDate);
  var atKeyDayTime = local.hhmm === floorSlot(notify.keyDayTime);
  var atWarningTime = local.hhmm === floorSlot(notify.warningTime);

  if (isRequiredDow(local.logicalDow) && !derived.doneToday) {
    if (atKeyDayTime) {
      due.push({
        slot: local.logicalDate + " keyday",
        title: longDayName(local.logicalDow) + " — key day",
        body: keyDayBody(local.logicalDow, derived, week, progression, idx),
        url: "./#flow"
      });
    }
    // Only warn when the streak is genuinely at stake. At 0 there is nothing to
    // lose and the morning nudge already carries the restart framing.
    if (atWarningTime && derived.streak >= 1) {
      var w = warningCopy(derived, idx);
      due.push({
        slot: local.logicalDate + " warn",
        title: w.title,
        body: w.body,
        url: "./#flow"
      });
    }
  }

  if (local.logicalDow === "Sun" && notify.recapEnabled && atWarningTime) {
    due.push({
      slot: local.logicalDate + " recap",
      title: "Your week",
      body: recapCopy(derived, week),
      url: "./"
    });
  }

  return due;
}

// True when a push could possibly be due at this instant — lets index.ts skip
// the day_log fetch on the ~285 daily cron ticks that can never send anything.
export function slotCouldFire(local, notify) {
  if (!notify || !notify.enabled) return false;
  var key = isRequiredDow(local.logicalDow);
  var sun = local.logicalDow === "Sun" && notify.recapEnabled;
  if (key && local.hhmm === floorSlot(notify.keyDayTime)) return true;
  if ((key || sun) && local.hhmm === floorSlot(notify.warningTime)) return true;
  return false;
}
