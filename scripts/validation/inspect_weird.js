const fs = require('fs');

const raw = fs.readFileSync('extracted_text.txt', 'utf8');
const lines = raw.split(/\r?\n/);

const weird = [];
for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    if (line.startsWith('MVY')) {
        const parts = line.split('\t').map(p => p.trim());
        if (parts[3] && (parts[3].startsWith('****') || /[\u0900-\u097F]/.test(parts[3]))) {
            weird.push({ lineNum: i, line, parts });
        }
    }
}

console.log('Total weird lines:', weird.length);
console.log('Sample weird lines (up to 5):');
for (let w of weird.slice(0, 5)) {
    console.log('Line ' + w.lineNum + ':', w.line);
    console.log('Parts:', w.parts);
    console.log('---');
}
