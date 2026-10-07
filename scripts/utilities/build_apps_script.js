const fs = require('fs');
const path = require('path');

const rootDir = path.join(__dirname, '..', '..');
const css = fs.readFileSync(path.join(rootDir, 'src', 'frontend', 'style.css'), 'utf8');
const appJs = fs.readFileSync(path.join(rootDir, 'src', 'frontend', 'app.js'), 'utf8');
let html = fs.readFileSync(path.join(rootDir, 'src', 'frontend', 'index.html'), 'utf8');

// Replace <link rel="stylesheet" href="style.css"> with <style>...</style>
html = html.replace('<link rel="stylesheet" href="style.css">', `<style>\n${css}\n</style>`);

// Replace <script src="app.js"></script>
const scriptBundle = `
<script>
// --- Application Logic (100% Dynamic from Google Sheets) ---
${appJs}
</script>
`;

html = html.replace('<script src="app.js"></script>', scriptBundle);

const targetRoot = path.join(rootDir, 'Index_AppsScript.html');
const targetSrc = path.join(rootDir, 'src', 'apps-script', 'Index_AppsScript.html');

fs.writeFileSync(targetRoot, html, 'utf8');
fs.writeFileSync(targetSrc, html, 'utf8');
console.log('Successfully created Index_AppsScript.html in root and src/apps-script, size:', (fs.statSync(targetRoot).size / 1024).toFixed(1), 'KB');
