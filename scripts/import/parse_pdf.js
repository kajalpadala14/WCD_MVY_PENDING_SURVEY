const fs = require('fs');
const { PDFParse } = require('pdf-parse');

async function run() {
    const buffer = fs.readFileSync('MVY_pending _survey - Worksheet.pdf');
    const parser = new PDFParse({ data: buffer });
    await parser.load();
    const textResult = await parser.getText();
    console.log("Pages processed:", textResult.pages?.length || 'unknown');
    console.log("Text length:", textResult.text?.length);
    fs.writeFileSync('extracted_text.txt', textResult.text, 'utf8');
    console.log("Preview first 1500 chars:\n" + textResult.text.substring(0, 1500));
    await parser.destroy();
}

run().catch(console.error);
