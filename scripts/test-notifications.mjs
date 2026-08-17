// Node test harness for the notification engine (BUILD-SPEC-notifications.md §8).
//   node scripts/test-notifications.mjs
//
// Two jobs:
//   1. Exercise dueNotifications / the copy ladder against hand-built state.
//   2. PARITY — assert the streak engine mirrored into logic.js still agrees
//      with js/streak.js. This is the guard against the two drifting apart.

import { readFileSync } from "node:fs";
import {
  computeDerived, weekProgress, dueNotifications, slotCouldFire,
  notifySettings, keyDayBody, warningCopy, recapCopy, weekIndexFor,
  mondayOf, addDaysStr, progressionFromRows, LADDER
} from "../supabase/functions/send-reminders/logic.js";

// js/streak.js is a browser IIFE that hangs itself off `window` — give it one.
const streakSrc = readFileSync(new URL("../js/streak.js", import.meta.url), "utf8");
const win = {};
new Function("window", streakSrc)(win);
const PFStreak = win.PFStreak;

let pass = 0, fail = 0;
function ok(name, cond, extra) {
  if (cond) { pass++; return; }
  fail++;
  console.log("  FAIL  " + name + (extra ? "\n        " + extra : ""));
}
function eq(name, actual, expected) {
  ok(name, actual === expected, "expected " + JSON.stringify(expected) + "\n        got      " + JSON.stringify(actual));
}
function section(t) { console.log("\n" + t); }

// ---------------- fixtures ----------------

const SHORT = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const dowOf = (d) => SHORT[new Date(d + "T12:00:00Z").getUTCDay()];
const NOTIFY = { enabled: true, keyDayTime: "09:00", warningTime: "18:00", recapEnabled: true };
const localAt = (date, hhmm) => ({ hhmm, logicalDate: date, logicalDow: dowOf(date) });

const MON = mondayOf("2026-06-03"); // any date -> its Monday
const D = (n) => addDaysStr(MON, n);

// n consecutive perfect weeks (Mon/Wed/Thu) starting at MON.
function perfectWeeks(n, reps = 1) {
  const log = {};
  for (let w = 0; w < n; w++) {
    for (const off of [0, 2, 3]) log[D(w * 7 + off)] = { reps };
  }
  return log;
}

// ---------------- 1. which pushes fire ----------------

section("Scheduling");
{
  const log = perfectWeeks(3);
  // Week 4: nothing done yet.
  const mon4 = D(21), tue4 = D(22), wed4 = D(23), fri4 = D(25), sat4 = D(26);

  const at = (date, hhmm) => {
    const d = computeDerived(log, date);
    return dueNotifications(localAt(date, hhmm), NOTIFY, d, weekProgress(log, date), null);
  };

  eq("Mon 09:00 -> nudge", at(mon4, "09:00").length, 1);
  eq("Mon nudge slot", at(mon4, "09:00")[0].slot, mon4 + " keyday");
  eq("Mon nudge deep-links to flow", at(mon4, "09:00")[0].url, "./#flow");
  eq("Wed 09:00 -> nudge", at(wed4, "09:00").length, 1);
  eq("Tue 09:00 -> silent", at(tue4, "09:00").length, 0);
  eq("Fri 09:00 -> silent", at(fri4, "09:00").length, 0);
  eq("Sat 18:00 -> silent", at(sat4, "18:00").length, 0);
  eq("Mon 09:05 (off-slot) -> silent", at(mon4, "09:05").length, 0);
  eq("Mon never gets a recap", at(mon4, "18:00").filter((n) => n.slot.endsWith("recap")).length, 0);

  // Done today suppresses both key-day pushes.
  const doneLog = Object.assign({}, log, { [mon4]: { reps: 1 } });
  const dd = computeDerived(doneLog, mon4);
  eq("nudge suppressed once done",
    dueNotifications(localAt(mon4, "09:00"), NOTIFY, dd, weekProgress(doneLog, mon4), null).length, 0);
  eq("warning suppressed once done",
    dueNotifications(localAt(mon4, "18:00"), NOTIFY, dd, weekProgress(doneLog, mon4), null).length, 0);

  // Master switch.
  const off = Object.assign({}, NOTIFY, { enabled: false });
  const d4 = computeDerived(log, mon4);
  eq("master switch off -> nothing",
    dueNotifications(localAt(mon4, "09:00"), off, d4, weekProgress(log, mon4), null).length, 0);

  // No history at all.
  eq("no history -> nothing",
    dueNotifications(localAt(mon4, "09:00"), NOTIFY, computeDerived({}, mon4), weekProgress({}, mon4), null).length, 0);
}

