const fs = require('fs');
const path = require('path');

const rootDir = path.join(__dirname, '..');
const css = fs.readFileSync(path.join(rootDir, 'style.css'), 'utf8');
const dataJs = fs.readFileSync(path.join(rootDir, 'data.js'), 'utf8');
const appJs = fs.readFileSync(path.join(rootDir, 'app.js'), 'utf8');
let html = fs.readFileSync(path.join(rootDir, 'index.html'), 'utf8');

// Replace <link rel="stylesheet" href="style.css"> with <style>...</style>
html = html.replace('<link rel="stylesheet" href="style.css">', `<style>\n${css}\n</style>`);

// Replace <script src="data.js"></script> and <script src="app.js"></script>
const scriptBundle = `
<script>
// --- Embedded Beneficiary Data from PDF ---
${dataJs}

// --- Application Logic ---
${appJs}
</script>
`;

html = html.replace('<script src="data.js"></script>\n  <script src="app.js"></script>', scriptBundle);
html = html.replace('<script src="data.js"></script>\r\n  <script src="app.js"></script>', scriptBundle);

const targetPath = path.join(rootDir, 'Index_AppsScript.html');
fs.writeFileSync(targetPath, html, 'utf8');
console.log('Successfully created standalone Index_AppsScript.html for Google Apps Script, size:', (fs.statSync(targetPath).size / 1024).toFixed(1), 'KB');
