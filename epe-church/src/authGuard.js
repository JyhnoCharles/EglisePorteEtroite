import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;
const SUPABASE_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!SUPABASE_URL || !SUPABASE_KEY) {
  console.error('Missing env vars:', { SUPABASE_URL, SUPABASE_KEY });
  throw new Error('Missing Supabase configuration');
}

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

// Runs immediately when the dashboard loads, before the page is usable
async function checkSession() {
  const {
    data: { session },
  } = await supabase.auth.getSession();

  if (!session) {
    // No valid session — bounce straight to login, don't show any dashboard content
    window.location.replace('/adminlogin.html');
  }
}

checkSession();

// Optional: keep listening in case the session expires while the page is open
supabase.auth.onAuthStateChange((event, session) => {
  if (event === 'SIGNED_OUT' || !session) {
    window.location.replace('/adminlogin.html');
  }
});

export { supabase };