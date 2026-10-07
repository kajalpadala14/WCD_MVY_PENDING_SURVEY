/**
 * MVY Pending Survey - जिला पंचायत दंतेवाड़ा
 * Google Apps Script Backend (Code.gs)
 *
 * 100% Dynamic & Google Sheet Powered:
 * - कोई भी हार्डकोडेड यूज़र या पासवर्ड नहीं - सब कुछ Google Sheet के 'User' टैब से लाइव आता है।
 * - कोई भी हार्डकोडेड हितग्राही डेटा नहीं - सब कुछ Google Sheet के 'survey' टैब से लाइव लोड होता है।
 * - Google Sheet के 'survey' टैब में सर्वे के 9 कारणों के कॉलम में 1 मार्क होता है और तारीख व ऑपरेटर दर्ज होता है।
 */

// आपकी Google Sheet ID (यदि कंटेनर-बाउंड है तो getActiveSpreadsheet अपने-आप लेगा)
var SPREADSHEET_ID = "16rjPKtyijI5HKXPg2KOGaoIvCMZCjo2EPZHhxLU8Tjc";

function doGet(e) {
  // यदि URL में ?action=api कॉल की जाए तो JSON API की तरह उत्तर दें (लोकल सर्वर के लिए)
  if (e && e.parameter && e.parameter.action) {
    var action = e.parameter.action;
    var result = {};
    if (action === "getBeneficiaries") {
      result = getBeneficiaries();
    } else if (action === "getCompletedSurveys") {
      result = getCompletedSurveys();
    } else if (action === "verifyLogin") {
      result = verifyLogin(e.parameter.userId, e.parameter.password);
    } else if (action === "clearAllSurveys") {
      result = clearAllSurveys();
    }
    return ContentService.createTextOutput(JSON.stringify(result))
      .setMimeType(ContentService.MimeType.JSON);
  }

  return HtmlService.createTemplateFromFile('Index')
    .evaluate()
    .setTitle('MVY Pending Survey - जिला पंचायत दंतेवाड़ा')
    .addMetaTag('viewport', 'width=device-width, initial-scale=1.0')
    .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
}

function doPost(e) {
  try {
    var data = JSON.parse(e.postData.contents);
    if (data.action === "submitSurvey") {
      var res = submitSurvey(data.record);
      return ContentService.createTextOutput(JSON.stringify(res))
        .setMimeType(ContentService.MimeType.JSON);
    } else if (data.action === "clearAllSurveys") {
      var clearRes = clearAllSurveys();
      return ContentService.createTextOutput(JSON.stringify(clearRes))
        .setMimeType(ContentService.MimeType.JSON);
    }
  } catch (err) {
    return ContentService.createTextOutput(JSON.stringify({ success: false, message: err.toString() }))
      .setMimeType(ContentService.MimeType.JSON);
  }
}

function include(filename) {
  return HtmlService.createHtmlOutputFromFile(filename).getContent();
}

/**
 * स्प्रेडशीट कनेक्शन प्राप्त करें
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
 * 'survey' शीट ढूंढें
 */
function getSurveySheet(ss) {
  return ss.getSheetByName("survey") || ss.getSheetByName("Survey") || ss.getSheetByName("surveys") || ss.getSheetByName("Surveys");
}

/**
 * 'User' शीट ढूंढें
 */
function getUserSheet(ss) {
  return ss.getSheetByName("User") || ss.getSheetByName("user") || ss.getSheetByName("Users") || ss.getSheetByName("users");
}

/**
 * 1. Google Sheet की 'User' शीट से यूज़र्स की लाइव लिस्ट पढ़ें
 * (कोई हार्डकोडेड डेटा नहीं - केवल शीट के मान)
 */
