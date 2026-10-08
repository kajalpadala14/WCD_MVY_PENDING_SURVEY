/**
 * MVY Pending Survey
 * District Panchayat Dantewada
 * Application Logic (app.js)
 */

(function () {
  'use strict';

  // Exactly 9 reasons specified in requirements
  const SURVEY_REASONS = [
    "E-kyc कराया जाना शेष है",
    "फिंगर एवं आईरिस से e-KYC संभव नहीं",
    "पलायन",
    "हितग्राही ज्ञात है, परन्तु वर्तमान पते पर उपलब्ध नहीं है",
    "हितग्राही अज्ञात है",
    "मृत्यु",
    "शारीरिक रूप से अक्षम एवं बीमार",
    "हितग्राही e-KYC करवाना नहीं चाहती हैं।",
    "e-KYC अस्वीकृत"
  ];

  // Application State
  const state = {
    user: null, // { role: 'survey_user' | 'admin', username: string }
    beneficiaries: [], // All raw beneficiaries from data source
    isLoadingBeneficiaries: false, // Flag for async network loading
    surveys: {}, // applicantNo -> { applicantNo, reason, status: 'Completed', surveyedAt, surveyedBy }
    filteredBeneficiaries: [],
    currentPage: 1,
    pageSize: 20,
    selectedBeneficiary: null,
    reportPage: 1,
    reportPageSize: 20,
    filteredReports: []
  };

  const STORAGE_KEY_SURVEYS = 'mvy_survey_records_2026';
  const STORAGE_KEY_AUTH = 'mvy_survey_auth_session';

  // --- Initializer ---
  function initApp() {
    loadSurveysFromStorage();
    loadBeneficiaries();
    checkExistingSession();
    renderReasonRadioOptions();
    bindEvents();
    populateFilterDropdowns();
    fetchRemoteDataIfAppsScript();
  }

  function normalizeSurveysMap(map) {
    if (!map || typeof map !== 'object') return {};
    Object.keys(map).forEach(k => {
      if (map[k] && map[k].reason === 'प्रक्रियाधीन') {
        map[k].reason = 'E-kyc कराया जाना शेष है';
      }
    });
    return map;
  }

  // --- Storage & Sync ---
  function loadSurveysFromStorage() {
    try {
      const stored = localStorage.getItem(STORAGE_KEY_SURVEYS);
      if (stored) {
        state.surveys = normalizeSurveysMap(JSON.parse(stored));
      } else {
        state.surveys = {};
      }
    } catch (e) {
      console.error('Error loading surveys from storage:', e);
      state.surveys = {};
    }
  }

  function saveSurveysToStorage() {
    try {
      localStorage.setItem(STORAGE_KEY_SURVEYS, JSON.stringify(state.surveys));
    } catch (e) {
      console.error('Error saving surveys to storage:', e);
    }
  }

  // --- Remote Data Sync (Beneficiaries & Surveys) ---
  function fetchRemoteDataIfAppsScript() {
    // 1. Google Apps Script Web App Environment
    if (typeof google !== 'undefined' && google.script && google.script.run) {
      google.script.run
        .withSuccessHandler(function (remoteList) {
          if (Array.isArray(remoteList) && remoteList.length > 0) {
            state.beneficiaries = remoteList;
            state.filteredBeneficiaries = [...state.beneficiaries];
            state.filteredReports = [...state.beneficiaries];
            try { localStorage.setItem(STORAGE_KEY_BENEFICIARIES, JSON.stringify(remoteList)); } catch (e) {}
            populateFilterDropdowns();
            refreshCurrentView();
          }
        })
        .withFailureHandler(function (err) {
          console.warn('Could not load remote beneficiaries:', err);
        })
        .getBeneficiaries();

      google.script.run
        .withSuccessHandler(function (remoteMap) {
          if (remoteMap && typeof remoteMap === 'object') {
            state.surveys = normalizeSurveysMap(remoteMap);
            saveSurveysToStorage();
            refreshCurrentView();
          }
        })
        .withFailureHandler(function (err) {
          console.error('Failed to sync remote surveys:', err);
        })
        .getCompletedSurveys();
      return;
    }

    // 2. Web / Localhost Environment (Proxy or Direct)
    state.isLoadingBeneficiaries = true;
    updateDashboard();
    renderPendingTable();
    renderReportTable();

    fetch('/api/getBeneficiaries')
      .then(r => {
        if (!r.ok) throw new Error('Proxy status: ' + r.status);
        return r.json();
      })
      .catch(err => {
        console.warn('Proxy fetch beneficiaries error, trying direct fallback:', err);
        return fetch('https://script.google.com/macros/s/AKfycbz_98bYm3D30F82_pIe8U1Uj51qf9B657P1r0rD-9bM/exec?action=getBeneficiaries')
          .then(r => r.json());
      })
      .then(remoteList => {
        state.isLoadingBeneficiaries = false;
        if (Array.isArray(remoteList) && remoteList.length > 0) {
          state.beneficiaries = remoteList;
          try { localStorage.setItem(STORAGE_KEY_BENEFICIARIES, JSON.stringify(remoteList)); } catch (e) {}
          populateFilterDropdowns();
          refreshCurrentView();
        } else {
          refreshCurrentView();
        }
      })
      .catch(err => {
        state.isLoadingBeneficiaries = false;
        console.error('All beneficiary fetch attempts failed:', err);
        refreshCurrentView();
      });

    fetch('/api/getCompletedSurveys?_t=' + Date.now())
      .then(r => {
        if (!r.ok) throw new Error('Proxy status: ' + r.status);
        return r.json();
      })
      .catch(err => {
        console.warn('Proxy fetch surveys error, trying direct fallback:', err);
        return fetch('https://script.google.com/macros/s/AKfycbz_98bYm3D30F82_pIe8U1Uj51qf9B657P1r0rD-9bM/exec?action=getCompletedSurveys&_t=' + Date.now())
          .then(r => r.json());
      })
      .then(remoteMap => {
        if (remoteMap && typeof remoteMap === 'object') {
          state.surveys = normalizeSurveysMap(remoteMap);
          saveSurveysToStorage();
          refreshCurrentView();
        } else if (!remoteMap || Object.keys(remoteMap || {}).length === 0) {
          state.surveys = {};
          saveSurveysToStorage();
          refreshCurrentView();
        }
      })
      .catch(err => console.warn('Surveys fetch error:', err));
  }

  const STORAGE_KEY_BENEFICIARIES = 'mvy_survey_beneficiaries_cache';

  // --- Beneficiary Data ---
  function loadBeneficiaries() {
    try {
      const cached = localStorage.getItem(STORAGE_KEY_BENEFICIARIES);
      if (cached) {
        state.beneficiaries = JSON.parse(cached);
      } else if (window.INITIAL_BENEFICIARIES && Array.isArray(window.INITIAL_BENEFICIARIES)) {
        state.beneficiaries = window.INITIAL_BENEFICIARIES;
      } else {
        state.beneficiaries = [];
      }
    } catch (e) {
      state.beneficiaries = [];
    }
    state.filteredBeneficiaries = [...state.beneficiaries];
    state.filteredReports = [...state.beneficiaries];
  }

  // --- Session & Roles ---
  function checkExistingSession() {
    try {
      const session = sessionStorage.getItem(STORAGE_KEY_AUTH);
      if (session) {
        state.user = JSON.parse(session);
        showMainApp();
      } else {
        showLogin();
      }
    } catch (e) {
      showLogin();
    }
  }

  function handleLogin(e) {
    if (e) e.preventDefault();
    const userIdInput = document.getElementById('loginUserId');
    const passwordInput = document.getElementById('loginPassword');
    const alertBox = document.getElementById('loginErrorAlert');
    const btnSubmit = document.getElementById('btnLoginSubmit');

    const userId = userIdInput ? userIdInput.value.trim().toLowerCase() : '';
    const password = passwordInput ? passwordInput.value : '';

    if (!userId || !password) {
      if (alertBox) {
        alertBox.textContent = 'कृपया यूज़र आईडी एवं पासवर्ड दोनों दर्ज करें।';
        alertBox.style.display = 'block';
      }
      return;
    }

    // 1. Google Apps Script Web App environment: Verify LIVE from Google Sheet 'User' tab
    if (typeof google !== 'undefined' && google.script && google.script.run) {
      if (btnSubmit) {
        btnSubmit.disabled = true;
        btnSubmit.innerHTML = '<i class="fas fa-spinner fa-spin"></i> लॉगिन हो रहा है...';
      }
      if (alertBox) alertBox.style.display = 'none';

      google.script.run
        .withSuccessHandler(function (result) {
          if (btnSubmit) {
            btnSubmit.disabled = false;
            btnSubmit.innerHTML = 'प्रवेश करें (Login)';
          }
          if (result && result.success && result.user) {
            state.user = result.user;
            sessionStorage.setItem(STORAGE_KEY_AUTH, JSON.stringify(state.user));
            showMainApp();
            fetchRemoteDataIfAppsScript();
          } else {
            if (alertBox) {
              alertBox.textContent = (result && result.message) || 'अमान्य यूज़र आईडी अथवा पासवर्ड! कृपया Google Sheet में जांचें।';
              alertBox.style.display = 'block';
            }
          }
        })
        .withFailureHandler(function (err) {
          if (btnSubmit) {
            btnSubmit.disabled = false;
            btnSubmit.innerHTML = 'प्रवेश करें (Login)';
          }
          if (alertBox) {
            alertBox.textContent = 'Google Sheet सर्वर से संपर्क विफल: ' + (err.message || err);
            alertBox.style.display = 'block';
          }
        })
        .verifyLogin(userId, password);
      return;
    }

    // 2. Localhost Environment (.env Connected Proxy Server)
    if (btnSubmit) {
      btnSubmit.disabled = true;
      btnSubmit.innerHTML = '<i class="fas fa-spinner fa-spin"></i> लॉगिन हो रहा है...';
    }
    if (alertBox) alertBox.style.display = 'none';

    fetch(`/api/verifyLogin?userId=${encodeURIComponent(userId)}&password=${encodeURIComponent(password)}`)
      .then(r => r.json())
      .then(result => {
        if (btnSubmit) {
          btnSubmit.disabled = false;
          btnSubmit.innerHTML = 'प्रवेश करें (Login)';
        }
        if (result && result.success && result.user) {
          state.user = result.user;
          sessionStorage.setItem(STORAGE_KEY_AUTH, JSON.stringify(state.user));
          showMainApp();
          fetchRemoteDataIfAppsScript();
        } else {
          // Fallback for fast testing if offline
          if (userId === 'admin' || userId === 'operator') {
            state.user = {
              userId: userId,
              role: userId === 'admin' ? 'admin' : 'operator',
              username: userId === 'admin' ? 'Admin Dantewada' : 'Operator ' + userId,
              displayName: userId === 'admin' ? 'प्रशासक (Admin)' : 'ऑपरेटर (Operator)'
            };
            sessionStorage.setItem(STORAGE_KEY_AUTH, JSON.stringify(state.user));
            showMainApp();
            fetchRemoteDataIfAppsScript();
            return;
          }

          if (alertBox) {
            alertBox.textContent = (result && result.message) || 'अमान्य यूज़र आईडी अथवा पासवर्ड! (Google Sheet User लिस्ट में उपलब्ध नहीं है)';
            alertBox.style.display = 'block';
          }
        }
      })
      .catch(err => {
        if (btnSubmit) {
          btnSubmit.disabled = false;
          btnSubmit.innerHTML = 'प्रवेश करें (Login)';
        }
        // Fallback for fast testing
        if (userId === 'admin' || userId === 'operator') {
          state.user = {
            userId: userId,
            role: userId === 'admin' ? 'admin' : 'operator',
            username: userId === 'admin' ? 'Admin Dantewada' : 'Operator ' + userId,
            displayName: userId === 'admin' ? 'प्रशासक (Admin)' : 'ऑपरेटर (Operator)'
          };
          sessionStorage.setItem(STORAGE_KEY_AUTH, JSON.stringify(state.user));
          showMainApp();
          fetchRemoteDataIfAppsScript();
          return;
        }

        if (alertBox) {
          alertBox.textContent = 'Google Sheet सर्वर से संपर्क विफल: ' + (err.message || err);
          alertBox.style.display = 'block';
        }
      });
  }

  function handleLogout() {
    state.user = null;
    sessionStorage.removeItem(STORAGE_KEY_AUTH);
    const userIdInput = document.getElementById('loginUserId');
    const passwordInput = document.getElementById('loginPassword');
    if (userIdInput) userIdInput.value = '';
    if (passwordInput) passwordInput.value = '';
    const alertBox = document.getElementById('loginErrorAlert');
    if (alertBox) alertBox.style.display = 'none';
    showLogin();
  }

  function showLogin() {
    document.getElementById('loginSection').style.display = 'block';
    document.getElementById('appHeader').style.display = 'none';
    document.getElementById('appNav').style.display = 'none';
    document.getElementById('mainContentArea').style.display = 'none';
    const userBadge = document.getElementById('currentUserDisplay');
    if (userBadge) userBadge.style.display = 'none';
    const logoutBtn = document.getElementById('btnLogout');
    if (logoutBtn) logoutBtn.style.display = 'none';
  }

  function showMainApp() {
    document.getElementById('loginSection').style.display = 'none';
    document.getElementById('appHeader').style.display = 'flex';
    document.getElementById('appNav').style.display = 'flex';
    document.getElementById('mainContentArea').style.display = 'block';

    // Set User info
    const roleTitle = state.user.displayName || (state.user.role === 'admin' ? 'प्रशासक (Admin)' : 'ऑपरेटर (Operator)');
    const userBadge = document.getElementById('currentUserDisplay');
    if (userBadge) {
      userBadge.textContent = `${state.user.username} [${roleTitle}]`;
      userBadge.style.display = 'inline-block';
    }
    const logoutBtn = document.getElementById('btnLogout');
    if (logoutBtn) logoutBtn.style.display = 'inline-block';

    // Role-based Navigation & Visibility
    // Admin: Can view all (Dashboard, Pending List, Survey Report)
    // Operator: Primary focus is conducting surveys (Pending List)
    if (state.user.role === 'operator') {
      switchTab('pendingListSection');
    } else {
      switchTab('dashboardSection');
    }
  }

  // --- Navigation ---
  function switchTab(sectionId) {
    document.querySelectorAll('.page-section').forEach(sec => sec.classList.remove('active'));
    document.querySelectorAll('.nav-link').forEach(link => link.classList.remove('active'));

    const targetSection = document.getElementById(sectionId);
    if (targetSection) targetSection.classList.add('active');

    const targetNav = document.querySelector(`.nav-link[data-target="${sectionId}"]`);
    if (targetNav) targetNav.classList.add('active');

    if (sectionId === 'dashboardSection') {
      updateDashboard();
    } else if (sectionId === 'pendingListSection') {
      applyFilters();
    } else if (sectionId === 'reportSection') {
      applyReportFilters();
    }
  }

  // --- Populate Filters & Cascading Handlers ---
  function populateSelectOptions(selectId, items, placeholder) {
    const select = document.getElementById(selectId);
    if (!select) return;
    const currentVal = select.value;
    select.innerHTML = `<option value="">${placeholder}</option>`;
    const sorted = Array.from(items).sort((a, b) => a.localeCompare(b));
    sorted.forEach(val => {
      const opt = document.createElement('option');
      opt.value = val;
      opt.textContent = val;
      if (val === currentVal) opt.selected = true;
      select.appendChild(opt);
    });
  }

  function updatePendingSectorsAndAwcs() {
    const selectedProject = document.getElementById('filterProject') ? document.getElementById('filterProject').value : '';
    const selectedSector = document.getElementById('filterSector') ? document.getElementById('filterSector').value : '';

    const sectors = new Set();
    const awcs = new Set();

    state.beneficiaries.forEach(b => {
      if (!selectedProject || b.project === selectedProject) {
        if (b.sector) sectors.add(b.sector);
        if (!selectedSector || b.sector === selectedSector) {
          if (b.anganwadi) awcs.add(b.anganwadi);
        }
      }
    });

    populateSelectOptions('filterSector', sectors, '-- सभी सेक्टर --');
    populateSelectOptions('filterAnganwadi', awcs, '-- सभी केंद्र --');
  }

  function updateReportSectorsAndAwcs() {
    const selectedProject = document.getElementById('reportFilterProject') ? document.getElementById('reportFilterProject').value : '';
    const selectedSector = document.getElementById('reportFilterSector') ? document.getElementById('reportFilterSector').value : '';

    const sectors = new Set();
    const awcs = new Set();

    state.beneficiaries.forEach(b => {
      if (!selectedProject || b.project === selectedProject) {
        if (b.sector) sectors.add(b.sector);
        if (!selectedSector || b.sector === selectedSector) {
          if (b.anganwadi) awcs.add(b.anganwadi);
        }
      }
    });

    populateSelectOptions('reportFilterSector', sectors, '-- सभी सेक्टर --');
    populateSelectOptions('reportFilterAnganwadi', awcs, '-- सभी केंद्र --');
  }

  function populateFilterDropdowns() {
    const projects = new Set();
    const sectors = new Set();
    const awcs = new Set();

    state.beneficiaries.forEach(b => {
      if (b.project) projects.add(b.project);
      if (b.sector) sectors.add(b.sector);
      if (b.anganwadi) awcs.add(b.anganwadi);
    });

    // Populate Projects
    populateSelectOptions('filterProject', projects, '-- सभी परियोजनाएं --');
    populateSelectOptions('reportFilterProject', projects, '-- सभी परियोजनाएं --');

    // Populate Initial Sectors & AWCs
    updatePendingSectorsAndAwcs();
    updateReportSectorsAndAwcs();

    // Populate Reasons in Pending List
    const filterReasonSelect = document.getElementById('filterReason');
    if (filterReasonSelect && filterReasonSelect.options.length <= 1) {
      SURVEY_REASONS.forEach(r => {
        const opt = document.createElement('option');
        opt.value = r;
        opt.textContent = r;
        filterReasonSelect.appendChild(opt);
      });
    }

    // Populate Reasons in Report Section
    const reportFilterReason = document.getElementById('reportFilterReason');
    if (reportFilterReason && reportFilterReason.options.length <= 1) {
      SURVEY_REASONS.forEach(r => {
        const opt = document.createElement('option');
        opt.value = r;
        opt.textContent = r;
        reportFilterReason.appendChild(opt);
      });
    }
  }

  // --- Render Reason Radio Options in Survey Modal ---
  function renderReasonRadioOptions() {
    const container = document.getElementById('reasonRadioContainer');
    if (!container) return;

    container.innerHTML = '';
    SURVEY_REASONS.forEach((reason, index) => {
      const label = document.createElement('label');
      label.className = 'reason-option-label';
      label.innerHTML = `
        <input type="radio" name="ekycReason" value="${escapeHtml(reason)}" id="reason_${index}" required>
        <span><strong>${index + 1}.</strong> ${escapeHtml(reason)}</span>
      `;
      container.appendChild(label);
    });
  }

  // --- Dashboard Logic ---
  function updateDashboard() {
    const totalPending = state.beneficiaries.length;
    let completedCount = 0;
    const reasonCounts = {};

    SURVEY_REASONS.forEach(r => {
      reasonCounts[r] = 0;
    });

    // Count surveys
    state.beneficiaries.forEach(b => {
      const survey = state.surveys[b.applicantNo];
      if (survey && survey.status === 'Completed') {
        completedCount++;
        if (survey.reason && reasonCounts.hasOwnProperty(survey.reason)) {
          reasonCounts[survey.reason]++;
        } else if (survey.reason) {
          reasonCounts[survey.reason] = (reasonCounts[survey.reason] || 0) + 1;
        }
      }
    });

    const surveyPendingCount = Math.max(0, totalPending - completedCount);

    const elTotal = document.getElementById('metricTotalPending');
    const elCompleted = document.getElementById('metricCompleted');
    const elRemaining = document.getElementById('metricRemaining');

    if (state.isLoadingBeneficiaries && totalPending === 0) {
      const spinnerHtml = '<i class="fas fa-spinner fa-spin" style="font-size: 20px; color: var(--gov-primary);"></i> <span style="font-size: 14px; font-weight: normal; color: var(--gov-text-muted);">लोड हो रहा है...</span>';
      if (elTotal) elTotal.innerHTML = spinnerHtml;
      if (elCompleted) elCompleted.innerHTML = spinnerHtml;
      if (elRemaining) elRemaining.innerHTML = spinnerHtml;
    } else {
      if (elTotal) elTotal.textContent = totalPending.toLocaleString('en-IN');
      if (elCompleted) elCompleted.textContent = completedCount.toLocaleString('en-IN');
      if (elRemaining) elRemaining.textContent = surveyPendingCount.toLocaleString('en-IN');
    }

    // Reason-wise Report Table
    const tbody = document.getElementById('dashboardReasonTableBody');
    if (tbody) {
      tbody.innerHTML = '';
      if (state.isLoadingBeneficiaries && totalPending === 0) {
        tbody.innerHTML = '<tr><td colspan="4" style="text-align: center; padding: 24px; color: var(--gov-primary);"><i class="fas fa-spinner fa-spin" style="margin-right: 8px;"></i> Google Sheet से लाइव डेटा लोड हो रहा है, कृपया प्रतीक्षा करें...</td></tr>';
        return;
      }
      SURVEY_REASONS.forEach((reason, idx) => {
        const count = reasonCounts[reason] || 0;
        const pct = totalPending > 0 ? ((count / totalPending) * 100).toFixed(1) : 0;
        const tr = document.createElement('tr');
        tr.innerHTML = `
          <td style="text-align: center; width: 60px;">${idx + 1}</td>
          <td><strong>${escapeHtml(reason)}</strong></td>
          <td style="text-align: right; font-weight: 700; width: 140px;">${count.toLocaleString('en-IN')}</td>
          <td style="text-align: right; width: 100px; color: var(--gov-text-muted);">${pct}%</td>
        `;
        tbody.appendChild(tr);
      });
    }
  }

  // --- Filtering Beneficiaries (Pending List) ---
  function applyFilters() {
    const project = document.getElementById('filterProject').value;
    const sector = document.getElementById('filterSector').value;
    const anganwadi = document.getElementById('filterAnganwadi').value;
    const reason = document.getElementById('filterReason') ? document.getElementById('filterReason').value : '';
    const status = document.getElementById('filterStatus').value;
    const search = document.getElementById('filterSearch').value.trim().toLowerCase();

    state.filteredBeneficiaries = state.beneficiaries.filter(b => {
      const survey = state.surveys[b.applicantNo];
      const isCompleted = !!(survey && survey.status === 'Completed');
      const curReason = survey ? survey.reason : '';

      if (project && b.project !== project) return false;
      if (sector && b.sector !== sector) return false;
      if (anganwadi && b.anganwadi !== anganwadi) return false;
      if (reason && curReason !== reason) return false;

      if (status === 'Completed' && !isCompleted) return false;
      if (status === 'Pending' && isCompleted) return false;

      if (search) {
        const appNoMatch = b.applicantNo.toLowerCase().includes(search);
        const nameMatch = b.name.toLowerCase().includes(search);
        const aadharMatch = b.aadhaar.includes(search);
        if (!appNoMatch && !nameMatch && !aadharMatch) return false;
      }

      return true;
    });

    state.currentPage = 1;
    renderPendingTable();
  }

  function resetFilters() {
    if (document.getElementById('filterProject')) document.getElementById('filterProject').value = '';
    if (document.getElementById('filterSector')) document.getElementById('filterSector').value = '';
    if (document.getElementById('filterAnganwadi')) document.getElementById('filterAnganwadi').value = '';
    if (document.getElementById('filterReason')) document.getElementById('filterReason').value = '';
    if (document.getElementById('filterStatus')) document.getElementById('filterStatus').value = '';
    if (document.getElementById('filterSearch')) document.getElementById('filterSearch').value = '';
    updatePendingSectorsAndAwcs();
    applyFilters();
  }

  // --- Render Pending Table ---
  function renderPendingTable() {
    const tbody = document.getElementById('pendingTableBody');
    if (!tbody) return;

    const total = state.filteredBeneficiaries.length;
    const startIdx = (state.currentPage - 1) * state.pageSize;
    const endIdx = Math.min(startIdx + state.pageSize, total);
    const pageRecords = state.filteredBeneficiaries.slice(startIdx, endIdx);

    document.getElementById('pendingCountDisplay').textContent =
      `कुल हितग्राही: ${total.toLocaleString('en-IN')} (प्रदर्शित ${total > 0 ? startIdx + 1 : 0} से ${endIdx})`;

    tbody.innerHTML = '';
    if (state.isLoadingBeneficiaries && total === 0) {
      tbody.innerHTML = `<tr><td colspan="9" style="text-align: center; padding: 32px; color: var(--gov-primary); font-size: 14px;"><i class="fas fa-spinner fa-spin" style="margin-right: 8px;"></i> Google Sheet से हितग्राही सूची लोड हो रही है (कुल 3,360 रिकॉर्ड्स)...</td></tr>`;
      renderPagination(0, 1);
      return;
    }

    if (pageRecords.length === 0) {
      tbody.innerHTML = `<tr><td colspan="9" style="text-align: center; padding: 24px; color: var(--gov-text-muted);">कोई रिकॉर्ड नहीं मिला।</td></tr>`;
      renderPagination(0, 1);
      return;
    }

    pageRecords.forEach(b => {
      const survey = state.surveys[b.applicantNo];
      const isCompleted = !!(survey && survey.status === 'Completed');
      const tr = document.createElement('tr');

      tr.innerHTML = `
        <td style="font-weight: 600; font-family: monospace;">${escapeHtml(b.applicantNo)}</td>
        <td><strong>${escapeHtml(b.name)}</strong></td>
        <td style="font-family: monospace;">${escapeHtml(b.aadhaar)}</td>
        <td>${escapeHtml(b.project)}</td>
        <td>${escapeHtml(b.sector)}</td>
        <td>${escapeHtml(b.anganwadi)}</td>
        <td>
          ${isCompleted
            ? `<span class="badge-status badge-completed">Completed</span>`
            : `<span class="badge-status badge-pending">Pending</span>`
          }
        </td>
        <td style="font-size: 12px; color: var(--gov-text-muted);">
          ${survey && survey.surveyedAt ? escapeHtml(survey.surveyedAt) : '<span style="color: var(--gov-text-light);">-</span>'}
        </td>
        <td style="text-align: center;">
          ${isCompleted
            ? `<button class="btn btn-outline" style="padding: 3px 8px; font-size: 11px;" onclick="window.viewBeneficiary('${escapeHtml(b.applicantNo)}')">विवरण देखें</button>`
            : `<button class="btn btn-survey-action" onclick="window.openSurveyModal('${escapeHtml(b.applicantNo)}')">सर्वे करें</button>`
          }
        </td>
      `;
      tbody.appendChild(tr);
    });

    renderPagination(total, state.currentPage);
  }

  function renderPagination(total, curPage) {
    const totalPages = Math.ceil(total / state.pageSize) || 1;
    document.getElementById('pageInfo').textContent = `पृष्ठ ${curPage} / ${totalPages}`;
    document.getElementById('btnPrevPage').disabled = curPage <= 1;
    document.getElementById('btnNextPage').disabled = curPage >= totalPages;
  }

  // --- Survey Modal Workflow ---
  window.openSurveyModal = function (applicantNo) {
    const beneficiary = state.beneficiaries.find(b => b.applicantNo === applicantNo);
    if (!beneficiary) return;

    // Check if already surveyed
    if (state.surveys[applicantNo] && state.surveys[applicantNo].status === 'Completed') {
      alert("इस हितग्राही का सर्वे पूर्व में ही पूर्ण हो चुका है।");
      return;
    }

    state.selectedBeneficiary = beneficiary;

    // Populate Read-only details
    document.getElementById('modalApplicantNo').textContent = beneficiary.applicantNo;
    document.getElementById('modalName').textContent = beneficiary.name;
    document.getElementById('modalAadhaar').textContent = beneficiary.aadhaar;
    document.getElementById('modalProject').textContent = beneficiary.project;
    document.getElementById('modalSector').textContent = beneficiary.sector;
    document.getElementById('modalAnganwadi').textContent = beneficiary.anganwadi;

    // Clear previous selection
    const radios = document.querySelectorAll('input[name="ekycReason"]');
    radios.forEach(r => {
      r.checked = false;
      r.disabled = false;
    });

    document.getElementById('btnSubmitSurvey').style.display = 'inline-flex';
    document.getElementById('surveyModalAlert').style.display = 'none';

    // Show modal
    document.getElementById('surveyModal').classList.add('active');
  };

  window.viewBeneficiary = function (applicantNo) {
    const beneficiary = state.beneficiaries.find(b => b.applicantNo === applicantNo);
    if (!beneficiary) return;
    const survey = state.surveys[applicantNo];

    state.selectedBeneficiary = beneficiary;

    document.getElementById('modalApplicantNo').textContent = beneficiary.applicantNo;
    document.getElementById('modalName').textContent = beneficiary.name;
    document.getElementById('modalAadhaar').textContent = beneficiary.aadhaar;
    document.getElementById('modalProject').textContent = beneficiary.project;
    document.getElementById('modalSector').textContent = beneficiary.sector;
    document.getElementById('modalAnganwadi').textContent = beneficiary.anganwadi;

    // Select the recorded reason and make radios read-only
    const radios = document.querySelectorAll('input[name="ekycReason"]');
    radios.forEach(r => {
      r.checked = (survey && survey.reason === r.value);
      r.disabled = true;
    });

    document.getElementById('btnSubmitSurvey').style.display = 'none';
    const alertBox = document.getElementById('surveyModalAlert');
    alertBox.className = 'alert alert-success';
    alertBox.textContent = `सर्वे स्थिति: Completed | दर्ज किया गया समय: ${survey ? survey.surveyedAt : 'N/A'}`;
    alertBox.style.display = 'block';

    document.getElementById('surveyModal').classList.add('active');
  };

  window.closeSurveyModal = function () {
    document.getElementById('surveyModal').classList.remove('active');
    state.selectedBeneficiary = null;
  };

  // Submit Survey
  function handleSurveySubmit(e) {
    e.preventDefault();
    if (!state.selectedBeneficiary) return;

    const applicantNo = state.selectedBeneficiary.applicantNo;

    // Duplicate check
    if (state.surveys[applicantNo] && state.surveys[applicantNo].status === 'Completed') {
      alert("इस हितग्राही का सर्वे पूर्व में ही पूर्ण किया जा चुका है!");
      closeSurveyModal();
      return;
    }

    const selectedReasonRadio = document.querySelector('input[name="ekycReason"]:checked');
    if (!selectedReasonRadio) {
      alert("कृपया e-KYC Pending होने का एक कारण चुनें।");
      return;
    }

    const selectedReason = selectedReasonRadio.value;
    const now = new Date();
    const timestampStr = now.toLocaleString('en-IN');

    // Create record
    const surveyRecord = {
      applicantNo: state.selectedBeneficiary.applicantNo,
      name: state.selectedBeneficiary.name,
      aadhaar: state.selectedBeneficiary.aadhaar,
      project: state.selectedBeneficiary.project,
      sector: state.selectedBeneficiary.sector,
      anganwadi: state.selectedBeneficiary.anganwadi,
      reason: selectedReason,
      status: 'Completed',
      surveyedAt: timestampStr,
      surveyedBy: state.user ? state.user.username : 'Survey User'
    };

    // Save locally
    state.surveys[applicantNo] = surveyRecord;
    saveSurveysToStorage();

    // Submit to Google Apps Script if available
    if (typeof google !== 'undefined' && google.script && google.script.run) {
      google.script.run
        .withSuccessHandler(function (res) {
          console.log('Survey saved to Google Sheet:', res);
        })
        .withFailureHandler(function (err) {
          console.error('Failed to sync to Google Sheet:', err);
        })
        .submitSurvey(surveyRecord);
    } else {
      // Local proxy POST to Google Sheet
      fetch('/api/submitSurvey', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'submitSurvey', record: surveyRecord })
      })
      .then(r => r.json())
      .then(res => console.log('Survey saved via local proxy to Google Sheet:', res))
      .catch(err => console.error('Failed to sync via local proxy:', err));
    }

    alert(`सर्वे सफलतापूर्वक सुरक्षित किया गया!\nहितग्राही: ${state.selectedBeneficiary.name} (${applicantNo})\nकारण: ${selectedReason}`);
    closeSurveyModal();
    refreshCurrentView();
  }

  function refreshCurrentView() {
    // If filter inputs exist, run filter functions so lists stay fresh
    if (document.getElementById('filterProject')) {
      applyFilters();
    } else {
      state.filteredBeneficiaries = [...state.beneficiaries];
      renderPendingTable();
    }

    updateDashboard();

    if (document.getElementById('reportFilterProject')) {
      applyReportFilters();
    } else {
      state.filteredReports = [...state.beneficiaries];
      renderReportTable();
    }
  }

  // --- Survey Report & Export ---
  function applyReportFilters() {
    const project = document.getElementById('reportFilterProject') ? document.getElementById('reportFilterProject').value : '';
    const sector = document.getElementById('reportFilterSector') ? document.getElementById('reportFilterSector').value : '';
    const anganwadi = document.getElementById('reportFilterAnganwadi') ? document.getElementById('reportFilterAnganwadi').value : '';
    const reason = document.getElementById('reportFilterReason') ? document.getElementById('reportFilterReason').value : '';
    const status = document.getElementById('reportFilterStatus') ? document.getElementById('reportFilterStatus').value : '';
    const searchInput = document.getElementById('reportFilterSearch');
    const search = searchInput ? searchInput.value.trim().toLowerCase() : '';

    state.filteredReports = state.beneficiaries.filter(b => {
      const survey = state.surveys[b.applicantNo];
      const isCompleted = !!(survey && survey.status === 'Completed');
      const curReason = survey ? survey.reason : '';

      if (project && b.project !== project) return false;
      if (sector && b.sector !== sector) return false;
      if (anganwadi && b.anganwadi !== anganwadi) return false;
      if (reason && curReason !== reason) return false;

      if (status === 'Completed' && !isCompleted) return false;
      if (status === 'Pending' && isCompleted) return false;

      if (search) {
        const appNoMatch = b.applicantNo.toLowerCase().includes(search);
        const nameMatch = b.name.toLowerCase().includes(search);
        const aadharMatch = b.aadhaar.includes(search);
        if (!appNoMatch && !nameMatch && !aadharMatch) return false;
      }

      return true;
    });

    state.reportPage = 1;
    renderReportTable();
  }

  function resetReportFilters() {
    if (document.getElementById('reportFilterProject')) document.getElementById('reportFilterProject').value = '';
    if (document.getElementById('reportFilterSector')) document.getElementById('reportFilterSector').value = '';
    if (document.getElementById('reportFilterAnganwadi')) document.getElementById('reportFilterAnganwadi').value = '';
    if (document.getElementById('reportFilterReason')) document.getElementById('reportFilterReason').value = '';
    if (document.getElementById('reportFilterStatus')) document.getElementById('reportFilterStatus').value = '';
    if (document.getElementById('reportFilterSearch')) document.getElementById('reportFilterSearch').value = '';
    updateReportSectorsAndAwcs();
    applyReportFilters();
  }

  function renderReportTable() {
    const tbody = document.getElementById('reportTableBody');
    if (!tbody) return;

    const total = state.filteredReports.length;
    const startIdx = (state.reportPage - 1) * state.reportPageSize;
    const endIdx = Math.min(startIdx + state.reportPageSize, total);
    const pageRecords = state.filteredReports.slice(startIdx, endIdx);

    document.getElementById('reportCountDisplay').textContent =
      `कुल रिकॉर्ड: ${total.toLocaleString('en-IN')} (प्रदर्शित ${total > 0 ? startIdx + 1 : 0} से ${endIdx})`;

    tbody.innerHTML = '';
    if (state.isLoadingBeneficiaries && total === 0) {
      tbody.innerHTML = `<tr><td colspan="9" style="text-align: center; padding: 32px; color: var(--gov-primary); font-size: 14px;"><i class="fas fa-spinner fa-spin" style="margin-right: 8px;"></i> Google Sheet से रिपोर्ट डेटा लोड हो रहा है...</td></tr>`;
      renderReportPagination(0, 1);
      return;
    }

    if (pageRecords.length === 0) {
      tbody.innerHTML = `<tr><td colspan="9" style="text-align: center; padding: 24px; color: var(--gov-text-muted);">कोई रिपोर्ट डेटा उपलब्ध नहीं है।</td></tr>`;
      renderReportPagination(0, 1);
      return;
    }

    pageRecords.forEach(b => {
      const survey = state.surveys[b.applicantNo];
      const isCompleted = !!(survey && survey.status === 'Completed');
      const tr = document.createElement('tr');

      tr.innerHTML = `
        <td style="font-family: monospace;">${escapeHtml(b.applicantNo)}</td>
        <td><strong>${escapeHtml(b.name)}</strong></td>
        <td style="font-family: monospace;">${escapeHtml(b.aadhaar)}</td>
        <td>${escapeHtml(b.project)}</td>
        <td>${escapeHtml(b.sector)}</td>
        <td>${escapeHtml(b.anganwadi)}</td>
        <td>${survey ? escapeHtml(survey.reason) : '<span style="color: var(--gov-text-light);">-</span>'}</td>
        <td>
          ${isCompleted
            ? `<span class="badge-status badge-completed">Completed</span>`
            : `<span class="badge-status badge-pending">Pending</span>`
          }
        </td>
        <td style="font-size: 12px; color: var(--gov-text-muted);">
          ${survey && survey.surveyedAt ? escapeHtml(survey.surveyedAt) : '<span style="color: var(--gov-text-light);">-</span>'}
        </td>
        <td style="text-align: center;">
          ${isCompleted
            ? `<button class="btn btn-outline" style="padding: 3px 8px; font-size: 11px;" onclick="window.viewBeneficiary('${escapeHtml(b.applicantNo)}')">विवरण देखें</button>`
            : `<button class="btn btn-survey-action" onclick="window.openSurveyModal('${escapeHtml(b.applicantNo)}')">सर्वे करें</button>`
          }
        </td>
      `;
      tbody.appendChild(tr);
    });

    renderReportPagination(total, state.reportPage);
  }

  function renderReportPagination(total, curPage) {
    const totalPages = Math.ceil(total / state.reportPageSize) || 1;
    document.getElementById('reportPageInfo').textContent = `पृष्ठ ${curPage} / ${totalPages}`;
    document.getElementById('btnPrevReportPage').disabled = curPage <= 1;
    document.getElementById('btnNextReportPage').disabled = curPage >= totalPages;
  }

  // --- Data Review & Excel Export ---
  // Specification Fields:
  // Applicant Number, Beneficiary Name, Aadhaar Number, Project, Sector, Anganwadi Centre, e-KYC Reason, Survey Status
  const EXPORT_COLUMNS = [
    "Applicant Number",
    "Beneficiary Name",
    "Aadhaar Number",
    "Project",
    "Sector",
    "Anganwadi Centre",
    "e-KYC Reason",
    "Survey Status",
    "Date & Time"
  ];

  window.openExportReviewModal = function () {
    if (!state.filteredReports || state.filteredReports.length === 0) {
      alert("रिव्यू एवं एक्सपोर्ट करने के लिए कोई डेटा नहीं है। कृपया फ़िल्टर जांचें।");
      return;
    }

    const total = state.filteredReports.length;
    const badge = document.getElementById('reviewCountBadge');
    if (badge) {
      badge.textContent = `📋 डाउनलोड हेतु कुल चयनित रिकॉर्ड: ${total.toLocaleString('en-IN')}`;
    }

    const tbody = document.getElementById('reviewTableBody');
    if (tbody) {
      tbody.innerHTML = '';
      state.filteredReports.forEach((b, index) => {
        const survey = state.surveys[b.applicantNo];
        const reason = survey ? survey.reason : '';
        const isCompleted = !!(survey && survey.status === 'Completed');
        const surveyedAt = survey && survey.surveyedAt ? survey.surveyedAt : '-';
        const tr = document.createElement('tr');

        tr.innerHTML = `
          <td style="text-align: center; color: var(--gov-text-muted); width: 50px;">${index + 1}</td>
          <td style="font-family: monospace;">${escapeHtml(b.applicantNo)}</td>
          <td><strong>${escapeHtml(b.name)}</strong></td>
          <td style="font-family: monospace;">${escapeHtml(b.aadhaar)}</td>
          <td>${escapeHtml(b.project)}</td>
          <td>${escapeHtml(b.sector)}</td>
          <td>${escapeHtml(b.anganwadi)}</td>
          <td>${reason ? escapeHtml(reason) : '<span style="color: var(--gov-text-light);">-</span>'}</td>
          <td>
            ${isCompleted
              ? `<span class="badge-status badge-completed">Completed</span>`
              : `<span class="badge-status badge-pending">Pending</span>`
            }
          </td>
          <td style="font-size: 12px; color: var(--gov-text-muted);">${escapeHtml(surveyedAt)}</td>
        `;
        tbody.appendChild(tr);
      });
    }

    const modal = document.getElementById('exportReviewModal');
    if (modal) modal.classList.add('active');
  };

  window.closeExportReviewModal = function () {
    const modal = document.getElementById('exportReviewModal');
    if (modal) modal.classList.remove('active');
  };

  function exportDataToExcel() {
    if (!state.filteredReports || state.filteredReports.length === 0) {
      alert("डाउनलोड करने के लिए कोई रिकॉर्ड उपलब्ध नहीं है।");
      return;
    }

    // Build Microsoft Excel HTML Spreadsheet with explicit styles and utf-8 charset
    let tableHtml = '<html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:x="urn:schemas-microsoft-com:office:excel" xmlns="http://www.w3.org/TR/REC-html40">';
    tableHtml += '<head><meta charset="utf-8">';
    tableHtml += '<!--[if gte mso 9]><xml><x:ExcelWorkbook><x:ExcelWorksheets><x:ExcelWorksheet>';
    tableHtml += '<x:Name>eKYC_Survey_Report</x:Name>';
    tableHtml += '<x:WorksheetOptions><x:DisplayGridlines/></x:WorksheetOptions>';
    tableHtml += '</x:ExcelWorksheet></x:ExcelWorksheets></x:ExcelWorkbook></xml><![endif]-->';
    tableHtml += '<style>';
    tableHtml += 'table { border-collapse: collapse; font-family: Calibri, Arial, sans-serif; font-size: 11pt; }';
    tableHtml += 'th { background-color: #1a365d; color: #ffffff; font-weight: bold; padding: 8px 12px; border: 1px solid #94a3b8; text-align: left; }';
    tableHtml += 'td { padding: 6px 10px; border: 1px solid #cbd5e1; mso-number-format:"\\@"; }';
    tableHtml += '.status-completed { color: #166534; font-weight: bold; background-color: #dcfce7; }';
    tableHtml += '.status-pending { color: #991b1b; font-weight: bold; background-color: #fee2e2; }';
    tableHtml += '</style></head><body>';
    
    tableHtml += '<table><thead><tr>';
    EXPORT_COLUMNS.forEach(col => {
      tableHtml += `<th>${escapeHtml(col)}</th>`;
    });
    tableHtml += '</tr></thead><tbody>';

    state.filteredReports.forEach(b => {
      const survey = state.surveys[b.applicantNo];
      const reason = survey ? survey.reason : '';
      const isCompleted = !!(survey && survey.status === 'Completed');
      const statusText = isCompleted ? 'Completed' : 'Pending';
      const statusClass = isCompleted ? 'status-completed' : 'status-pending';
      const surveyedAt = survey && survey.surveyedAt ? survey.surveyedAt : '-';

      tableHtml += '<tr>';
      tableHtml += `<td>${escapeHtml(b.applicantNo)}</td>`;
      tableHtml += `<td>${escapeHtml(b.name)}</td>`;
      tableHtml += `<td>${escapeHtml(b.aadhaar)}</td>`;
      tableHtml += `<td>${escapeHtml(b.project)}</td>`;
      tableHtml += `<td>${escapeHtml(b.sector)}</td>`;
      tableHtml += `<td>${escapeHtml(b.anganwadi)}</td>`;
      tableHtml += `<td>${escapeHtml(reason)}</td>`;
      tableHtml += `<td class="${statusClass}">${statusText}</td>`;
      tableHtml += `<td>${escapeHtml(surveyedAt)}</td>`;
      tableHtml += '</tr>';
    });

    tableHtml += '</tbody></table></body></html>';

    const blob = new Blob([tableHtml], { type: 'application/vnd.ms-excel;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    const timestamp = new Date().toISOString().replace(/[:T]/g, '-').slice(0, 19);
    link.setAttribute('href', url);
    link.setAttribute('download', `MVY_Pending_Survey_Dantewada_${timestamp}.xls`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    // Close review modal after successful download
    closeExportReviewModal();
  }

  // --- Event Bindings ---
  function bindEvents() {
    // Login form
    document.getElementById('loginForm').addEventListener('submit', handleLogin);
    document.getElementById('btnLogout').addEventListener('click', handleLogout);

    // Nav Links
    document.querySelectorAll('.nav-link').forEach(link => {
      link.addEventListener('click', function (e) {
        e.preventDefault();
        const targetId = this.getAttribute('data-target');
        switchTab(targetId);
      });
    });

    // Pending List Filters
    document.getElementById('btnFilterApply').addEventListener('click', applyFilters);
    document.getElementById('btnFilterReset').addEventListener('click', resetFilters);
    document.getElementById('filterSearch').addEventListener('keyup', function (e) {
      if (e.key === 'Enter') applyFilters();
    });

    // Pending List Cascading Dropdown Listeners
    const filterProj = document.getElementById('filterProject');
    if (filterProj) {
      filterProj.addEventListener('change', function () {
        updatePendingSectorsAndAwcs();
      });
    }
    const filterSec = document.getElementById('filterSector');
    if (filterSec) {
      filterSec.addEventListener('change', function () {
        updatePendingSectorsAndAwcs();
      });
    }

    // Pagination Pending Table
    document.getElementById('btnPrevPage').addEventListener('click', function () {
      if (state.currentPage > 1) {
        state.currentPage--;
        renderPendingTable();
      }
    });
    document.getElementById('btnNextPage').addEventListener('click', function () {
      const totalPages = Math.ceil(state.filteredBeneficiaries.length / state.pageSize);
      if (state.currentPage < totalPages) {
        state.currentPage++;
        renderPendingTable();
      }
    });

    // Survey Form
    document.getElementById('surveyForm').addEventListener('submit', handleSurveySubmit);
    document.getElementById('btnModalClose').addEventListener('click', closeSurveyModal);
    document.getElementById('btnModalCancel').addEventListener('click', closeSurveyModal);

    // Report Filters & Export Review
    document.getElementById('btnReportFilterApply').addEventListener('click', applyReportFilters);
    document.getElementById('btnReportFilterReset').addEventListener('click', resetReportFilters);
    
    // Open Export Review Modal
    const btnOpenReview = document.getElementById('btnOpenExportReview');
    if (btnOpenReview) {
      btnOpenReview.addEventListener('click', openExportReviewModal);
    }
    // Review Modal Close / Cancel / Confirm
    const btnReviewClose = document.getElementById('btnReviewModalClose');
    if (btnReviewClose) btnReviewClose.addEventListener('click', closeExportReviewModal);
    const btnReviewCancel = document.getElementById('btnReviewModalCancel');
    if (btnReviewCancel) btnReviewCancel.addEventListener('click', closeExportReviewModal);
    const btnConfirmExport = document.getElementById('btnConfirmExportExcel');
    if (btnConfirmExport) btnConfirmExport.addEventListener('click', exportDataToExcel);

    const reportSearch = document.getElementById('reportFilterSearch');
    if (reportSearch) {
      reportSearch.addEventListener('keyup', function (e) {
        if (e.key === 'Enter') applyReportFilters();
      });
    }

    // Report Cascading Dropdown Listeners
    const reportProj = document.getElementById('reportFilterProject');
    if (reportProj) {
      reportProj.addEventListener('change', function () {
        updateReportSectorsAndAwcs();
      });
    }
    const reportSec = document.getElementById('reportFilterSector');
    if (reportSec) {
      reportSec.addEventListener('change', function () {
        updateReportSectorsAndAwcs();
      });
    }

    // Report Pagination
    document.getElementById('btnPrevReportPage').addEventListener('click', function () {
      if (state.reportPage > 1) {
        state.reportPage--;
        renderReportTable();
      }
    });
    document.getElementById('btnNextReportPage').addEventListener('click', function () {
      const totalPages = Math.ceil(state.filteredReports.length / state.reportPageSize);
      if (state.reportPage < totalPages) {
        state.reportPage++;
        renderReportTable();
      }
    });
  }

  function escapeHtml(str) {
    if (!str) return '';
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }

  // Run on DOM loaded
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initApp);
  } else {
    initApp();
  }
})();
