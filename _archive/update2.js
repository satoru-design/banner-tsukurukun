const fs = require('fs');
let content = fs.readFileSync('src/app/page.tsx', 'utf-8');

// Replace CTA style (using RegExp without template literals issues)
content = content.replace(/style={{ color: el\.textStyle\.color, backgroundColor: el\.textStyle\.backgroundColor, fontSize: `\$\{el\.textStyle\.fontSize\}px`, fontWeight: el\.textStyle\.fontWeight, textAlign: el\.textStyle\.textAlign }}/g,
  `style={{ fontFamily: el.textStyle.fontFamily, textShadow: el.textStyle.textShadow, WebkitTextStroke: \`\${el.textStyle.textStrokeWidth || 0}px \${el.textStyle.textStrokeColor || 'transparent'}\`, color: el.textStyle.color, backgroundColor: el.textStyle.backgroundColor, fontSize: \`\${el.textStyle.fontSize}px\`, fontWeight: el.textStyle.fontWeight, textAlign: el.textStyle.textAlign }}`
);

fs.writeFileSync('src/app/page.tsx', content, 'utf-8');
console.log("Updated advanced styles!");
