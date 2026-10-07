# डिप्लॉयमेंट गाइड (Deployment Guide)
## Google Apps Script Web App डिप्लॉयमेंट

### चरण 1: Google Sheet खोलें
1. अपनी Google Sheet खोलें: [https://docs.google.com/spreadsheets/d/16rjPKtyijI5HKXPg2KOGaoIvCMZCjo2EPZHhxLU8Tjc/edit](https://docs.google.com/spreadsheets/d/16rjPKtyijI5HKXPg2KOGaoIvCMZCjo2EPZHhxLU8Tjc/edit)
2. मेनू बार में **Extensions (एक्सटेंशन)** ➔ **Apps Script** पर क्लिक करें।

### चरण 2: कोड कॉपी करें
1. **`Code.gs`**: फ़ाइल `src/apps-script/Code.gs` का पूरा कोड पेस्ट करें और Ctrl+S दबाएं।
2. **`Index.html`**: बायीं तरफ `+` पर क्लिक करके `HTML` फ़ाइल बनाएं जिसका नाम **`Index`** रखें।
3. फ़ाइल `src/apps-script/Index_AppsScript.html` का पूरा कोड उसमें पेस्ट करें और Ctrl+S दबाएं।

### चरण 3: वेब ऐप के रूप में डिप्लॉय करें
1. ऊपर दायीं ओर नीले बटन **Deploy** ➔ **New deployment** पर क्लिक करें।
2. गियर आइकॉन ➔ **Web app** चुनें।
3. **Configuration**:
   - **Execute as:** `Me` (आपकी ईमेल आईडी)
   - **Who has access:** `Anyone` (कोई भी)
4. **Deploy** पर क्लिक करें और प्राप्त Web App URL को कॉपी कर लें।