// ---------------- 2. the warning only fires when it's true ----------------

section("Streak warning");
{
  // 3 perfect weeks => 9 required days => a freeze banked (earned 3x, capped at 1).
  // Evaluated on the Monday of week 4: today is never counted as missed, so the
  // freeze is still in hand. (By Wednesday that Monday HAS been missed and the
  // freeze is already spent — which is the whole reason the server needs the
  // real engine rather than a cached snapshot.)
  const log = perfectWeeks(3);
  const mon4 = D(21);
  const d = computeDerived(log, mon4);
  ok("freeze is banked after 3 perfect weeks", d.freezes === 1, "freezes=" + d.freezes);
  ok("streak survives the bonus-day gaps", d.streak === 9, "streak=" + d.streak);

  // Two days later that same freeze has been auto-spent on the missed Monday.
  const spent = computeDerived(log, D(23));
  ok("freeze auto-spends on a missed key day", spent.freezes === 0, "freezes=" + spent.freezes);
  ok("streak holds flat through a freeze", spent.streak === 9, "streak=" + spent.streak);

  const due = dueNotifications(localAt(mon4, "18:00"), NOTIFY, d, weekProgress(log, mon4), null);
  eq("warning fires at warningTime", due.length, 1);
  eq("warning slot", due[0].slot, mon4 + " warn");
  ok("freeze-banked copy names the freeze", /freeze/i.test(due[0].title + due[0].body), due[0].title);
  ok("freeze copy says the streak won't grow",
    /won't grow|still at/i.test(due[0].body), due[0].body);

  // Same state, no freeze -> different, harder copy.
  const noFreeze = Object.assign({}, d, { freezes: 0 });
  const w = warningCopy(noFreeze, 0);
  ok("no-freeze copy states the reset", /reset|scratch|start again/i.test(w.body), w.body);
  ok("no-freeze copy differs from freeze copy", w.body !== due[0].body);

  // Short streak reframes.
  eq("streak 2 uses the short-streak title", warningCopy({ streak: 2, freezes: 0 }, 0).title,
    "Don't let it die at 2");

  // Nothing to lose -> no warning at all.
  const zero = Object.assign({}, d, { streak: 0 });
  eq("streak 0 -> no warning",
    dueNotifications(localAt(mon4, "18:00"), NOTIFY, zero, weekProgress(log, mon4), null).length, 0);
}

// ---------------- 3. Sunday recap ----------------

section("Sunday recap");
{
  const sun = D(6); // Sunday of week 1
  const full = perfectWeeks(1);
  const rec = (log) => {
    const d = computeDerived(log, sun);
    return dueNotifications(localAt(sun, "18:00"), NOTIFY, d, weekProgress(log, sun), null);
  };

  const r3 = rec(full);
  eq("recap fires Sunday at warningTime", r3.length, 1);
  eq("recap slot", r3[0].slot, sun + " recap");
  eq("recap title", r3[0].title, "Your week");
  eq("recap does not deep-link to the flow", r3[0].url, "./");
  ok("3/3 copy", r3[0].body.startsWith("3 of 3."), r3[0].body);

  // Sunday morning is silent — the recap is an evening push.
  const d3 = computeDerived(full, sun);
  eq("Sunday 09:00 -> silent",
    dueNotifications(localAt(sun, "09:00"), NOTIFY, d3, weekProgress(full, sun), null).length, 0);

  // 2/3 names the day that got away.
  const noWed = { [D(0)]: { reps: 1 }, [D(3)]: { reps: 1 } };
  ok("2/3 names Wednesday", /Wednesday got away/.test(rec(noWed)[0].body), rec(noWed)[0].body);
  const noMon = { [D(2)]: { reps: 1 }, [D(3)]: { reps: 1 } };
  ok("2/3 names Monday", /Monday got away/.test(rec(noMon)[0].body), rec(noMon)[0].body);

  ok("1/3 copy", /not a habit yet/.test(rec({ [D(0)]: { reps: 1 } })[0].body));
  // 0/3 needs history from an earlier week, or there is nothing to recap.
  const blank = { [D(-7)]: { reps: 1 } };
  ok("0/3 copy", /Blank week/.test(rec(blank)[0].body), rec(blank)[0].body);

  // Recap can be switched off on its own.
  const noRecap = Object.assign({}, NOTIFY, { recapEnabled: false });
  eq("recap disabled -> silent",
    dueNotifications(localAt(sun, "18:00"), noRecap, d3, weekProgress(full, sun), null).length, 0);
}

// ---------------- 4. copy ladder ----------------

section("Copy ladder");
{
  const week = { monDone: true, wedDone: true, thuDone: false };
  const dead = { monDone: false, wedDone: true, thuDone: false };
  const base = { streak: 4, totalSessions: 12, freezes: 0, perfectWeeks: 1, firstLog: D(0) };

  ok("1. milestone wins",
    keyDayBody("Wed", Object.assign({}, base, { streak: 6 }), week, "advice", 0) === "Today makes 7. First week.");
  ok("2. perfect week one away",
    keyDayBody("Thu", base, week, "advice", 0) === "One session from a perfect week. Last key day.");
  ok("3. badge one away",
    /One more session for Double digits/.test(
      keyDayBody("Wed", Object.assign({}, base, { totalSessions: 9 }), week, null, 0)));
  eq("4. progression beats the pool",
    keyDayBody("Wed", base, week, "Side Plank: add 5 seconds.", 0), "Side Plank: add 5 seconds.");
  ok("5. streak >= 7 leads with the number",
    keyDayBody("Wed", Object.assign({}, base, { streak: 8 }), week, null, 0).startsWith("Day 8. "));
  ok("6. streak 0 reframes as a restart",
    /cheapest day to restart/.test(keyDayBody("Wed", Object.assign({}, base, { streak: 0 }), week, null, 0)));
  ok("7. falls through to the pool",
    keyDayBody("Wed", base, week, null, 0) === "Wednesday. This is the one people skip.");

  // The guard: a dead week must never be sold as a clean one.
  const thuDead = keyDayBody("Thu", base, dead, null, 0);
  ok("Thu never promises a dead perfect week", !/perfect week|clean week/i.test(thuDead), thuDead);
  eq("Thu names the day that was missed", thuDead, "Monday's gone, but the streak isn't. Today keeps it.");
  const wedDead = keyDayBody("Wed", base, { monDone: false }, null, 0);
  ok("Wed recovery copy after a missed Monday", /Monday slipped|Monday's gone|two of three/i.test(wedDead), wedDead);
}

// ---------------- 5. rotation ----------------

section("Rotation");
{
  const week = { monDone: true, wedDone: false, thuDone: false };
  const base = { streak: 4, totalSessions: 12, freezes: 0, perfectWeeks: 0, firstLog: D(0) };
  const lines = [0, 1, 2, 3, 4, 5, 6].map((i) => keyDayBody("Wed", base, week, null, i));

  eq("stable within a week", keyDayBody("Wed", base, week, null, 2), lines[2]);
  ok("differs week to week", lines[0] !== lines[1] && lines[1] !== lines[2]);
  eq("cycles at 6", lines[6], lines[0]);
  eq("six distinct lines", new Set(lines.slice(0, 6)).size, 6);

  eq("weekIndex counts weeks from the first log", weekIndexFor(D(0), D(21)), 3);
  eq("weekIndex is 0 in the first week", weekIndexFor(D(0), D(3)), 0);
  eq("weekIndex never goes negative", weekIndexFor(D(21), D(0)), 0);
}

// ---------------- 6. slotCouldFire (the query-skip guard) ----------------

section("Early exit");
{
  eq("key day at nudge time", slotCouldFire(localAt(D(0), "09:00"), NOTIFY), true);
  eq("key day at warning time", slotCouldFire(localAt(D(0), "18:00"), NOTIFY), true);
  eq("key day off-slot", slotCouldFire(localAt(D(0), "13:00"), NOTIFY), false);
  eq("Sunday at recap time", slotCouldFire(localAt(D(6), "18:00"), NOTIFY), true);
  eq("Sunday at nudge time", slotCouldFire(localAt(D(6), "09:00"), NOTIFY), false);
  eq("Tuesday never", slotCouldFire(localAt(D(1), "09:00"), NOTIFY), false);
  eq("disabled never", slotCouldFire(localAt(D(0), "09:00"), Object.assign({}, NOTIFY, { enabled: false })), false);
}

// ---------------- 7. settings fallback ----------------

section("Settings");
{
  const legacy = notifySettings({ remindersEnabled: true, reminderTimes: ["11:00", "15:00"] });
  eq("legacy seeds keyDayTime from the first reminder time", legacy.keyDayTime, "11:00");
  eq("legacy defaults warningTime", legacy.warningTime, "18:00");
  eq("legacy off is honoured", notifySettings({ remindersEnabled: false }).enabled, false);
  const modern = notifySettings({ notify: { enabled: true, keyDayTime: "07:30" } });
  eq("notify block wins", modern.keyDayTime, "07:30");
  eq("missing fields fall back", modern.warningTime, "18:00");
  eq("no settings at all still works", notifySettings(null).keyDayTime, "09:00");
}

// ---------------- 7b. Progression ladders (server side) ----------------

section("Progression ladders");
{
  // Two easy, complete side-plank sessions; lvl marks the ladder level.
  const spRow = (date, lvl) => ({
    log_date: date,
    sets_log: { side_plank: Object.assign({ s: [40, 40, 40, 40], diff: "easy" }, lvl ? { lvl } : {}) }
  });
  const rows0 = [spRow(D(3)), spRow(D(2))]; // newest first, level 0
  const HOLD40 = { side_plank: 40 };

  // Level 0, at the 40s cap -> upgrade push naming the CURRENT movement.
  eq("upgrade advice at the cap",
    progressionFromRows(rows0, HOLD40, {}),
    "Side Plank: next level unlocked — take the upgrade in your next flow.");

  // Below the cap -> within-level advice, never an upgrade.
  ok("below the cap -> add seconds",
    /add 5 seconds/.test(progressionFromRows(rows0, { side_plank: 30 }, {})));

  // Upgraded to level 1 but the easy sessions are level-0 records -> silence.
  eq("old-level records never re-qualify",
    progressionFromRows(rows0, HOLD40, { side_plank: 1 }), null);

  // Two easy sessions AT level 1 -> the next upgrade offer.
  const rows1 = [spRow(D(10), 1), spRow(D(9), 1)];
  eq("re-qualified at level 1 -> next upgrade",
    progressionFromRows(rows1, HOLD40, { side_plank: 1 }),
    "Side Plank — Top Leg Raised: next level unlocked — take the upgrade in your next flow.");

  // At level 1 the holds were reset to 30 (override cleared) -> add seconds first.
  ok("after upgrade, holds climb back to the cap first",
    /Side Plank — Top Leg Raised: add 5 seconds/.test(progressionFromRows(rows1, {}, { side_plank: 1 })));

  // Top of the ladder -> terminal advice, never an upgrade.
  const rows2 = [spRow(D(20), 2), spRow(D(19), 2)];
  ok("top of the ladder -> terminal advice",
    /Feet-elevated at 40s/.test(progressionFromRows(rows2, HOLD40, { side_plank: 2 })));

  // Reps ladder (no cap gate): dead bugs easy² at level 0 -> upgrade.
  const dbRows = [
    { log_date: D(3), sets_log: { deadbugs: { s: [20, 20], diff: "easy" } } },
    { log_date: D(2), sets_log: { deadbugs: { s: [20, 20], diff: "easy" } } }
  ];
  eq("reps exercise upgrades without a cap gate",
    progressionFromRows(dbRows, {}, {}),
    "Dead Bugs: next level unlocked — take the upgrade in your next flow.");

  // PARITY: the server's LADDER names must exactly match the client's `levels`
  // arrays in js/exercises.js — the push must never name a level that doesn't
  // exist in the app.
  const exSrc = readFileSync(new URL("../js/exercises.js", import.meta.url), "utf8");
  const exWin = {};
  new Function("window", exSrc)(exWin);
  const laddered = exWin.PF_EXERCISES.filter((x) => x.levels);
  eq("client ladder count", laddered.length, 5);
  for (const ex of laddered) {
    const clientNames = ex.levels.map((l) => l.name);
    eq("ladder parity: " + ex.id, JSON.stringify(LADDER[ex.id]), JSON.stringify(clientNames));
  }
}

// ---------------- 8. PARITY with js/streak.js ----------------

section("Engine parity (js/streak.js <-> logic.js)");
{
  const FIELDS = ["streak", "freezes", "earnCounter", "longestStreak",
                  "freezesEarned", "freezesUsed", "totalCompleted", "goldDays",
                  "bonusDaysDone", "totalSessions", "perfectWeeks", "comeback", "firstLog"];

  const fixtures = {
    "empty log": {},
    "single day": { [D(0)]: { reps: 1 } },
    "three perfect weeks": perfectWeeks(3),
    "gold days": perfectWeeks(2, 2),
    "freeze consumed": (() => {
      // 3 required days -> freeze banked, then miss the next required day.
      const l = perfectWeeks(1);
      l[D(7)] = { reps: 0 }; // Mon of week 2 missed
      l[D(9)] = { reps: 1 };
      return l;
    })(),
    "reset with no freeze": { [D(0)]: { reps: 1 }, [D(14)]: { reps: 1 } },
    "comeback": (() => {
      const l = { [D(0)]: { reps: 1 } };           // then a long gap -> reset
      for (let i = 14; i < 24; i++) l[D(i)] = { reps: 1 }; // 10 straight days back
      return l;
    })(),
    "sparse / retroactive": { [D(2)]: { reps: 1 }, [D(3)]: { reps: 2 }, [D(16)]: { reps: 1 } },
    "month boundary": (() => {
      const l = {};
      for (let i = 0; i < 45; i++) if (i % 3 === 0) l[D(i)] = { reps: 1 };
      return l;
    })()
  };

  for (const [name, log] of Object.entries(fixtures)) {
    for (const today of [D(24), D(45)]) {
      const a = PFStreak.computeDerived(log, today);
      const b = computeDerived(log, today);
      const diff = FIELDS.filter((f) => JSON.stringify(a[f]) !== JSON.stringify(b[f]));
      ok("parity: " + name + " @ " + today, diff.length === 0,
        diff.map((f) => f + " client=" + JSON.stringify(a[f]) + " server=" + JSON.stringify(b[f])).join("\n        "));
    }
  }

  // The mirrors must also agree on the constants they branch on.
  eq("FREEZE_CAP matches", PFStreak.FREEZE_CAP, 1);
  eq("EARN_EVERY matches", PFStreak.EARN_EVERY, 3);

  // weekProgress must score the same three days perfectWeeks() scores.
  const wk = weekProgress(perfectWeeks(1), D(6));
  ok("weekProgress agrees with a perfect week", wk.monDone && wk.wedDone && wk.thuDone);
}

console.log("\n" + (fail === 0 ? "PASS" : "FAIL") + " — " + pass + " passed, " + fail + " failed"
  + " (TZ=" + (process.env.TZ || "system") + ")");
process.exit(fail === 0 ? 0 : 1);
