/**
 * MVY Pending Survey - जिला पंचायत दंतेवाड़ा
 * Google Apps Script Backend (Code.gs)
 *
 * आपकी Google Sheet के साथ 100% Plug-and-Play:
 * - Sheet 1 ("survey"): ऑपरेटर द्वारा किए गए सर्वे रिकॉर्ड्स अपने-आप जुड़ते हैं।
 * - Sheet 2 ("User"): शीट में जोड़े गए यूज़र आईडी और पासवर्ड से ऑटोमैटिक लॉगिन होता है।
 */

// यदि यह स्क्रिप्ट सीधे स्प्रेडशीट से बंधी (Container-bound) है तो ID खाली रहने दें।
// यदि स्टैंडअलोन है तो अपनी स्प्रेडशीट ID नीचे इनवर्टेड कॉमा में डाल सकते हैं:
var SPREADSHEET_ID = "16rjPKtyijI5HKXPg2KOGaoIvCMZCjo2EPZHhxLU8Tjc";

function doGet(e) {
  return HtmlService.createTemplateFromFile('Index')
    .evaluate()
    .setTitle('MVY Pending Survey - जिला पंचायत दंतेवाड़ा')
    .addMetaTag('viewport', 'width=device-width, initial-scale=1.0')
    .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
}

function include(filename) {
  return HtmlService.createHtmlOutputFromFile(filename).getContent();
}

/**
 * स्प्रेडशीट कनेक्शन प्राप्त करें (ऑटो-डिटेक्ट)
 */
function getTargetSpreadsheet() {
  if (SPREADSHEET_ID && SPREADSHEET_ID.trim() !== "") {
    try {
      return SpreadsheetApp.openById(SPREADSHEET_ID.trim());
    } catch (e) {
      console.warn("Could not open by ID, falling back to active spreadsheet: " + e.message);
    }
  }
  return SpreadsheetApp.getActiveSpreadsheet();
}

/**
 * 'survey' शीट ढूंढें (केस-इनसेंसिटिव ताकि 'survey', 'Survey' या 'Surveys' सभी काम करें)
 */
function getSurveySheet(ss) {
  var sheet = ss.getSheetByName("survey") || ss.getSheetByName("Survey") || ss.getSheetByName("surveys") || ss.getSheetByName("Surveys");
  if (!sheet) {
    sheet = ss.insertSheet("survey");
    sheet.appendRow([
      "Applicant Number",
      "Beneficiary Name",
      "Aadhaar Number",
      "Project",
      "Sector",
      "Anganwadi Centre",
      "e-KYC Reason",
      "Survey Status",
      "Surveyed At",
      "Surveyed By"
    ]);
    sheet.getRange(1, 1, 1, 10).setFontWeight("bold").setBackground("#1a365d").setFontColor("#ffffff");
  }
  return sheet;
}

/**
 * 'User' शीट ढूंढें (केस-इनसेंसिटिव ताकि 'User', 'user', 'Users' सभी काम करें)
 */
function getUserSheet(ss) {
  return ss.getSheetByName("User") || ss.getSheetByName("user") || ss.getSheetByName("Users") || ss.getSheetByName("users");
}

/**
 * 1. Google Sheet की 'User' शीट से यूज़र्स की लिस्ट पढ़ें
 * ताकि शीट में नया ऑपरेटर या पासवर्ड डालने पर तुरंत काम करे
 */
function getRemoteUsers() {
  var accounts = {};
  try {
    var ss = getTargetSpreadsheet();
    var uSheet = getUserSheet(ss);
    if (uSheet) {
      var data = uSheet.getDataRange().getValues();
      // Row 1 हेडर है: User_ID (Col A), Password (Col B), Role (Col C), Name (Col D)
      for (var i = 1; i < data.length; i++) {
        var row = data[i];
        var uId = (row[0] || "").toString().trim().toLowerCase();
        var pass = (row[1] || "").toString().trim();
        var role = (row[2] || "").toString().trim().toLowerCase();
        var name = (row[3] || "").toString().trim();

        if (uId && pass) {
          accounts[uId] = {
            password: pass,
            role: (role === 'admin') ? 'admin' : 'operator',
            displayName: (role === 'admin') ? 'प्रशासक (Admin)' : 'ऑपरेटर (Operator)',
            defaultName: name || (role === 'admin' ? 'Admin Dantewada' : 'Operator ' + uId)
          };
        }
      }
    }
  } catch (err) {
    console.error("Error reading users from sheet: " + err);
  }
  return accounts;
}

