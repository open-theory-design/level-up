// Level Up — persistence + zero-login sync (PRD §2.1, §7)
// Source of truth is localStorage; Supabase (when configured in config.js)
// mirrors it under the 6-char sync code. Conflict policy: last-write-wins,
// applied per logical day / per strength entry (PRD §2.1 accepted trade-off).

(function () {
  "use strict";

  var LS_KEY = "postureflow_state_v1";
  var PUSH_DEBOUNCE_MS = 1500;

  // No ambiguous chars (0/O, 1/I/L)
  var CODE_CHARS = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";

  function genSyncCode() {
    var out = "";
    var rnd = new Uint32Array(6);
    (window.crypto || {}).getRandomValues
      ? crypto.getRandomValues(rnd)
      : rnd.forEach(function (_, i) { rnd[i] = Math.floor(Math.random() * 1e9); });
    for (var i = 0; i < 6; i++) out += CODE_CHARS[rnd[i] % CODE_CHARS.length];
    return out;
  }

  function defaultState() {
    return {
      syncCode: genSyncCode(),
      createdAt: new Date().toISOString(),
      settingsUpdatedAt: new Date().toISOString(),
      settings: {
        imageStyle: "illustrations", // "illustrations" | "photos" | "color"
        remindersEnabled: true,
        reminderTimes: ["11:00", "15:00"],
        timingEnabled: true, // when on at finish, the flow's duration is recorded
        celebration: "stamp" // off | stamp | confetti | ripple (day-completion animation)
      },
      // dayLog: { "YYYY-MM-DD": { reps: 0|1|2, exercisesDone: {exId: 0|1|2}, updatedAt } }
      dayLog: {},
      // strengthLog: [{ id, loggedAt, lift, weightKg, reps, sets }]
      strengthLog: [],
      // Accumulated flow timing; syncs across devices (last-write-wins by
      // timingUpdatedAt, per the app's single-user LWW model).
      timing: emptyTiming(),
      timingUpdatedAt: new Date().toISOString(),
      // Badge ids already revealed to the user — for one-time unlock detection.
      // Union-merged on sync (never un-see a badge).
      badgesSeen: []
    };
  }

  function emptyTiming() {
    return {
      timedSessions: 0,   // completed, timing-enabled flows
      totalMs: 0,         // summed total durations
      lastTotalMs: null,
      bestTotalMs: null,
      ex: {}              // exId -> { ms, n } for per-exercise averages
    };
  }

  function load() {
    try {
      var raw = localStorage.getItem(LS_KEY);
      if (raw) {
        var s = JSON.parse(raw);
        // Backfill any fields added since first install
        var d = defaultState();
        s.settings = Object.assign(d.settings, s.settings || {});
        s.dayLog = s.dayLog || {};
        s.strengthLog = s.strengthLog || [];
        s.syncCode = s.syncCode || d.syncCode;
        s.timing = Object.assign(emptyTiming(), s.timing || {});
        s.timingUpdatedAt = s.timingUpdatedAt || d.timingUpdatedAt;
        s.badgesSeen = s.badgesSeen || [];
        return s;
      }
    } catch (e) { /* corrupted state -> start fresh */ }
    var fresh = defaultState();
    localStorage.setItem(LS_KEY, JSON.stringify(fresh));
    return fresh;
  }

  // ---------------- Supabase ----------------

  var cfg = window.POSTUREFLOW_CONFIG || {};
  var configured =
    cfg.SUPABASE_URL && cfg.SUPABASE_ANON_KEY &&
    cfg.SUPABASE_URL.indexOf("PASTE_") === -1 &&
    cfg.SUPABASE_ANON_KEY.indexOf("PASTE_") === -1 &&
    window.supabase && typeof window.supabase.createClient === "function";

  var client = configured
    ? window.supabase.createClient(cfg.SUPABASE_URL, cfg.SUPABASE_ANON_KEY)
    : null;

  var pushTimer = null;
  var syncStatus = configured ? "idle" : "local-only"; // local-only | idle | syncing | error

  function lifetimeFor(state, derived) {
    return {
      total_sessions: derived.totalSessions,
      total_completed_days: derived.totalCompleted,
      total_gold_days: derived.goldDays,
      total_bonus_days: derived.bonusDaysDone,
      longest_streak: derived.longestStreak,
      freezes_earned: derived.freezesEarned,
      freezes_used: derived.freezesUsed,
      exercise_counts: derived.exCounts
    };
  }

  function pushAll(state) {
    if (!client) return Promise.resolve(false);
    syncStatus = "syncing";
    var todayStr = PFStreak.logicalDateStr(new Date());
    var derived = PFStreak.computeDerived(state.dayLog, todayStr);

    var profileRow = {
      sync_code: state.syncCode,
      created_at: state.createdAt,
      updated_at: new Date().toISOString(),
      settings: state.settings,
      freezes: derived.freezes,
      earn_counter: derived.earnCounter,
      lifetime: lifetimeFor(state, derived),
      timing: state.timing,
      timing_updated_at: state.timingUpdatedAt,
      badges_seen: state.badgesSeen || []
    };

    var dayRows = Object.keys(state.dayLog).map(function (d) {
      var e = state.dayLog[d];
      return {
        sync_code: state.syncCode,
        log_date: d,
        reps: e.reps || 0,
        is_required: PFStreak.isRequired(d),
        freeze_used: !!derived.freezeDays[d],
        exercises_done: e.exercisesDone || {},
        updated_at: e.updatedAt || new Date().toISOString()
      };
    });

    var liftRows = state.strengthLog.map(function (r) {
      return {
        id: r.id,
        sync_code: state.syncCode,
        logged_at: r.loggedAt,
        lift: r.lift,
        weight_kg: r.weightKg,
        reps: r.reps,
        sets: r.sets || null
      };
    });

    return client.from("profile").upsert(profileRow)
      .then(function (res) {
        if (res.error) throw res.error;
        return dayRows.length ? client.from("day_log").upsert(dayRows) : { error: null };
      })
      .then(function (res) {
        if (res.error) throw res.error;
        return liftRows.length ? client.from("strength_log").upsert(liftRows) : { error: null };
      })
      .then(function (res) {
        if (res.error) throw res.error;
        syncStatus = "idle";
        return true;
      })
      .catch(function () {
        syncStatus = "error";
        return false;
      });
  }

  function pullAll(code) {
    if (!client) return Promise.resolve(null);
    var out = {};
    return client.from("profile").select("*").eq("sync_code", code).maybeSingle()
      .then(function (res) {
        if (res.error || !res.data) return null;
        out.profile = res.data;
        return client.from("day_log").select("*").eq("sync_code", code)
          .then(function (dr) {
            out.days = dr.data || [];
            return client.from("strength_log").select("*").eq("sync_code", code);
          })
          .then(function (sr) {
            out.lifts = sr.data || [];
            return out;
          });
      })
      .catch(function () { return null; });
  }

  // Merge a pulled remote snapshot into local state.
  // Per-day and per-entry last-write-wins by updated_at (PRD §2.1).
  function mergeRemote(state, remote) {
    if (!remote || !remote.profile) return state;
    var p = remote.profile;

    if (!state.settingsUpdatedAt || (p.updated_at && p.updated_at > state.settingsUpdatedAt)) {
      state.settings = Object.assign(state.settings, p.settings || {});
      state.settingsUpdatedAt = p.updated_at;
    }
    if (p.created_at && p.created_at < state.createdAt) state.createdAt = p.created_at;

    // Timing: whole-object last-write-wins by timing_updated_at.
    if (p.timing && p.timing_updated_at &&
        (!state.timingUpdatedAt || p.timing_updated_at > state.timingUpdatedAt)) {
      state.timing = p.timing;
      state.timingUpdatedAt = p.timing_updated_at;
    }

    // badgesSeen: union merge (seen-ness is monotonic — never un-see).
    if (p.badges_seen && p.badges_seen.length) {
      var seen = {};
      (state.badgesSeen || []).concat(p.badges_seen).forEach(function (id) { seen[id] = true; });
      state.badgesSeen = Object.keys(seen);
    }

    (remote.days || []).forEach(function (row) {
      var local = state.dayLog[row.log_date];
      var remoteAt = row.updated_at || "";
      if (!local || (remoteAt && remoteAt > (local.updatedAt || ""))) {
        state.dayLog[row.log_date] = {
          reps: row.reps || 0,
          exercisesDone: row.exercises_done || {},
          updatedAt: remoteAt
        };
      }
    });

    var haveIds = {};
    state.strengthLog.forEach(function (r) { haveIds[r.id] = true; });
    (remote.lifts || []).forEach(function (row) {
      if (haveIds[row.id]) return;
      state.strengthLog.push({
        id: row.id,
        loggedAt: row.logged_at,
        lift: row.lift,
        weightKg: row.weight_kg == null ? null : Number(row.weight_kg),
        reps: row.reps,
        sets: row.sets
      });
    });
    state.strengthLog.sort(function (a, b) { return a.loggedAt < b.loggedAt ? -1 : 1; });
    return state;
  }

  window.PFStore = {
    load: load,
    save: function (state) {
      localStorage.setItem(LS_KEY, JSON.stringify(state));
      if (client) {
        clearTimeout(pushTimer);
        pushTimer = setTimeout(function () {
          pushAll(state).then(function () {
            document.dispatchEvent(new CustomEvent("pf-sync-status"));
          });
        }, PUSH_DEBOUNCE_MS);
      }
    },
    pullAll: pullAll,
    pushAll: pushAll,
    mergeRemote: mergeRemote,
    genSyncCode: genSyncCode,
    emptyTiming: emptyTiming,
    isConfigured: function () { return !!client; },
    status: function () { return syncStatus; }
  };
})();
