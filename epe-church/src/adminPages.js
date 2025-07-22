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

    const { error: upsertError } = await supabase
      .from('attendance')
      .upsert([{ ID: scannedID, Name: member.Name , date: today, status: 'present' }], {onConflict:['ID', 'date']  })
      .select();

    if (upsertError) {
      alert('Error marking attendance.', error);
      console.error('Error marking attendance:', error);
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
    console.error("Failed to reload data:", error);
    return;
  }

 

  

  // Prev and next page
 

  // ④ Build and inject rows
  const tbody = document.querySelector('#attTable tbody');
  tbody.innerHTML = attend.map((m,i) => {

    const rowNumber = (currentPage - 1) * pageSize + i + 1;


    const [first, ...rest] = (m.Name ?? '').split(' ');
    const last = rest.join(' ');
    return `<tr data-id="${m.ID}" data-date="${m.date}" onclick="selectRow(this)">
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



// Selects row to be deleted
let selectedRow = null;

window.selectRow = function(row){

  //unHighlight
  document.querySelectorAll('#attTable tbody tr').forEach(tr => {
    tr.computedStyleMap.backgroundColor = '';
  });

  // highlight
  row.style.backgroundColor = 'lightcoral';
  selectedRow = row;
}


window.deleteSelectedRow = async function(){
  if(!selectedRow) {
    alert("failed to delete");
    return;
  }

   // Debug: Log the selected row's data
  console.log("Selected row dataset:", selectedRow.dataset);

  const rowID = selectedRow.dataset.id;
  const date = selectedRow.dataset.date;

  console.log("Trying to delete attendance record for ID:", rowID, "on date:", date);

  try {
  const { data, error } = await supabase 
  .from('attendance')
  .delete()
  .eq('ID',rowID)
  .eq('date',date )
  .select();

  console.log("Deleted rows:", data, "Error:", error);

  if (error) throw error;
    
    // Only remove from UI if Supabase deletion succeeded
    selectedRow.remove();
    selectedRow = null;

    await loadMembers();

    alert("Successfully deleted record");
    
  } catch (error) {
    console.error("Delete error:", error);
    alert('Failed to delete: ' + error.message);
  }
}


// Open and close pop-up
window.memberModal = function () {
  document.getElementById('memberModal').style.display = 'block';
};

window.closeMemberModal = function () {
  document.getElementById('memberModal').style.display = 'none';
  document.getElementById('modalResult').textContent = '';
};


document.getElementById('memberForm').addEventListener('submit', async (e) => {
  e.preventDefault();

  const name = document.getElementById('modalName').value.trim();
  const address = document.getElementById('modalMemberAddress').value.trim();
  const Phone = document.getElementById('modalMemberPhonenumber').value.trim();
  const contactcell = document.getElementById('modalMemberContactCell').value.trim();
  const resultDiv = document.getElementById('modalResult');

  // Get last member_id
  const { data: lastMember, error: fetchError } = await supabase
    .from('members')
    .select('ID')
    .order('ID', { ascending: false })
    .limit(1)
    .single();

  const nextMemberId = lastMember ? parseInt(lastMember.ID) + 1 : 1;

  // Insert new member
  const { data, error } = await supabase
    .from('members')
    .insert([{ID: nextMemberId, Name: name , Phone_Number: Phone, Contact_Cellphone: contactcell ,Address: address  }]);

  if (error) {
    resultDiv.textContent = error.message;
  } else {
    resultDiv.textContent = `Member #${nextMemberId} added!`;
    document.getElementById('memberForm').reset();
    setTimeout(closeMemberModal, 1000);
  }
});





