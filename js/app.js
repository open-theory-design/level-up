// Level Up — UI (PRD §5)
// Single-page vanilla JS. Views: dashboard | flow | stats | settings.

(function () {
  "use strict";

  var state = PFStore.load();
  var view = "dashboard";
  var flowIndex = 0;
  var weekOffset = 0; // 0 = current week; negative = past weeks (day strip navigation)
  var flowStartReps = 0; // today's reps when the flow was opened (for celebration)
  var strengthOpen = false;
  var firedReminders = {}; // "YYYY-MM-DD HH:MM" -> true
  var app = document.getElementById("app");

  // Flow timing: measured silently every run; only committed to lifetime
  // stats if the clock toggle is on when the run finishes. Discarded on exit.
  var flowTiming = null; // { startedAt, segStart, perEx: {} }
  function nowMs() {
    return (window.performance && performance.now) ? performance.now() : Date.now();
  }
  function timingStart() {
    var t = nowMs();
    flowTiming = { startedAt: t, segStart: t, perEx: {} };
  }
  function timingCloseSegment() { // bank the time spent on the visible exercise
    if (!flowTiming) return;
    var t = nowMs();
    var id = PF_EXERCISES[flowIndex].id;
    flowTiming.perEx[id] = (flowTiming.perEx[id] || 0) + (t - flowTiming.segStart);
    flowTiming.segStart = t;
  }
  function timingCommit() {
    if (!flowTiming) return;
    if (!state.settings.timingEnabled) { flowTiming = null; return; }
    var total = nowMs() - flowTiming.startedAt;
    var tm = state.timing;
    tm.timedSessions += 1;
    tm.totalMs += total;
    tm.lastTotalMs = total;
    if (tm.bestTotalMs == null || total < tm.bestTotalMs) tm.bestTotalMs = total;
    Object.keys(flowTiming.perEx).forEach(function (id) {
      var e = tm.ex[id] || { ms: 0, n: 0 };
      e.ms += flowTiming.perEx[id];
      e.n += 1;
      tm.ex[id] = e;
    });
    state.timingUpdatedAt = new Date().toISOString(); // mark for sync
    flowTiming = null;
  }
  function fmtDur(ms) {
    if (ms == null) return "—";
    var s = Math.round(ms / 1000);
    var m = Math.floor(s / 60);
    var r = s % 60;
    return m > 0 ? m + ":" + (r < 10 ? "0" : "") + r : r + "s";
  }

  var DOW_LETTERS = ["S", "M", "T", "W", "T", "F", "S"];
  var REMINDER_MSGS = [
    "Posture check: drop your shoulders, tuck your chin.",
    "Desk break: stand up and squeeze your glutes for 10 seconds."
  ];
  var LIFT_PLACEHOLDER_HINTS = { hip_thrust: [70, 10], squat: [80, 6], deadlift: [100, 5] };
  // Section headers in the daily-flow list: exercises 1–6 target the rounded-
  // shoulder "hunch" (upper crossed); 7–12 target the hips/glutes (lower
  // crossed). The divide falls before the Kneeling Psoas Stretch (index 6).
  var FLOW_GROUPS = [
    { at: 0, label: "Posture & shoulders" },
    { at: 6, label: "Hips & glutes" }
  ];

  function esc(s) {
    return String(s).replace(/[&<>"]/g, function (c) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c];
    });
  }

  function today() { return PFStreak.logicalDateStr(new Date()); }

  function derived() { return PFStreak.computeDerived(state.dayLog, today()); }

  function save() { PFStore.save(state); }

  function dayEntry(dateStr) {
    if (!state.dayLog[dateStr]) state.dayLog[dateStr] = { reps: 0, exercisesDone: {}, updatedAt: "" };
    return state.dayLog[dateStr];
  }

  function touch(entry) { entry.updatedAt = new Date().toISOString(); }

  // ---------------- Images ----------------

  function imageFor(ex) {
    if (state.settings.imageStyle === "photos") return PF_IMAGES.photoHTML(ex);
    if (state.settings.imageStyle === "color") return PF_IMAGES.color(ex.id);
    return PF_IMAGES.illustration(ex.id);
  }

  // ---------------- Toast ----------------

  var toastTimer = null;
  function toast(msg, kind) {
    var el = document.querySelector(".toast");
    if (!el) {
      el = document.createElement("div");
      el.className = "toast";
      document.body.appendChild(el);
    }
    el.textContent = msg;
    el.className = "toast" + (kind === "reminder" ? " reminder" : "");
    requestAnimationFrame(function () { el.classList.add("show"); });
    clearTimeout(toastTimer);
    toastTimer = setTimeout(function () { el.classList.remove("show"); }, kind === "reminder" ? 8000 : 2600);
  }

  // ---------------- Day-completion celebration (BUILD-SPEC §3) ----------------

  var reduceMotion = window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  var CHECK_SVG = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" ' +
    'stroke-linecap="round" stroke-linejoin="round"><path d="M5 13l4 4L19 7"/></svg>';
  // Back arrow as an SVG (centered in its viewBox) — the "←" text glyph has
  // uneven side-bearings and renders visibly off-center inside the round button.
  var BACK_SVG = '<svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" ' +
    'stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M19 12H5"/>' +
    '<path d="M11 6l-6 6 6 6"/></svg>';
  var celebrateTimer = null;

  function clearCelebrate() {
    var o = document.querySelector(".celebrate-overlay");
    if (o) o.remove();
    clearTimeout(celebrateTimer);
  }

  function confettiHTML(gold) {
    var colors = gold ? ["#E9BC4F", "#15AFA6", "#F3DFA1"] : ["#15AFA6", "#0F9C94", "#E9BC4F"];
    var out = "";
    for (var i = 0; i < 26; i++) {
      var dx = Math.round((Math.random() * 2 - 1) * 150);
      var dy = Math.round(150 + Math.random() * 230);
      var rot = Math.round((Math.random() * 2 - 1) * 540);
      var delay = Math.round(Math.random() * 130);
      var size = Math.round(6 + Math.random() * 6);
      var left = Math.round(38 + Math.random() * 24);
      out += '<i class="cel-confetti" style="--dx:' + dx + "px;--dy:" + dy + "px;--rot:" + rot +
        "deg;animation-delay:" + delay + "ms;left:" + left + "%;width:" + size + "px;height:" + size +
        "px;background:" + colors[i % colors.length] + '"></i>';
    }
    return out;
  }

  // variant: "normal" | "gold"
  function celebrate(variant) {
    var mode = state.settings.celebration || "stamp";
    if (mode === "off") return;
    clearCelebrate();
    var gold = variant === "gold";
    var o = document.createElement("div");
    o.className = "celebrate-overlay" + (gold ? " gold" : "");
    var dur = 1000;

    if (reduceMotion) {
      // Reduced motion: static checkmark only, no scale/particles.
      o.innerHTML = '<div class="cel-stamp static"><span class="cel-check">' + CHECK_SVG + "</span></div>";
      dur = 650;
    } else if (mode === "stamp") {
      o.innerHTML = '<span class="cel-ring"></span><div class="cel-stamp"><span class="cel-check">' + CHECK_SVG + "</span></div>";
      dur = 800;
    } else if (mode === "ripple") {
      o.innerHTML = '<span class="cel-ripple"></span>';
      dur = 950;
    } else if (mode === "confetti") {
      o.innerHTML = confettiHTML(gold) + '<div class="cel-stamp small"><span class="cel-check">' + CHECK_SVG + "</span></div>";
      dur = 1150;
    } else if (mode === "burst") {
      // Ripple wash + confetti burst together, check on top.
      o.innerHTML = '<span class="cel-ripple soft"></span>' + confettiHTML(gold) +
        '<div class="cel-stamp small"><span class="cel-check">' + CHECK_SVG + "</span></div>";
      dur = 1200;
    }
    o.addEventListener("click", clearCelebrate); // tap dismisses instantly
    document.body.appendChild(o);
    celebrateTimer = setTimeout(clearCelebrate, dur);
  }

  // Fire a celebration when TODAY transitions to complete (0->1) or gold (1->2).
  // Past-day (retroactive) completions never celebrate.
  function maybeCelebrate(prevReps, nextReps) {
    if (nextReps >= 2 && prevReps < 2) celebrate("gold");
    else if (nextReps >= 1 && prevReps < 1) celebrate("normal");
  }

  // ---------------- Badge unlock reveal (BUILD-SPEC §2.5) ----------------

  var revealQueue = [];

  // Establish the baseline at startup: mark all currently-earned badges as seen
  // WITHOUT revealing, so pre-existing history doesn't flood the user. Only
  // badges earned later in the session reveal.
  function initBadgeBaseline() {
    var res = PFBadges.compute(derived());
    var seen = {};
    state.badgesSeen.forEach(function (id) { seen[id] = true; });
    var added = false;
    Object.keys(res.earnedIds).forEach(function (id) {
      if (!seen[id]) { state.badgesSeen.push(id); added = true; }
    });
    if (added) save();
  }

  // After a day-changing action: reveal any newly-earned badges exactly once.
  function checkBadgeReveals() {
    var res = PFBadges.compute(derived());
    var seen = {};
    state.badgesSeen.forEach(function (id) { seen[id] = true; });
    var byId = {};
    res.badges.forEach(function (b) { byId[b.id] = b; });
    var added = false;
    Object.keys(res.earnedIds).forEach(function (id) {
      if (!seen[id]) {
        state.badgesSeen.push(id); // mark immediately so it never re-reveals
        added = true;
        if (byId[id]) revealQueue.push(byId[id]);
      }
    });
    if (added) save();
    showNextReveal();
  }

  function showNextReveal() {
    if (document.querySelector(".reveal-overlay")) return; // one at a time
    var b = revealQueue.shift();
    if (!b) return;
    var o = document.createElement("div");
    o.className = "reveal-overlay";
    o.innerHTML =
      '<div class="reveal-card' + (reduceMotion ? " static" : "") + " badge-" + (b.color || "slate") + '">' +
        '<div class="reveal-ic">' + PFBadges.icon(b.icon) + "</div>" +
        '<div class="reveal-kicker">Milestone unlocked</div>' +
        '<div class="reveal-name">' + esc(b.name) + "</div>" +
        '<div class="reveal-sub">' + esc(b.threshold ? b.threshold + " " + b.unit : (b.desc || "")) + "</div>" +
      "</div>";
    var tmr;
    function dismiss() {
      o.remove();
      clearTimeout(tmr);
      setTimeout(showNextReveal, 260); // queue the next, if any
    }
    o.addEventListener("click", dismiss);
    document.body.appendChild(o);
    tmr = setTimeout(dismiss, 2200);
  }

  // ---------------- Dashboard ----------------

  function renderHeader() {
    var online = PFStore.isConfigured();
    var statsIcon =
      '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"><line x1="6" y1="20" x2="6" y2="13"/><line x1="12" y1="20" x2="12" y2="6"/><line x1="18" y1="20" x2="18" y2="10"/></svg>';
    var gearIcon =
      '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round">' +
        '<line x1="4" y1="7" x2="20" y2="7"/><line x1="4" y1="12" x2="20" y2="12"/><line x1="4" y1="17" x2="20" y2="17"/>' +
        '<circle cx="9" cy="7" r="2.4" fill="#fff"/><circle cx="15" cy="12" r="2.4" fill="#fff"/><circle cx="8" cy="17" r="2.4" fill="#fff"/>' +
      "</svg>";
    return (
      '<div class="pf-header">' +
        '<div class="pf-logo">' +
          '<svg width="26" height="26" viewBox="0 0 26 26"><rect width="26" height="26" rx="7" fill="#0C6B66"/><path d="M7.5 14 L13 8.5 L18.5 14" fill="none" stroke="#fff" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"/><path d="M7.5 19 L13 13.5 L18.5 19" fill="none" stroke="#3ED5C8" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"/></svg>' +
          "Level Up" +
        "</div>" +
        '<div class="header-actions">' +
          '<button class="icon-btn" data-action="goto" data-view="stats" aria-label="Lifetime stats" title="Lifetime stats">' + statsIcon + "</button>" +
          '<button class="icon-btn" data-action="goto" data-view="settings" aria-label="Settings" title="Settings">' + gearIcon +
            '<span class="status-dot' + (online ? " online" : "") + '"></span>' +
          "</button>" +
        "</div>" +
      "</div>"
    );
  }

  // Monday of the week currently being viewed (weekOffset weeks from today's).
  function viewedMonday() {
    return PFStreak.addDays(PFStreak.mondayOf(today()), weekOffset * 7);
  }

  function renderStreakCard(d, risk) {
    var flakes = "";
    for (var i = 0; i < PFStreak.FREEZE_CAP; i++) {
      flakes += '<span class="' + (i < d.freezes ? "flake" : "flake-empty") + '">❄️</span>';
    }
    // Apply the at-risk visual to the card. For the week trigger, only when the
    // current week is in view (so the pulsing stars match what's shown).
    var showRisk = risk && (risk.kind === "day" || weekOffset === 0);
    var cardCls = "card" + (showRisk ? " at-risk at-risk-" + risk.kind + (risk.hot ? " hot" : "") : "");
    return (
      '<div class="' + cardCls + '">' +
        '<div class="streak-block">' +
          "<div>" +
            '<div class="streak-num">' + d.streak + "</div>" +
            '<div class="streak-label">day streak</div>' +
          "</div>" +
          '<div class="freeze-bank">' +
            '<div class="flakes">' + flakes + "</div>" +
            '<div class="freeze-progress">' + d.earnCounter + "/" + PFStreak.EARN_EVERY + " toward next freeze</div>" +
          "</div>" +
        "</div>" +
        renderWeek(d) +
        renderWeekStars(viewedMonday()) +
      "</div>"
    );
  }

  // Three full-width goal stars beneath the week calendar: go once, twice, or
  // three times this week. Any day the flow is completed counts (no required-day
  // restriction). Reflects the week currently in view.
  // Count days in the Mon–Sun week starting `monday` with the flow done (reps>=1).
  // Shared by the goal stars and the at-risk check so they never disagree.
  function sessionsInWeek(monday) {
    var done = 0;
    for (var i = 0; i < 7; i++) {
      var e = state.dayLog[PFStreak.addDays(monday, i)];
      if (e && (e.reps || 0) >= 1) done += 1;
    }
    return done;
  }

  var WEEK_STAR_LABELS = ["1st", "2nd", "3rd"];
  function renderWeekStars(monday) {
    var done = sessionsInWeek(monday);
    var filled = Math.min(3, done);
    var items = "";
    for (var s = 0; s < 3; s++) {
      var on = s < filled;
      items +=
        '<div class="wk-goal' + (on ? " on" : "") + '">' +
          '<span class="wk-star">★</span>' +
          '<span class="wk-goal-label">' + WEEK_STAR_LABELS[s] + "</span>" +
        "</div>";
    }
    return '<div class="week-stars" role="img" aria-label="' + done +
      ' of 3 sessions completed this week">' + items + "</div>";
  }

  // Friendly Mon–Sun range, e.g. "Jun 30 – Jul 6" (month omitted on the end when
  // the week doesn't cross a month boundary: "Jul 6 – 12").
  function weekRangeLabel(monday) {
    var sun = PFStreak.addDays(monday, 6);
    var m1 = new Date(monday + "T12:00:00");
    var m2 = new Date(sun + "T12:00:00");
    var a = MONTHS[m1.getMonth() + 1] + " " + m1.getDate();
    var b = (m1.getMonth() === m2.getMonth() ? "" : MONTHS[m2.getMonth() + 1] + " ") + m2.getDate();
    return a + " – " + b;
  }

  // Fixed Monday→Sunday week, Variant B: required days normal weight, bonus days
  // lighter. Reads the derived state map (same source as the heatmap). Tap a past
  // or present cell to retro-edit (cycle 0 -> 1x -> 2x -> 0); future days in the
  // current week are shown muted and are not interactive. ‹ › move between weeks.
  function renderWeek(d) {
    var t = today();
    var monday = viewedMonday();
    var label = weekOffset === 0 ? "This week"
      : weekOffset === -1 ? "Last week"
      : weekRangeLabel(monday);
    var nav =
      '<div class="week-nav">' +
        '<button class="week-arrow" data-action="week-prev" aria-label="Previous week">‹</button>' +
        '<span class="week-label">' + esc(label) + "</span>" +
        '<button class="week-arrow" data-action="week-next" aria-label="Next week"' +
          (weekOffset >= 0 ? " disabled" : "") + ">›</button>" +
      "</div>";

    var cells = "";
    for (var i = 0; i < 7; i++) {
      var date = PFStreak.addDays(monday, i);
      var st = PFStreak.stateForDate(d, date, t);
      var future = date > t;
      var cls = "day-cell " + (PFStreak.isRequired(date) ? "req" : "bonus");
      var mark = "·";
      if (st === "gold") { cls += " done2"; mark = "✓✓"; }
      else if (st === "required-done" || st === "bonus-done") { cls += " done1"; mark = "✓"; }
      else if (st === "freeze") { cls += " frozen"; mark = "❄"; }
      else if (future) { cls += " future"; }
      else cls += " empty";
      if (date === t) cls += " today";
      var dow = '<span class="dow">' + DOW_LETTERS[PFStreak.weekdayOf(date)] + "</span>";
      var body = dow + '<span class="mark">' + mark + "</span>";
      cells += future
        ? '<div class="' + cls + '" aria-label="' + date + '">' + body + "</div>"
        : '<button class="' + cls + '" data-action="cycle-day" data-date="' + date + '" ' +
          'aria-label="' + date + '">' + body + "</button>";
    }
    return nav + '<div class="day-strip">' + cells + "</div>";
  }

  // Small leading thumbnail for each list row, following the active image
  // style. In Photos mode the line-art sits behind the photo, so a missing
  // photo (onerror removes the <img>) reveals the illustration instead of a
  // blank box.
  function thumbFor(ex) {
    if (state.settings.imageStyle === "photos") {
      return PF_IMAGES.illustration(ex.id) +
        '<img class="thumb-img" src="photos/' + ex.id + '.jpg" alt="" onerror="this.remove()">';
    }
    if (state.settings.imageStyle === "color") return PF_IMAGES.color(ex.id);
    return PF_IMAGES.illustration(ex.id);
  }

  function renderFlowCard() {
    var entry = state.dayLog[today()] || {};
    var done = entry.exercisesDone || {};
    var items = "";
    PF_EXERCISES.forEach(function (ex, i) {
      var g = FLOW_GROUPS.filter(function (x) { return x.at === i; })[0];
      if (g) items += '<div class="check-group">' + esc(g.label) + "</div>";
      var v = done[ex.id] || 0;
      var mark = v >= 2 ? "✓✓" : v >= 1 ? "✓" : "";
      items +=
        '<button class="check-item s' + v + '" data-action="cycle-exercise" data-ex="' + ex.id + '">' +
          '<span class="check-thumb">' + thumbFor(ex) + "</span>" +
          '<span class="check-main"><span class="check-name">' + esc(ex.name) + "</span>" +
          '<span class="check-dose">' + esc(ex.dose) + "</span></span>" +
          '<span class="check-box">' + mark + "</span>" +
        "</button>";
    });
    return (
      '<div class="card">' +
        '<div class="card-title">Daily posture flow</div>' +
        '<button class="btn-primary" data-action="start-flow">Start daily flow</button>' +
        '<div class="checklist">' + items + "</div>" +
        '<div class="flow-note">These are general movement cues, not medical advice — move gently and stop if anything hurts.</div>' +
      "</div>"
    );
  }

  function lastLift(liftIds) {
    var last = null;
    state.strengthLog.forEach(function (r) {
      if (liftIds.indexOf(r.lift) === -1) return;
      if (!last || r.loggedAt > last.loggedAt) last = r;
    });
    return last;
  }

  function daysAgoLabel(iso) {
    if (!iso) return "never logged";
    var n = Math.max(0, Math.floor(
      (new Date(today() + "T12:00:00") - new Date(PFStreak.logicalDateStr(new Date(iso)) + "T12:00:00")) / 86400000
    ));
    return n === 0 ? "Last logged: today" : n === 1 ? "Last logged: yesterday" : "Last logged: " + n + " days ago";
  }

  function warmupDoneToday() {
    var t = today();
    return state.strengthLog.some(function (r) {
      return (r.lift === "ytw" || r.lift === "face_pull") &&
        PFStreak.logicalDateStr(new Date(r.loggedAt)) === t;
    });
  }

  function renderStrengthCard() {
    var allIds = PF_LIFTS.map(function (l) { return l.id; });
    var last = lastLift(allIds);
    var head =
      '<button class="strength-head" data-action="toggle-strength">' +
        "<div><h3>Strength &amp; weights</h3>" +
        '<span class="meta">' + esc(daysAgoLabel(last && last.loggedAt)) + " · never overdue</span></div>" +
        '<span class="chev">' + (strengthOpen ? "▲" : "▼") + "</span>" +
      "</button>";

    if (!strengthOpen) return '<div class="card">' + head + "</div>";

    var unlocked = warmupDoneToday();
    var gate =
      '<div class="warmup-gate' + (unlocked ? " cleared" : "") + '">' +
        '<div class="gate-title">' + (unlocked ? "✓ Warm-up logged" : "1 · Warm-up first") + "</div>" +
        '<div class="gate-sub">YTWs or Face Pulls are the mandatory baseline — weights unlock after logging one.</div>' +
        '<div class="warmup-btns">' +
          '<button class="btn-secondary" data-action="log-warmup" data-lift="ytw">Log YTWs</button>' +
          '<button class="btn-secondary" data-action="log-warmup" data-lift="face_pull">Log Face Pulls</button>' +
        "</div>" +
      "</div>";

    var rows = PF_LIFTS.filter(function (l) { return !l.warmup; }).map(function (l) {
      var lastOfLift = lastLift([l.id]);
      var hint = LIFT_PLACEHOLDER_HINTS[l.id] || [0, 0];
      var phW = lastOfLift && lastOfLift.weightKg != null ? lastOfLift.weightKg : hint[0];
      var phR = lastOfLift && lastOfLift.reps != null ? lastOfLift.reps : hint[1];
      var lastLabel = lastOfLift
        ? "last: " + lastOfLift.weightKg + "kg × " + lastOfLift.reps
        : "last: " + hint[0] + "kg × " + hint[1] + " (example)";
      var dis = unlocked ? "" : " disabled";
      return (
        '<div class="lift-row" data-lift-row="' + l.id + '">' +
          '<span class="lift-name">' + esc(l.name) + '<span class="last">' + esc(lastLabel) + "</span></span>" +
          '<input type="number" inputmode="decimal" min="0" step="0.5" placeholder="' + phW + '" data-field="kg"' + dis + ">" +
          '<span class="lift-x">kg ×</span>' +
          '<input type="number" inputmode="numeric" min="0" step="1" placeholder="' + phR + '" data-field="reps"' + dis + ">" +
          '<button class="lift-log-btn" data-action="log-lift" data-lift="' + l.id + '"' + dis + ">Log</button>" +
        "</div>"
      );
    }).join("");

    return (
      '<div class="card">' + head +
        '<div class="strength-body">' + gate + rows +
          (unlocked ? "" : '<div class="locked-note">🔒 Weight inputs unlock after the warm-up</div>') +
          '<div class="locked-note">Target cadence: 2–3× per week (informational only)</div>' +
        "</div>" +
      "</div>"
    );
  }

  // ---------------- At-risk ("angry") attention state ----------------
  // Two triggers, mutually exclusive (Sun isn't a required day):
  //   week — Sunday & this week's sessions < 3
  //   day  — required day (Mon/Wed/Thu), ≥6pm local, today's flow not done
  // `hot` = escalated (from 6pm) → harder copy + faster pulse.
  function riskState() {
    var t = today();
    var evening = (new Date()).getHours() >= 18; // ~6pm local
    if (PFStreak.weekdayOf(t) === 0) { // Sunday
      var wk = sessionsInWeek(PFStreak.mondayOf(t));
      if (wk < 3) return { kind: "week", remaining: 3 - wk, hot: evening };
    }
    if (PFStreak.isRequired(t) && evening) {
      var doneToday = ((state.dayLog[t] || {}).reps || 0) >= 1;
      if (!doneToday) return { kind: "day", remaining: 1, hot: true };
    }
    return null;
  }

  // Full-width urgent banner (the whole thing is the "Start now" CTA).
  function renderRiskBanner(risk) {
    if (!risk) return "";
    var msg;
    if (risk.kind === "week") {
      var s = risk.remaining === 1 ? "" : "s";
      msg = risk.hot
        ? "Last chance — " + risk.remaining + " session" + s + " left before the week resets."
        : "It's Sunday — " + risk.remaining + " session" + s + " to go for your 3 this week.";
    } else {
      msg = "Your streak's on the line — today isn't done yet.";
    }
    return '<button class="risk-banner' + (risk.hot ? " hot" : "") + '" data-action="start-flow">' +
      '<span class="risk-ic">⚠️</span>' +
      '<span class="risk-msg">' + esc(msg) + "</span>" +
      '<span class="risk-cta">Start now →</span>' +
      "</button>";
  }

  function renderDashboard() {
    var d = derived();
    var risk = riskState();
    return (
      renderHeader() +
      renderRiskBanner(risk) +
      renderStreakCard(d, risk) +
      renderFlowCard() +
      renderStrengthCard()
    );
  }

  // ---------------- Flow carousel ----------------

  // The whole screen is a tap-to-advance target (data-action="flow-advance").
  // Inner controls carry their own data-action, so event delegation's
  // closest() picks them first — the Back and Close buttons never advance.
  // Skim-friendly form cues: a "Do" group (green ✓) and an optional "Avoid"
  // group (red ✕). Bare glyphs, no circles. Backward-compatible with a plain
  // `cue` string if tips/avoid aren't present.
  function tipGroup(label, items, kind) {
    if (!items || !items.length) return "";
    var rows = items.map(function (t) {
      return '<div class="tip-item ' + kind + '"><span class="tip-ic">' +
        (kind === "avoid" ? "✕" : "✓") + "</span><span>" + esc(t) + "</span></div>";
    }).join("");
    return '<div class="tip-group"><div class="tip-label">' + label + "</div>" + rows + "</div>";
  }
  function renderFlowTips(ex) {
    if ((!ex.tips || !ex.tips.length) && !ex.avoid) {
      return ex.cue ? '<div class="tip-group">' + tipGroup("Do", [ex.cue], "do") + "</div>" : "";
    }
    return tipGroup("Do", ex.tips, "do") + tipGroup("Avoid", ex.avoid, "avoid");
  }

  function renderFlow() {
    var ex = PF_EXERCISES[flowIndex];
    var lastOne = flowIndex === PF_EXERCISES.length - 1;
    var pct = Math.round(((flowIndex + 1) / PF_EXERCISES.length) * 100);
    var showDose = ex.dose && ex.dose.toLowerCase() !== "self-paced";
    var notFirst = flowIndex > 0;
    var timing = state.settings.timingEnabled;
    var clockIcon =
      '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">' +
        '<circle cx="12" cy="12" r="8.5"/><path d="M12 7.5V12l3 2"/>' +
        (timing ? "" : '<line x1="5" y1="19" x2="19" y2="5"/>') +
      "</svg>";
    return (
      '<div class="flow-screen" data-action="flow-advance">' +
        '<div class="flow-top">' +
          (notFirst
            ? '<button class="flow-back" data-action="flow-back" aria-label="Previous exercise">‹</button>'
            : '<span class="flow-back-spacer"></span>') +
          '<span class="flow-progress">' + (flowIndex + 1) + " / " + PF_EXERCISES.length + "</span>" +
          '<div class="flow-top-right">' +
            '<button class="flow-clock' + (timing ? " on" : "") + '" data-action="toggle-timing" ' +
              'aria-label="' + (timing ? "Timing on — tap to stop recording this run" : "Timing off — tap to record") + '" ' +
              'aria-pressed="' + timing + '" title="' + (timing ? "Timing on" : "Timing off") + '">' + clockIcon + "</button>" +
            '<button class="flow-close" data-action="exit-flow" aria-label="Close">✕</button>' +
          "</div>" +
        "</div>" +
        '<div class="flow-bar"><div style="width:' + pct + '%"></div></div>' +
        '<div class="flow-body">' +
          '<div class="flow-img">' + imageFor(ex) + "</div>" +
          '<h2 class="flow-name">' + esc(ex.name) + "</h2>" +
          (showDose ? '<div class="flow-reps">' + esc(ex.dose) + "</div>" : "") +
          renderFlowTips(ex) +
        "</div>" +
        '<div class="flow-hint">Tap anywhere, or press → / space. Press ← to go back.</div>' +
        '<div class="flow-actions">' +
          (notFirst ? '<button class="flow-prev-btn" data-action="flow-back">Back</button>' : "") +
          '<button class="flow-next' + (lastOne ? " finish" : "") + '" data-action="flow-advance">' +
            (lastOne ? "Finish ✓" : "Next") +
          "</button>" +
        "</div>" +
      "</div>"
    );
  }

  // ---------------- Stats ----------------

  function statTile(cls, v, k) {
    return '<div class="stat-tile ' + cls + '"><div class="v">' + v + '</div><div class="k">' + k + "</div></div>";
  }
  function statGroup(label, tiles) {
    return '<div class="stat-group-label">' + label + "</div>" +
      '<div class="stat-grid">' + tiles + "</div>";
  }

  // ---------------- Consistency heatmap (BUILD-SPEC §1) ----------------

  var MONTHS = ["", "Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  var HM_WD = ["M", "T", "W", "T", "F", "S", "S"];

  function niceDate(dateStr) {
    var dt = new Date(dateStr + "T12:00:00");
    var wd = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"][dt.getDay()];
    return wd + " " + dt.getDate() + " " + MONTHS[dt.getMonth() + 1];
  }
  function captionFor(dateStr, st) {
    var phrase = {
      "gold": "completed 2× (gold)",
      "required-done": "completed",
      "bonus-done": "completed (bonus day)",
      "freeze": "freeze used",
      "missed": "missed",
      "rest": "rest day",
      "today-pending": "today — not done yet",
      "empty": "no activity"
    }[st] || "";
    return niceDate(dateStr) + (phrase ? " · " + phrase : "");
  }

  function renderHeatmapCard(d) {
    var t = today();
    var hm = PFStreak.heatmapCells(d, t, 16);
    var CELL = 13, GAP = 3, STEP = CELL + GAP, LEFT = 15, TOP = 15;
    var W = LEFT + hm.cols.length * STEP - GAP;
    var H = TOP + 7 * STEP - GAP;

    var wdLabels = "";
    for (var r = 0; r < 7; r++) {
      wdLabels += '<text class="hm-wd" x="' + (LEFT - 5) + '" y="' + (TOP + r * STEP + CELL - 3) +
        '" text-anchor="end">' + HM_WD[r] + "</text>";
    }
    var months = hm.monthLabels.map(function (m) {
      return '<text class="hm-mo" x="' + (LEFT + m.col * STEP) + '" y="' + (TOP - 5) + '">' + MONTHS[m.month] + "</text>";
    }).join("");

    var rects = "";
    hm.cols.forEach(function (col, ci) {
      col.forEach(function (cell) {
        var x = LEFT + ci * STEP, y = TOP + cell.row * STEP;
        var cls = "hm-cell hm-" + cell.state + (cell.date === t ? " hm-today" : "");
        var attrs = cell.state === "future" ? "" :
          ' data-action="hm-cell" data-date="' + cell.date + '" data-state="' + cell.state + '"';
        rects += '<rect class="' + cls + '" x="' + x + '" y="' + y + '" width="' + CELL +
          '" height="' + CELL + '" rx="3"' + attrs + "/>";
      });
    });

    var svg = '<svg class="heatmap" viewBox="0 0 ' + W + " " + H + '" role="img" ' +
      'aria-label="Consistency heatmap, last 16 weeks">' + wdLabels + months + rects + "</svg>";

    var legendItems = [
      ["required-done", "Required"],
      ["bonus-done", "Bonus"],
      ["gold", "2×"],
      ["freeze", "Freeze"],
      ["missed", "Missed / rest"]
    ].map(function (l) {
      return '<span class="hm-leg"><i class="hm-sw hm-' + l[0] + '"></i>' + l[1] + "</span>";
    }).join("");

    var caption = d.firstLog
      ? "Tap a day to see what happened."
      : "Your consistency fills in here as you log sessions.";

    return (
      '<div class="card">' +
        '<div class="card-title">Consistency · last 16 weeks</div>' +
        '<div class="hm-wrap">' + svg + "</div>" +
        '<div class="hm-caption" id="hm-caption">' + caption + "</div>" +
        '<div class="hm-legend">' + legendItems + "</div>" +
      "</div>"
    );
  }

  // ---------------- Milestones / badges (BUILD-SPEC §2) ----------------

  function renderBadgesCard(d) {
    var res = PFBadges.compute(d);
    var earnedCount = Object.keys(res.earnedIds).length;
    var cards = res.badges.map(function (b) {
      if (b.status === "earned") {
        return (
          '<div class="badge earned badge-' + b.color + '">' +
            '<div class="badge-ic">' + PFBadges.icon(b.icon) + "</div>" +
            '<div class="badge-name">' + esc(b.name) + "</div>" +
            '<div class="badge-sub">' + esc(b.threshold ? b.threshold + " " + b.unit : (b.desc || "")) + "</div>" +
            '<div class="badge-tag">✓ Earned</div>' +
          "</div>"
        );
      }
      if (b.status === "in-progress") {
        var pct = Math.min(100, Math.round((b.current / b.threshold) * 100));
        return (
          '<div class="badge inprog">' +
            '<div class="badge-ic">' + PFBadges.icon(b.icon) + "</div>" +
            '<div class="badge-name">' + esc(b.name) + "</div>" +
            '<div class="badge-sub">' + esc(b.current + " / " + b.threshold) + " " + esc(b.unit) + "</div>" +
            '<div class="badge-bar"><div style="width:' + pct + '%"></div></div>' +
          "</div>"
        );
      }
      return (
        '<div class="badge locked">' +
          '<div class="badge-ic">' + PFBadges.lockIcon() + "</div>" +
          '<div class="badge-name">' + esc(b.name) + "</div>" +
          '<div class="badge-sub">' + esc(b.desc || "Locked") + "</div>" +
        "</div>"
      );
    }).join("");

    return (
      '<div class="card">' +
        '<div class="card-title">Milestones · ' + earnedCount + " earned</div>" +
        '<div class="badge-shelf">' + cards + "</div>" +
      "</div>"
    );
  }

  function renderStats() {
    var d = derived();

    // Top stats, grouped into skimmable categories.
    var topStats =
      statGroup("Streak",
        statTile("green", d.streak, "Current streak") +
        statTile("slate", d.longestStreak, "Longest streak")) +
      statGroup("Days &amp; sessions",
        statTile("slate", d.totalCompleted, "Days completed") +
        statTile("slate", d.totalSessions, "Total sessions") +
        statTile("gold", d.goldDays, "Gold (2×) days") +
        statTile("slate", d.bonusDaysDone, "Bonus days")) +
      statGroup("Freezes",
        statTile("blue", d.freezesEarned, "Freezes earned") +
        statTile("blue", d.freezesUsed, "Freezes used"));

    var prs = PF_LIFTS.filter(function (l) { return !l.warmup; }).map(function (l) {
      var best = null;
      state.strengthLog.forEach(function (r) {
        if (r.lift !== l.id || r.weightKg == null) return;
        if (!best || r.weightKg > best.weightKg) best = r;
      });
      return '<div class="pr-row"><span>' + esc(l.name) + '</span><span class="v">' +
        (best ? best.weightKg + "kg × " + best.reps : "—") + "</span></div>";
    }).join("");

    var counts = PF_EXERCISES.map(function (ex) {
      return '<div class="excount-row"><span>' + esc(ex.name) + '</span><span class="v">' +
        (d.exCounts[ex.id] || 0) + "</span></div>";
    }).join("");

    return (
      '<div class="subnav"><button class="back" data-action="goto" data-view="dashboard" aria-label="Back">' + BACK_SVG + '</button><h2>Lifetime stats</h2></div>' +
      '<div class="card">' + topStats + "</div>" +
      renderHeatmapCard(d) +
      renderBadgesCard(d) +
      renderTimingCard() +
      '<div class="card"><div class="card-title">Exercise completions</div>' + counts + "</div>" +
      '<div class="card"><div class="card-title">Strength PRs</div>' + prs + "</div>"
    );
  }

  function renderTimingCard() {
    var tm = state.timing;
    var head = '<div class="card-title">Flow timing</div>';
    if (!tm || tm.timedSessions === 0) {
      return (
        '<div class="card">' + head +
          '<div class="timing-empty">No timed runs yet. Finish a daily flow with the clock toggle ' +
          '(top-right of the flow) switched on to start tracking.</div>' +
        "</div>"
      );
    }
    var avg = tm.totalMs / tm.timedSessions;
    var tiles =
      '<div class="stat-tile slate"><div class="v">' + fmtDur(avg) + '</div><div class="k">Average time</div></div>' +
      '<div class="stat-tile green"><div class="v">' + fmtDur(tm.bestTotalMs) + '</div><div class="k">Best time</div></div>' +
      '<div class="stat-tile slate"><div class="v">' + fmtDur(tm.lastTotalMs) + '</div><div class="k">Last time</div></div>' +
      '<div class="stat-tile slate"><div class="v">' + tm.timedSessions + '</div><div class="k">Timed runs</div></div>';

    var rows = PF_EXERCISES.map(function (ex) {
      var e = tm.ex[ex.id];
      return '<div class="excount-row"><span>' + esc(ex.name) + '</span><span class="v">' +
        (e && e.n ? fmtDur(e.ms / e.n) : "—") + "</span></div>";
    }).join("");

    return (
      '<div class="card">' + head +
        '<div class="stat-grid">' + tiles + "</div>" +
        '<div class="timing-sub">Average per exercise</div>' + rows +
        '<button class="btn-danger-soft" data-action="reset-timing">Reset timing data</button>' +
      "</div>"
    );
  }

  // ---------------- Settings ----------------

  function renderSettings() {
    var s = state.settings;
    var configured = PFStore.isConfigured();
    var times = s.reminderTimes.map(function (t, i) {
      return '<input type="time" value="' + esc(t) + '" data-reminder-index="' + i + '">';
    }).join(" ");

    return (
      '<div class="subnav"><button class="back" data-action="goto" data-view="dashboard" aria-label="Back">' + BACK_SVG + '</button><h2>Settings</h2></div>' +

      '<div class="card"><div class="card-title">Sync</div>' +
        '<div class="sync-code-big">' + esc(state.syncCode) + "</div>" +
        '<div class="sync-hint">Enter this code on another device to sync it here</div>' +
        (configured
          ? '<div class="sync-join">' +
              '<input id="join-code" maxlength="6" placeholder="ABC123" autocomplete="off">' +
              '<button data-action="join-code">Sync device</button>' +
            "</div>"
          : '<div class="local-note"><strong>Local-only mode.</strong> Supabase isn’t configured in config.js, so data lives on this device only. See DEPLOY.md to enable phone ↔ desktop sync.</div>') +
      "</div>" +

      '<div class="card"><div class="card-title">Appearance</div>' +
        '<div class="set-row col"><span class="set-label">Theme</span>' +
          '<div class="seg">' +
            '<button class="' + (s.theme !== "dark" ? "on" : "") + '" data-action="set-theme" data-theme-val="light">Light</button>' +
            '<button class="' + (s.theme === "dark" ? "on" : "") + '" data-action="set-theme" data-theme-val="dark">Dark</button>' +
          "</div></div>" +
      "</div>" +

      '<div class="card"><div class="card-title">Exercise images</div>' +
        '<div class="set-row col"><span class="set-label">Image style</span>' +
          '<div class="seg">' +
            '<button class="' + (s.imageStyle === "illustrations" ? "on" : "") + '" data-action="set-images" data-style="illustrations">Line art</button>' +
            '<button class="' + (s.imageStyle === "color" ? "on" : "") + '" data-action="set-images" data-style="color">Color</button>' +
            '<button class="' + (s.imageStyle === "photos" ? "on" : "") + '" data-action="set-images" data-style="photos">Photos</button>' +
          "</div></div>" +
      "</div>" +

      '<div class="card"><div class="card-title">Completion celebration</div>' +
        '<div class="set-row col"><span class="set-label">When you complete a day' +
          '<span class="set-sub">Tap an option to preview it</span></span>' +
          '<div class="seg seg-compact">' +
            ["off", "stamp", "confetti", "ripple", "burst"].map(function (opt) {
              var label = opt.charAt(0).toUpperCase() + opt.slice(1);
              return '<button class="' + ((s.celebration || "stamp") === opt ? "on" : "") +
                '" data-action="set-celebration" data-cel="' + opt + '">' + label + "</button>";
            }).join("") +
          "</div></div>" +
      "</div>" +

      '<div class="card"><div class="card-title">Reminders &amp; notifications</div>' +
        '<div class="set-row"><span class="set-label">In-app reminders' +
          '<span class="set-sub">Fire while the app is open</span></span>' +
          '<button class="toggle' + (s.remindersEnabled ? " on" : "") + '" data-action="toggle-reminders" role="switch" aria-checked="' + s.remindersEnabled + '" aria-label="Reminders"></button>' +
        "</div>" +
        '<div class="set-row"><span class="set-label">Times</span><span>' + times + "</span></div>" +
        renderPushRow() +
      "</div>"
    );
  }

  // The push row's states: unsupported browser -> note; permission denied ->
  // note; otherwise a toggle (+ test button when subscribed). Pushes use the
  // same times as in-app reminders, plus the required-day streak-saver.
  function renderPushRow() {
    if (!PFStore.isConfigured()) return ""; // local-only mode: no backend to push from
    if (!pushSupported()) {
      return '<div class="locked-note">Closed-app push isn’t supported in this browser</div>';
    }
    if (pushState.permission === "denied") {
      return '<div class="set-row"><span class="set-label">Push to this device' +
        '<span class="set-sub">Notifications are blocked — allow them in your browser’s site settings</span></span></div>';
    }
    var busy = pushState.busy || !pushState.checked;
    var row =
      '<div class="set-row"><span class="set-label">Push to this device' +
        '<span class="set-sub">Reminder times + a streak-saver on required days — works with the app closed</span></span>' +
        '<button class="toggle' + (pushState.subscribed ? " on" : "") + (busy ? " busy" : "") +
          '" data-action="toggle-push" role="switch" aria-checked="' + pushState.subscribed +
          '" aria-label="Push notifications"' + (busy ? " disabled" : "") + "></button>" +
      "</div>";
    if (pushState.subscribed) {
      row += '<button class="btn-secondary btn-block" data-action="test-push">Send test notification</button>';
    }
    return row;
  }

  // ---------------- Web Push (closed-app notifications) ----------------

  // UI state for the Settings push toggle. `checked` flips true after the
  // first async probe so we don't flash the wrong state.
  var pushState = { supported: false, permission: "default", subscribed: false, endpoint: null, busy: false, checked: false };

  function pushSupported() {
    return "serviceWorker" in navigator && "PushManager" in window && "Notification" in window;
  }

  function urlBase64ToUint8Array(base64String) {
    var padding = "=".repeat((4 - (base64String.length % 4)) % 4);
    var base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
    var raw = atob(base64);
    var out = new Uint8Array(raw.length);
    for (var i = 0; i < raw.length; i++) out[i] = raw.charCodeAt(i);
    return out;
  }

  // navigator.serviceWorker.ready can hang in some embedded browsers even when
  // an active worker exists — prefer getRegistration() and only fall back to
  // .ready for a genuinely fresh install.
  function swReg() {
    return navigator.serviceWorker.getRegistration().then(function (reg) {
      if (reg && reg.active) return reg;
      return navigator.serviceWorker.ready;
    });
  }

  function withTimeout(p, ms) {
    return Promise.race([p, new Promise(function (_, rej) {
      setTimeout(function () { rej(new Error("timeout")); }, ms);
    })]);
  }

  function refreshPushState() {
    pushState.supported = pushSupported();
    pushState.permission = ("Notification" in window) ? Notification.permission : "denied";
    if (!pushState.supported) { pushState.checked = true; return; }
    withTimeout(
      swReg().then(function (reg) { return reg.pushManager.getSubscription(); }),
      3000
    )
      .then(function (sub) {
        var changed = pushState.subscribed !== !!sub || !pushState.checked;
        pushState.subscribed = !!sub;
        pushState.endpoint = sub ? sub.endpoint : null;
        pushState.checked = true;
        if (view === "settings" && changed) render();
      })
      .catch(function () {
        // Probe failed or timed out — settle the UI rather than spin forever.
        var first = !pushState.checked;
        pushState.checked = true;
        if (view === "settings" && first) render();
      });
  }

  function enablePush() {
    var key = (window.POSTUREFLOW_CONFIG || {}).VAPID_PUBLIC_KEY;
    if (!key || key.indexOf("PASTE_") !== -1) { toast("Add VAPID_PUBLIC_KEY to config.js first"); return; }
    pushState.busy = true; render();
    Notification.requestPermission().then(function (perm) {
      pushState.permission = perm;
      if (perm !== "granted") { pushState.busy = false; render(); return; }
      return swReg().then(function (reg) {
        return reg.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: urlBase64ToUint8Array(key)
        });
      }).then(function (sub) {
        return PFStore.savePushSubscription(state, sub).then(function (ok) {
          pushState.busy = false;
          pushState.subscribed = ok;
          pushState.endpoint = sub.endpoint;
          if (!ok) { sub.unsubscribe(); toast("Couldn’t save the subscription (is the push table set up?)"); }
          else toast("Push enabled on this device ✓");
          render();
        });
      });
    }).catch(function () {
      pushState.busy = false;
      toast("Push setup failed — see console");
      render();
    });
  }

  function disablePush() {
    pushState.busy = true; render();
    swReg()
      .then(function (reg) { return reg.pushManager.getSubscription(); })
      .then(function (sub) {
        var endpoint = sub ? sub.endpoint : pushState.endpoint;
        var done = sub ? sub.unsubscribe() : Promise.resolve(true);
        return done.then(function () { return PFStore.deletePushSubscription(endpoint); });
      })
      .then(function () {
        pushState.busy = false; pushState.subscribed = false; pushState.endpoint = null;
        toast("Push disabled on this device");
        render();
      })
      .catch(function () { pushState.busy = false; render(); });
  }

  function sendTestPush() {
    var url = PFStore.pushFunctionUrl();
    if (!url) return;
    var key = (window.POSTUREFLOW_CONFIG || {}).SUPABASE_ANON_KEY;
    toast("Sending test notification…");
    fetch(url + "?test=1", {
      method: "POST",
      headers: { apikey: key, Authorization: "Bearer " + key }
    }).then(function (r) {
      if (!r.ok) throw new Error(r.status);
      toast("Test sent — check your notifications");
    }).catch(function () {
      toast("Test failed — is the Edge Function deployed?");
    });
  }

  // ---------------- Render root ----------------

  // Theme: reflect settings.theme onto <html data-theme> and keep the PWA
  // status-bar colour in step. Runs on every render so remote-merged settings
  // apply too.
  function applyTheme() {
    var dark = state.settings.theme === "dark";
    document.documentElement.setAttribute("data-theme", dark ? "dark" : "light");
    var meta = document.querySelector('meta[name="theme-color"]');
    if (meta) meta.setAttribute("content", dark ? "#0C1412" : "#0C6B66");
  }

  function render() {
    applyTheme();
    if (view === "flow") { app.innerHTML = renderFlow(); return; }
    if (view === "stats") { app.innerHTML = renderStats(); return; }
    if (view === "settings") { app.innerHTML = renderSettings(); return; }
    app.innerHTML = renderDashboard();
  }

  // ---------------- Actions ----------------

  function cycleDay(dateStr) {
    if (dateStr > today()) return;
    var e = dayEntry(dateStr);
    var prev = e.reps || 0;
    e.reps = ((e.reps || 0) + 1) % 3;
    if (e.reps === 0) e.exercisesDone = {}; // third tap = reset
    touch(e);
    save();
    render();
    if (dateStr === today()) maybeCelebrate(prev, e.reps); // only today celebrates
    checkBadgeReveals();
  }

  function cycleExercise(exId) {
    var e = dayEntry(today());
    e.exercisesDone = e.exercisesDone || {};
    var prev = e.reps || 0;
    e.exercisesDone[exId] = ((e.exercisesDone[exId] || 0) + 1) % 3;
    e.reps = PFStreak.repsFromExercises(e.exercisesDone, PF_EXERCISES.map(function (x) { return x.id; }));
    touch(e);
    save();
    render();
    maybeCelebrate(prev, e.reps);
    checkBadgeReveals();
  }

  // Tick state tracks position: as you leave an exercise (advance) it's ticked;
  // as you step back onto one it's unticked. So "ticked" = exercises before the
  // current position, and the day completes when you finish the last one.
  function flowAdvance() {
    var e = dayEntry(today());
    e.exercisesDone = e.exercisesDone || {};
    var exIds = PF_EXERCISES.map(function (x) { return x.id; });
    // Second full pass upgrades to 2x (gold); first pass marks 1x.
    var pass = exIds.every(function (id) { return (e.exercisesDone[id] || 0) >= 1; }) ? 2 : 1;
    var ex = PF_EXERCISES[flowIndex];
    e.exercisesDone[ex.id] = Math.max(e.exercisesDone[ex.id] || 0, pass);
    e.reps = PFStreak.repsFromExercises(e.exercisesDone, exIds);
    touch(e);
    timingCloseSegment(); // bank time for the exercise being left

    if (flowIndex < PF_EXERCISES.length - 1) {
      flowIndex += 1;
      save();
      render();
    } else {
      timingCommit();
      save();
      weekOffset = 0; // snap the strip back to the current week to show today's completion
      view = "dashboard";
      render();
      toast(e.reps >= 2 ? "Gold day — full flow ×2 ✓✓" : "Day complete ✓ Streak +1");
      maybeCelebrate(flowStartReps, e.reps); // compare vs reps when the flow opened
      checkBadgeReveals();
    }
  }

  function flowBack() {
    if (flowIndex <= 0) return;
    timingCloseSegment(); // bank time before leaving this exercise
    flowIndex -= 1;
    var ex = PF_EXERCISES[flowIndex];
    var e = dayEntry(today());
    e.exercisesDone = e.exercisesDone || {};
    e.exercisesDone[ex.id] = 0; // stepping back un-ticks the exercise you land on
    e.reps = PFStreak.repsFromExercises(e.exercisesDone, PF_EXERCISES.map(function (x) { return x.id; }));
    touch(e);
    save();
    render();
  }

  function logLift(liftId, rowEl) {
    var kgInput = rowEl.querySelector('[data-field="kg"]');
    var repsInput = rowEl.querySelector('[data-field="reps"]');
    var kg = parseFloat(kgInput.value || kgInput.placeholder);
    var reps = parseInt(repsInput.value || repsInput.placeholder, 10);
    if (!(kg >= 0) || !(reps > 0)) { toast("Enter a weight and reps"); return; }
    state.strengthLog.push({
      id: (crypto.randomUUID ? crypto.randomUUID() : String(Date.now()) + Math.random()),
      loggedAt: new Date().toISOString(),
      lift: liftId,
      weightKg: kg,
      reps: reps,
      sets: null
    });
    save();
    render();
    toast(kg + "kg × " + reps + " logged");
  }

  function logWarmup(liftId) {
    state.strengthLog.push({
      id: (crypto.randomUUID ? crypto.randomUUID() : String(Date.now()) + Math.random()),
      loggedAt: new Date().toISOString(),
      lift: liftId,
      weightKg: null,
      reps: null,
      sets: null
    });
    save();
    render();
    toast("Warm-up logged — weights unlocked");
  }

  function joinCode() {
    var input = document.getElementById("join-code");
    var code = (input.value || "").trim().toUpperCase();
    if (code.length !== 6) { toast("Enter the 6-character code"); return; }
    if (code === state.syncCode) { toast("That’s this device’s own code"); return; }
    toast("Looking up " + code + "…");
    PFStore.pullAll(code).then(function (remote) {
      if (!remote) { toast("Code not found (is the other device online?)"); return; }
      if (!confirm("Join " + code + "? This device will merge into that account and share its data.")) return;
      state.syncCode = code;
      state = PFStore.mergeRemote(state, remote);
      save();
      render();
      toast("Synced with " + code + " ✓");
    });
  }

  // ---------------- Event delegation ----------------

  document.addEventListener("click", function (ev) {
    var btn = ev.target.closest("[data-action]");
    if (!btn) return;
    var a = btn.dataset.action;

    if (a === "goto") {
      view = btn.dataset.view;
      if (view === "settings") refreshPushState(); // async; re-renders when it lands
      render();
    }
    else if (a === "start-flow") {
      flowIndex = 0;
      flowStartReps = (state.dayLog[today()] || {}).reps || 0;
      timingStart();
      view = "flow";
      render();
    }
    else if (a === "exit-flow") { flowTiming = null; view = "dashboard"; render(); }
    else if (a === "flow-advance") flowAdvance();
    else if (a === "flow-back") flowBack();
    else if (a === "hm-cell") {
      var cap = document.getElementById("hm-caption");
      if (cap) cap.textContent = captionFor(btn.dataset.date, btn.dataset.state);
      var prev = document.querySelector(".hm-cell.hm-sel");
      if (prev) prev.classList.remove("hm-sel");
      btn.classList.add("hm-sel");
    }
    else if (a === "toggle-timing") {
      state.settings.timingEnabled = !state.settings.timingEnabled;
      state.settingsUpdatedAt = new Date().toISOString();
      save(); render();
    }
    else if (a === "reset-timing") {
      if (confirm("Reset all timing averages? This can’t be undone.")) {
        state.timing = PFStore.emptyTiming();
        state.timingUpdatedAt = new Date().toISOString();
        save(); render();
        toast("Timing data reset");
      }
    }
    else if (a === "week-prev") { weekOffset -= 1; render(); }
    else if (a === "week-next") { if (weekOffset < 0) { weekOffset += 1; render(); } }
    else if (a === "cycle-day") cycleDay(btn.dataset.date);
    else if (a === "cycle-exercise") cycleExercise(btn.dataset.ex);
    else if (a === "toggle-strength") { strengthOpen = !strengthOpen; render(); }
    else if (a === "log-warmup") logWarmup(btn.dataset.lift);
    else if (a === "log-lift") logLift(btn.dataset.lift, btn.closest("[data-lift-row]"));
    else if (a === "join-code") joinCode();
    else if (a === "set-theme") {
      state.settings.theme = btn.dataset.themeVal;
      state.settingsUpdatedAt = new Date().toISOString();
      save(); render();
    }
    else if (a === "set-images") {
      state.settings.imageStyle = btn.dataset.style;
      state.settingsUpdatedAt = new Date().toISOString();
      save(); render();
    }
    else if (a === "set-celebration") {
      state.settings.celebration = btn.dataset.cel;
      state.settingsUpdatedAt = new Date().toISOString();
      save(); render();
      celebrate("normal"); // preview the chosen style (no-op when "off")
    }
    else if (a === "toggle-push") { if (pushState.subscribed) disablePush(); else enablePush(); }
    else if (a === "test-push") sendTestPush();
    else if (a === "toggle-reminders") {
      state.settings.remindersEnabled = !state.settings.remindersEnabled;
      state.settingsUpdatedAt = new Date().toISOString();
      save(); render();
    }
  });

  document.addEventListener("change", function (ev) {
    var t = ev.target;
    if (t.matches("[data-reminder-index]") && t.value) {
      state.settings.reminderTimes[Number(t.dataset.reminderIndex)] = t.value;
      state.settingsUpdatedAt = new Date().toISOString();
      save();
    }
  });

  // Keyboard navigation for the daily flow: →/space/enter advance (tick),
  // ← goes back (untick), Esc exits.
  document.addEventListener("keydown", function (ev) {
    if (view !== "flow") return;
    var k = ev.key;
    if (k === "ArrowRight" || k === " " || k === "Spacebar" || k === "Enter") {
      ev.preventDefault();
      if (document.activeElement && document.activeElement.blur) document.activeElement.blur();
      flowAdvance();
    } else if (k === "ArrowLeft") {
      ev.preventDefault();
      if (document.activeElement && document.activeElement.blur) document.activeElement.blur();
      flowBack();
    } else if (k === "Escape") {
      ev.preventDefault();
      flowTiming = null;
      view = "dashboard";
      render();
    }
  });

  document.addEventListener("pf-sync-status", function () {
    // Re-render header dot only when idle on dashboard (cheap full render)
    if (view === "dashboard") render();
  });

  // ---------------- In-app reminders (PRD §5.5) ----------------

  var reminderCounter = 0;
  setInterval(function () {
    if (!state.settings.remindersEnabled) return;
    var now = new Date();
    var hhmm = (now.getHours() < 10 ? "0" : "") + now.getHours() + ":" +
               (now.getMinutes() < 10 ? "0" : "") + now.getMinutes();
    if (state.settings.reminderTimes.indexOf(hhmm) === -1) return;
    var key = today() + " " + hhmm;
    if (firedReminders[key]) return;
    firedReminders[key] = true;
    var msg = REMINDER_MSGS[reminderCounter++ % REMINDER_MSGS.length];
    toast(msg, "reminder");
    if ("Notification" in window && Notification.permission === "granted") {
      try { new Notification("Level Up", { body: msg }); } catch (e) { /* not supported */ }
    }
  }, 20000);

  // Ask for notification permission lazily on first interaction (optional,
  // only enhances reminders while the app is open).
  document.addEventListener("click", function askOnce() {
    document.removeEventListener("click", askOnce);
    if ("Notification" in window && Notification.permission === "default") {
      try { Notification.requestPermission(); } catch (e) { /* ignore */ }
    }
  }, { once: true });

  // ---------------- Startup sync ----------------

  initBadgeBaseline(); // adopt existing history as baseline — no retroactive flood
  refreshPushState(); // warm the push-toggle state before Settings is opened
  render();

  if (PFStore.isConfigured()) {
    PFStore.pullAll(state.syncCode).then(function (remote) {
      if (remote) {
        state = PFStore.mergeRemote(state, remote);
        save();
        initBadgeBaseline(); // re-baseline against merged remote history
      } else {
        PFStore.pushAll(state); // first run: create the row
      }
      render();
    });
  }
})();
