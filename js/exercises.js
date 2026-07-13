// Level Up — exercise catalog (PRD §5.3, §5.6, §6)
// Two bundled image sets: "illustrations" (inline SVG line art, clinical style)
// and "photos" (drop a file at photos/<id>.jpg to fill a slot; until then a
// flagged placeholder renders — niche moves have no free coverage, PRD §5.6).

(function () {
  "use strict";

  var S = 'fill="none" stroke="#2B4C7E" stroke-width="5" stroke-linecap="round" stroke-linejoin="round"';
  var T = 'fill="none" stroke="#00A896" stroke-width="4" stroke-linecap="round" stroke-linejoin="round"';
  var G = 'stroke="#D7DDE3" stroke-width="3" stroke-linecap="round"';

  function svg(inner) {
    return '<svg viewBox="0 0 240 150" xmlns="http://www.w3.org/2000/svg" role="img">' + inner + "</svg>";
  }

  var ILLUST = {
    // Kneeling forward fold: table set out in front, arms reaching across to it.
    lat_stretch: svg(
      '<line x1="20" y1="134" x2="220" y2="134" ' + G + "/>" +
      '<path d="M14 100 h48 M20 100 v34 M56 100 v34" ' + T + "/>" +  // table, set away
      '<path d="M116 104 L58 100" ' + S + "/>" +                     // arms reaching to table
      '<circle cx="106" cy="116" r="10" ' + S + "/>" +              // head hanging
      '<path d="M116 104 L152 120" ' + S + "/>" +                    // torso to hips
      '<path d="M152 120 L152 134 M152 134 L174 132" ' + S + "/>"    // thigh + shin (kneeling)
    ),
    // Forearm anchored on the doorframe, body leans/steps forward to open chest.
    pec_stretch: svg(
      '<line x1="20" y1="134" x2="220" y2="134" ' + G + "/>" +
      '<path d="M198 16 v118" ' + T + "/>" +                          // doorframe
      '<circle cx="140" cy="40" r="11" ' + S + "/>" +
      '<path d="M140 51 L150 104" ' + S + "/>" +                      // torso, forward lean
      '<path d="M150 104 L168 132 M150 104 L146 132" ' + S + "/>" +   // stride: front foot forward
      '<path d="M142 58 L186 62 L186 38" ' + S + "/>" +               // arm bent 90° on frame
      '<path d="M142 58 L128 86" ' + S + "/>"                        // other arm
    ),
    // Head tilted toward the shoulder; the arm arcs up and around the crown,
    // hand reaching to the far side to pull gently.
    neck_stretch: svg(
      '<line x1="20" y1="134" x2="220" y2="134" ' + G + "/>" +
      '<circle cx="130" cy="50" r="11" ' + S + "/>" +                // head, close to body
      '<path d="M121 70 L126 59" ' + S + "/>" +                       // short neck
      '<path d="M120 70 L120 106" ' + S + "/>" +                      // torso
      '<path d="M120 106 L112 132 M120 106 L129 132" ' + S + "/>" +   // legs
      '<path d="M122 72 L146 34 Q130 20 115 42" ' + S + "/>" +        // arm up, forearm arcs over crown
      '<path d="M120 74 L104 100" ' + S + "/>" +                      // other arm down
      '<path d="M139 60 q7 11 -1 20 M137 80 l-5 -3 M137 80 l5 -4" ' + T + "/>"  // pull toward shoulder
    ),
    // Front view "W", sliding arms up and down. No wall line needed.
    wall_angels: svg(
      '<line x1="20" y1="134" x2="220" y2="134" ' + G + "/>" +
      '<circle cx="120" cy="40" r="12" ' + S + "/>" +
      '<path d="M120 52 L120 96" ' + S + "/>" +
      '<path d="M120 96 L110 132 M120 96 L130 132" ' + S + "/>" +
      '<path d="M120 60 L98 68 L102 42" ' + S + "/>" +                // left arm goalpost
      '<path d="M120 60 L142 68 L138 42" ' + S + "/>" +              // right arm goalpost
      '<path d="M168 52 L168 88 M168 52 l-5 8 M168 52 l5 8 M168 88 l-5 -8 M168 88 l5 -8" ' + T + "/>"
    ),
    // Side profile; face points right, so the "pull back" arrow sits behind the
    // head (left) with its head at the end of the line, pointing back.
    chin_tucks: svg(
      '<circle cx="118" cy="62" r="26" ' + S + "/>" +
      '<path d="M144 58 l8 6 -8 5" ' + S + "/>" +
      '<path d="M112 88 L108 112 M108 112 L60 124 M108 112 L160 122" ' + S + "/>" +
      '<path d="M82 44 L48 44 M48 44 l10 -6 M48 44 l10 6" ' + T + "/>"
    ),
    // Hold a band in both hands and raise/lower both arms together.
    external_rotations: svg(
      '<line x1="20" y1="134" x2="220" y2="134" ' + G + "/>" +
      '<circle cx="120" cy="38" r="11" ' + S + "/>" +
      '<path d="M120 49 L120 96" ' + S + "/>" +
      '<path d="M120 96 L110 132 M120 96 L130 132" ' + S + "/>" +
      '<path d="M120 58 L92 48" ' + S + "/>" +                        // left arm up
      '<path d="M120 58 L148 48" ' + S + "/>" +                       // right arm up
      '<path d="M92 48 Q120 58 148 48" ' + T + "/>" +                 // band between hands
      '<path d="M170 46 L170 80 M170 46 l-5 8 M170 46 l5 8 M170 80 l-5 -8 M170 80 l5 -8" ' + T + "/>"
    ),
    // Half-kneeling lunge; clean forward arrow for the hip drive.
    psoas_stretch: svg(
      '<line x1="20" y1="134" x2="220" y2="134" ' + G + "/>" +
      '<circle cx="122" cy="48" r="11" ' + S + "/>" +
      '<path d="M122 59 L120 96" ' + S + "/>" +                       // torso upright
      '<path d="M120 96 L148 116 L148 134" ' + S + "/>" +            // front leg planted
      '<path d="M120 96 L96 130 M96 130 L80 134" ' + S + "/>" +      // back leg kneeling
      '<path d="M121 66 L146 106" ' + S + "/>" +                      // arm to front thigh
      '<path d="M121 66 L104 90" ' + S + "/>" +                       // other arm
      '<path d="M100 108 L132 108 M132 108 l-9 -5 M132 108 l-9 5" ' + T + "/>"  // hip-forward
    ),
    // Arched (cat) + sagging dashed (cow), with an up/down motion arrow.
    cat_cow: svg(
      '<line x1="20" y1="134" x2="220" y2="134" ' + G + "/>" +
      '<path d="M84 94 L84 132 M156 94 L156 132" ' + S + "/>" +      // fore/hind legs
      '<circle cx="72" cy="100" r="10" ' + S + "/>" +                // head down
      '<path d="M84 94 Q120 68 156 94" ' + S + "/>" +                // cat (arched up)
      '<path d="M84 98 Q120 116 156 98" fill="none" stroke="#00A896" stroke-width="4" stroke-dasharray="7 8" stroke-linecap="round"/>' +  // cow (sag)
      '<path d="M120 76 L120 110 M120 76 l-5 8 M120 76 l5 8 M120 110 l-5 -8 M120 110 l5 -8" ' + T + "/>"
    ),
    planks: svg(
      '<line x1="20" y1="134" x2="220" y2="134" ' + G + "/>" +
      '<circle cx="60" cy="88" r="11" ' + S + "/>" +
      '<path d="M70 96 L196 122" ' + S + "/>" +
      '<path d="M78 98 L70 126 L48 126" ' + S + "/>" +
      '<path d="M196 122 L206 132" ' + S + "/>"
    ),
    bird_dogs: svg(
      '<line x1="20" y1="134" x2="220" y2="134" ' + G + "/>" +
      '<path d="M96 92 L158 92" ' + S + "/>" +
      '<path d="M100 92 L100 132 M152 92 L152 132" ' + S + "/>" +
      '<circle cx="84" cy="86" r="11" ' + S + "/>" +
      '<path d="M96 92 L44 78" ' + T + "/>" +
      '<path d="M158 92 L212 78" ' + T + "/>"
    ),
    // Side-lying, feet together; thighs fan open to stacked knees (the "clam").
    clamshells: svg(
      '<line x1="20" y1="134" x2="220" y2="134" ' + G + "/>" +
      '<circle cx="50" cy="116" r="10" ' + S + "/>" +               // head resting
      '<path d="M62 120 L116 122" ' + S + "/>" +                     // torso on side
      '<path d="M116 122 L138 128 L150 134" ' + S + "/>" +          // bottom leg: hip->knee->foot
      '<path d="M116 122 L140 108 L150 134" ' + S + "/>" +          // top leg: knee lifted open
      '<path d="M138 128 L140 108" ' + T + "/>" +                    // band across the knees
      '<path d="M150 122 Q176 106 158 86" ' + T + "/>" +             // rotation shaft (knee opens up)
      '<path d="M158 86 l-6 9 M158 86 l8 5" ' + T + "/>"             // arrowhead at the end
    ),
    // Floor glute bridge: shoulders down, hips lifted, one leg extended out.
    hip_thrusts: svg(
      '<line x1="20" y1="134" x2="220" y2="134" ' + G + "/>" +
      '<circle cx="52" cy="126" r="9" ' + S + "/>" +               // head/shoulders on floor
      '<path d="M62 128 L112 108" ' + S + "/>" +                     // torso up to lifted hips
      '<path d="M112 108 L140 110 L140 134" ' + S + "/>" +          // planted leg
      '<path d="M112 108 L170 120" ' + S + "/>" +                    // extended leg out
      '<path d="M112 130 L112 114 M112 114 l-5 8 M112 114 l5 8" ' + T + "/>"  // drive up
    )
  };

  // Daily flow — fixed, authoritative sequence (PRD §5.3).
  window.PF_EXERCISES = [
    { id: "lat_stretch",        name: "Lat Stretch",                 dose: "self-paced",         cue: "Elbows on table, elbows tucked inward." },
    { id: "pec_stretch",        name: "Pec Stretch",                 dose: "self-paced",         cue: "Keep shoulders down away from ears. Don’t force the joint." },
    { id: "neck_stretch",       name: "Neck Stretch",                dose: "self-paced",         cue: "Drop the opposite arm all the way down, tilt head sideways, then gently twist chin downward." },
    { id: "wall_angels",        name: "Wall Angels",                 dose: "self-paced",         cue: "Press your lower back flat against the wall. Don’t let your ribs flare out.", nicheStock: true },
    { id: "chin_tucks",         name: "Chin Tucks",                  dose: "hold 3–5s",     cue: "Pull your head straight back like making a double chin." },
    { id: "external_rotations", name: "Band Raises",                 dose: "self-paced",         cue: "Hold a band with both hands and raise both arms up, then lower with control. Keep the band under tension throughout.", nicheStock: true },
    { id: "psoas_stretch",      name: "Kneeling Psoas Stretch",      dose: "2 × 45s per leg", cue: "Squeeze the glute of the stretching leg to push the hip forward. Don’t arch your lower back." },
    { id: "cat_cow",            name: "Cat/Cow",                     dose: "10 slow transitions", cue: "Move slowly through your full spinal range of motion." },
    { id: "planks",             name: "Planks / Half Side Planks",   dose: "3 × 30–45s", cue: "Tuck your tailbone, squeeze your glutes, pull elbows toward toes. No sagging lower back." },
    { id: "bird_dogs",          name: "Bird Dogs",                   dose: "2 × 10 per side", cue: "Torso perfectly still like a tabletop. Move slowly." },
    { id: "clamshells",         name: "Banded Clamshells",           dose: "2 × 15 per side", cue: "Don’t rotate your torso. Isolate the burn to the side of your glute.", nicheStock: true },
    { id: "hip_thrusts",        name: "Leg-Out Hip Thrusts",         dose: "2 × 12 per leg",  cue: "Drive through your heel. Keep your gaze forward, not at the ceiling." }
  ];

  // Ad-hoc strength bank — fixed order, warm-up gate first (PRD §6).
  window.PF_LIFTS = [
    { id: "ytw",        name: "YTWs",                                warmup: true },
    { id: "face_pull",  name: "Face Pulls",                          warmup: true },
    { id: "hip_thrust", name: "Weighted Hip Thrusts / Glute Bridges" },
    { id: "squat",      name: "Squats" },
    { id: "deadlift",   name: "Deadlifts" }
  ];

  window.PF_IMAGES = {
    illustration: function (exId) {
      return ILLUST[exId] || "";
    },
    // "Color" set — bundled flat colored figures (js/illustrations-color.js).
    color: function (exId) {
      return (window.PF_COLOR_ART || {})[exId] || ILLUST[exId] || "";
    },
    // Photo set: an <img> pointing at photos/<id>.jpg. If the file is absent
    // (paid-stock placeholder slots), the onerror handler swaps in the
    // flagged placeholder card (PRD §5.6).
    photoHTML: function (ex) {
      var tag = ex.nicheStock ? "Paid-stock placeholder" : "Openly-licensed slot";
      var ph =
        '<div class="photo-ph"><span class="cam">📷</span>' +
        "Photo of " + ex.name + "<br>Add <code>photos/" + ex.id + ".jpg</code> to fill this slot" +
        '<br><span class="tag">' + tag + " — replaceable</span></div>";
      return (
        '<img src="photos/' + ex.id + '.jpg" alt="' + ex.name + '" ' +
        "onerror=\"this.outerHTML=this.nextElementSibling.innerHTML\">" +
        '<template>' + ph + "</template>"
      );
    }
  };
})();
