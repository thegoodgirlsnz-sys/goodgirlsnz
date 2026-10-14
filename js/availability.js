/* ==========================================================
   MISSY AVAILABILITY — PUBLIC READER
   ==========================================================
   Fetches availability from Supabase.
   Falls back to FALLBACK_AVAILABILITY if Supabase isn't set up yet.
   ========================================================== */

// ---- FALLBACK DATA (used until Supabase is connected) ----
const FALLBACK_WEEK_LABEL = 'This Week';

const FALLBACK_AVAILABILITY = [
  { day: 'Monday',    status: 'available', start_time: '10:00am', end_time: '4:00pm', note: '' },
  { day: 'Tuesday',   status: 'available', start_time: '12:00pm', end_time: '8:00pm', note: '' },
  { day: 'Wednesday', status: 'booked',    start_time: '',        end_time: '',       note: 'Fully Booked' },
  { day: 'Thursday',  status: 'available', start_time: '10:00am', end_time: '6:00pm', note: '' },
  { day: 'Friday',    status: 'available', start_time: '2:00pm',  end_time: '8:00pm', note: '' },
  { day: 'Saturday',  status: 'limited',   start_time: '',        end_time: '',       note: 'Limited Availability' },
  { day: 'Sunday',    status: 'closed',    start_time: '',        end_time: '',       note: 'Closed' }
];

// ---- HELPERS ----
function esc(str) {
  return String(str == null ? '' : str)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;').replace(/'/g, '&#039;');
}

function getStatusText(item) {
  if (item.note && item.note.trim() !== '') return item.note;
  switch (item.status) {
    case 'available': return 'Available';
    case 'limited':   return 'Limited Availability';
    case 'booked':    return 'Fully Booked';
    case 'closed':    return 'Closed';
    default:          return '';
  }
}

function getInfoText(item) {
  if (item.status === 'available' && item.start_time && item.end_time) {
    return 'Available: ' + item.start_time + ' – ' + item.end_time;
  }
  return getStatusText(item);
}

// ---- RENDER ----
function renderAvailability(weekLabel, days) {
  const grid = document.getElementById('availabilityGrid');
  const labelEl = document.getElementById('weekLabel');

  if (labelEl && weekLabel) labelEl.textContent = weekLabel;

  if (!grid) return;

  grid.innerHTML = '';

  days.forEach(item => {
    const card = document.createElement('div');
    card.className = 'day-card';
    card.innerHTML =
      '<div class="day-name">' + item.day + '</div>' +
      '<div class="day-info">' + getInfoText(item) + '</div>' +
      '<span class="day-status ' + item.status + '">' + getStatusText(item) + '</span>';
    grid.appendChild(card);
  });
}

// ---- LOAD DATA ----
const DAY_ORDER = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];

async function loadAvailability() {
  // If Supabase is not configured, use fallback
  if (!window.supabaseClient) {
    console.warn('[Availability] Supabase not connected - using fallback data.');
    renderAvailability(FALLBACK_WEEK_LABEL, FALLBACK_AVAILABILITY);
    return;
  }

  try {
    const { data, error } = await window.supabaseClient
      .from('availability')
      .select('day, status, start_time, end_time, note');

    if (error) throw error;

    if (!data || data.length === 0) {
      renderAvailability(FALLBACK_WEEK_LABEL, FALLBACK_AVAILABILITY);
      return;
    }

    // Sort Monday -> Sunday on the client (no extra DB column needed)
    data.sort((a, b) => DAY_ORDER.indexOf(a.day) - DAY_ORDER.indexOf(b.day));

    renderAvailability(FALLBACK_WEEK_LABEL, data);

  } catch (err) {
    console.error('[Availability] Error loading from Supabase:', err);
    renderAvailability(FALLBACK_WEEK_LABEL, FALLBACK_AVAILABILITY);
  }
}

// ---- INIT ----
document.addEventListener('DOMContentLoaded', loadAvailability);

// Re-fetch when the page is restored from back/forward cache or tab becomes visible again
window.addEventListener('pageshow', function (e) { if (e.persisted) loadAvailability(); });
document.addEventListener('visibilitychange', function () {
  if (document.visibilityState === 'visible') loadAvailability();
});
