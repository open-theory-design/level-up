// Level Up — exercise catalog (PRD §5.3, §5.6, §6)
// Two bundled image sets: "illustrations" (inline SVG line art, clinical style)
// and "photos" (drop a file at photos/<id>.jpg to fill a slot; until then a
// flagged placeholder renders — niche moves have no free coverage, PRD §5.6).

(function () {
  "use strict";

  // Strokes render on --img-plate, which stays light in BOTH themes, so fixed
  // hexes are safe here. Figure = deep teal, accent = spring green (Deep Teal &
  // Spring palette).
  var S = 'fill="none" stroke="#0C6B66" stroke-width="5" stroke-linecap="round" stroke-linejoin="round"';
  var T = 'fill="none" stroke="#15AFA6" stroke-width="4" stroke-linecap="round" stroke-linejoin="round"';
  var G = 'stroke="#C9D6D0" stroke-width="3" stroke-linecap="round"';

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
    band_raises: svg(
      '<line x1="20" y1="134" x2="220" y2="134" ' + G + "/>" +
      '<circle cx="120" cy="38" r="11" ' + S + "/>" +
      '<path d="M120 49 L120 96" ' + S + "/>" +
      '<path d="M120 96 L110 132 M120 96 L130 132" ' + S + "/>" +
      '<path d="M120 58 L92 48" ' + S + "/>" +                        // left arm up
      '<path d="M120 58 L148 48" ' + S + "/>" +                       // right arm up
      '<path d="M92 48 Q120 58 148 48" ' + T + "/>" +                 // band between hands
      '<path d="M170 46 L170 80 M170 46 l-5 8 M170 46 l5 8 M170 80 l-5 -8 M170 80 l5 -8" ' + T + "/>"
    ),
    // Prone on forearms, roller under the front of one thigh; double arrow shows
    // the slow back-and-forth travel from hip to just above the knee.
    quad_roll: svg(
      '<line x1="20" y1="134" x2="220" y2="134" ' + G + "/>" +
      '<path d="M30 134 L66 134" ' + S + "/>" +                      // forearm on the floor
      '<path d="M50 134 L56 108" ' + S + "/>" +                      // upper arm to shoulder
      '<circle cx="44" cy="104" r="10" ' + S + "/>" +                // head
      '<path d="M56 108 L136 114" ' + S + "/>" +                     // torso, face-down
      '<path d="M136 114 L182 124" ' + S + "/>" +                    // thigh resting on roller
      '<path d="M182 124 L208 134" ' + S + "/>" +                    // shin to foot
      '<circle cx="160" cy="127" r="7" ' + T + "/>" +                // the roller
      '<path d="M124 92 L176 92 M124 92 l8 -5 M124 92 l8 5 M176 92 l-8 -5 M176 92 l-8 5" ' + T + "/>"
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
      '<path d="M84 98 Q120 116 156 98" fill="none" stroke="#15AFA6" stroke-width="4" stroke-dasharray="7 8" stroke-linecap="round"/>' +  // cow (sag)
      '<path d="M120 76 L120 110 M120 76 l-5 8 M120 76 l5 8 M120 110 l-5 -8 M120 110 l5 -8" ' + T + "/>"
    ),
    // Dead bug: supine, knees stacked over hips (tabletop), opposite arm + leg
    // reaching away while the low back stays pressed to the floor.
    deadbugs: svg(
      '<line x1="20" y1="134" x2="220" y2="134" ' + G + "/>" +
      '<circle cx="48" cy="120" r="10" ' + S + "/>" +               // head on the floor
      '<path d="M58 122 L150 122" ' + S + "/>" +                    // spine flat on the floor
      '<path d="M68 122 L74 84" ' + S + "/>" +                      // near arm straight up
      '<path d="M68 122 L36 104" ' + S + "/>" +                     // opposite arm reaching back over head
      '<path d="M150 122 L146 84 L174 88" ' + S + "/>" +            // near knee: thigh up + shin (tabletop)
      '<path d="M150 122 L200 112" ' + S + "/>" +                   // opposite leg extended out
      '<path d="M188 100 L188 82 M188 82 l-5 8 M188 82 l5 8" ' + T + "/>"  // slow, controlled lower/raise
    ),
    // Side plank: forearm on the floor, body a straight diagonal off the floor,
    // hips lifted, top arm reaching up.
    side_plank: svg(
      '<line x1="20" y1="134" x2="220" y2="134" ' + G + "/>" +
      '<path d="M36 132 L74 132" ' + S + "/>" +                     // forearm on the floor
      '<path d="M56 132 L66 104" ' + S + "/>" +                     // upper arm up to shoulder
      '<circle cx="70" cy="94" r="10" ' + S + "/>" +                // head
      '<path d="M76 102 L202 132" ' + S + "/>" +                    // straight body to feet on floor
      '<path d="M82 100 L98 74" ' + S + "/>" +                      // top arm raised to the ceiling
      '<path d="M122 108 L122 92 M122 92 l-5 8 M122 92 l5 8" ' + T + "/>"  // lift the hips
    ),
    // Couch stretch: half-kneeling, rear shin running up a wall/couch behind,
    // torso tall, pelvis tucked under.
    couch_stretch: svg(
      '<line x1="20" y1="134" x2="220" y2="134" ' + G + "/>" +
      '<path d="M204 22 v112" ' + T + "/>" +                        // wall / couch back
      '<circle cx="92" cy="50" r="11" ' + S + "/>" +                // head
      '<path d="M92 61 L94 100" ' + S + "/>" +                      // torso upright
      '<path d="M94 100 L70 118 L70 134" ' + S + "/>" +             // front leg planted
      '<path d="M94 100 L150 126" ' + S + "/>" +                    // rear thigh to knee on floor
      '<path d="M150 126 L198 96" ' + S + "/>" +                    // rear shin up the wall
      '<path d="M93 70 L116 104" ' + S + "/>" +                     // arm resting on front thigh
      '<path d="M93 70 L76 96" ' + S + "/>"                         // other arm
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
    ),

    // ---- Progression-ladder variants (keyed "<id>@<level>") ----
    // Same clinical style as the base drawings; each shows what actually
    // changes at that level so the picture matches the new name/instructions.

    // Side plank, top leg raised: bottom leg to the floor, top leg held up.
    "side_plank@1": svg(
      '<line x1="20" y1="134" x2="220" y2="134" ' + G + "/>" +
      '<path d="M36 132 L74 132" ' + S + "/>" +                     // forearm on the floor
      '<path d="M56 132 L66 104" ' + S + "/>" +                     // upper arm up to shoulder
      '<circle cx="70" cy="94" r="10" ' + S + "/>" +                // head
      '<path d="M76 102 L140 117" ' + S + "/>" +                    // torso to the hips
      '<path d="M140 117 L202 132" ' + S + "/>" +                   // bottom leg to the floor
      '<path d="M140 117 L200 94" ' + S + "/>" +                    // top leg raised
      '<path d="M82 100 L98 74" ' + S + "/>" +                      // top arm to the ceiling
      '<path d="M170 118 L170 100 M170 100 l-5 8 M170 100 l5 8" ' + T + "/>"  // lift the leg
    ),
    // Side plank, feet elevated on a step/couch: feet above the shoulders.
    "side_plank@2": svg(
      '<line x1="20" y1="134" x2="220" y2="134" ' + G + "/>" +
      '<path d="M184 108 h32 M188 108 v26 M212 108 v26" ' + T + "/>" + // step / couch
      '<path d="M36 132 L74 132" ' + S + "/>" +                     // forearm on the floor
      '<path d="M56 132 L66 104" ' + S + "/>" +                     // upper arm up to shoulder
      '<circle cx="70" cy="94" r="10" ' + S + "/>" +                // head
      '<path d="M76 102 L196 108" ' + S + "/>" +                    // body to feet on the step
      '<path d="M82 100 L98 74" ' + S + "/>" +                      // top arm to the ceiling
      '<path d="M128 100 L128 84 M128 84 l-5 8 M128 84 l5 8" ' + T + "/>"  // hips high
    ),
    // Tempo dead bugs: same pose, dashed slow-motion arrow (4s lowers).
    "deadbugs@1": svg(
      '<line x1="20" y1="134" x2="220" y2="134" ' + G + "/>" +
      '<circle cx="48" cy="120" r="10" ' + S + "/>" +
      '<path d="M58 122 L150 122" ' + S + "/>" +
      '<path d="M68 122 L74 84" ' + S + "/>" +
      '<path d="M68 122 L36 104" ' + S + "/>" +
      '<path d="M150 122 L146 84 L174 88" ' + S + "/>" +
      '<path d="M150 122 L200 112" ' + S + "/>" +
      '<path d="M188 106 L188 76" fill="none" stroke="#15AFA6" stroke-width="4" stroke-dasharray="5 7" stroke-linecap="round"/>' +  // slow travel
      '<path d="M188 76 l-5 8 M188 76 l5 8 M188 106 l-5 -8 M188 106 l5 -8" ' + T + "/>"
    ),
    // Weighted dead bugs: dumbbell held vertically over the chest, legs move.
    "deadbugs@2": svg(
      '<line x1="20" y1="134" x2="220" y2="134" ' + G + "/>" +
      '<circle cx="48" cy="120" r="10" ' + S + "/>" +
      '<path d="M58 122 L150 122" ' + S + "/>" +
      '<path d="M68 122 L64 84" ' + S + "/>" +                       // both arms straight up
      '<path d="M78 122 L88 84" ' + S + "/>" +
      '<path d="M56 80 h40" ' + S + "/>" +                            // dumbbell bar
      '<path d="M56 73 v14 M96 73 v14" ' + S + "/>" +                 // dumbbell heads
      '<path d="M150 122 L146 84 L174 88" ' + S + "/>" +
      '<path d="M150 122 L200 112" ' + S + "/>" +
      '<path d="M188 100 L188 82 M188 82 l-5 8 M188 82 l5 8" ' + T + "/>"
    ),
    // Paused bird dogs: pause bars at the reaching hand and foot.
    "bird_dogs@1": svg(
      '<line x1="20" y1="134" x2="220" y2="134" ' + G + "/>" +
      '<path d="M96 92 L158 92" ' + S + "/>" +
      '<path d="M100 92 L100 132 M152 92 L152 132" ' + S + "/>" +
      '<circle cx="84" cy="86" r="11" ' + S + "/>" +
      '<path d="M96 92 L44 78" ' + T + "/>" +
      '<path d="M158 92 L212 78" ' + T + "/>" +
      '<path d="M36 60 v12 M43 60 v12" ' + T + "/>" +                 // pause at the hand
      '<path d="M205 60 v12 M212 60 v12" ' + T + "/>"                 // pause at the foot
    ),
    // Elbow-to-knee bird dogs: back rounds, elbow and knee meet under the body.
    "bird_dogs@2": svg(
      '<line x1="20" y1="134" x2="220" y2="134" ' + G + "/>" +
      '<path d="M96 92 Q127 72 158 92" ' + S + "/>" +                 // rounded back
      '<path d="M100 92 L100 132 M152 92 L152 132" ' + S + "/>" +
      '<circle cx="88" cy="96" r="11" ' + S + "/>" +                  // head tucked
      '<path d="M96 92 L121 114" ' + T + "/>" +                       // elbow crunching under
      '<path d="M158 92 L133 114" ' + T + "/>" +                      // knee driving to meet it
      '<path d="M123 122 h8" ' + T + "/>"                             // the meeting point
    ),
    // Clamshells with a heavier band: the band drawn thick and dark.
    "clamshells@1": svg(
      '<line x1="20" y1="134" x2="220" y2="134" ' + G + "/>" +
      '<circle cx="50" cy="116" r="10" ' + S + "/>" +
      '<path d="M62 120 L116 122" ' + S + "/>" +
      '<path d="M116 122 L138 128 L150 134" ' + S + "/>" +
      '<path d="M116 122 L140 108 L150 134" ' + S + "/>" +
      '<path d="M138 128 L140 108" fill="none" stroke="#0C6B66" stroke-width="8" stroke-linecap="round"/>' +  // heavy band
      '<path d="M150 122 Q176 106 158 86" ' + T + "/>" +
      '<path d="M158 86 l-6 9 M158 86 l8 5" ' + T + "/>"
    ),
    // Paused clamshells: heavy band + hold bars at the open position.
    "clamshells@2": svg(
      '<line x1="20" y1="134" x2="220" y2="134" ' + G + "/>" +
      '<circle cx="50" cy="116" r="10" ' + S + "/>" +
      '<path d="M62 120 L116 122" ' + S + "/>" +
      '<path d="M116 122 L138 128 L150 134" ' + S + "/>" +
      '<path d="M116 122 L140 108 L150 134" ' + S + "/>" +
      '<path d="M138 128 L140 108" fill="none" stroke="#0C6B66" stroke-width="8" stroke-linecap="round"/>' +  // heavy band
      '<path d="M160 90 v12 M167 90 v12" ' + T + "/>"                 // 2s squeeze at the top
    ),
    // Weighted hip thrusts: dumbbell resting across the lifted hips.
    "hip_thrusts@1": svg(
      '<line x1="20" y1="134" x2="220" y2="134" ' + G + "/>" +
      '<circle cx="52" cy="126" r="9" ' + S + "/>" +
      '<path d="M62 128 L112 108" ' + S + "/>" +
      '<path d="M112 108 L140 110 L140 134" ' + S + "/>" +
      '<path d="M112 108 L170 120" ' + S + "/>" +
      '<path d="M98 96 h28" ' + S + "/>" +                            // dumbbell bar on the hips
      '<path d="M98 89 v14 M126 89 v14" ' + S + "/>" +                // dumbbell heads
      '<path d="M112 130 L112 116 M112 116 l-5 8 M112 116 l5 8" ' + T + "/>"
    ),
    // Elevated single-leg hip thrusts: shoulders up on a couch/bench.
    "hip_thrusts@2": svg(
      '<line x1="20" y1="134" x2="220" y2="134" ' + G + "/>" +
      '<path d="M28 110 h44 M34 110 v24 M66 110 v24" ' + T + "/>" +   // couch / bench
      '<circle cx="44" cy="100" r="9" ' + S + "/>" +                  // head/shoulders on the bench
      '<path d="M56 106 L124 96" ' + S + "/>" +                       // torso, hips high
      '<path d="M124 96 L154 102 L154 134" ' + S + "/>" +             // planted leg
      '<path d="M124 96 L190 108" ' + S + "/>" +                      // extended leg out
      '<path d="M124 128 L124 112 M124 112 l-5 8 M124 112 l5 8" ' + T + "/>"
    )
  };

  // Daily flow — fixed, authoritative sequence (PRD §5.3).
  window.PF_EXERCISES = [
    { id: "lat_stretch",        name: "Lat Stretch",                 dose: "self-paced",         tips: ["Rest your elbows on the table", "Sink your hips back", "Let your chest drop toward the floor", "Keep your ribs down"] },
    { id: "pec_stretch",        name: "Pec Stretch",                 dose: "self-paced",         tips: ["Keep your shoulders down, away from your ears"], avoid: ["Forcing the joint"] },
    { id: "neck_stretch",       name: "Neck Stretch",                dose: "self-paced",         tips: ["Drop the opposite arm down", "Tilt your head sideways", "Gently rotate your chin toward your armpit"], avoid: ["Pulling hard"] },
    { id: "wall_angels",        name: "Wall Angels",                 dose: "self-paced",         tips: ["Press your lower back flat against the wall"], avoid: ["Letting your ribs flare out"], nicheStock: true },
    { id: "chin_tucks",         name: "Chin Tucks",                  dose: "hold 3–5s",     tips: ["Pull your head straight back, like making a double chin"] },
    { id: "band_raises",        name: "Band Raises",                 dose: "self-paced",         tips: ["Hold a band with both hands", "Raise both arms up, then lower with control", "Keep the band under tension throughout"], nicheStock: true },
    { id: "quad_roll",          name: "Quad Foam Roll",              dose: "3 × 30s per leg",  track: { type: "hold", sets: 6, secs: 30, min: 20, max: 40 }, tips: ["Roll slowly — 2–4 seconds per pass", "Work from the hip down to just above the knee", "Pause on tender spots and keep breathing"], avoid: ["Rolling over your kneecap or hip bone", "Going past 2 minutes on one leg"] },
    { id: "psoas_stretch",      name: "Kneeling Psoas Stretch",      dose: "2 × 45s per leg", tips: ["Squeeze the glute of the stretching leg", "Push your hip forward"], avoid: ["Arching your lower back"] },
    { id: "couch_stretch",      name: "Couch Stretch",               dose: "2 × 45s per leg", tips: ["Rest your rear shin flat up a wall or couch", "Front foot planted, knee over ankle", "Squeeze the glute and tuck your pelvis under"], avoid: ["Arching your lower back", "Forcing into sharp knee pain"] },
    { id: "cat_cow",            name: "Cat/Cow",                     dose: "10 slow transitions", tips: ["Move slowly through your full spinal range", "Inhale as you drop your belly", "Exhale as you round your back"] },
    { id: "deadbugs",           name: "Dead Bugs",                   dose: "2 × 20 (10 per side)", track: { type: "reps", sets: 2, target: 20 }, tips: ["Press your lower back flat into the floor", "Lower the opposite arm and leg slowly", "Move with control and keep breathing"], avoid: ["Letting your lower back arch off the floor"],
      levels: [
        { name: "Tempo Dead Bugs", dose: "2 × 20 (10 per side)", sub: "Same 20 reps — 4-second lowers.",
          tips: ["Count 4 slow seconds on every lower", "Lower back stays glued to the floor", "Exhale on the way down"],
          avoid: ["Letting your lower back arch off the floor"] },
        { name: "Weighted Dead Bugs", dose: "2 × 20 (10 per side)", sub: "Light dumbbell over your chest, legs do the work.",
          tips: ["Hold a light dumbbell straight above your chest", "Arms stay vertical — only the legs move", "If your back arches, the weight is too heavy"],
          avoid: ["Letting your lower back arch off the floor"] }
      ] },
    { id: "side_plank",         name: "Side Plank",                  dose: "2 × 30s per side", track: { type: "hold", sets: 4, secs: 30, min: 15, max: 40 }, tips: ["Stack your feet and lift your hips high", "Hold a straight line from head to heels", "Push your bottom shoulder away from your ear"], avoid: ["Letting your hips sag toward the floor"],
      levels: [
        { name: "Side Plank — Top Leg Raised", dose: "2 × 30s per side", sub: "Longer lever, same 30s holds.",
          tips: ["Lift the top leg to hip height and hold it there", "Keep the hips stacked — don't roll back", "Both legs straight"],
          avoid: ["Letting your hips sag toward the floor"] },
        { name: "Side Plank — Feet Elevated", dose: "2 × 30s per side", sub: "Feet up on the couch. Holds reset to 30s.",
          tips: ["Feet on a step or couch, elbow under shoulder", "Straight line from head to heels", "The higher the feet, the harder it gets"],
          avoid: ["Letting your hips sag toward the floor"] }
      ] },
    { id: "bird_dogs",          name: "Bird Dogs",                   dose: "2 × 20 (10 per side)", track: { type: "reps", sets: 2, target: 20 }, tips: ["Keep your torso still, like a tabletop", "Move slowly"],
      levels: [
        { name: "Paused Bird Dogs", dose: "2 × 20 (10 per side)", sub: "3-second holds at full reach.",
          tips: ["Hold 3 full seconds at the top", "Reach long through fingertips and heel", "Nothing else moves"] },
        { name: "Elbow-to-Knee Bird Dogs", dose: "2 × 20 (10 per side)", sub: "Crunch under, then reach. Slow both ways.",
          tips: ["Touch elbow to knee under your body, then re-extend", "Round your back slightly on the crunch, flatten on the reach", "Slow both directions"] }
      ] },
    { id: "clamshells",         name: "Banded Clamshells",           dose: "2 × 15 per side", track: { type: "reps", sets: 2, target: 15 }, tips: ["Isolate the burn to the side of your glute"], avoid: ["Rotating your torso"], nicheStock: true,
      levels: [
        { name: "Clamshells — Heavier Band", dose: "2 × 15 per side", sub: "Next band up. Same strict 15s.",
          tips: ["Move up to the next band", "Same strict form — no torso roll", "The last 3 reps should burn"],
          avoid: ["Rotating your torso"] },
        { name: "Paused Clamshells — Heavy Band", dose: "2 × 15 per side", sub: "2-second squeeze at the top.",
          tips: ["Squeeze 2 full seconds at the top", "Keep tension through the whole set — never let the band go slack"],
          avoid: ["Rotating your torso"] }
      ] },
    { id: "hip_thrusts",        name: "Leg-Out Hip Thrusts",         dose: "2 × 12 per leg",  track: { type: "reps", sets: 2, target: 12 }, tips: ["Drive through your heel", "Keep your gaze forward"], avoid: ["Looking up at the ceiling"],
      levels: [
        { name: "Weighted Hip Thrusts", dose: "2 × 12 per leg", sub: "Dumbbell across the hips.",
          tips: ["Rest a dumbbell or plate across your hips", "Drive through your heel, squeeze at the top", "Chin tucked, gaze forward"],
          avoid: ["Looking up at the ceiling"] },
        { name: "Elevated Single-Leg Hip Thrusts", dose: "2 × 12 per leg", sub: "Shoulders on the couch, full range.",
          tips: ["Shoulders on the couch, one foot planted", "Hips all the way up to a flat tabletop", "Add the dumbbell back once 12 feels easy"],
          avoid: ["Looking up at the ceiling"] }
      ] }
  ];

  // Ad-hoc strength bank — fixed order, warm-up gate first (PRD §6).
  window.PF_LIFTS = [
    { id: "ytw",        name: "YTWs",                                warmup: true },
    { id: "face_pull",  name: "Face Pulls",                          warmup: true },
    { id: "hip_thrust", name: "Weighted Hip Thrusts / Glute Bridges" },
    { id: "bulgarian",  name: "Bulgarian Split Squats" },
    { id: "squat",      name: "Squats" },
    { id: "deadlift",   name: "Deadlifts" }
  ];

  // Keys may carry a progression level ("side_plank@2"). Fall back toward the
  // base drawing, always preferring level-correct art over style-correct art —
  // the picture matching the movement matters more than matching the set.
  function baseOf(key) { return key.indexOf("@") === -1 ? key : key.slice(0, key.indexOf("@")); }

  window.PF_IMAGES = {
    illustration: function (key) {
      return ILLUST[key] || ILLUST[baseOf(key)] || "";
    },
    // "Color" set — bundled flat colored figures (js/illustrations-color.js).
    color: function (key) {
      var C = window.PF_COLOR_ART || {};
      return C[key] || ILLUST[key] || C[baseOf(key)] || ILLUST[baseOf(key)] || "";
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
