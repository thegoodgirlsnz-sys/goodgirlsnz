/* ==========================================================
   GOOD GIRLS — SUPABASE CONFIG
   ==========================================================
   
   This file connects the website to your Supabase project.
   
   ⚠️ IMPORTANT — ONLY USE THE PUBLISHABLE (PUBLIC) KEY HERE.
   
   Never put a "secret key" (sb_secret_...) in this file.
   Secret keys bypass Row-Level Security and give full
   admin access to anyone who views the page source.
   
   ========================================================== */

// ==========================================================
// 1. SUPABASE DETAILS
// ==========================================================

const SUPABASE_URL = 'https://zyxanoyfqrnnwhbvkusb.supabase.co';
const SUPABASE_ANON_KEY = 'sb_publishable_R5RbuljhZ0mnKhQBthMGUw_ijK0z7CM';

// ==========================================================
// 2. DO NOT EDIT BELOW THIS LINE
// ==========================================================

(function () {
  'use strict';

  // Check SDK loaded
  if (typeof window.supabase === 'undefined') {
    console.error(
      '[Good Girls] Supabase SDK not loaded. ' +
      'Make sure the CDN script is included BEFORE this file:\n' +
      '<script src="https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2"></script>'
    );
    return;
  }

  // Check placeholders replaced
  if (
    !SUPABASE_URL ||
    !SUPABASE_ANON_KEY ||
    SUPABASE_URL.indexOf('YOUR_SUPABASE_URL') !== -1 ||
    SUPABASE_ANON_KEY.indexOf('YOUR_SUPABASE_ANON_KEY') !== -1 ||
    SUPABASE_ANON_KEY.indexOf('sb_secret_') === 0
  ) {
    console.error(
      '[Good Girls] Supabase config is invalid.\n' +
      'Open supabase-config.js and make sure:\n' +
      '  • SUPABASE_URL is your Project URL\n' +
      '  • SUPABASE_ANON_KEY is your PUBLISHABLE key (sb_publishable_...)\n' +
      'Never use a secret key (sb_secret_...) in the frontend.'
    );
    return;
  }

  // Initialise the Supabase client and expose it globally
  try {
    window.supabaseClient = window.supabase.createClient(
      SUPABASE_URL,
      SUPABASE_ANON_KEY,
      {
        auth: {
          persistSession: true,
          autoRefreshToken: true,
          detectSessionInUrl: true
        }
      }
    );

    console.log('[Good Girls] Supabase client initialised successfully.');
  } catch (err) {
    console.error('[Good Girls] Failed to initialise Supabase client:', err);
  }
})();