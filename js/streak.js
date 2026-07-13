// Level Up — streak & freeze engine (PRD §4)
// Everything is DERIVED from the day log, never stored as a running counter,
// so retroactive edits and the 4am boundary are handled by simple recompute.

(function () {
  "use strict";

  var REQUIRED = { 1: true, 3: true, 4: true }; // Mon, Wed, Thu (Date.getDay)
  var FREEZE_CAP = 2;
  var EARN_EVERY = 3; // +1 freeze per 3 required days completed in a row

  function pad(n) { return (n < 10 ? "0" : "") + n; }

  // Logical day runs 4:00am -> 3:59am local (PRD §4.1): shift back 4 hours.
  function logicalDateStr(date) {
    var d = new Date(date.getTime() - 4 * 3600 * 1000);
    return d.getFullYear() + "-" + pad(d.getMonth() + 1) + "-" + pad(d.getDate());
  }

  function weekdayOf(dateStr) {
    return new Date(dateStr + "T12:00:00").getDay();
  }

  function isRequired(dateStr) {
    return !!REQUIRED[weekdayOf(dateStr)];
  }

  function addDays(dateStr, n) {
    var d = new Date(dateStr + "T12:00:00");
    d.setDate(d.getDate() + n);
    return d.getFullYear() + "-" + pad(d.getMonth() + 1) + "-" + pad(d.getDate());
  }

  // Walk the log from the first completed day to logical-today and apply
  // §4.2 (streak) + §4.3 (freeze economy). Today is never treated as
  // "missed" — a required day only breaks things once it is over.
  function computeDerived(dayLog, todayStr) {
    dayLog = dayLog || {};
    var completedDates = Object.keys(dayLog)
      .filter(function (d) { return dayLog[d] && dayLog[d].reps > 0; })
      .sort();

    var streak = 0, freezes = 0, earn = 0, longest = 0;
    var freezesEarned = 0, freezesUsed = 0;
    var freezeDays = {}; // dateStr -> true, for the 7-day strip
    var totalCompleted = 0, goldDays = 0, bonusDaysDone = 0, totalSessions = 0;
    var states = {};        // dateStr -> heatmap/strip state (single source of truth)
    var firstLog = completedDates.length ? completedDates[0] : null;
    var sawReset = false, comeback = false; // comeback = reset from >0, later rebuilt to 7

    if (completedDates.length) {
      var start = completedDates[0] < todayStr ? completedDates[0] : todayStr;
      for (var d = start; d <= todayStr; d = addDays(d, 1)) {
        var reps = (dayLog[d] && dayLog[d].reps) || 0;
        var req = isRequired(d);

        if (reps >= 1) {
          streak += 1; // +1 per completed day, required or bonus; gold is still +1
          if (streak > longest) longest = streak;
          if (sawReset && streak >= 7) comeback = true;
          totalCompleted += 1;
          totalSessions += Math.min(reps, 2);
          if (reps >= 2) goldDays += 1;
          if (!req) bonusDaysDone += 1;
          if (req) {
            earn += 1;
            if (earn >= EARN_EVERY) {
              earn = 0; // counter resets after each grant
              if (freezes < FREEZE_CAP) { freezes += 1; freezesEarned += 1; }
            }
          }
          states[d] = reps >= 2 ? "gold" : (req ? "required-done" : "bonus-done");
        } else if (d === todayStr) {
          states[d] = "today-pending";
        } else {
          if (req) {
            earn = 0; // a protected miss still breaks the earn-counter (§4.3)
            if (freezes > 0) {
              freezes -= 1;
              freezesUsed += 1;
              freezeDays[d] = true; // streak holds flat
              states[d] = "freeze";
            } else {
              if (streak > 0) sawReset = true;
              streak = 0;
              states[d] = "missed";
            }
          } else {
            states[d] = "rest"; // bonus day missed: never penalized
          }
        }
      }
    } else {
      states[todayStr] = "today-pending";
    }

    // Per-exercise lifetime counts (PRD §4.5)
    var exCounts = {};
    Object.keys(dayLog).forEach(function (d) {
      var done = dayLog[d] && dayLog[d].exercisesDone;
      if (!done) return;
      Object.keys(done).forEach(function (ex) {
        if (done[ex] >= 1) exCounts[ex] = (exCounts[ex] || 0) + done[ex];
      });
    });

    return {
      streak: streak,
      freezes: freezes,
      earnCounter: earn,
      longestStreak: longest,
      freezesEarned: freezesEarned,
      freezesUsed: freezesUsed,
      freezeDays: freezeDays,
      totalCompleted: totalCompleted,
      goldDays: goldDays,
      bonusDaysDone: bonusDaysDone,
      totalSessions: totalSessions,
      exCounts: exCounts,
      states: states,             // per-date state map (heatmap + strip)
      firstLog: firstLog,
      perfectWeeks: perfectWeeks(dayLog, todayStr),
      comeback: comeback
    };
  }

  // Monday-of-week for a date string.
  function mondayOf(dateStr) {
    var wd = weekdayOf(dateStr); // 0 Sun .. 6 Sat
    return addDays(dateStr, wd === 0 ? -6 : 1 - wd);
  }

  // Weeks in which all three required days (Mon/Wed/Thu) were completed.
  function perfectWeeks(dayLog, todayStr) {
    var completed = Object.keys(dayLog)
      .filter(function (d) { return dayLog[d] && dayLog[d].reps > 0; })
      .sort();
    if (!completed.length) return 0;
    var count = 0;
    for (var wk = mondayOf(completed[0]); wk <= todayStr; wk = addDays(wk, 7)) {
      var mon = dayLog[wk], wed = dayLog[addDays(wk, 2)], thu = dayLog[addDays(wk, 3)];
      if (mon && mon.reps >= 1 && wed && wed.reps >= 1 && thu && thu.reps >= 1) count++;
    }
    return count;
  }

  // Resolve the state for any date given a computed derived result. Dates
  // before the first log are empty (no pre-history penalty, §1.6); dates after
  // today are "future". Everything in-range comes straight from derived.states.
  function stateForDate(derived, dateStr, todayStr) {
    if (dateStr > todayStr) return "future";
    if (derived.states[dateStr]) return derived.states[dateStr];
    if (derived.firstLog && dateStr < derived.firstLog) return "empty";
    return "empty";
  }

  // Build a rolling grid of `weeks` columns ending in the week containing today.
  // Returns { weeks: [[{date,state,weekday}, ... 7 rows Mon->Sun]], monthLabels }.
  function heatmapCells(derived, todayStr, weeks) {
    weeks = weeks || 16;
    var thisMonday = mondayOf(todayStr);
    var startMonday = addDays(thisMonday, -7 * (weeks - 1));
    var cols = [];
    var monthLabels = [];
    var lastMonth = null;
    for (var w = 0; w < weeks; w++) {
      var colMonday = addDays(startMonday, w * 7);
      var col = [];
      for (var row = 0; row < 7; row++) {
        var date = addDays(colMonday, row);
        col.push({ date: date, state: stateForDate(derived, date, todayStr), row: row });
      }
      // Month label when the week's Monday enters a new month.
      var mo = colMonday.slice(0, 7); // YYYY-MM
      if (mo !== lastMonth) {
        lastMonth = mo;
        monthLabels.push({ col: w, month: Number(colMonday.slice(5, 7)) });
      }
      cols.push(col);
    }
    return { cols: cols, monthLabels: monthLabels };
  }

  // Day reps derived from the per-exercise checklist: any exercise logged
  // marks the day complete (green); the full flow twice = gold (PRD §4.1).
  function repsFromExercises(exercisesDone, exerciseIds) {
    exercisesDone = exercisesDone || {};
    var any = false, allTwice = exerciseIds.length > 0;
    exerciseIds.forEach(function (id) {
      var v = exercisesDone[id] || 0;
      if (v >= 1) any = true;
      if (v < 2) allTwice = false;
    });
    return allTwice ? 2 : any ? 1 : 0;
  }

  window.PFStreak = {
    logicalDateStr: logicalDateStr,
    weekdayOf: weekdayOf,
    isRequired: isRequired,
    addDays: addDays,
    mondayOf: mondayOf,
    computeDerived: computeDerived,
    repsFromExercises: repsFromExercises,
    stateForDate: stateForDate,
    heatmapCells: heatmapCells,
    FREEZE_CAP: FREEZE_CAP,
    EARN_EVERY: EARN_EVERY
  };
})();
