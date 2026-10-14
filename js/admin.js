/* ==========================================================
   GOOD GIRLS — ADMIN LOGIC
   ==========================================================
   
   File:   js/admin.js
   Used:   admin-dashboard.html
   Purpose:
     - Protect the dashboard (only logged-in users)
     - Load the 7 days of availability from Supabase
     - Populate the form fields
     - Save edited availability back to Supabase
     - Logout
   
   Requires:
     - supabase-config.js (provides window.supabaseClient)
     - Supabase table `availability` with columns:
         id, day, status, start_time, end_time, note, updated_at
   
   ========================================================== */

(function () {
  'use strict';

  // ---- Day order (fixed) ----
  const DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];

  // ---- Status options (must match Supabase data values) ----
  const STATUS_OPTIONS = [
    { value: 'available', label: 'Available' },
    { value: 'limited',   label: 'Limited' },
    { value: 'booked',    label: 'Fully Booked' },
    { value: 'closed',    label: 'Closed' }
  ];

  // ---- DOM references ----
  const form = document.getElementById('availabilityForm');
  const daysGrid = document.getElementById('daysGrid');
  const messageEl = document.getElementById('message');
  const loadingState = document.getElementById('loadingState');
  const saveBtn = document.getElementById('saveBtn');
  const resetBtn = document.getElementById('resetBtn');
  const logoutBtn = document.getElementById('logoutBtn');
  const userEmailEl = document.getElementById('userEmail');

  // ---- Guard: Supabase must be configured ----
  if (!window.supabaseClient) {
    showMessage('error', 'Supabase is not configured. Please check supabase-config.js.');
    if (loadingState) loadingState.textContent = 'Configuration error.';
    return;
  }

  // ---- Helpers ----
  function showMessage(type, text) {
    if (!messageEl) return;
    messageEl.className = 'message ' + type + ' show';
    messageEl.textContent = text;
    // Auto-hide success messages after 4s
    if (type === 'success') {
      setTimeout(function () {
        messageEl.className = 'message';
        messageEl.textContent = '';
      }, 4000);
    }
  }

  function hideMessage() {
    if (!messageEl) return;
    messageEl.className = 'message';
    messageEl.textContent = '';
  }

  function setSaving(isSaving) {
    if (!saveBtn) return;
    saveBtn.disabled = isSaving;
    saveBtn.textContent = isSaving ? 'Saving…' : 'Save Changes';
  }

  function escapeHtml(str) {
    if (str === null || str === undefined) return '';
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }

  // ==========================================================
  // 1. AUTH CHECK
  // ==========================================================
  function checkSession() {
    return window.supabaseClient.auth.getSession().then(function (result) {
      const session = result && result.data ? result.data.session : null;
      if (!session) {
        window.location.href = 'admin-login.html';
        return null;
      }
      if (userEmailEl && session.user && session.user.email) {
        userEmailEl.textContent = session.user.email;
      }
      return session;
    });
  }

  // ==========================================================
  // 2. BUILD EMPTY FORM ROWS
  // ==========================================================
  function renderDayRows(rows) {
    // rows is an object keyed by day name
    daysGrid.innerHTML = '';

    DAYS.forEach(function (day) {
      const row = rows[day] || {
        day: day,
        status: 'closed',
        start_time: '',
        end_time: '',
        note: ''
      };

      const card = document.createElement('div');
      card.className = 'day-row';
      card.dataset.day = day;

      // Build status options
      let statusOptionsHTML = '';
      STATUS_OPTIONS.forEach(function (opt) {
        const selected = row.status === opt.value ? ' selected' : '';
        statusOptionsHTML +=
          '<option value="' + opt.value + '"' + selected + '>' + opt.label + '</option>';
      });

      card.innerHTML =
        '<div class="day-name">' + escapeHtml(day) + '</div>' +
        '<div>' +
          '<label class="field-label" for="status-' + day + '">Status</label>' +
          '<select id="status-' + day + '" data-field="status">' +
            statusOptionsHTML +
          '</select>' +
        '</div>' +
        '<div>' +
          '<label class="field-label" for="start-' + day + '">Start</label>' +
          '<input type="text" id="start-' + day + '" data-field="start_time" ' +
            'placeholder="10:00am" value="' + escapeHtml(row.start_time) + '" />' +
        '</div>' +
        '<div>' +
          '<label class="field-label" for="end-' + day + '">End</label>' +
          '<input type="text" id="end-' + day + '" data-field="end_time" ' +
            'placeholder="4:00pm" value="' + escapeHtml(row.end_time) + '" />' +
        '</div>' +
        '<div>' +
          '<label class="field-label" for="note-' + day + '">Note</label>' +
          '<input type="text" id="note-' + day + '" data-field="note" ' +
            'placeholder="Optional" value="' + escapeHtml(row.note) + '" />' +
        '</div>';

      daysGrid.appendChild(card);

      // Hook up enable/disable of time fields based on status
      const statusSelect = card.querySelector('select[data-field="status"]');
      const startInput = card.querySelector('input[data-field="start_time"]');
      const endInput = card.querySelector('input[data-field="end_time"]');

      function updateTimeFields() {
        if (statusSelect.value === 'available') {
          startInput.disabled = false;
          endInput.disabled = false;
        } else {
          startInput.disabled = true;
          endInput.disabled = true;
        }
      }

      statusSelect.addEventListener('change', updateTimeFields);
      updateTimeFields();
    });
  }

  // ==========================================================
  // 3. LOAD AVAILABILITY FROM SUPABASE
  // ==========================================================
  function loadAvailability() {
    if (loadingState) loadingState.style.display = 'block';
    if (form) form.style.display = 'none';

    return window.supabaseClient
      .from('availability')
      .select('id, day, status, start_time, end_time, note')
      .then(function (response) {
        if (response.error) {
          console.error('[Good Girls] Load error:', response.error);
          showMessage('error', 'Could not load availability: ' + response.error.message);
          if (loadingState) loadingState.textContent = 'Failed to load.';
          return;
        }

        // Map rows by day for quick lookup
        const rowsByDay = {};
        (response.data || []).forEach(function (row) {
          rowsByDay[row.day] = row;
        });

        renderDayRows(rowsByDay);

        if (loadingState) loadingState.style.display = 'none';
        if (form) form.style.display = 'block';
      })
      .catch(function (err) {
        console.error('[Good Girls] Load exception:', err);
        showMessage('error', 'Network error while loading availability.');
        if (loadingState) loadingState.textContent = 'Network error.';
      });
  }

  // ==========================================================
  // 4. COLLECT FORM DATA
  // ==========================================================
  function collectFormData() {
    const result = [];

    DAYS.forEach(function (day) {
      const card = daysGrid.querySelector('.day-row[data-day="' + day + '"]');
      if (!card) return;

      const status = card.querySelector('select[data-field="status"]').value;
      let start = card.querySelector('input[data-field="start_time"]').value.trim();
      let end = card.querySelector('input[data-field="end_time"]').value.trim();
      let note = card.querySelector('input[data-field="note"]').value.trim();

      // If not available, clear times to keep data clean
      if (status !== 'available') {
        start = '';
        end = '';
      }

      result.push({
        day: day,
        status: status,
        start_time: start,
        end_time: end,
        note: note
      });
    });

    return result;
  }

  // ==========================================================
  // 5. SAVE AVAILABILITY TO SUPABASE
  // ==========================================================
  function saveAvailability(e) {
    if (e) e.preventDefault();
    hideMessage();
    setSaving(true);

    const rows = collectFormData();

    // Upsert by `day` — requires a UNIQUE constraint on `day` column.
    window.supabaseClient
      .from('availability')
      .upsert(rows, { onConflict: 'day' })
      .then(function (response) {
        setSaving(false);

        if (response.error) {
          console.error('[Good Girls] Save error:', response.error);
          showMessage('error', 'Could not save: ' + response.error.message);
          return;
        }

        showMessage('success', 'Availability saved. Changes are now live.');
      })
      .catch(function (err) {
        setSaving(false);
        console.error('[Good Girls] Save exception:', err);
        showMessage('error', 'Network error while saving.');
      });
  }

  // ==========================================================
  // 6. RESET FORM (reload from Supabase)
  // ==========================================================
  function resetForm() {
    hideMessage();
    loadAvailability();
  }

  // ==========================================================
  // 7. LOGOUT
  // ==========================================================
  function logout() {
    window.supabaseClient.auth.signOut().then(function () {
      window.location.href = 'admin-login.html';
    }).catch(function (err) {
      console.error('[Good Girls] Logout error:', err);
      window.location.href = 'admin-login.html';
    });
  }

  // ==========================================================
  // 8. INIT
  // ==========================================================
  checkSession().then(function (session) {
    if (!session) return;

    loadAvailability();

    if (form) form.addEventListener('submit', saveAvailability);
    if (resetBtn) resetBtn.addEventListener('click', resetForm);
    if (logoutBtn) logoutBtn.addEventListener('click', logout);
  });

})();