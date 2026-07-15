// Pure scheduling logic for the send-reminders Edge Function.
// No imports, no I/O — shared by the Deno function (index.ts) and the local
// Node test harness. Mirrors the app's rules:
//   - logical day runs 4:00am -> 3:59am local (js/streak.js logicalDateStr)
//   - required days are Mon/Wed/Thu (js/streak.js REQUIRED)
//   - cron fires every 5 minutes; times are floored to their 5-min slot

export var STREAK_NUDGE_TIME = "20:00"; // local, on required days with no flow logged

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

// Decide which pushes are due for one subscription at this instant.
//   local        — result of localNow()
//   reminderTimes— array of "HH:MM" from profile.settings (may be missing)
//   flowDoneToday— truthy when day_log has reps >= 1 for local.logicalDate
// Returns [{slot, title, body}] — slot is the idempotency key (unique per
// endpoint per calendar occurrence).
export function dueNotifications(local, reminderTimes, flowDoneToday) {
  var due = [];
  (reminderTimes || []).forEach(function (t, i) {
    if (floorSlot(t) === local.hhmm) {
      due.push({
        slot: local.logicalDate + " " + local.hhmm,
        title: "Level Up",
        body: i % 2 === 0
          ? "Posture check: drop your shoulders, tuck your chin — time for your flow."
          : "Desk break: stand up, squeeze your glutes, and run your daily flow."
      });
    }
  });
  if (local.hhmm === STREAK_NUDGE_TIME && isRequiredDow(local.logicalDow) && !flowDoneToday) {
    due.push({
      slot: local.logicalDate + " streak",
      title: "Your streak is on the line",
      body: "Required day and no flow logged yet — one run keeps the streak alive."
    });
  }
  return due;
}
