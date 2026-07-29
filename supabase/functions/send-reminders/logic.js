// Pure scheduling logic for the send-reminders Edge Function.
// No imports, no I/O — shared by the Deno function (index.ts) and the local
// Node test harness. Mirrors the app's rules:
//   - logical day runs 4:00am -> 3:59am local (js/streak.js logicalDateStr)
//   - required days are Mon/Wed/Thu (js/streak.js REQUIRED)
//   - cron fires every 5 minutes; times are floored to their 5-min slot

// Evening check on key days (streak risk) and Sunday (weekly-goal "last chance").
export var EVENING_CHECK = "18:00"; // local ~6pm

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

// The 7 YYYY-MM-DD dates of the Monday-based week containing `logicalDate`.
// `dow` is the "Mon".."Sun" weekday of that logical date.
var DOW_INDEX = { Mon: 0, Tue: 1, Wed: 2, Thu: 3, Fri: 4, Sat: 5, Sun: 6 };
export function weekDates(logicalDate, dow) {
  var monday = addDaysStr(logicalDate, -DOW_INDEX[dow]);
  var out = [];
  for (var i = 0; i < 7; i++) out.push(addDaysStr(monday, i));
  return out;
}

// ---------------- Progression ("level up this exercise") ----------------
// KEEP IN SYNC with the mirrored rules in js/app.js (progressionFor et al).
// Group A (control drills): the Felt tap is the signal — reps are weak data.
// Group B (loadable): top-of-range reps on both sets required — add LOAD first.
// side_plank: capped at 40s; below → add time, at cap → progress the variation.
// TRACK_META mirrors the `track` fields in js/exercises.js (flow order).
export var TRACK_META = [
  { id: "deadbugs",    group: "A", sets: 2, target: 10 },
  { id: "side_plank",  group: "S", sets: 2, secs: 30 },
  { id: "bird_dogs",   group: "A", sets: 2, target: 10 },
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
      : "Side Plank: add 5 seconds — use the + under the timer."
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

// Copy for the Sunday weekly "last chance" push, by sessions still needed.
function weeklyLastChanceBody(remaining) {
  if (remaining <= 1) return "One session between you and a full week. Sunday's almost gone — go.";
  if (remaining === 2) return "You're 2 short of your 3 this week. It all resets tonight — move.";
  return "Zero sessions this week. Salvage it tonight or it's a write-off.";
}

// Decide which pushes are due for one subscription at this instant.
//   local         — result of localNow()
//   reminderTimes — array of "HH:MM" from profile.settings (may be missing)
//   flowDoneToday — truthy when day_log has reps >= 1 for local.logicalDate
//   weekSessions  — count of days in the current Mon–Sun week with reps >= 1
//   progression   — advice string from progressionFromRows(), or null; appended
//                   to reminder pushes so "level up X" arrives when actionable
// Returns [{slot, title, body}] — slot is the idempotency key (unique per
// endpoint per calendar occurrence).
export function dueNotifications(local, reminderTimes, flowDoneToday, weekSessions, progression) {
  var due = [];
  (reminderTimes || []).forEach(function (t, i) {
    if (floorSlot(t) === local.hhmm) {
      var body = i % 2 === 0
        ? "Posture check: drop your shoulders, tuck your chin — time for your flow."
        : "Desk break: stand up, squeeze your glutes, and run your daily flow.";
      if (progression) body += " And today: " + progression;
      due.push({
        slot: local.logicalDate + " " + local.hhmm,
        title: "Level Up",
        body: body
      });
    }
  });
  // Evening check (~6pm). Two mutually-exclusive risk pushes (Sun isn't a key day):
  if (local.hhmm === EVENING_CHECK) {
    // Daily streak risk — key day, flow not done.
    if (isRequiredDow(local.logicalDow) && !flowDoneToday) {
      due.push({
        slot: local.logicalDate + " streak",
        title: "Your streak's on the line ⚠️",
        body: "It's a key day and today's flow isn't done. Knock it out before the day slips."
      });
    }
    // Weekly goal risk — Sunday, fewer than 3 sessions this week.
    if (local.logicalDow === "Sun" && (weekSessions || 0) < 3) {
      due.push({
        slot: local.logicalDate + " lastchance",
        title: "Last chance ⏳",
        body: weeklyLastChanceBody(3 - (weekSessions || 0))
      });
    }
  }
  return due;
}
