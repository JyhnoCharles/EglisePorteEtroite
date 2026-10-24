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

// Scanner mode: 'attendance' (default) or 'communion'.
// Deliberately kept in memory only (not saved anywhere), so a page
// refresh always puts the scanner back on attendance.
let scanMode = 'attendance';

const modeToggle = document.getElementById('modeToggle');
const modeBanner = document.getElementById('modeBanner');
const scanBkg = document.querySelector('.scanbkg');

function renderScanMode() {
  const isCommunion = scanMode === 'communion';

  scanBkg?.classList.toggle('communion-mode', isCommunion);
  if (modeBanner) modeBanner.textContent = isCommunion ? 'COMMUNION MODE' : 'ATTENDANCE MODE';
  if (modeToggle) modeToggle.textContent = isCommunion ? 'Switch to Attendance' : 'Switch to Communion';

  // Hide the last person's popup so a confirmation from the old mode
  // can't be mistaken for a scan in the new one.
  const lastScan = document.getElementById('scanResult');
  if (lastScan) lastScan.style.display = 'none';

  // Clicking the toggle moves focus onto the button; hand it straight
  // back to the barcode input so the next scan lands in the right place.
  barcodeInput.focus();
}

modeToggle?.addEventListener('click', () => {
  scanMode = scanMode === 'attendance' ? 'communion' : 'attendance';
  renderScanMode();
});

renderScanMode();

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
      console.log('No member found with that ID.');
      return;
    }

    

    // Record the scan in whichever table the current mode points at.
    // The mode is read once, here, so it can't change mid-scan.
    const today = new Date().toLocaleDateString('en-CA');
    const mode = scanMode; // 'attendance' or 'communion' — also the table name

    const record = mode === 'communion'
      ? { ID: scannedID, Name: member.Name, date: today }
      : { ID: scannedID, Name: member.Name, date: today, status: 'present' };

    const { error: upsertError } = await supabase
      .from(mode)
      .upsert([record], { onConflict: 'ID,date' })
      .select();

    if (upsertError) {
      alert(`Error recording ${mode}: ` + upsertError.message);
      console.error(`Error recording ${mode}:`, upsertError);
      barcodeInput.focus();
      return;
    }

    // Look up this member's photo (if any) and show it on screen.
    // This is display-only, in-memory state — it intentionally clears
    // on refresh, since it should only reflect the most recent scan.
    const { data: photoRow } = await supabase
      .from('photos')
      .select('photo_url')
      .eq('member_id', scannedID)
      .maybeSingle();

    const scanResult = document.getElementById('scanResult');
    const scanPhoto = document.getElementById('scanPhoto');
    const scanName = document.getElementById('scanName');

    scanName.textContent = member.Name;

    // Say which kind of scan just happened.
    const scanMessage = document.getElementById('scanMessage');
    const label = mode === 'communion' ? 'Communion recorded' : 'Attendance recorded';
    if (scanMessage) {
      scanMessage.textContent = label;
      scanMessage.className = 'scanMessage ' + mode;
    } else {
      // Fallback if the #scanMessage element isn't in the HTML yet
      scanName.textContent = `${member.Name} — ${label}`;
    }

    if (photoRow?.photo_url) {
      scanPhoto.src = photoRow.photo_url;
      scanPhoto.style.display = 'block';
    } else {
      scanPhoto.removeAttribute('src');
      scanPhoto.style.display = 'none';
    }

    scanResult.style.display = 'flex';
    barcodeInput.focus();
  }
});

// fills Attendance tables

const prevBtn = document.getElementById('aprev');
const nextBtn = document.getElementById('anext');
const dateInput = document.getElementById('attDate');
const typeSelect = document.getElementById('attType');

// Which list the attendance page is showing: 'attendance' or 'communion'.
// Falls back to attendance if the selector isn't in the HTML yet.
function currentType() {
  return typeSelect?.value === 'communion' ? 'communion' : 'attendance';
}

const pageSize = 20;
let currentPage = 1;

// Default the picker to today, using the same date format the scanner writes.
dateInput.value = new Date().toLocaleDateString('en-CA');

dateInput.addEventListener('change', () => {
  currentPage = 1;
  loadMembers();
});

typeSelect?.addEventListener('change', () => {
  currentPage = 1;
  loadMembers();
});

document.getElementById('exportAttendance').addEventListener('click', exportAttendanceCSV);

