// Level Up configuration
// -----------------------------------------------------------------------------
// Paste your Supabase project values below. You get these from:
//   Supabase dashboard -> Project Settings -> API
// See DEPLOY.md for the full walkthrough.
//
// The anon key is safe to expose in a public frontend (that is what it is for).
// Your data is scoped by the private sync code, not by this key.

window.POSTUREFLOW_CONFIG = {
  SUPABASE_URL: "PASTE_YOUR_SUPABASE_URL_HERE",       // e.g. https://abcd1234.supabase.co
  SUPABASE_ANON_KEY: "PASTE_YOUR_SUPABASE_ANON_KEY_HERE"
};

// If the values above are still placeholders, the app runs in LOCAL-ONLY mode:
// everything works on this one device, stored in the browser, with no cross-device
// sync. Fill them in to turn on phone <-> desktop syncing.
