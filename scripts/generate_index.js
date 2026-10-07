const fs = require('fs');
const path = require('path');

const rootDir = path.join(__dirname, '..');
const css = fs.readFileSync(path.join(rootDir, 'style.css'), 'utf8');

// Read base template
const template = `<!DOCTYPE html>
<html lang="hi">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>MVY Pending Survey - जिला पंचायत दंतेवाड़ा</title>
  <style>
${css}
  </style>
</head>
<body>

  <!-- ================= TOP BAR ================= -->
  <div class="gov-topbar">
    <div class="gov-topbar-left">
      छत्तीसगढ़ शासन | Government of Chhattisgarh • महिला एवं बाल विकास विभाग (WCD)
    </div>
    <div class="gov-topbar-right">
      <span id="currentUserDisplay" class="user-badge" style="display: none;"></span>
      <button id="btnLogout" class="btn-logout" style="display: none;">लॉगआउट (Logout)</button>
    </div>
  </div>

  <!-- ================= HEADER ================= -->
  <header id="appHeader" class="gov-header" style="display: none;">
    <div class="header-brand">
      <div class="emblem-placeholder">CG</div>
      <div class="header-titles">
        <h1>MVY Pending Survey</h1>
        <h2>जिला पंचायत दंतेवाड़ा (District Panchayat Dantewada)</h2>
      </div>
    </div>
  </header>

  <!-- ================= MAIN NAVIGATION ================= -->
  <nav id="appNav" class="gov-nav" style="display: none;">
    <a href="#" class="nav-link active" data-target="dashboardSection">1. Dashboard</a>
    <a href="#" class="nav-link" data-target="pendingListSection">2. e-KYC Pending List</a>
    <a href="#" class="nav-link" data-target="reportSection">3. Survey Report</a>
  </nav>

  <!-- ================= LOGIN SECTION ================= -->
  <div id="loginSection" class="login-wrapper">
    <div class="login-header">
      <div class="emblem-placeholder" style="margin: 0 auto 12px auto;">CG</div>
      <h2>MVY Pending Survey</h2>
      <p>जिला पंचायत दंतेवाड़ा (District Panchayat Dantewada)</p>
    </div>

    <form id="loginForm">
      <div id="loginErrorAlert" class="alert alert-danger" style="display: none; margin-bottom: 12px; font-size: 13px;"></div>

      <div class="form-group" style="margin-bottom: 14px;">
        <label for="loginUserId">उपयोगकर्ता आईडी (User ID):</label>
        <input type="text" id="loginUserId" class="form-control" placeholder="यूज़र आईडी दर्ज करें (उदा. admin / operator)" required autocomplete="username">
      </div>

      <div class="form-group" style="margin-bottom: 18px;">
        <label for="loginPassword">पासवर्ड (Password):</label>
        <input type="password" id="loginPassword" class="form-control" placeholder="पासवर्ड दर्ज करें" required autocomplete="current-password">
      </div>

      <button type="submit" class="btn btn-primary" style="width: 100%; padding: 10px; font-size: 14px;">
        प्रवेश करें (Login)
      </button>

      <div style="margin-top: 14px; padding: 10px; background: #f8fafc; border: 1px dashed #cbd5e1; border-radius: 4px; font-size: 12px; color: var(--gov-text-muted); text-align: center;">
        <i class="fas fa-lock" style="margin-right: 4px;"></i>
        लॉगिन क्रेडेंशियल सीधे आपकी <strong>Google Sheet ('User' टैब)</strong> से सत्यापित किए जाते हैं।
      </div>
    </form>
  </div>

  <!-- ================= MAIN CONTENT CONTAINER ================= -->
  <main id="mainContentArea" class="main-container" style="display: none;">

    <!-- ================= 1. DASHBOARD SECTION ================= -->
    <section id="dashboardSection" class="page-section active">
      <div class="section-title-bar">
        <h3 class="section-title">डैशबोर्ड (Dashboard Summary)</h3>
      </div>

      <div class="metrics-grid">
        <div class="metric-card card-pending">
          <div class="metric-label">Total e-KYC Pending</div>
          <div id="metricTotalPending" class="metric-value">0</div>
        </div>
        <div class="metric-card card-completed">
          <div class="metric-label">Survey Completed</div>
          <div id="metricCompleted" class="metric-value">0</div>
        </div>
        <div class="metric-card card-remaining">
          <div class="metric-label">Survey Pending</div>
          <div id="metricRemaining" class="metric-value">0</div>
        </div>
      </div>

      <div class="table-card" style="margin-top: 10px;">
        <div class="table-header-info">
          <strong>कारण-वार सर्वे रिपोर्ट (Reason-wise Count)</strong>
          <span>कुल 9 निर्धारित कारण</span>
        </div>
        <div class="table-responsive">
          <table class="gov-table">
            <thead>
              <tr>
                <th style="width: 60px; text-align: center;">क्र.</th>
                <th>e-KYC Pending होने का कारण (Reason)</th>
                <th style="text-align: right; width: 140px;">हितग्राही संख्या (Count)</th>
                <th style="text-align: right; width: 100px;">प्रतिशत (%)</th>
              </tr>
            </thead>
            <tbody id="dashboardReasonTableBody">
            </tbody>
          </table>
        </div>
      </div>
    </section>

    <!-- ================= 2. e-KYC PENDING LIST SECTION ================= -->
    <section id="pendingListSection" class="page-section">
      <div class="section-title-bar">
        <h3 class="section-title">e-KYC Pending List (हितग्राही सूची)</h3>
      </div>

      <div class="filter-panel">
        <div class="filter-grid">
          <div class="form-group">
            <label for="filterProject">Project (परियोजना):</label>
            <select id="filterProject" class="form-control">
              <option value="">-- सभी परियोजनाएं --</option>
            </select>
          </div>
          <div class="form-group">
            <label for="filterSector">Sector (सेक्टर):</label>
            <select id="filterSector" class="form-control">
              <option value="">-- सभी सेक्टर --</option>
            </select>
          </div>
          <div class="form-group">
            <label for="filterAnganwadi">Anganwadi Centre (आंगनवाड़ी केंद्र):</label>
            <select id="filterAnganwadi" class="form-control">
              <option value="">-- सभी केंद्र --</option>
            </select>
          </div>
          <div class="form-group">
            <label for="filterReason">e-KYC Reason (कारण):</label>
            <select id="filterReason" class="form-control">
              <option value="">-- सभी कारण --</option>
            </select>
          </div>
          <div class="form-group">
            <label for="filterStatus">Survey Status (स्थिति):</label>
            <select id="filterStatus" class="form-control">
              <option value="">-- सभी स्थिति --</option>
              <option value="Pending">Pending</option>
              <option value="Completed">Completed</option>
            </select>
          </div>
          <div class="form-group">
            <label for="filterSearch">खोजें (Search):</label>
            <input type="text" id="filterSearch" class="form-control" placeholder="नाम / आवेदक क्र. / आधार...">
          </div>
        </div>
        <div style="margin-top: 12px; display: flex; justify-content: flex-end; gap: 8px;">
          <button id="btnFilterReset" class="btn btn-secondary">रीसेट (Reset)</button>
          <button id="btnFilterApply" class="btn btn-primary">फिल्टर लागू करें (Apply)</button>
        </div>
      </div>

      <div class="table-card">
        <div class="table-header-info">
          <span id="pendingCountDisplay">कुल हितग्राही: 0</span>
        </div>
        <div class="table-responsive">
          <table class="gov-table">
            <thead>
              <tr>
                <th>Applicant Number</th>
                <th>Beneficiary Name</th>
                <th>Aadhaar Number</th>
                <th>Project</th>
                <th>Sector</th>
                <th>Anganwadi Centre</th>
                <th>Survey Status</th>
                <th style="text-align: center;">कार्यवाही (Action)</th>
              </tr>
            </thead>
            <tbody id="pendingTableBody">
            </tbody>
          </table>
        </div>
        <div class="pagination-bar">
          <span id="pageInfo">पृष्ठ 1 / 1</span>
          <div class="pagination-controls">
            <button id="btnPrevPage" class="btn-page">पिछला (Prev)</button>
            <button id="btnNextPage" class="btn-page">अगला (Next)</button>
          </div>
        </div>
      </div>
    </section>

    <!-- ================= 3. SURVEY REPORT SECTION ================= -->
    <section id="reportSection" class="page-section">
      <div class="section-title-bar">
        <h3 class="section-title">Survey Report (सर्वे रिपोर्ट एवं डेटा एक्सपोर्ट)</h3>
        <button id="btnOpenExportReview" class="btn btn-success">
          📊 डेटा रिव्यू एवं एक्सेल डाउनलोड (Review &amp; Export Excel)
        </button>
      </div>

      <div class="filter-panel">
        <div class="filter-grid">
          <div class="form-group">
            <label for="reportFilterProject">Project (परियोजना):</label>
            <select id="reportFilterProject" class="form-control">
              <option value="">-- सभी परियोजनाएं --</option>
            </select>
          </div>
          <div class="form-group">
            <label for="reportFilterSector">Sector (सेक्टर):</label>
            <select id="reportFilterSector" class="form-control">
              <option value="">-- सभी सेक्टर --</option>
            </select>
          </div>
          <div class="form-group">
            <label for="reportFilterAnganwadi">Anganwadi Centre (आंगनवाड़ी केंद्र):</label>
            <select id="reportFilterAnganwadi" class="form-control">
              <option value="">-- सभी केंद्र --</option>
            </select>
          </div>
          <div class="form-group">
            <label for="reportFilterReason">e-KYC Reason (कारण):</label>
            <select id="reportFilterReason" class="form-control">
              <option value="">-- सभी कारण --</option>
            </select>
          </div>
          <div class="form-group">
            <label for="reportFilterStatus">Survey Status (स्थिति):</label>
            <select id="reportFilterStatus" class="form-control">
              <option value="">-- सभी स्थिति --</option>
              <option value="Completed">Completed</option>
              <option value="Pending">Pending</option>
            </select>
          </div>
          <div class="form-group">
            <label for="reportFilterSearch">खोजें (Search):</label>
            <input type="text" id="reportFilterSearch" class="form-control" placeholder="नाम / आवेदक क्र. / आधार...">
          </div>
        </div>
        <div style="margin-top: 12px; display: flex; justify-content: flex-end; gap: 8px;">
          <button id="btnReportFilterReset" class="btn btn-secondary">रीसेट (Reset)</button>
          <button id="btnReportFilterApply" class="btn btn-primary">फिल्टर लागू करें (Apply)</button>
        </div>
      </div>

      <div class="table-card">
        <div class="table-header-info">
          <span id="reportCountDisplay">कुल रिकॉर्ड: 0</span>
        </div>
        <div class="table-responsive">
          <table class="gov-table">
            <thead>
              <tr>
                <th>Applicant Number</th>
                <th>Beneficiary Name</th>
                <th>Aadhaar Number</th>
                <th>Project</th>
                <th>Sector</th>
                <th>Anganwadi Centre</th>
                <th>e-KYC Reason</th>
                <th>Survey Status</th>
                <th style="text-align: center;">कार्यवाही (Action)</th>
              </tr>
            </thead>
            <tbody id="reportTableBody">
            </tbody>
          </table>
        </div>
        <div class="pagination-bar">
          <span id="reportPageInfo">पृष्ठ 1 / 1</span>
          <div class="pagination-controls">
            <button id="btnPrevReportPage" class="btn-page">पिछला (Prev)</button>
            <button id="btnNextReportPage" class="btn-page">अगला (Next)</button>
          </div>
        </div>
      </div>
    </section>

  </main>

  <!-- ================= SURVEY FORM MODAL ================= -->
  <div id="surveyModal" class="modal-overlay">
    <div class="modal-dialog">
      <div class="modal-header">
        <h3>MVY Pending Survey Form</h3>
        <button id="btnModalClose" class="modal-close-btn">&times;</button>
      </div>

      <form id="surveyForm">
        <div class="modal-body">
          <div id="surveyModalAlert" class="alert"></div>

          <div class="beneficiary-details-box">
            <h4>हितग्राही का विवरण (Beneficiary Details - Read-Only)</h4>
            <div class="details-grid">
              <div class="detail-item">
                <span>1. Applicant Number</span>
                <span id="modalApplicantNo">-</span>
              </div>
              <div class="detail-item">
                <span>2. Beneficiary/Applicant Name</span>
                <span id="modalName">-</span>
              </div>
              <div class="detail-item">
                <span>3. Aadhaar Number</span>
                <span id="modalAadhaar">-</span>
              </div>
              <div class="detail-item">
                <span>4. Project</span>
                <span id="modalProject">-</span>
              </div>
              <div class="detail-item">
                <span>5. Sector</span>
                <span id="modalSector">-</span>
              </div>
              <div class="detail-item">
                <span>6. Anganwadi Centre</span>
                <span id="modalAnganwadi">-</span>
              </div>
            </div>
          </div>

          <div class="survey-reason-section">
            <div class="survey-reason-title">
              e-KYC Pending होने का कारण <span style="color: red;">*</span>
            </div>
            <div id="reasonRadioContainer" class="reason-options-list">
            </div>
          </div>
        </div>

        <div class="modal-footer">
          <button type="button" id="btnModalCancel" class="btn btn-secondary">बंद करें (Cancel)</button>
          <button type="submit" id="btnSubmitSurvey" class="btn btn-primary">Submit (सर्वे दर्ज करें)</button>
        </div>
      </form>
    </div>
  </div>

  <!-- ================= EXCEL EXPORT REVIEW MODAL ================= -->
  <div id="exportReviewModal" class="modal-overlay">
    <div class="modal-dialog modal-lg">
      <div class="modal-header">
        <h3>डाउनलोड से पहले डेटा रिव्यू (Review Data Before Download)</h3>
        <button id="btnReviewModalClose" class="modal-close-btn">&times;</button>
      </div>

      <div class="modal-body">
        <div style="display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; margin-bottom: 12px; gap: 8px;">
          <div class="review-stats-badge" id="reviewCountBadge">
            📋 डाउनलोड हेतु कुल चयनित रिकॉर्ड: 0
          </div>
          <div style="font-size: 12px; color: var(--gov-text-muted);">
            (नोट: नीचे दिए गए 8 अधिकृत फ़ील्ड्स के साथ एक्सेल फ़ाइल (.xls) तैयार होगी)
          </div>
        </div>

        <div class="table-card" style="margin-bottom: 0;">
          <div class="table-responsive" style="max-height: 48vh; overflow-y: auto;">
            <table class="gov-table" id="reviewTable">
              <thead>
                <tr>
                  <th style="width: 50px; text-align: center;">क्र.</th>
                  <th>Applicant Number</th>
                  <th>Beneficiary Name</th>
                  <th>Aadhaar Number</th>
                  <th>Project</th>
                  <th>Sector</th>
                  <th>Anganwadi Centre</th>
                  <th>e-KYC Reason</th>
                  <th>Survey Status</th>
                </tr>
              </thead>
              <tbody id="reviewTableBody">
              </tbody>
            </table>
          </div>
        </div>
      </div>

      <div class="modal-footer">
        <button type="button" id="btnReviewModalCancel" class="btn btn-secondary">रद्द करें (Cancel)</button>
        <button type="button" id="btnConfirmExportExcel" class="btn btn-success">
          📥 कन्फर्म करें एवं एक्सेल डाउनलोड करें (.xls)
        </button>
      </div>
    </div>
  </div>

  <!-- Scripts -->
  <script src="data.js"></script>
  <script src="app.js"></script>
</body>
</html>
`;

fs.writeFileSync(path.join(rootDir, 'index.html'), template, 'utf8');
console.log('Successfully generated index.html with fixed scrolling styles');
