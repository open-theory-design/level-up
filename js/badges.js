// Level Up — milestones / badges (BUILD-SPEC §2)
// All thresholds derive from the streak engine's derived result, so badges are
// recomputed on every load and stay honest through retroactive edits. Badges
// are cosmetic only (Open Decision D3). Icons are inline SVG (zero-dependency;
// the app ships no icon font).

(function () {
  "use strict";

  // 24x24 stroke icons (currentColor), Tabler-inspired to match the spec.
  var ICONS = {
    medal: '<path d="M8 3h8l-2.5 6.5M8 3l2.5 6.5M8 3 5 3l3.5 8"/><circle cx="12" cy="15" r="6"/><path d="M12 12.2l1 2 2 .2-1.5 1.4.4 2-1.9-1-1.9 1 .4-2L9 14.4l2-.2z"/>',
    flame: '<path d="M12 3c1 3 4 4 4 8a4 4 0 0 1-8 0c0-1.5.5-2.5 1-3 .3 1 .8 1.5 1.5 1.8C10 8 10.5 5 12 3z"/>',
    bolt: '<path d="M13 3 5 13h5l-1 8 8-11h-5l1-7z"/>',
    calendar: '<rect x="4" y="5" width="16" height="16" rx="2"/><path d="M4 9h16M8 3v4M16 3v4"/><path d="M8.5 16l1.5 1.5 2.5-3"/>',
    rotate: '<path d="M20 12a8 8 0 1 1-2.3-5.6"/><path d="M20 4v4h-4"/>',
    lock: '<rect x="5" y="11" width="14" height="9" rx="2"/><path d="M8 11V8a4 4 0 0 1 8 0v3"/>'
  };
  function icon(name) {
    return '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" ' +
      'stroke-linecap="round" stroke-linejoin="round">' + (ICONS[name] || "") + "</svg>";
  }

  // dimension -> { key for derived value, color class, icon, tiers[], names[] }
  var DIMENSIONS = [
    {
      dim: "sessions", value: "totalSessions", color: "slate", icon: "medal",
      tiers: [25, 100, 250, 500, 1000],
      names: ["Getting going", "Century", "250 club", "500 club", "Iron habit"],
      unit: "sessions"
    },
    {
      dim: "streak", value: "longestStreak", color: "teal", icon: "flame",
      tiers: [7, 14, 30, 60, 100],
      names: ["First week", "Fortnight", "Month strong", "Two months", "Centurion"],
      unit: "day streak"
    },
    {
      dim: "gold", value: "goldDays", color: "gold", icon: "bolt",
      tiers: [5, 10, 25, 50],
      names: ["Overachiever", "Double gold", "Gold 25", "Gold 50"],
      unit: "2× days"
    },
    {
      dim: "perfect_week", value: "perfectWeeks", color: "slate", icon: "calendar",
      tiers: [1, 4, 12, 26],
      names: ["Perfect week", "Perfect month", "Perfect quarter", "Half-year perfect"],
      unit: "perfect weeks"
    }
  ];

  var COMEBACK = { dim: "comeback", color: "teal", icon: "rotate", name: "Comeback", desc: "Rebuild a 7-day streak after a reset" };

  // Returns { earnedIds: Set-like {}, badges: [ {id,name,color,icon,threshold,unit,status,current} ] }
  // status: "earned" | "in-progress" | "locked". Per dimension: all earned tiers
  // as earned badges + the single next tier as in-progress (further tiers hidden).
  function compute(derived) {
    var earnedIds = {};
    var badges = [];

    DIMENSIONS.forEach(function (dm) {
      var val = derived[dm.value] || 0;
      var shownNext = false;
      dm.tiers.forEach(function (th, i) {
        var id = dm.dim + "_" + th;
        if (val >= th) {
          earnedIds[id] = true;
          badges.push({
            id: id, dim: dm.dim, name: dm.names[i], color: dm.color, icon: dm.icon,
            threshold: th, unit: dm.unit, status: "earned"
          });
        } else if (!shownNext) {
          shownNext = true; // only the next unearned tier shows as in-progress
          badges.push({
            id: id, dim: dm.dim, name: dm.names[i], color: dm.color, icon: dm.icon,
            threshold: th, unit: dm.unit, status: "in-progress", current: val
          });
        }
      });
    });

    // Comeback: one-off.
    if (derived.comeback) {
      earnedIds["comeback"] = true;
      badges.push({
        id: "comeback", dim: "comeback", name: COMEBACK.name, color: COMEBACK.color,
        icon: COMEBACK.icon, desc: COMEBACK.desc, status: "earned"
      });
    } else {
      badges.push({
        id: "comeback", dim: "comeback", name: COMEBACK.name, color: "muted",
        icon: COMEBACK.icon, desc: COMEBACK.desc, status: "locked"
      });
    }

    return { earnedIds: earnedIds, badges: badges };
  }

  window.PFBadges = {
    compute: compute,
    icon: icon,
    lockIcon: function () { return icon("lock"); }
  };
})();
