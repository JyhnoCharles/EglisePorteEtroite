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


//  Swtitches the page when the btn is pressed
const buttons = document.querySelectorAll('nav [data-view]');
const views   = document.querySelectorAll('.view');

buttons.forEach(btn => {
  btn.addEventListener('click', () => swapView(btn.dataset.view));
});

function swapView(id){
  views.forEach(v => v.hidden = (v.id !== id)); // show one, hide the rest
}



// Barcode input Checker

const barcodeInput = document.getElementById('bqinput');

barcodeInput.addEventListener('keydown', async (e) => {
  if (e.key === 'Enter') {
    const scannedID = barcodeInput.value.trim();
    barcodeInput.value = ''; // clear the input

    if (!scannedID) return;

    //Lookup the member in the DB
    const { data: member, error } = await supabase
      .from('members')
      .select('*')
      .eq('ID', scannedID)
      .single();

    if (error || !member) {
      alert('No member found with that ID.');
      return;
    }

    

    // Mark them present for today
    const today = new Date().toLocaleDateString('en-CA')

    const { error: insertError } = await supabase
      .from('attendance')
      .insert([{ ID: scannedID, Name: member.Name , date: today, status: 'present' }]);

    if (insertError) {
      alert('Error marking attendance.', error);
      console.error('Error marking attendance:', error);
    } else {
      alert(` ${member.Name} marked present.`);
    }
  }
});

// fills Attendance tables

const prevBtn = document.getElementById('aprev');
const nextBtn = document.getElementById('anext');

const pageSize = 20;
let currentPage = 1;

nextBtn.addEventListener('click', () => {
  currentPage++;
  loadMembers();
});
prevBtn.addEventListener('click', () => {
  if (currentPage > 1){

  currentPage--;
  loadMembers();
  }
});

async function loadMembers() {

  const from  = (currentPage - 1) * pageSize;
  const to = (pageSize * currentPage) - 1;

  // ③ Fetch rows
  const { data: attend, error } = await supabase
    .from('attendance')                             // exact, lower-case table name
    .select('*')
    .range(from,to)
    .order('ID', { ascending: true });

    console.log('members →', attend, 'error →', error);   

  if (error) {
    document.querySelector('#attTable tbody')
      .innerHTML = `<tr><td colspan="5">Failed to load members</td></tr>`;
    console.error(error);
    return;
  }

  // Prev and next page
 

  // ④ Build and inject rows
  const tbody = document.querySelector('#attTable tbody');
  tbody.innerHTML = attend.map((m,i) => {

    const rowNumber = (currentPage - 1) * pageSize + i + 1;


    const [first, ...rest] = (m.Name ?? '').split(' ');
    const last = rest.join(' ');
    return `<tr>
      <td>${rowNumber}</td>
      <td>${m.ID}</td>
      <td>${first}</td>
      <td>${last}</td>
      <td>${m.date}</td>
    </tr>`;
  }).join('');
}

// Run after the HTML is parsed
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', loadMembers);
} else {
  loadMembers();
}

