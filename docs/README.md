# MVY Pending Survey - जिला पंचायत दंतेवाड़ा
### महिला एवं बाल विकास विभाग (WCD), छत्तीसगढ़ शासन

महतारी वंदन योजना (MVY) के लंबित e-KYC हितग्राहियों का 100% डायनामिक डिजिटल सर्वेक्षण वेब पोर्टल।

---

### 📂 मॉड्यूलर डायरेक्टरी संरचना (100% Dynamic - No Hardcoded Data):

```text
WCD_MVY_Survey/
│
├── src/
│   ├── frontend/                 # मुख्य वेब क्लाइंट (UI & Logic)
│   │   ├── index.html            # मुख्य पोर्टल इंटरफेस
│   │   ├── style.css             # छत्तीसगढ़ शासन थीम स्टाइलशीट
│   │   └── app.js                # क्लाइंट लॉजिक (Dynamic Google Sheet Sync)
│   │
│   └── apps-script/              # Google Apps Script बैकएंड
│       ├── Code.gs               # Apps Script API (User verification, Survey sync)
│       └── Index_AppsScript.html # Apps Script में पेस्ट करने योग्य स्टैंडअलोन वेब ऐप
│
├── scripts/
│   ├── export/                   # रिपोर्ट एक्सपोर्ट स्क्रिप्ट्स
│   └── utilities/                # बिल्ड एवं ऑटोमेशन टूल्स
│       ├── generate_index.js     # इंडेक्स HTML जनरेटर
│       └── build_apps_script.js  # Apps Script HTML बंडलर
│
├── docs/                         # परियोजना प्रलेखन
│   ├── PRD.md                    # उत्पाद आवश्यकताएँ (PRD)
│   ├── README.md                 # परियोजना विवरण
│   ├── workflow.md               # कार्यप्रवाह निर्देशिका
│   └── deployment.md             # डिप्लॉयमेंट गाइड
│
├── public/
│   └── assets/
│       ├── images/               # लोगो एवं शासकीय प्रतीक
│       └── icons/                # फॉन्ट एवं यूआई आइकन्स
│
├── .env                          # सक्रिय परिवेश चर (Sheet ID & URLs)
├── .env.example                  # परिवेश टेम्पलेट
├── .gitignore                    # गिट सुरक्षा कॉन्फ़िगरेशन
├── package.json                  # NPM स्क्रिप्ट्स
├── package-lock.json
└── README.md
```

> **नोट:** सभी हितग्राही डेटा (3,360) और यूज़र क्रेडेंशियल्स सीधे Google Sheet से लाइव आते हैं, इसलिए प्रोजेक्ट में कोई भी भारी स्टैटिक डेटा या हार्डकोडेड फाइल्स नहीं रखी गई हैं।

---

### 🚀 उपयोगी कमांड्स (NPM Scripts):

```bash
# 1. लोकल सर्वर शुरू करें (Start Local Server)
npm start

# 2. सभी आर्टिफैक्ट्स और HTML रीबिल्ड करें (Build)
npm run build
```