function getRemoteUsers() {
  var accounts = {};
  try {
    var ss = getTargetSpreadsheet();
    var uSheet = getUserSheet(ss);
    if (uSheet) {
      var data = uSheet.getDataRange().getValues();
      // Row 1: User_ID, Password, Role, Name
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
            defaultName: name || (role === 'admin' ? 'Admin' : 'Operator ' + uId)
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
 * 2. लॉगिन सत्यापन (केवल Google Sheet के 'User' टैब से - कोई हार्डकोडेड पासवर्ड नहीं)
 */
function verifyLogin(userId, password) {
  var uId = (userId || "").trim().toLowerCase();
  var pass = (password || "").trim();

  if (!uId || !pass) {
    return { success: false, message: 'कृपया यूज़र आईडी एवं पासवर्ड दोनों दर्ज करें।' };
  }

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

  return { success: false, message: 'अमान्य यूज़र आईडी अथवा पासवर्ड! (Google Sheet User लिस्ट में उपलब्ध नहीं है)' };
}

/**
 * 3. Google Sheet के 'survey' टैब से सभी हितग्राही लाइव लोड करें
 * Columns:
 * Col A (1): आवेदक क्र.
 * Col B (2): आवेदिका का नाम
 * Col C (3): आधार नंबर
 * Col D (4): परियोजना
 * Col E (5): सेक्टर
 * Col F (6): आंगनबाड़ी केंद्र
 */
function getBeneficiaries() {
  try {
    var ss = getTargetSpreadsheet();
    var sSheet = getSurveySheet(ss);
    if (!sSheet) return [];

    var data = sSheet.getDataRange().getValues();
    if (data.length <= 1) return [];

    // Row 1 या 2 हेडर हो सकता है, पहली पंक्ति जिसमें MVY शुरू हो उसे खोजें
    var startRow = 1;
    for (var r = 0; r < Math.min(5, data.length); r++) {
      var val = (data[r][0] || "").toString().trim();
      if (val.indexOf("MVY") === 0) {
        startRow = r;
        break;
      }
    }

    var list = [];
    for (var i = startRow; i < data.length; i++) {
      var row = data[i];
      var appNo = (row[0] || "").toString().trim();
      if (!appNo) continue;

      list.push({
        applicantNo: appNo,
        name: (row[1] || "").toString().trim(),
        aadhaar: (row[2] || "").toString().trim(),
        project: (row[3] || "").toString().trim(),
        sector: (row[4] || "").toString().trim(),
        anganwadi: (row[5] || "").toString().trim()
      });
    }
    return list;
  } catch (err) {
    console.error("Error reading beneficiaries: " + err);
    return [];
  }
}

/**
 * 4. Google Sheet से पूर्व में पूर्ण हो चुके सर्वे लोड करें
 */
function getCompletedSurveys() {
  try {
    var ss = getTargetSpreadsheet();
    var sSheet = getSurveySheet(ss);
    if (!sSheet) return {};

    var data = sSheet.getDataRange().getValues();
    var map = {};

    // 9 कारणों की सूची
    var reasonCols = [
      "फिंगर एवं आईरिस से e-KYC संभव नहीं",
      "पलायन",
      "हितग्राही ज्ञात है, परन्तु वर्तमान पते पर उपलब्ध नहीं है",
      "हितग्राही अज्ञात है",
      "मृत्यु",
      "शारीरिक रूप से अक्षम एवं बीमार",
      "हितग्राही e-KYC करवाना नहीं चाहती हैं।",
      "e-KYC अस्वीकृत",
      "प्रक्रियाधीन"
    ];

    // हेडर रो खोजें (जहाँ कारण लिखे हों)
    var headerRowIdx = -1;
    for (var r = 0; r < Math.min(5, data.length); r++) {
      var rowStr = data[r].join(" ");
      if (rowStr.indexOf("फिंगर एवं आईरिस") !== -1 || rowStr.indexOf("पलायन") !== -1) {
        headerRowIdx = r;
        break;
      }
    }

    // कारण कॉलम मैप तैयार करें
    var colReasonMap = {};
    if (headerRowIdx !== -1) {
      for (var c = 6; c < data[headerRowIdx].length; c++) {
        var hText = (data[headerRowIdx][c] || "").toString().trim();
        for (var k = 0; k < reasonCols.length; k++) {
          if (hText.indexOf(reasonCols[k].substring(0, 5)) !== -1) {
            colReasonMap[c] = reasonCols[k];
            break;
          }
        }
      }
    }

    // डेटा पंक्तियाँ स्कैन करें
    var dataStart = headerRowIdx !== -1 ? headerRowIdx + 1 : 1;
    for (var i = dataStart; i < data.length; i++) {
      var row = data[i];
      var appNo = (row[0] || "").toString().trim();
      if (!appNo) continue;

      // चेक करें कि क्या 9 कॉलमों में कोई 1 या 'yes' भरा है
      var matchedReason = "";
      for (var colIdx in colReasonMap) {
        var val = (row[colIdx] || "").toString().trim();
        if (val === "1" || val.toLowerCase() === "yes" || val === "हाँ" || val === "true") {
          matchedReason = colReasonMap[colIdx];
          break;
        }
      }

      // यदि मानक फॉर्मेट (Col G में कारण का नाम) हो
      if (!matchedReason && row[6] && typeof row[6] === "string" && row[6].length > 2) {
        matchedReason = row[6].trim();
      }

      if (matchedReason) {
        map[appNo] = {
          applicantNo: appNo,
          reason: matchedReason,
          status: "Completed",
          surveyedAt: row[15] || row[8] || "",
          surveyedBy: row[16] || row[9] || "Operator"
        };
      }
    }

    return map;
  } catch (e) {
    console.error("Error reading completed surveys: " + e);
    return {};
  }
}

/**
 * 5. सर्वे सुरक्षित करें (Google Sheet में लाइव अपडेट)
 */
function submitSurvey(record) {
  var lock = LockService.getScriptLock();
  try {
    lock.waitLock(15000);

    var ss = getTargetSpreadsheet();
    var sSheet = getSurveySheet(ss);
    if (!sSheet) {
      return { success: false, message: "'survey' शीट नहीं मिली।" };
    }

    var data = sSheet.getDataRange().getValues();
    var applicantNo = (record.applicantNo || "").trim();
    var selectedReason = (record.reason || "").trim();

    // 9 कारणों के कॉलम हेडर ढूंढें
    var headerRowIdx = -1;
    for (var r = 0; r < Math.min(5, data.length); r++) {
      var rowStr = data[r].join(" ");
      if (rowStr.indexOf("फिंगर एवं आईरिस") !== -1 || rowStr.indexOf("पलायन") !== -1) {
        headerRowIdx = r;
        break;
      }
    }

    // हितग्राही की पंक्ति खोजें
    var targetRowIdx = -1;
    for (var i = 0; i < data.length; i++) {
      if (data[i][0] && data[i][0].toString().trim() === applicantNo) {
        targetRowIdx = i + 1; // 1-based row index
        break;
      }
    }

    var now = new Date();
    var dateStr = now.toLocaleString("en-IN", { timeZone: "Asia/Kolkata" });
    var surveyedBy = record.surveyedBy || "Operator";

    if (targetRowIdx !== -1 && headerRowIdx !== -1) {
      // यूजर की मौजूदा शीट संरचना में संबंधित कारण कॉलम में 1 लगाएं
      var reasonColIdx = -1;
      for (var c = 6; c < data[headerRowIdx].length; c++) {
        var hText = (data[headerRowIdx][c] || "").toString().trim();
        if (hText.indexOf(selectedReason.substring(0, 5)) !== -1) {
          reasonColIdx = c + 1; // 1-based column
          break;
        }
      }

      if (reasonColIdx !== -1) {
        sSheet.getRange(targetRowIdx, reasonColIdx).setValue(1);
      } else {
        // यदि सीधा कारण कॉलम न मिले तो Col G (7) में कारण लिखें
        sSheet.getRange(targetRowIdx, 7).setValue(selectedReason);
      }

      // Col P (16): सर्वे दिनांक व समय (Timestamp)
      // Col Q (17): सर्वेकर्ता का नाम (Surveyed By)
      sSheet.getRange(targetRowIdx, 16).setValue(dateStr);
      sSheet.getRange(targetRowIdx, 17).setValue(surveyedBy);

      return {
        success: true,
        message: "सर्वे सफलतापूर्वक सुरक्षित किया गया!",
        applicantNo: applicantNo
      };
    } else if (targetRowIdx !== -1) {
      // यदि हेडर अलग फॉर्मेट का हो तो कॉलम 7 में कारण और 8 में दिनांक दर्ज करें
      sSheet.getRange(targetRowIdx, 7).setValue(selectedReason);
      sSheet.getRange(targetRowIdx, 8).setValue(dateStr);
      sSheet.getRange(targetRowIdx, 9).setValue(surveyedBy);
      return {
        success: true,
        message: "सर्वे सफलतापूर्वक सुरक्षित किया गया!",
        applicantNo: applicantNo
      };
    } else {
      // यदि नया हितग्राही हो तो नई पंक्ति जोड़ें
      sSheet.appendRow([
        applicantNo,
        record.name || "",
        record.aadhaar || "",
        record.project || "",
        record.sector || "",
        record.anganwadi || "",
        selectedReason,
        "Completed",
        dateStr,
        surveyedBy
      ]);

      return {
        success: true,
        message: "सर्वे सफलतापूर्वक सुरक्षित किया गया!",
        applicantNo: applicantNo
      };
    }
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
 * 6. सभी सर्वे प्रविष्टियों को साफ़ (Clear) करें
 */
function clearAllSurveys() {
  var lock = LockService.getScriptLock();
  try {
    lock.waitLock(20000);
    var ss = getTargetSpreadsheet();
    var sSheet = getSurveySheet(ss);
    if (!sSheet) {
      return { success: false, message: "'survey' शीट नहीं मिली।" };
    }

    var lastRow = sSheet.getLastRow();
    var lastCol = sSheet.getLastColumn();
    if (lastRow < 2) {
      return { success: true, message: "शीट में कोई डेटा साफ़ करने हेतु नहीं है।" };
    }

    // Col G (7) से लेकर Col Q (17) या अंतिम कॉलम तक की सभी प्रविष्टियों को खाली करें
    var clearCols = Math.max(11, lastCol - 6);
    sSheet.getRange(2, 7, lastRow - 1, clearCols).clearContent();

    return {
      success: true,
      message: "सभी सर्वे प्रविष्टियां (कारण, समय, ऑपरेटर) Google Sheet से सफलतापूर्वक साफ़ (Clear) कर दी गई हैं!"
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
