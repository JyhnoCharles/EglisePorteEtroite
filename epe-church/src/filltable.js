import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js/+esm';


// at top of login.js (and filltable.js)
const ENV = (typeof import.meta !== 'undefined' && import.meta.env) || {};

// now safely read (no hard-coded secret!)
const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL
const SUPABASE_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY

if (!SUPABASE_URL || !SUPABASE_KEY) {
  console.error('Missing Supabase env vars; set them in Vercel or your local bundler.');
}


const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

console.log('filltable.js loaded, running at', new Date());


let amount = 0;

const pageSize = 20;
const sub = -20;

let back = false;

let currentPage = 1;



const prevBtn = document.getElementById('prev');
const nextBtn = document.getElementById('next');

nextBtn.addEventListener('click', () => {
  currentPage++;
  back = true;
  loadMembers();
});
prevBtn.addEventListener('click', () => {
  if (currentPage > 1){

  currentPage--;
  amount = amount - sub;
  back = false;
  loadMembers();
  }
  
});



async function loadMembers() {

  const from  = (currentPage - 1) * pageSize;
  const to = (pageSize * currentPage) - 1;

  // ③ Fetch rows
  const { data: members, error } = await supabase
    .from('members')                             // exact, lower-case table name
    .select('*')
    .range(from,to)
    .order('ID', { ascending: true });

    console.log('members →', members, 'error →', error);   

  if (error) {
    document.querySelector('#membersTable tbody')
      .innerHTML = `<tr><td colspan="5">Failed to load members</td></tr>`;
    console.error(error);
    return;
  }

  // Prev and next page
 

  // ④ Build and inject rows
  const tbody = document.querySelector('#membersTable tbody');
  tbody.innerHTML = members.map(m => {



    const [first, ...rest] = (m.Name ?? '').split(' ');
    const last = rest.join(' ');
    return `<tr>
      <td>${amount}</td>
      <td>${m.ID}</td>
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