/**
 * 2. लॉगिन सत्यापन (Login Verification from Sheet)
 */
function verifyLogin(userId, password) {
  var uId = (userId || "").trim().toLowerCase();
  var pass = (password || "").trim();

  // 1st: शीट से यूज़र्स चेक करें
  var remoteUsers = getRemoteUsers();
  if (remoteUsers[uId] && remoteUsers[uId].password === pass) {
    return {
      success: true,
      user: {
        userId: uId,
        role: remoteUsers[uId].role,
        username: remoteUsers[uId].defaultName,
        displayName: remoteUsers[uId].displayName
      }
    };
  }

  // 2nd: हार्डकोडेड फ़ॉलबैक (यदि शीट लोड न हो पाए)
  if (uId === 'admin' && pass === 'admin@2026') {
    return {
      success: true,
      user: { userId: 'admin', role: 'admin', username: 'Admin Dantewada', displayName: 'प्रशासक (Admin)' }
    };
  }
  if (uId === 'operator' && pass === 'mvy@2026') {
    return {
      success: true,
      user: { userId: 'operator', role: 'operator', username: 'Survey Operator', displayName: 'ऑपरेटर (Operator)' }
    };
  }

  return { success: false, message: 'अमान्य यूज़र आईडी अथवा पासवर्ड!' };
}

/**
 * 3. सर्वे सुरक्षित करें (Save Survey Submission to 'survey' Sheet)
 * - डुप्लीकेट सबमिशन रोकता है (Lock Service के साथ)
 */
function submitSurvey(record) {
  var lock = LockService.getScriptLock();
  try {
    lock.waitLock(15000); // 15 सेकेंड इंतज़ार

    var ss = getTargetSpreadsheet();
    var sSheet = getSurveySheet(ss);
    var data = sSheet.getDataRange().getValues();
    var applicantNo = (record.applicantNo || "").trim();

    // डुप्लीकेट सर्वे जांच (यदि पहले से दर्ज है)
    for (var i = 1; i < data.length; i++) {
      if (data[i][0] && data[i][0].toString().trim() === applicantNo) {
        return {
          success: false,
          message: "इस हितग्राही (Applicant: " + applicantNo + ") का सर्वे पूर्व में ही दर्ज किया जा चुका है।"
        };
      }
    }

    // नया रिकॉर्ड शीट में जोड़ें
    var timestamp = new Date();
    sSheet.appendRow([
      applicantNo,
      record.name || "",
      record.aadhaar || "",
      record.project || "",
      record.sector || "",
      record.anganwadi || "",
      record.reason || "",
      "Completed",
      timestamp.toLocaleString("en-IN", { timeZone: "Asia/Kolkata" }),
      record.surveyedBy || "Operator"
    ]);

    return {
      success: true,
      message: "सर्वे सफलतापूर्वक सुरक्षित किया गया!",
      applicantNo: applicantNo
    };
  } catch (err) {
    return {
      success: false,
      message: "त्रुटि: " + err.toString()
    };
  } finally {
    lock.releaseLock();
  }
}

/**
 * 4. पूर्ण हो चुके सर्वे लोड करें ('survey' Sheet से)
 */
function getCompletedSurveys() {
  try {
    var ss = getTargetSpreadsheet();
    var sSheet = getSurveySheet(ss);
    var data = sSheet.getDataRange().getValues();
    var map = {};

    for (var i = 1; i < data.length; i++) {
      var appNo = data[i][0] ? data[i][0].toString().trim() : "";
      if (appNo) {
        map[appNo] = {
          applicantNo: appNo,
          reason: data[i][6] || "",
          status: data[i][7] || "Completed",
          surveyedAt: data[i][8] || "",
          surveyedBy: data[i][9] || ""
        };
      }
    }
    return map;
  } catch (e) {
    console.error("Error reading completed surveys: " + e);
    return {};
  }
}
