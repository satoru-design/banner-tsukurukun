const fs = require('fs');
let content = fs.readFileSync('src/app/page.tsx', 'utf-8');

content = content.replace(/onClickCapture=\{\(e\) =>/g, "onClickCapture={(e: any) =>");

fs.writeFileSync('src/app/page.tsx', content, 'utf-8');
console.log("Fixed e type");
