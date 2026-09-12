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


const pageSize = 20;

let currentPage = 1;

// Tracks which member row is currently selected (for edit/delete)
let selectedMemberRow = null;


const prevBtn = document.getElementById('prev');
const nextBtn = document.getElementById('next');
const searchInput = document.getElementById('Searchbar');

let searchTerm = '';
let searchDebounce = null;

searchInput.addEventListener('input', () => {
  clearTimeout(searchDebounce);
  searchDebounce = setTimeout(() => {
    searchTerm = searchInput.value.trim();
    currentPage = 1;
    loadMembers();
  }, 300);
});

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
  let query = supabase
    .from('members')                             // exact, lower-case table name
    .select('*');

  if (searchTerm) {
    // Escape characters that would otherwise break the .or() filter syntax
    const safeTerm = searchTerm.replace(/[,%]/g, '');
    const term = `%${safeTerm}%`;
    query = query.or(
      `Name.ilike.${term},ID.ilike.${term},Address.ilike.${term},Phone_Number.ilike.${term},Contact_Cellphone.ilike.${term}`
    );
  }

  const { data: members, error } = await query
    .order('ID', { ascending: true })
    .range(from, to);

    console.log('members →', members, 'error →', error);   

  if (error) {
    document.querySelector('#membersTable tbody')
      .innerHTML = `<tr><td colspan="6">Failed to load members</td></tr>`;
    console.error(error);
    return;
  }

  // A fresh load means nothing on screen is selected anymore
  selectedMemberRow = null;
  const infoEl = document.getElementById('memberAttendanceInfo');
  if (infoEl) infoEl.innerHTML = '';

  // ④ Build and inject rows
  const tbody = document.querySelector('#membersTable tbody');

  if (!members.length) {
    tbody.innerHTML = `<tr><td colspan="6">No members match your search.</td></tr>`;
    return;
  }

  tbody.innerHTML = members.map((m,i) => {

    const rowNumber = (currentPage - 1) * pageSize + i + 1;


    const [first, ...rest] = (m.Name ?? '').split(' ');
    const last = rest.join(' ');
    return `<tr data-id="${m.ID}" data-name="${m.Name ?? ''}" data-phone="${m.Phone_Number ?? ''}" data-contact="${m.Contact_Cellphone ?? ''}" data-address="${m.Address ??  ''}" data-emergency="${m.Emergency_Contact ?? ''}" onclick="selectMemberRow(this)">
      <td>${rowNumber}</td>
      <td>${m.ID}</td>
      <td>${first}</td>
      <td>${last}</td>
      <td>${m.Address}</td>
      <td>${m.Phone_Number}</td>
      <td>${m.Emergency_Contact}</td>
    </tr>`;
  }).join('');
}

// Exposed so adminPages.js can trigger a reload after an edit, without
// the two modules needing to import each other.
window.loadMembersTable = loadMembers;

// Run after the HTML is parsed
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', loadMembers);
} else {
  loadMembers();
}


// Select / deselect a member row. Clicking the same row again deselects it.
// Shows the member's contact info immediately, and their most recent
// attendance record once it's fetched.
window.selectMemberRow = async function (row) {
  const infoEl = document.getElementById('memberAttendanceInfo');

  if (selectedMemberRow === row) {
    row.classList.remove('selected-row');
    selectedMemberRow = null;
    infoEl.innerHTML = '';
    return;
  }

  if (selectedMemberRow) {
    selectedMemberRow.classList.remove('selected-row');
  }

  row.classList.add('selected-row');
  selectedMemberRow = row;

  const { id, name, phone, contact, address, emergency } = row.dataset;

  infoEl.innerHTML = `
    <h4>${name || 'Unnamed'}</h4>
    <p><strong>ID:</strong> ${id}</p>
    <p><strong>Phone:</strong> ${phone || '—'}</p>
    <p><strong>Contact Cell:</strong> ${contact || '—'}</p>
    <p><strong>Address:</strong> ${address || '—'}</p>
    <p><strong>Emergency Contact:</strong> ${emergency || '—'}</p>
    <p id="lastAttendanceLine"><strong>Last attendance:</strong> Checking…</p>
  `;

  const { data: lastAttendance, error } = await supabase
    .from('attendance')
    .select('date, status')
    .eq('ID', id)
    .order('date', { ascending: false })
    .limit(1)
    .maybeSingle();

  // If a different row got clicked while this was still loading,
  // don't overwrite whatever's showing now.
  if (selectedMemberRow !== row) return;

  const lineEl = document.getElementById('lastAttendanceLine');
  if (!lineEl) return;

  if (error) {
    lineEl.innerHTML = `<strong>Last attendance:</strong> could not load`;
    console.error(error);
    return;
  }

  lineEl.innerHTML = lastAttendance
    ? `<strong>Last attendance:</strong> ${lastAttendance.date} — ${lastAttendance.status ?? 'present'}`
    : `<strong>Last attendance:</strong> none recorded`;
};


// Deletes whichever member row is currently selected.
window.DeleteMember = async function () {
  if (!selectedMemberRow) {
    alert('Select a member first.');
    return;
  }

  const id = selectedMemberRow.dataset.id;
  const name = selectedMemberRow.dataset.name;

  if (!confirm(`Delete ${name} (ID ${id})? This cannot be undone.`)) return;

  const { error } = await supabase
    .from('members')
    .delete()
    .eq('ID', id);

  if (error) {
    alert('Failed to delete: ' + error.message);
    console.error(error);
    return;
  }

  selectedMemberRow = null;
  await loadMembers();
};


// Opens the existing member modal pre-filled with the selected row's data,
// and flags adminPages.js's submit handler to update instead of insert.
window.editMember = async function () {
  if (!selectedMemberRow) {
    alert('Select a member first.');
    return;
  }

  window.editingMemberId = selectedMemberRow.dataset.id;

  document.getElementById('modalName').value = selectedMemberRow.dataset.name || '';
  document.getElementById('modalMemberPhonenumber').value = selectedMemberRow.dataset.phone || '';
  document.getElementById('modalMemberContactCell').value = selectedMemberRow.dataset.contact || '';
  document.getElementById('modalMemberAddress').value = selectedMemberRow.dataset.address || '';
  document.getElementById('modalMemberEmergencyContact').value = selectedMemberRow.dataset.emergency || '';
  document.getElementById('modalPhotoFile').value = '';

  const statusEl = document.getElementById('modalPhotoStatus');
  statusEl.textContent = 'Checking for an existing photo…';

  document.querySelector('#memberModal h3').textContent = 'Edit Member';
  document.querySelector('#memberForm button[type="submit"]').textContent = 'Save Changes';

  window.memberModal();

  const { data: photoRow } = await supabase
    .from('photos')
    .select('photo_url')
    .eq('member_id', window.editingMemberId)
    .maybeSingle();

  statusEl.textContent = photoRow?.photo_url
    ? 'This member already has a photo on file — uploading a new one will replace it.'
    : 'No photo on file yet.';
};


// Opens the modal in "create" mode, clearing out any leftover edit state.
window.createMember = function () {
  window.editingMemberId = null;
  document.getElementById('memberForm').reset();
  document.getElementById('modalPhotoStatus').textContent = '';
  document.querySelector('#memberModal h3').textContent = 'New Member';
  document.querySelector('#memberForm button[type="submit"]').textContent = 'Save';
  window.memberModal();
};