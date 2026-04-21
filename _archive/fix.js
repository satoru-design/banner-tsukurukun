const fs = require('fs');
let text = fs.readFileSync('src/app/page.tsx', 'utf-8');
text = text.replace(/fontSize: `\$\{el\.textStyle\.fontSize\}px`/g, "fontSize: `${el.textStyle.fontSize}px`");
text = text.replace(/\\`\\\$\{el\.textStyle\.fontSize\}px\\`/g, "`${el.textStyle.fontSize}px`");
text = text.replace(/\\`\\\$/g, "`$");

fs.writeFileSync('src/app/page.tsx', text, 'utf-8');
console.log("Fixed!");
