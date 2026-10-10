# कार्यप्रवाह निर्देशिका (Workflow Guide)
## MVY Pending Survey System

```
[Google Sheet] <------------------------------------+
  ├── Tab 'User' (User_ID, Password, Role)          |
  └── Tab 'survey' (3,360 Beneficiaries & Columns)  |
        |                                           |
        v                                           |
[Google Apps Script: Code.gs]                       |
  ├── verifyLogin(userId, password)                 |
  ├── getBeneficiaries()                            |
  ├── getCompletedSurveys()                         |
  └── submitSurvey(record) -------------------------+
        |
        v
[Frontend Web Portal: index.html / Index_AppsScript.html]
  ├── लॉगिन स्क्रीन (User ID & Password)
  ├── 1. डैशबोर्ड (संख्या व प्रतिशत विश्लेषण)
  ├── 2. लंबित सूची (फ़िल्टर व सर्वे फॉर्म)
  └── 3. रिपोर्ट व एक्सेल डाउनलोड
```

### दैनिक सर्वेक्षण कार्यप्रणाली:
1. ऑपरेटर लॉगिन करता है।
2. लंबित हितग्राही को नाम, आधार या आवेदन क्रमांक से खोजता है।
3. 'सर्वे करें' बटन पर क्लिक करके 10 कारणों में से सही कारण चुनता है।
4. 'सुरक्षित करें' दबाते ही Google Sheet और पोर्टल दोनों में स्थिति 'Completed' हो जाती है।