function csvEscape(value) {
  const str = String(value ?? '');
  if (str.includes(',') || str.includes('"') || str.includes('\n')) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

function downloadCSV(filename, lines) {
  const blob = new Blob([lines.join('\n')], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

async function exportAttendanceCSV() {
  const selectedDate = dateInput.value;

  // Communion export: every member is listed, with a Yes/No column showing
  // who took communion that day and who didn't.
  if (currentType() === 'communion') {
    const [membersResult, communionResult] = await Promise.all([
      supabase.from('members').select('ID, Name').order('ID', { ascending: true }),
      supabase.from('communion').select('ID').eq('date', selectedDate),
    ]);

    if (membersResult.error || communionResult.error) {
      alert('Export failed: ' + (membersResult.error?.message || communionResult.error?.message));
      console.error(membersResult.error, communionResult.error);
      return;
    }

    const tookCommunion = new Set(communionResult.data.map((r) => r.ID));

    const communionLines = ['ID,Name,Communion,Date'];
    membersResult.data.forEach((m) => {
      communionLines.push([
        m.ID,
        csvEscape(m.Name),
        tookCommunion.has(m.ID) ? 'Yes' : 'No',
        selectedDate,
      ].join(','));
    });

    downloadCSV(`communion_${selectedDate}.csv`, communionLines);
    return;
  }

  const [membersResult, attendanceResult] = await Promise.all([
    supabase.from('members').select('ID, Name'),
    supabase.from('attendance').select('ID, status').eq('date', selectedDate),
  ]);

  if (membersResult.error || attendanceResult.error) {
    alert('Export failed: ' + (membersResult.error?.message || attendanceResult.error?.message));
    console.error(membersResult.error, attendanceResult.error);
    return;
  }

  // Anyone with no attendance row for this date counts as absent.
  const statusByMember = Object.fromEntries(
    attendanceResult.data.map((r) => [r.ID, r.status ?? 'present'])
  );

  const rows = membersResult.data.map((m) => ({
    id: m.ID,
    name: m.Name,
    status: statusByMember[m.ID] ?? 'absent',
  }));

  const lines = ['ID,Name,Status,Date'];
  rows.forEach((r) => {
    lines.push([r.id, csvEscape(r.name), r.status, selectedDate].join(','));
  });

  downloadCSV(`attendance_${selectedDate}.csv`, lines);
}

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
  const selectedDate = dateInput.value;
  const type = currentType(); // 'attendance' or 'communion' — also the table name

  // ③ Fetch rows — scoped to whichever date is picked
  const { data: attend, error } = await supabase
    .from(type)
    .select('*')
    .eq('date', selectedDate)
    .range(from,to)
    .order('ID', { ascending: true });

    console.log('members →', attend, 'error →', error);   

if (error) {
    console.error("Failed to reload data:", error);
    return;
  }

  // A fresh load means nothing on screen is selected anymore
  selectedRow = null;

  // ④ Build and inject rows
  const tbody = document.querySelector('#attTable tbody');

  // Caption and last column header follow whichever list is showing
  document.querySelector('#attTable caption').textContent =
    type === 'communion' ? 'EPE Communion' : 'EPE Attendance';
  document.querySelector('#attTable thead th:last-child').textContent =
    type === 'communion' ? 'Communion' : 'Attendance';

  if (!attend.length) {
    tbody.innerHTML = `<tr><td colspan="5">No ${type} recorded for this date.</td></tr>`;
    return;
  }

  tbody.innerHTML = attend.map((m,i) => {

    const rowNumber = (currentPage - 1) * pageSize + i + 1;


    const [first, ...rest] = (m.Name ?? '').split(' ');
    const last = rest.join(' ');
    const status = m.status ?? 'present';

    // Communion rows have no present/absent/excused — being listed means
    // the person took communion that day.
    const lastCell = type === 'communion'
      ? 'Took communion'
      : `<select onclick="event.stopPropagation()" onchange="updateStatus(this, '${m.ID}', '${m.date}')">
          <option value="present" ${status === 'present' ? 'selected' : ''}>Present</option>
          <option value="absent" ${status === 'absent' ? 'selected' : ''}>Absent</option>
          <option value="excused" ${status === 'excused' ? 'selected' : ''}>Excused</option>
        </select>`;

    return `<tr data-id="${m.ID}" data-date="${m.date}" onclick="selectRow(this)">
      <td>${rowNumber}</td>
      <td>${m.ID}</td>
      <td>${first}</td>
      <td>${last}</td>
      <td>${lastCell}</td>
    </tr>`;
  }).join('');
}

// Run after the HTML is parsed
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', loadMembers);
} else {
  loadMembers();
}



// Selects row to be deleted — clicking the same row again deselects it.
let selectedRow = null;

window.selectRow = function(row){

  if (selectedRow === row) {
    row.style.backgroundColor = '';
    selectedRow = null;
    return;
  }

  if (selectedRow) {
    selectedRow.style.backgroundColor = '';
  }

  row.style.backgroundColor = 'lightcoral';
  selectedRow = row;
}


window.updateStatus = async function (selectEl, id, date) {
  const newStatus = selectEl.value;

  const { error } = await supabase
    .from('attendance')
    .update({ status: newStatus })
    .eq('ID', id)
    .eq('date', date);

  if (error) {
    alert('Failed to update status: ' + error.message);
    console.error(error);
  }
};


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
  .from(currentType())
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


window.logout = async function () {
  const { error } = await supabase.auth.signOut();

  if (error) {
    alert('Failed to log out: ' + error.message);
    console.error(error);
    return;
  }

  window.location.href = 'index.html'; // update to your actual login page's filename
};


// Open and close pop-up
window.memberModal = function () {
  document.getElementById('memberModal').style.display = 'block';
};

window.closeMemberModal = function () {
  document.getElementById('memberModal').style.display = 'none';
  document.getElementById('modalResult').textContent = '';
  document.getElementById('memberForm').reset();
  document.getElementById('modalPhotoFile').value = '';
  document.getElementById('modalPhotoStatus').textContent = '';
  document.getElementById('modalMemberID').disabled = false;

  // Reset back to "create" mode so a stray Cancel click never leaves
  // the form stuck thinking it's still editing someone.
  window.editingMemberId = null;
  document.querySelector('#memberModal h3').textContent = 'New Member';
  document.querySelector('#memberForm button[type="submit"]').textContent = 'Save';
};


// Uploads a photo file to Storage and links it to the given member ID
// in the photos table. Re-running this for the same member replaces
// their existing photo, since photos.member_id is unique.
async function uploadMemberPhoto(memberId, file) {
  const ext = file.name.split('.').pop();
  const path = `${memberId}/${Date.now()}.${ext}`;

  const { error: uploadErr } = await supabase.storage
    .from('pictures')
    .upload(path, file, { upsert: true });

  if (uploadErr) {
    throw new Error('Photo upload failed: ' + uploadErr.message);
  }

  const { data: publicUrlData } = supabase.storage
    .from('pictures')
    .getPublicUrl(path);

  const { error: linkErr } = await supabase
    .from('photos')
    .upsert(
      { member_id: memberId, photo_url: publicUrlData.publicUrl },
      { onConflict: 'member_id' }
    );

  if (linkErr) {
    throw new Error('Failed to link photo: ' + linkErr.message);
  }
}


document.getElementById('memberForm').addEventListener('submit', async (e) => {
  e.preventDefault();

  const name = document.getElementById('modalName').value.trim();
  const address = document.getElementById('modalMemberAddress').value.trim();
  const Phone = document.getElementById('modalMemberPhonenumber').value.trim();
  const contactcell = document.getElementById('modalMemberContactCell').value.trim();
  const emergencyContact = document.getElementById('modalMemberEmergencyContact').value.trim();
  const resultDiv = document.getElementById('modalResult');
  const photoFile = document.getElementById('modalPhotoFile').files[0];

  // --- Editing an existing member ---
  if (window.editingMemberId) {
    const newId = document.getElementById('modalMemberID').value.trim();

    if (!newId) {
      resultDiv.textContent = 'Member ID cannot be empty.';
      return;
    }

    // If the ID actually changed, make sure nobody else already has it
    // before touching anything.
    if (newId !== window.editingMemberId) {
      const { data: existing, error: checkErr } = await supabase
        .from('members')
        .select('ID')
        .eq('ID', newId)
        .maybeSingle();

      if (checkErr) {
        resultDiv.textContent = 'Error checking ID availability: ' + checkErr.message;
        return;
      }

      if (existing) {
        resultDiv.textContent = `ID "${newId}" is already in use by another member.`;
        return;
      }
    }

    const { error } = await supabase
      .from('members')
      .update({
        ID: newId,
        Name: name,
        Phone_Number: Phone,
        Contact_Cellphone: contactcell,
        Emergency_Contact: emergencyContact,
        Address: address,
      })
      .eq('ID', window.editingMemberId);

    if (error) {
      resultDiv.textContent = error.message;
      return;
    }

    resultDiv.textContent = newId !== window.editingMemberId
      ? `Member updated — ID changed to #${newId}.`
      : `Member #${window.editingMemberId} updated!`;

    // photos.member_id and attendance.ID follow the change automatically
    // (ON UPDATE CASCADE), so a new photo just needs to go under the new ID.
    window.editingMemberId = newId;

    if (photoFile) {
      try {
        await uploadMemberPhoto(window.editingMemberId, photoFile);
        resultDiv.textContent += ' Photo saved.';
      } catch (err) {
        resultDiv.textContent += ' (photo upload failed: ' + err.message + ')';
        console.error(err);
      }
    }

    setTimeout(closeMemberModal, 1000);
    window.loadMembersTable?.();
    return;
  }

  // --- Creating a new member ---
  const { data: lastMember, error: fetchError } = await supabase
    .from('members')
    .select('ID')
    .order('ID', { ascending: false })
    .limit(1)
    .single();

  const nextMemberId = lastMember ? parseInt(lastMember.ID) + 1 : 1;

  const { data, error } = await supabase
    .from('members')
    .insert([{
      ID: nextMemberId,
      Name: name,
      Phone_Number: Phone,
      Contact_Cellphone: contactcell,
      Emergency_Contact: emergencyContact,
      Address: address,
    }]);

  if (error) {
    resultDiv.textContent = error.message;
    return;
  }

  resultDiv.textContent = `Member #${nextMemberId} added!`;

  if (photoFile) {
    try {
      await uploadMemberPhoto(nextMemberId, photoFile);
      resultDiv.textContent += ' Photo saved.';
    } catch (err) {
      resultDiv.textContent += ' (photo upload failed: ' + err.message + ')';
      console.error(err);
    }
  }

  document.getElementById('memberForm').reset();
  setTimeout(closeMemberModal, 1000);
  window.loadMembersTable?.();
});