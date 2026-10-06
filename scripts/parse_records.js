const fs = require('fs');

const raw = fs.readFileSync('extracted_text.txt', 'utf8');
const lines = raw.split(/\r?\n/);

const records = [];
const errors = [];

for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue;

    if (line.startsWith('MVY')) {
        // split by tab
        const rawParts = line.split('\t').map(p => p.trim());
        
        // Find applicantNo (part starting with MVY)
        const appNo = rawParts[0].split(/\s+/)[0];
        
        // Find Aadhaar index: regex /^\*{6,8}\d{4}$/ or contains '****'
        let aadhaarIdx = -1;
        for (let j = 1; j < rawParts.length; j++) {
            if (/^\*{6,8}\d{4}$/.test(rawParts[j])) {
                aadhaarIdx = j;
                break;
            }
        }
        
        if (aadhaarIdx === -1) {
            // maybe aadhaar is within one of the parts
            for (let j = 1; j < rawParts.length; j++) {
                const m = rawParts[j].match(/\*{4,8}\d{4}/);
                if (m) {
                    aadhaarIdx = j;
                    break;
                }
            }
        }

        if (aadhaarIdx !== -1) {
            // Name is everything between index 0 and aadhaarIdx, concatenated
            let nameParts = [];
            // If rawParts[0] had more than appNo
            const restOf0 = rawParts[0].substring(appNo.length).trim();
            if (restOf0) nameParts.push(restOf0);

            for (let k = 1; k < aadhaarIdx; k++) {
                if (rawParts[k]) nameParts.push(rawParts[k]);
            }
            const name = nameParts.join(' ').replace(/\s+/g, ' ').trim();

            const aadhaarMatch = rawParts[aadhaarIdx].match(/\*{4,8}\d{4}/);
            const aadhaar = aadhaarMatch ? aadhaarMatch[0] : rawParts[aadhaarIdx];

            // Project, Sector, Anganwadi are after aadhaarIdx
            const afterAadhaar = [];
            // check if anything after aadhaarMatch in the same part
            const afterInAadhaarPart = rawParts[aadhaarIdx].replace(aadhaar, '').trim();
            if (afterInAadhaarPart) afterAadhaar.push(afterInAadhaarPart);

            for (let k = aadhaarIdx + 1; k < rawParts.length; k++) {
                if (rawParts[k]) afterAadhaar.push(rawParts[k]);
            }

            if (afterAadhaar.length >= 3) {
                const project = afterAadhaar[0];
                const sector = afterAadhaar[1];
                const anganwadi = afterAadhaar.slice(2).join(' ');
                records.push({
                    applicantNo: appNo,
                    name: name,
                    aadhaar: aadhaar,
                    project: project,
                    sector: sector,
                    anganwadi: anganwadi
                });
            } else if (afterAadhaar.length === 2) {
                records.push({
                    applicantNo: appNo,
                    name: name,
                    aadhaar: aadhaar,
                    project: afterAadhaar[0],
                    sector: afterAadhaar[1],
                    anganwadi: ''
                });
            } else {
                errors.push({ lineNum: i, line, reason: 'Less than 2 parts after aadhaar', afterAadhaar });
            }
        } else {
            errors.push({ lineNum: i, line, reason: 'Aadhaar not found' });
        }
    }
}

console.log('Total records parsed:', records.length);
console.log('Errors:', errors.length);
if (errors.length > 0) {
    console.log('Errors detail:', errors);
}

// Check distinct projects
const projects = {};
records.forEach(r => { projects[r.project] = (projects[r.project] || 0) + 1; });
console.log('Projects distribution:', projects);

// Check distinct sectors
const sectors = {};
records.forEach(r => { sectors[r.sector] = (sectors[r.sector] || 0) + 1; });
console.log('Total sectors count:', Object.keys(sectors).length);

// Save cleaned json
fs.writeFileSync('beneficiaries.json', JSON.stringify(records, null, 2), 'utf8');
console.log('Saved to beneficiaries.json');
