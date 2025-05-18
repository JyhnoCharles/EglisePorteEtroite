import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js/+esm';


// at top of login.js (and filltable.js)
const ENV = (typeof import.meta !== 'undefined' && import.meta.env) || {};

// now safely read (no hard-coded secret!)
const SUPABASE_URL = ENV.SUPABASE_URL;
const SUPABASE_KEY = ENV.SUPABASE_ANON_KEY;

if (!SUPABASE_URL || !SUPABASE_KEY) {
  console.error('Missing Supabase env vars; set them in Vercel or your local bundler.');
}


const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

console.log('🚀 filltable.js loaded, running at', new Date());


async function loadMembers() {
  // ③ Fetch rows
  const { data: members, error } = await supabase
    .from('members')                             // exact, lower-case table name
    .select('ID, Name, Phone_Number, Address')
    .order('ID', { ascending: true });

    console.log('members →', members, 'error →', error);   

  if (error) {
    document.querySelector('#membersTable tbody')
      .innerHTML = `<tr><td colspan="5">Failed to load members</td></tr>`;
    console.error(error);
    return;
  }

  // ④ Build and inject rows
  const tbody = document.querySelector('#membersTable tbody');
  tbody.innerHTML = members.map(m => {
    const [first, ...rest] = (m.Name ?? '').split(' ');
    const last = rest.join(' ');
    return `<tr>
      <td>${m.id}</td>
      <td>${first}</td>
      <td>${last}</td>
      <td>${m.Address}</td>
      <td>${m.Phone_Number}</td>
    </tr>`;
  }).join('');
}

// Run after the HTML is parsed
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', loadMembers);
} else {
  loadMembers();
}
