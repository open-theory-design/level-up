// Level Up configuration
// -----------------------------------------------------------------------------
// Paste your Supabase project values below. You get these from:
//   Supabase dashboard -> Project Settings -> API
// See DEPLOY.md for the full walkthrough.
//
// The anon key is safe to expose in a public frontend (that is what it is for).
// Your data is scoped by the private sync code, not by this key.

window.POSTUREFLOW_CONFIG = {
  SUPABASE_URL: "https://oqcchfrrjvvfkheqtjsz.supabase.co",       // e.g. https://abcd1234.supabase.co
  SUPABASE_ANON_KEY: "sb_publishable_e2SJwJMUJXOD7kzGKkb6RA_cI71nt_L",
  // Web Push (VAPID) PUBLIC key — safe to expose; the private half lives only
  // in Supabase Edge Function secrets. See DEPLOY.md "Push notifications".
  VAPID_PUBLIC_KEY: "BL37umQ3-C87xVSdCNZcmWu3CTIsxboesXSIMlEQCnQjTcAsocnaokKDhg5racJPZoRXfi2WcXImemcrtwakklY"
};

// If the values above are still placeholders, the app runs in LOCAL-ONLY mode:
// everything works on this one device, stored in the browser, with no cross-device
// sync. Fill them in to turn on phone <-> desktop syncing.
