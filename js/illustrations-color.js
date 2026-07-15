// Level Up — "Color" illustration set (third image style).
// Flat, friendly colored figures in the app palette, matching the reference
// exercise-illustration style. Bundled SVG (no external assets), one per
// exercise, keyed by exercise id. Selected via Settings → Image style → Color.

(function () {
  "use strict";

  var SKIN = "#E9B48D";
  var HAIR = "#2B2F38";
  var TOP = "#0C6B66";  // tank top (deep teal)
  var BOT = "#0FB0A2";  // shorts (teal)
  var SHOE = "#22303F";
  var PROP = "#D9DFE4";  // walls, tables, benches
  var ACC = "#15AFA6";  // motion arrows (turquoise)
  var FLOOR = "#E2E7EB";

  function limb(d, color, w) {
    return '<path d="' + d + '" fill="none" stroke="' + color +
      '" stroke-width="' + (w || 12) + '" stroke-linecap="round" stroke-linejoin="round"/>';
  }
  function head(cx, cy, r, dir) {
    r = r || 15; dir = dir || 0;
    return (
      '<circle cx="' + cx + '" cy="' + cy + '" r="' + r + '" fill="' + HAIR + '"/>' +
      '<ellipse cx="' + (cx + dir * 3) + '" cy="' + (cy + 3) + '" rx="' + (r - 4) + '" ry="' + (r - 2) + '" fill="' + SKIN + '"/>'
    );
  }
  function shoe(cx, cy, dir) {
    dir = dir || 1;
    return '<path d="M' + cx + ' ' + (cy - 4) + ' q' + (dir * 12) + ' 0 ' + (dir * 12) + ' 5 l' + (-dir * 14) + ' 0 z" fill="' + SHOE + '"/>';
  }
  function floor() {
    return '<line x1="24" y1="152" x2="216" y2="152" stroke="' + FLOOR + '" stroke-width="4" stroke-linecap="round"/>';
  }
  function arrow(d) {
    return '<path d="' + d + '" fill="none" stroke="' + ACC + '" stroke-width="4" stroke-linecap="round" stroke-linejoin="round" marker-mid="url(#pfa)"/>';
  }
  function svg(inner) {
    return '<svg viewBox="0 0 240 170" xmlns="http://www.w3.org/2000/svg" role="img">' +
      '<defs><marker id="pfa" markerWidth="7" markerHeight="7" refX="4" refY="3.2" orient="auto">' +
      '<path d="M0 0 L6 3.2 L0 6.4 z" fill="' + ACC + '"/></marker></defs>' + inner + "</svg>";
  }

  var ART = {
    // 1. Lat Stretch — kneeling, forearms reaching onto a chair, hips back.
    lat_stretch: svg(
      floor() +
      '<rect x="188" y="96" width="10" height="56" rx="2" fill="' + PROP + '"/>' +
      '<rect x="168" y="96" width="34" height="9" rx="3" fill="' + PROP + '"/>' +
      limb("M96 150 L112 128", SKIN, 13) +        // shin on floor (knee down)
      limb("M112 128 L150 108", TOP, 24) +         // torso, flat back
      limb("M150 108 L186 112", SKIN, 12) +        // arms reaching to chair
      head(160, 108, 12, 1) +
      arrow("M92 96 L108 108 L120 116")            // hips-back cue
    ),

    // 2. Pec Stretch — standing, forearm on doorframe, chest opening.
    pec_stretch: svg(
      floor() +
      '<rect x="196" y="18" width="10" height="134" rx="3" fill="' + PROP + '"/>' +
      head(148, 50, 15, 1) +
      limb("M148 64 L154 104", TOP, 24) +
      limb("M154 104 L146 150", SKIN, 13) + limb("M154 104 L168 150", SKIN, 13) +
      shoe(146, 150, -1) + shoe(168, 150, 1) +
      limb("M154 72 L184 70 L182 46", SKIN, 12) +  // arm up on frame
      limb("M148 72 L138 100", SKIN, 12) +
      arrow("M138 60 Q126 66 130 82")
    ),

    // 3. Neck Stretch — seated cross-legged, hand over head to opposite ear.
    neck_stretch: svg(
      head(124, 46, 15, 0) +
      limb("M124 60 L120 98", TOP, 24) +
      '<path d="M92 116 Q120 104 148 116 Q120 128 92 116 z" fill="' + BOT + '"/>' +  // crossed legs
      limb("M114 66 L102 40 L120 34", SKIN, 11) +  // arm over head
      limb("M132 68 L142 96", SKIN, 11) +
      arrow("M150 46 Q158 60 148 74")
    ),

    // 4. Wall Angels — front view, arms in the "W/goalpost" position.
    wall_angels: svg(
      '<rect x="72" y="14" width="96" height="140" rx="10" fill="#EEF2F5"/>' +
      floor() +
      head(120, 46, 16, 0) +
      limb("M120 62 L120 104", TOP, 26) +
      limb("M120 104 L120 112", BOT, 26) +
      limb("M112 112 L108 150", SKIN, 13) + limb("M128 112 L132 150", SKIN, 13) +
      shoe(108, 150, -1) + shoe(132, 150, 1) +
      limb("M108 66 L92 78 L96 50", SKIN, 12) +   // left arm goalpost
      limb("M132 66 L148 78 L144 50", SKIN, 12) + // right arm goalpost
      arrow("M120 132 L120 122")
    ),

    // 5. Chin Tucks — profile bust, chin retracting straight back.
    chin_tucks: svg(
      limb("M64 142 L150 142", TOP, 26) +          // shoulders
      limb("M120 142 L120 112", SKIN, 15) +        // neck
      head(116, 88, 24, 1) +
      '<path d="M139 86 l9 4 -9 4 z" fill="' + SKIN + '"/>' +  // nose
      arrow("M180 90 L164 90 L150 90")             // push back
    ),

    // 6. Band Raises. NOTE: this drawing still depicts external rotations (elbow
    // tucked, forearm rotating out) — it does not match the "Band Raises" name/cue
    // or the line-art set. Redraw to both-arms-overhead-with-band to fully match.
    band_raises: svg(
      floor() +
      '<rect x="198" y="18" width="9" height="134" rx="3" fill="' + PROP + '"/>' +
      head(146, 48, 15, 1) +
      limb("M146 62 L146 104", TOP, 24) +
      limb("M146 104 L138 150", SKIN, 13) + limb("M146 104 L158 150", SKIN, 13) +
      shoe(138, 150, -1) + shoe(158, 150, 1) +
      limb("M146 74 L146 92 L186 92", SKIN, 12) +  // elbow tucked, forearm forward
      '<rect x="182" y="84" width="12" height="16" rx="2" fill="' + PROP + '"/>' +  // towel/fist
      limb("M146 74 L132 100", SKIN, 12) +
      arrow("M176 74 Q190 82 186 96")
    ),

    // 7. Kneeling Psoas Stretch — half-kneeling lunge, hip driven forward.
    psoas_stretch: svg(
      floor() +
      limb("M120 98 L150 122 L150 150", SKIN, 13) + // front leg planted
      shoe(150, 150, 1) +
      limb("M120 98 L98 148", SKIN, 13) +            // back knee down
      limb("M98 148 L80 151", SKIN, 12) +            // rear shin
      limb("M120 98 L126 60", TOP, 24) +             // torso upright
      head(128, 48, 14, 1) +
      limb("M126 68 L150 110", SKIN, 11) +           // hand to front knee
      limb("M126 68 L112 94", SKIN, 11) +
      arrow("M108 108 L124 104 L138 100")            // hip-forward cue
    ),

    // 8. Cat/Cow — all fours, arched (cat) with cow alternate dashed.
    cat_cow: svg(
      floor() +
      limb("M80 96 L80 148", SKIN, 13) +             // front legs
      limb("M150 96 L150 148", SKIN, 13) +           // back legs
      '<path d="M80 96 Q115 70 150 96" fill="none" stroke="' + BOT + '" stroke-dasharray="8 8" stroke-width="8" stroke-linecap="round"/>' +
      limb("M80 96 Q115 118 150 96", TOP, 24) +      // cow (belly down) as the solid pose
      head(70, 104, 12, -1) +
      arrow("M115 70 L115 84")
    ),

    // 9. Planks — forearm plank, straight line shoulder to ankle.
    planks: svg(
      floor() +
      limb("M62 146 L94 146", SKIN, 12) +            // forearm on floor
      limb("M94 146 L98 120", SKIN, 12) +            // upper arm to shoulder
      limb("M98 120 L172 140", TOP, 24) +            // straight torso
      limb("M172 140 L196 150", SKIN, 13) +          // legs to feet
      head(88, 116, 12, 1)
    ),

    // 10. Bird Dogs — all fours, opposite arm + leg extended level.
    bird_dogs: svg(
      floor() +
      limb("M96 98 L96 148", SKIN, 13) +             // support arm
      limb("M150 98 L150 148", SKIN, 13) +           // support knee
      limb("M96 98 L150 98", TOP, 24) +              // flat torso
      limb("M96 98 L56 84", SKIN, 12) +              // extended arm
      limb("M150 98 L192 84", SKIN, 12) +            // extended leg
      head(86, 94, 12, -1)
    ),

    // 11. Banded Clamshells — side-lying, banded top knee opening up.
    clamshells: svg(
      floor() +
      head(58, 122, 13, 1) +
      limb("M74 128 L128 132", TOP, 24) +            // torso lying
      limb("M128 132 L152 142 L176 142", SKIN, 13) + // bottom leg
      limb("M128 130 L150 118 L172 128", SKIN, 12) + // top leg lifted
      '<path d="M146 138 q6 -8 8 -16" fill="none" stroke="' + ACC + '" stroke-width="3.5"/>' +
      '<path d="M150 142 q7 -9 9 -18" fill="none" stroke="' + ACC + '" stroke-width="3.5"/>' +  // band
      arrow("M176 118 Q182 128 176 138")
    ),

    // 12. Leg-Out Hip Thrust — shoulders on bench, hips high, one leg out.
    hip_thrusts: svg(
      floor() +
      '<rect x="44" y="98" width="34" height="14" rx="3" fill="' + PROP + '"/>' +
      head(56, 90, 12, 1) +
      limb("M66 100 L120 96", TOP, 24) +             // torso, hips lifted
      limb("M120 96 L150 118 L150 150", SKIN, 13) +  // planted leg
      shoe(150, 150, 1) +
      limb("M120 96 L178 110", SKIN, 13) +           // extended leg out
      arrow("M120 126 L120 110")                     // drive-up cue
    )
  };

  window.PF_COLOR_ART = ART;
})();
