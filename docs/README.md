# MVY Pending Survey - जिला पंचायत दंतेवाड़ा
### महिला एवं बाल विकास विभाग (WCD), छत्तीसगढ़ शासन

महतारी वंदन योजना (MVY) के लंबित e-KYC हितग्राहियों (3,360) का डिजिटल सर्वेक्षण वेब पोर्टल।

---

### 📂 मॉड्यूलर डायरेक्टरी संरचना (Project Directory Structure):

```text
WCD_MVY_Survey/
│
├── src/
│   ├── frontend/                 # मुख्य वेब क्लाइंट
│   │   ├── index.html            # मुख्य यूआई
│   │   ├── style.css             # सरकारी पोर्टल थीम स्टाइल
│   │   └── app.js                # क्लाइंट लॉजिक
│   │
│   └── apps-script/              # Google Apps Script बैकएंड
│       ├── Code.gs               # Apps Script API व Google Sheet ऑपरेशंस
│       └── Index_AppsScript.html # Apps Script में पेस्ट करने योग्य वेब ऐप
│
├── data/
│   ├── beneficiaries.json        # 3,360 हितग्राहियों का JSON डेटा
│   └── raw/                      # मूल कच्चा डेटा
│       ├── MVY_pending _survey - Worksheet.pdf
│       └── extracted_text.txt
│
├── scripts/
│   ├── import/                   # डेटा इम्पोर्ट एवं पार्सिंग
│   │   ├── parse_pdf.js
│   │   └── parse_records.js
│   ├── export/                   # रिपोर्ट एक्सपोर्ट स्क्रिप्ट्स
│   ├── validation/               # डेटा वैलिडेशन
│   │   └── inspect_weird.js
│   └── utilities/                # बिल्ड एवं जनरेशन टूल्स
│       ├── generate_index.js
│       └── build_apps_script.js
│
├── docs/                         # परियोजना प्रलेखन
│   ├── PRD.md                    # उत्पाद आवश्यकताएँ (PRD)
│   ├── README.md                 # परियोजना विवरण
│   ├── workflow.md               # कार्यप्रवाह निर्देशिका
│   └── deployment.md             # डिप्लॉयमेंट गाइड
│
├── config/
│   └── data.js                   # इनिशियल फॉलबैक डेटा कॉन्फ़िग
│
├── public/
│   └── assets/
│       ├── images/               # लोगो एवं शासकीय प्रतीक
│       └── icons/                # फॉन्ट एवं यूआई आइकन्स
│
├── .env                          # सक्रिय परिवेश चर
├── .env.example                  # परिवेश टेम्पलेट
├── .gitignore                    # गिट सुरक्षा कॉन्फ़िगरेशन
├── package.json                  # NPM स्क्रिप्ट्स
├── package-lock.json
└── README.md
```

---

### 🚀 उपयोगी कमांड्स (NPM Scripts):

```bash
# 1. लोकल सर्वर शुरू करें (Start Local Server)
npm start

# 2. सभी आर्टिफैक्ट्स और HTML रीबिल्ड करें (Build)
npm run build
```
